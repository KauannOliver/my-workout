import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CardioState {
  startedAt?: number;
  pausedAt?: number;
  accumulatedPause: number;
  finishedElapsed: number;
  start: () => void;
  pause: () => void;
  resume: () => void;
  finish: () => number;
  reset: () => void;
}

const elapsed = (state: Pick<CardioState, "startedAt" | "pausedAt" | "accumulatedPause">) => state.startedAt ? Math.max(0, Math.floor(((state.pausedAt ?? Date.now()) - state.startedAt - state.accumulatedPause) / 1000)) : 0;

export const useCardioStore = create<CardioState>()(persist((set, get) => ({
  accumulatedPause: 0, finishedElapsed: 0,
  start: () => set({ startedAt: Date.now(), pausedAt: undefined, accumulatedPause: 0, finishedElapsed: 0 }),
  pause: () => set({ pausedAt: Date.now() }),
  resume: () => set((state) => ({ accumulatedPause: state.accumulatedPause + (state.pausedAt ? Date.now() - state.pausedAt : 0), pausedAt: undefined })),
  finish: () => { const value = elapsed(get()); set({ finishedElapsed: value, startedAt: undefined, pausedAt: undefined, accumulatedPause: 0 }); return value; },
  reset: () => set({ startedAt: undefined, pausedAt: undefined, accumulatedPause: 0, finishedElapsed: 0 }),
}), { name: "meu-treino-cardio" }));

export const cardioElapsed = elapsed;
