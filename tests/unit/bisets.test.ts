import { describe, expect, it } from "vitest";
import { buildBisetGroups, getCurrentBisetStep, getStepAfterWorkingSet, shouldRestAfterWorkingSet } from "@/domain/workout/bisets";
import { createBase } from "@/lib/records";
import type { ExerciseLog } from "@/types/models";

function log(id: string, block: string, order: number, completedSets = 0, skipped = false): ExerciseLog {
  return { ...createBase(id), sessionId: "session", exerciseId: id, templateItemId: id, exerciseName: id, block, order, minReps: 8, maxReps: 12, targetRir: 3, targetSets: 2, restSeconds: 90, completedSets, skipped };
}

describe("fluxo dos bisets", () => {
  it("faz exercício 1, exercício 2, descansa e volta ao exercício 1", () => {
    const logs = [log("A1", "A", 0), log("A2", "A", 1), log("B1", "B", 2), log("B2", "B", 3)];
    expect(getCurrentBisetStep(logs)).toMatchObject({ log: { id: "A1" }, round: 1, position: 1 });
    expect(shouldRestAfterWorkingSet(logs, "A1")).toBe(false);
    expect(getStepAfterWorkingSet(logs, "A1")).toMatchObject({ log: { id: "A2" }, round: 1, position: 2 });
    const afterA1 = logs.map((item) => item.id === "A1" ? { ...item, completedSets: 1 } : item);
    expect(shouldRestAfterWorkingSet(afterA1, "A2")).toBe(true);
    expect(getStepAfterWorkingSet(afterA1, "A2")).toMatchObject({ log: { id: "A1" }, round: 2, position: 1 });
  });

  it("só avança ao bloco seguinte depois de todas as rodadas do par", () => {
    const logs = [log("A1", "A", 0, 2), log("A2", "A", 1, 1), log("B1", "B", 2), log("B2", "B", 3)];
    expect(getStepAfterWorkingSet(logs, "A2")).toMatchObject({ block: "B", log: { id: "B1" }, round: 1 });
    expect(buildBisetGroups(logs)[0]).toMatchObject({ block: "A", completedRounds: 1, complete: false });
  });

  it("mantém descanso por rodada quando um exercício inteiro é desativado", () => {
    const logs = [log("A1", "A", 0), log("A2", "A", 1, 0, true)];
    expect(shouldRestAfterWorkingSet(logs, "A1")).toBe(true);
    expect(getStepAfterWorkingSet(logs, "A1")).toMatchObject({ log: { id: "A1" }, round: 2 });
  });

  it("executa circuito com sete exercícios e descansa somente depois do último", () => {
    const logs = Array.from({ length: 7 }, (_, index) => log(`C${index + 1}`, "circuito", index));
    expect(buildBisetGroups(logs)[0].logs).toHaveLength(7);
    expect(shouldRestAfterWorkingSet(logs, "C1")).toBe(false);
    expect(shouldRestAfterWorkingSet(logs, "C7")).toBe(true);
    const afterSix = logs.map((item, index) => index < 6 ? { ...item, completedSets: 1 } : item);
    expect(getCurrentBisetStep(afterSix)).toMatchObject({ log: { id: "C7" }, round: 1, position: 7, exercisesInRound: 7 });
  });

  it("descansa após cada série em bloco simples", () => {
    const logs = [log("S1", "simples", 0)];
    expect(shouldRestAfterWorkingSet(logs, "S1")).toBe(true);
    expect(getStepAfterWorkingSet(logs, "S1")).toMatchObject({ log: { id: "S1" }, round: 2 });
  });
});
