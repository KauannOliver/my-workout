import type { ExerciseLog, SetLog, WorkoutStatus } from "@/types/models";

export interface SessionCompletion {
  plannedSets: number;
  completedSets: number;
  skippedSets: number;
  completionRate: number;
  status: Extract<WorkoutStatus, "completed" | "partial" | "abandoned">;
  advancesRotation: boolean;
}

export function calculateSessionCompletion(logs: ExerciseLog[], sets: SetLog[], quickMode: boolean): SessionCompletion {
  const plannedSets = logs.reduce((total, log) => total + log.targetSets, 0);
  const workingSets = sets.filter((set) => set.type === "working");
  const completedSets = workingSets.filter((set) => set.status === "completed").length;
  const skippedSets = workingSets.filter((set) => set.status === "skipped").length + logs.filter((log) => log.skipped).reduce((total, log) => total + Math.max(0, log.targetSets - log.completedSets), 0);
  const completionRate = plannedSets ? Math.min(1, completedSets / plannedSets) : 0;
  const abandoned = completedSets === 0;
  return {
    plannedSets,
    completedSets,
    skippedSets,
    completionRate,
    status: abandoned ? "abandoned" : quickMode || completedSets < plannedSets || skippedSets > 0 ? "partial" : "completed",
    advancesRotation: !abandoned,
  };
}
