import Dexie, { type EntityTable } from "dexie";
import { WEEK_RULES } from "@/domain/program/rules";
import { createBase } from "@/lib/records";
import type {
  AchievementDefinition, AppSettings, BodyMeasurement, CardioLog, Exercise, ExerciseLog,
  MutationJournalEntry, NotificationInboxItem, NotificationPreference, Profile, Program,
  ProgramWeekRule, ProgressPhoto, SetLog, UserAchievement, WorkoutSession, WorkoutTemplate,
  WorkoutTemplateItem, WorkoutBlock,
} from "@/types/models";
import { SEED_ACHIEVEMENTS, SEED_BLOCKS, SEED_EXERCISES, SEED_TEMPLATE_ITEMS, SEED_TEMPLATES } from "./seed/program";
import { EXERCISE_CATALOG } from "./seed/exercise-catalog.generated";

const normalizeExerciseName = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim();

async function ensureExerciseCatalog(db: MeuTreinoDatabase) {
  const existing = await db.exercises.toArray();
  const names = new Map<string, Exercise>();
  for (const exercise of existing) {
    names.set(normalizeExerciseName(exercise.name), exercise);
    for (const alias of exercise.aliases ?? []) names.set(normalizeExerciseName(alias), exercise);
  }
  const additions: Exercise[] = [];
  for (const catalogExercise of EXERCISE_CATALOG) {
    const match = names.get(normalizeExerciseName(catalogExercise.name))
      ?? catalogExercise.aliases?.map((alias) => names.get(normalizeExerciseName(alias))).find(Boolean);
    if (!match) {
      additions.push(catalogExercise);
      names.set(normalizeExerciseName(catalogExercise.name), catalogExercise);
      continue;
    }
    if (match.source === "catalog") continue;
    const enriched: Exercise = {
      ...catalogExercise,
      id: match.id,
      name: match.name,
      aliases: [...new Set([...(catalogExercise.aliases ?? []), catalogExercise.name, ...(match.aliases ?? [])])].filter((alias) => normalizeExerciseName(alias) !== normalizeExerciseName(match.name)),
      createdAt: match.createdAt,
      updatedAt: match.updatedAt,
      recordVersion: match.recordVersion,
      loadIncrement: match.loadIncrement,
      active: match.active,
      favorite: match.favorite,
      custom: match.custom,
    };
    additions.push(enriched);
    names.set(normalizeExerciseName(enriched.name), enriched);
  }
  if (additions.length) await db.exercises.bulkPut(additions);
}

export class MeuTreinoDatabase extends Dexie {
  profiles!: EntityTable<Profile, "id">;
  appSettings!: EntityTable<AppSettings, "id">;
  programs!: EntityTable<Program, "id">;
  programWeekRules!: Dexie.Table<ProgramWeekRule, number>;
  exercises!: EntityTable<Exercise, "id">;
  workoutTemplates!: EntityTable<WorkoutTemplate, "id">;
  workoutBlocks!: EntityTable<WorkoutBlock, "id">;
  workoutTemplateItems!: EntityTable<WorkoutTemplateItem, "id">;
  workoutSessions!: EntityTable<WorkoutSession, "id">;
  exerciseLogs!: EntityTable<ExerciseLog, "id">;
  setLogs!: EntityTable<SetLog, "id">;
  cardioLogs!: EntityTable<CardioLog, "id">;
  bodyMeasurements!: EntityTable<BodyMeasurement, "id">;
  progressPhotos!: EntityTable<ProgressPhoto, "id">;
  notificationPreferences!: EntityTable<NotificationPreference, "id">;
  notificationInbox!: EntityTable<NotificationInboxItem, "id">;
  achievementDefinitions!: EntityTable<AchievementDefinition, "id">;
  userAchievements!: EntityTable<UserAchievement, "id">;
  mutationJournal!: EntityTable<MutationJournalEntry, "id">;

