import { describe, expect, it } from "vitest";
import { evaluateProgression } from "@/domain/progression/engine";
import type { SetLog } from "@/types/models";

const set = (changes: Partial<SetLog> = {}): SetLog => ({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), recordVersion: 1, exerciseLogId: "log", sessionId: "session", exerciseId: "exercise", setNumber: 1, type: "working", weight: 20, reps: 12, rir: 2, status: "completed", completedAt: new Date().toISOString(), technique: "good", rangeOfMotionReduced: false, personalRecord: false, ...changes });
const base = { targetRir: 2, minReps: 8, maxReps: 12, backPain: 0, increment: 2.5 };

describe("dupla progressão", () => {
  it("pede confirmação na primeira aparição qualificada", () => expect(evaluateProgression({ ...base, currentSets: [set(), set({setNumber:2})], previousQualified: false }).action).toBe("confirm"));
  it("recomenda aumento após duas aparições", () => expect(evaluateProgression({ ...base, currentSets: [set(), set({setNumber:2})], previousQualified: true })).toMatchObject({ action: "increase", suggestedWeight: 22.5 }));
  it("bloqueia aumento com dor elevada", () => expect(evaluateProgression({ ...base, currentSets: [set()], previousQualified: true, backPain: 4 }).action).toBe("blocked"));
  it("bloqueia aumento quando a dor aparece durante uma série", () => expect(evaluateProgression({ ...base, currentSets: [set({backPain:4})], previousQualified: true }).action).toBe("blocked"));
  it("bloqueia aumento com técnica ruim", () => expect(evaluateProgression({ ...base, currentSets: [set({technique:"poor"})], previousQualified: true }).action).toBe("blocked"));
  it("reduz quando RIR fica abaixo da meta", () => expect(evaluateProgression({ ...base, currentSets: [set({rir:1})], previousQualified: false }).action).toBe("reduce"));
  it("mantém carga enquanto soma repetições", () => expect(evaluateProgression({ ...base, currentSets: [set({reps:10})], previousQualified: false }).action).toBe("maintain"));
  it("bloqueia aumento quando uma série não é realizada", () => expect(evaluateProgression({ ...base, currentSets: [set(), set({setNumber:2,status:"skipped",completedAt:undefined})], previousQualified: true }).action).toBe("blocked"));
});
