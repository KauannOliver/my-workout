import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ExerciseBlock } from "@/types/models";

interface WorkoutUiState {
  restEndsAt?: number;
  restTotalSeconds: number;
  restBlock?: ExerciseBlock;
  restRound?: number;
  restNextExercise?: string;
  lastSetId?: string;
  startRest: (seconds: number, context?: { block: ExerciseBlock; round: number; nextExercise?: string }) => void;
  extendRest: (seconds: number) => void;
  skipRest: () => void;
  setLastSetId: (id?: string) => void;
  resetWorkoutUi: () => void;
}

export const useWorkoutUiStore = create<WorkoutUiState>()(persist((set) => ({
  restTotalSeconds: 0,
  startRest: (seconds, context) => set({ restEndsAt: Date.now() + seconds * 1000, restTotalSeconds: seconds, restBlock: context?.block, restRound: context?.round, restNextExercise: context?.nextExercise }),
  extendRest: (seconds) => set((state) => ({ restEndsAt: Math.max(Date.now(), state.restEndsAt ?? Date.now()) + seconds * 1000, restTotalSeconds: state.restTotalSeconds + seconds })),
  skipRest: () => set({ restEndsAt: undefined, restTotalSeconds: 0, restBlock: undefined, restRound: undefined, restNextExercise: undefined }),
  setLastSetId: (id) => set({ lastSetId: id }),
  resetWorkoutUi: () => set({ restEndsAt: undefined, restTotalSeconds: 0, restBlock: undefined, restRound: undefined, restNextExercise: undefined, lastSetId: undefined }),
}), { name: "meu-treino-workout-ui" }));
