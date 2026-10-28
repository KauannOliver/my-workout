import type { ExerciseLog } from "@/types/models";

const groupKey = (log: ExerciseLog) => log.blockId ?? log.block;
const groupOrder = (log: ExerciseLog) => log.blockOrder ?? (Number.parseInt(log.block, 36) || log.order);

export function getGroupKind(exerciseCount: number) {
  if (exerciseCount <= 1) return "Série simples";
  if (exerciseCount === 2) return "Biset";
  if (exerciseCount === 3) return "Triset";
  return `Circuito · ${exerciseCount} exercícios`;
}

export interface WorkoutGroup {
  id: string;
  block: string;
  name: string;
  logs: ExerciseLog[];
  targetRounds: number;
  completedRounds: number;
  complete: boolean;
}

export interface WorkoutStep {
  block: string;
  groupId: string;
  log: ExerciseLog;
  round: number;
  targetRounds: number;
  position: number;
  exercisesInRound: number;
}

export type BisetGroup = WorkoutGroup;
export type BisetStep = WorkoutStep;

export function buildBisetGroups(logs: ExerciseLog[]): WorkoutGroup[] {
  const keys = [...new Set(logs.map(groupKey))];
  return keys.map((id) => {
    const blockLogs = logs
      .filter((log) => groupKey(log) === id)
      .sort((a, b) => (a.positionInBlock ?? a.order) - (b.positionInBlock ?? b.order));
    const active = blockLogs.filter((log) => !log.skipped);
    const targetRounds = Math.max(0, ...blockLogs.map((log) => log.targetSets));
    const completedRounds = active.length === 0
      ? targetRounds
      : Math.min(...active.map((log) => Math.min(log.completedSets, log.targetSets)));
    return {
      id,
      block: blockLogs[0]?.block ?? id,
      name: blockLogs[0]?.blockName ?? `Bloco ${blockLogs[0]?.block ?? ""}`.trim(),
      logs: blockLogs,
      targetRounds,
      completedRounds,
      complete: blockLogs.length > 0 && blockLogs.every((log) => log.skipped || log.completedSets >= log.targetSets),
    };
  }).sort((a, b) => groupOrder(a.logs[0]) - groupOrder(b.logs[0]));
}

export function getCurrentBisetStep(logs: ExerciseLog[]): WorkoutStep | undefined {
  for (const group of buildBisetGroups(logs)) {
    const active = group.logs.filter((log) => !log.skipped);
    for (let round = 1; round <= group.targetRounds; round += 1) {
      const exercisesInRound = active.filter((log) => round <= log.targetSets);
      for (let position = 0; position < exercisesInRound.length; position += 1) {
        const log = exercisesInRound[position];
        if (log.completedSets < round) {
          return { block: group.block, groupId: group.id, log, round, targetRounds: group.targetRounds, position: position + 1, exercisesInRound: exercisesInRound.length };
        }
      }
    }
  }
  return undefined;
}

export function shouldRestAfterWorkingSet(logs: ExerciseLog[], logId: string): boolean {
  const log = logs.find((item) => item.id === logId);
  if (!log || log.skipped) return false;
  const round = log.completedSets + 1;
  const participants = logs
    .filter((item) => groupKey(item) === groupKey(log) && !item.skipped && item.targetSets >= round)
    .sort((a, b) => (a.positionInBlock ?? a.order) - (b.positionInBlock ?? b.order));
  return participants.at(-1)?.id === logId;
}

export function getStepAfterWorkingSet(logs: ExerciseLog[], logId: string): WorkoutStep | undefined {
  return getCurrentBisetStep(logs.map((log) => log.id === logId ? { ...log, completedSets: log.completedSets + 1 } : log));
}
