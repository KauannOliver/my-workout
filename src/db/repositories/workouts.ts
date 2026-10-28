import { differenceInCalendarWeeks, startOfDay } from "date-fns";
import { getDb } from "@/db/database";
import { getNextTemplate, getProgramTemplates, resolveCurrentTemplate } from "@/db/repositories/plans";
import { getProgramWeek, getWeekRule } from "@/domain/program/rules";
import { createBase, nowIso } from "@/lib/records";
import type { CardioLog, SetLog, WorkoutSession } from "@/types/models";
import { refreshAchievements } from "@/domain/achievements/evaluate";
import { calculateSessionCompletion } from "@/domain/workout/completion";

export async function getActiveSession() {
  return getDb().workoutSessions.where("status").anyOf(["active", "paused"]).first();
}

export async function startWorkout(input: { energyBefore: number; backPainBefore: number; sleepHoursBefore?: number; quickMode: boolean }) {
  const db = getDb();
  const existing = await getActiveSession();
  if (existing) return existing;
  const program = await db.programs.where("status").equals("active").first();
  if (!program) throw new Error("Nenhum plano ativo encontrado.");
  const template = await resolveCurrentTemplate(program);
  if (!template) throw new Error("Ficha do próximo treino não encontrada.");

  const standard = (program.kind ?? "standard-12-week") === "standard-12-week";
  const week = standard
    ? getProgramWeek(program.startDate)
    : Math.max(1, differenceInCalendarWeeks(startOfDay(new Date()), startOfDay(new Date(`${program.startDate}T00:00:00`)), { weekStartsOn: 1 }) + 1);
  const rule = standard ? getWeekRule(week) : undefined;
  const blocks = (await db.workoutBlocks.where("workoutTemplateId").equals(template.id).sortBy("order")).filter((block) => block.active);
  const selectedBlocks = input.quickMode ? blocks.filter((block) => block.quickModeIncluded) : blocks;
  const selectedBlockIds = new Set(selectedBlocks.map((block) => block.id));
  const items = await db.workoutTemplateItems.where("workoutTemplateId").equals(template.id).sortBy("order");
  const selected = items.filter((item) => item.active && (item.blockId ? selectedBlockIds.has(item.blockId) : (!input.quickMode || item.block !== "C")));
  if (!selected.length) throw new Error(input.quickMode ? "Marque ao menos um bloco como essencial para usar o modo rápido." : "Esta ficha ainda não possui exercícios.");

  const exercises = new Map((await db.exercises.bulkGet(selected.map((item) => item.exerciseId))).filter(Boolean).map((exercise) => [exercise!.id, exercise!]));
  const blockMap = new Map(selectedBlocks.map((block) => [block.id, block]));
  const participantCounts = new Map<string, number>();
  for (const item of selected) {
    const key = item.blockId ?? item.block;
    participantCounts.set(key, (participantCounts.get(key) ?? 0) + 1);
  }

  const session: WorkoutSession = {
    ...createBase(), programId: program.id, workoutTemplateId: template.id, workoutCode: template.code,
    workoutName: template.name, programKind: program.kind ?? "standard-12-week", week,
    phase: rule?.phase ?? "Plano personalizado", startedAt: nowIso(), pausedDurationSeconds: 0,
    status: "active", quickMode: input.quickMode, energyBefore: input.energyBefore,
    sleepHoursBefore: input.sleepHoursBefore, backPainBefore: input.backPainBefore,
  };

  await db.transaction("rw", [db.workoutSessions, db.exerciseLogs, db.mutationJournal], async () => {
    await db.workoutSessions.add(session);
    await db.exerciseLogs.bulkAdd(selected.map((item) => {
      const block = item.blockId ? blockMap.get(item.blockId) : undefined;
      const legacyCode = block?.legacyCode ?? (item.block === "A" || item.block === "B" || item.block === "C" ? item.block : undefined);
      return {
        ...createBase(), sessionId: session.id, exerciseId: item.exerciseId, templateItemId: item.id,
        exerciseName: exercises.get(item.exerciseId)?.name ?? "Exercício", blockId: item.blockId,
        block: item.blockId ?? item.block, blockName: block?.name ?? `Bloco ${item.block}`,
        blockOrder: block?.order ?? 0, positionInBlock: item.orderInBlock ?? 0,
        exercisesInBlock: participantCounts.get(item.blockId ?? item.block) ?? 1, order: item.order,
        minReps: item.minReps, maxReps: item.maxReps,
        targetRir: rule?.targetRir ?? item.targetRir ?? 2,
        targetSets: rule && legacyCode ? rule.setsByBlock[legacyCode] : block?.rounds ?? 3,
        restSeconds: block?.restSeconds ?? item.restSeconds, completedSets: 0, skipped: false,
      };
    }));
    await db.mutationJournal.add({ ...createBase(), table: "workoutSessions", recordId: session.id, operation: "create", synced: false });
  });
  return session;
}