  constructor() {
    super("MeuTreinoDB");
    this.version(1).stores({
      profiles: "id, name, updatedAt",
      appSettings: "id, onboardingCompleted",
      programs: "id, status, startDate",
      programWeekRules: "week, phase",
      exercises: "id, name, muscleGroup, active, custom",
      workoutTemplates: "id, code, order",
      workoutTemplateItems: "id, workoutTemplateId, exerciseId, block, order, active",
      workoutSessions: "id, programId, workoutTemplateId, workoutCode, status, startedAt, finishedAt, week",
      exerciseLogs: "id, sessionId, exerciseId, templateItemId, block, order",
      setLogs: "id, exerciseLogId, sessionId, exerciseId, completedAt, personalRecord",
      cardioLogs: "id, sessionId, type",
      bodyMeasurements: "id, profileId, measuredAt, weight",
      progressPhotos: "id, measurementId, type",
      notificationPreferences: "id, profileId, type, enabled",
      notificationInbox: "id, kind, scheduledFor, readAt",
      achievementDefinitions: "id, &code",
      userAchievements: "id, achievementId, unlockedAt",
      mutationJournal: "id, table, recordId, synced, createdAt",
    });
    this.version(2).stores({
      profiles: "id, name, updatedAt",
      appSettings: "id, onboardingCompleted",
      programs: "id, status, kind, startDate",
      programWeekRules: "week, phase",
      exercises: "id, name, muscleGroup, *muscleGroups, backDemand, active, custom, favorite",
      workoutTemplates: "id, programId, [programId+order], code, order, active",
      workoutBlocks: "id, workoutTemplateId, [workoutTemplateId+order], active",
      workoutTemplateItems: "id, workoutTemplateId, blockId, [blockId+orderInBlock], exerciseId, active",
      workoutSessions: "id, programId, workoutTemplateId, workoutCode, status, startedAt, finishedAt, week",
      exerciseLogs: "id, sessionId, exerciseId, templateItemId, blockId, block, order",
      setLogs: "id, exerciseLogId, sessionId, exerciseId, completedAt, personalRecord",
      cardioLogs: "id, sessionId, type",
      bodyMeasurements: "id, profileId, measuredAt, weight",
      progressPhotos: "id, measurementId, type",
      notificationPreferences: "id, profileId, type, enabled",
      notificationInbox: "id, kind, scheduledFor, readAt",
      achievementDefinitions: "id, &code",
      userAchievements: "id, achievementId, unlockedAt",
      mutationJournal: "id, table, recordId, synced, createdAt",
    }).upgrade(async (transaction) => {
      const programs = await transaction.table("programs").toArray() as Program[];
      const templates = await transaction.table("workoutTemplates").toArray() as WorkoutTemplate[];
      const items = await transaction.table("workoutTemplateItems").toArray() as WorkoutTemplateItem[];
      const standardProgram = programs.find((program) => program.status === "active") ?? programs[0];

      for (const program of programs) {
        const programTemplates = templates.filter((template) => !template.programId || template.programId === program.id);
        const current = programTemplates.find((template) => template.code === program.currentRotation) ?? programTemplates[0];
        await transaction.table("programs").update(program.id, {
          kind: program.kind ?? "standard-12-week",
          durationWeeks: program.durationWeeks ?? 12,
          weeklyGoal: program.weeklyGoal ?? 4,
          currentTemplateId: program.currentTemplateId ?? current?.id,
        });
      }

      const migratedBlocks: WorkoutBlock[] = [];
      for (const template of templates) {
        const templateItems = items.filter((item) => item.workoutTemplateId === template.id);
        const ownerId = template.programId ?? standardProgram?.id;
        await transaction.table("workoutTemplates").update(template.id, { programId: ownerId, active: template.active ?? true, cardioProtocol: template.cardioProtocol ?? "continuous" });
        const legacyCodes = [...new Set(templateItems.map((item) => item.block))];
        for (let blockIndex = 0; blockIndex < legacyCodes.length; blockIndex += 1) {
          const code = legacyCodes[blockIndex];
          const id = `legacy-block:${template.id}:${code}`;
          const blockItems = templateItems.filter((item) => item.block === code).sort((a, b) => a.order - b.order);
          migratedBlocks.push({
            ...createBase(id), workoutTemplateId: template.id, name: `Bloco ${code}`, order: blockIndex,
            rounds: 2, restSeconds: blockItems.at(-1)?.restSeconds ?? 60,
            quickModeIncluded: code !== "C", active: true,
            legacyCode: ["A", "B", "C"].includes(code) ? code as "A" | "B" | "C" : undefined,
          });
          for (let itemIndex = 0; itemIndex < blockItems.length; itemIndex += 1) {
            await transaction.table("workoutTemplateItems").update(blockItems[itemIndex].id, { blockId: id, orderInBlock: itemIndex, targetRir: blockItems[itemIndex].targetRir ?? 2 });
          }
        }
      }
      if (migratedBlocks.length) await transaction.table("workoutBlocks").bulkPut(migratedBlocks);
      await transaction.table("appSettings").toCollection().modify({ databaseVersion: 2 });
    });
  }
}

let database: MeuTreinoDatabase | undefined;

export function getDb() {
  if (typeof window === "undefined" && typeof indexedDB === "undefined") throw new Error("IndexedDB está disponível apenas no cliente.");
  database ??= new MeuTreinoDatabase();
  return database;
}

export async function initializeDatabase() {
  const db = getDb();
  await db.open();
  await db.transaction("rw", [db.programWeekRules, db.exercises, db.workoutTemplates, db.workoutBlocks, db.workoutTemplateItems, db.achievementDefinitions, db.appSettings], async () => {
    if ((await db.programWeekRules.count()) === 0) await db.programWeekRules.bulkPut(WEEK_RULES);
    if ((await db.exercises.count()) === 0) await db.exercises.bulkPut(SEED_EXERCISES);
    await ensureExerciseCatalog(db);
    if ((await db.workoutTemplates.count()) === 0) await db.workoutTemplates.bulkPut(SEED_TEMPLATES);
    if ((await db.workoutBlocks.count()) === 0) await db.workoutBlocks.bulkPut(SEED_BLOCKS);
    if ((await db.workoutTemplateItems.count()) === 0) await db.workoutTemplateItems.bulkPut(SEED_TEMPLATE_ITEMS);
    if ((await db.achievementDefinitions.count()) === 0) await db.achievementDefinitions.bulkPut(SEED_ACHIEVEMENTS);
    if ((await db.appSettings.count()) === 0) {
      await db.appSettings.add({
        ...createBase("50000000-0000-4000-8000-000000000001"), theme: "light", weightUnit: "kg",
        soundEnabled: true, vibrationEnabled: true, reducedMotion: false, onboardingCompleted: false,
        demoMode: false, loadSteps: [-10, -5, -2.5, 2.5, 5, 10], databaseVersion: 2,
      });
    }
  });
  return db;
}

export async function deleteAllLocalData() {
  const db = getDb();
  await db.delete();
  database = undefined;
  await initializeDatabase();
}