export async function saveSet(input: Omit<SetLog, "id" | "createdAt" | "updatedAt" | "recordVersion" | "personalRecord" | "completedAt">) {
  const db = getDb();
  const best = await db.setLogs.where("exerciseId").equals(input.exerciseId).filter((set) => set.status === "completed" && set.type === "working").toArray();
  const personalRecord = input.type === "working" && input.status === "completed" && (best.length === 0 || best.every((set) => input.weight > set.weight || (input.weight === set.weight && input.reps > set.reps)));
  const set: SetLog = { ...createBase(), ...input, personalRecord, completedAt: input.status === "completed" ? nowIso() : undefined };
  await db.transaction("rw", [db.setLogs, db.exerciseLogs, db.mutationJournal], async () => {
    await db.setLogs.add(set);
    const exerciseLog = await db.exerciseLogs.get(input.exerciseLogId);
    if (exerciseLog && input.type === "working") await db.exerciseLogs.update(exerciseLog.id, { completedSets: exerciseLog.completedSets + 1, updatedAt: nowIso(), recordVersion: exerciseLog.recordVersion + 1 });
    await db.mutationJournal.add({ ...createBase(), table: "setLogs", recordId: set.id, operation: "create", synced: false });
  });
  return set;
}

export async function undoSet(setId: string) {
  const db = getDb();
  const set = await db.setLogs.get(setId);
  if (!set) return;
  await db.transaction("rw", [db.setLogs, db.exerciseLogs], async () => {
    await db.setLogs.delete(setId);
    const log = await db.exerciseLogs.get(set.exerciseLogId);
    if (log && set.type === "working") await db.exerciseLogs.update(log.id, { completedSets: Math.max(0, log.completedSets - 1), updatedAt: nowIso(), recordVersion: log.recordVersion + 1 });
  });
}

export async function skipExercise(logId: string) {
  await getDb().exerciseLogs.update(logId, { skipped: true, updatedAt: nowIso() });
}

export async function togglePause(session: WorkoutSession) {
  const db = getDb();
  if (session.status === "paused") {
    const pauseSeconds = session.pausedAt ? Math.floor((Date.now() - new Date(session.pausedAt).getTime()) / 1000) : 0;
    await db.workoutSessions.update(session.id, { status: "active", pausedAt: undefined, pausedDurationSeconds: session.pausedDurationSeconds + pauseSeconds, updatedAt: nowIso() });
  } else {
    await db.workoutSessions.update(session.id, { status: "paused", pausedAt: nowIso(), updatedAt: nowIso() });
  }
}

export async function finishWorkout(input: { session: WorkoutSession; enjoymentAfter: number; backPainAfter: number; techniqueRating: "poor" | "fair" | "good" | "excellent"; notes?: string; cardio?: Omit<CardioLog, "id" | "createdAt" | "updatedAt" | "recordVersion" | "sessionId"> }) {
  const db = getDb();
  const finishedAt = nowIso();
  const currentPauseSeconds = input.session.status === "paused" && input.session.pausedAt ? Math.floor((Date.now() - new Date(input.session.pausedAt).getTime()) / 1000) : 0;
  const totalDurationSeconds = Math.max(0, Math.floor((Date.now() - new Date(input.session.startedAt).getTime()) / 1000) - input.session.pausedDurationSeconds - currentPauseSeconds);
  const [logs, sets] = await Promise.all([db.exerciseLogs.where("sessionId").equals(input.session.id).toArray(), db.setLogs.where("sessionId").equals(input.session.id).toArray()]);
  const completion = calculateSessionCompletion(logs, sets, input.session.quickMode);
  const status = completion.status;
  const program = await db.programs.get(input.session.programId);
  const templates = program ? await getProgramTemplates(program.id) : [];
  const nextTemplate = getNextTemplate(templates, input.session.workoutTemplateId);
  await db.transaction("rw", [db.workoutSessions, db.programs, db.cardioLogs, db.userAchievements, db.achievementDefinitions], async () => {
    await db.workoutSessions.update(input.session.id, {
      finishedAt, totalDurationSeconds, cardioDurationSeconds: input.cardio?.durationSeconds ?? 0,
      status, enjoymentAfter: input.enjoymentAfter, backPainAfter: input.backPainAfter, pausedAt: undefined,
      techniqueRating: input.techniqueRating, notes: input.notes, plannedWorkingSets: completion.plannedSets,
      completedWorkingSets: completion.completedSets, completionRate: completion.completionRate,
      updatedAt: finishedAt, recordVersion: input.session.recordVersion + 1,
    });
    if (input.cardio) await db.cardioLogs.add({ ...createBase(), ...input.cardio, sessionId: input.session.id });
    if (program && completion.advancesRotation && nextTemplate) await db.programs.update(program.id, { currentTemplateId: nextTemplate.id, currentRotation: nextTemplate.code, updatedAt: finishedAt, recordVersion: program.recordVersion + 1 });
    const first = await db.achievementDefinitions.where("code").equals("first-workout").first();
    if (completion.advancesRotation && first && !(await db.userAchievements.where("achievementId").equals(first.id).first())) await db.userAchievements.add({ ...createBase(), achievementId: first.id, progress: 1, unlockedAt: finishedAt });
  });
  await refreshAchievements();
  return input.session.id;
}

export async function duplicateSession(sessionId: string) {
  const db = getDb(); const source = await db.workoutSessions.get(sessionId); if (!source) throw new Error("Sessão não encontrada.");
  const sourceLogs = await db.exerciseLogs.where("sessionId").equals(sessionId).sortBy("order"); const sourceSets = await db.setLogs.where("sessionId").equals(sessionId).toArray(); const sourceCardio = await db.cardioLogs.where("sessionId").equals(sessionId).first();
  const session = { ...source, ...createBase(), startedAt: nowIso(), finishedAt: nowIso(), status: source.status === "partial" ? "partial" as const : "completed" as const, notes: source.notes ? `${source.notes} · sessão duplicada` : "Sessão duplicada" };
  await db.transaction("rw", [db.workoutSessions, db.exerciseLogs, db.setLogs, db.cardioLogs], async () => {
    await db.workoutSessions.add(session); const mapping = new Map<string,string>();
    for (const log of sourceLogs) { const copy = { ...log, ...createBase(), sessionId: session.id }; mapping.set(log.id, copy.id); await db.exerciseLogs.add(copy); }
    for (const set of sourceSets) await db.setLogs.add({ ...set, ...createBase(), sessionId: session.id, exerciseLogId: mapping.get(set.exerciseLogId)!, completedAt: nowIso(), personalRecord: false });
    if (sourceCardio) await db.cardioLogs.add({ ...sourceCardio, ...createBase(), sessionId: session.id });
  });
  await refreshAchievements(); return session.id;
}

export async function updateSessionNotes(sessionId: string, notes: string) { const session = await getDb().workoutSessions.get(sessionId); if (session) await getDb().workoutSessions.update(sessionId, { notes: notes.slice(0, 2000), updatedAt: nowIso(), recordVersion: session.recordVersion + 1 }); }

export async function deleteSession(sessionId: string) {
  const db = getDb();
  const logs = await db.exerciseLogs.where("sessionId").equals(sessionId).toArray();
  await db.transaction("rw", [db.workoutSessions, db.exerciseLogs, db.setLogs, db.cardioLogs], async () => {
    await db.setLogs.where("sessionId").equals(sessionId).delete();
    await db.exerciseLogs.bulkDelete(logs.map((log) => log.id));
    await db.cardioLogs.where("sessionId").equals(sessionId).delete();
    await db.workoutSessions.delete(sessionId);
  });
}
