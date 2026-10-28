import { describe, expect, it } from "vitest";
import { calculateSessionCompletion } from "@/domain/workout/completion";
import { createBase } from "@/lib/records";
import type { ExerciseLog, SetLog } from "@/types/models";

const log = (id: string, completedSets = 0, skipped = false): ExerciseLog => ({ ...createBase(id), sessionId: "session", exerciseId: id, templateItemId: id, exerciseName: id, block: "A", order: 0, minReps: 8, maxReps: 12, targetRir: 2, targetSets: 2, restSeconds: 90, completedSets, skipped });
const set = (id: string, status: "completed" | "skipped" = "completed"): SetLog => ({ ...createBase(id), exerciseLogId: "A1", sessionId: "session", exerciseId: "A1", setNumber: 1, type: "working", weight: 20, reps: 10, rir: 2, status, technique: "good", rangeOfMotionReduced: false, personalRecord: false });

describe("conclusão da sessão", () => {
  it("marca como concluída somente com todo o volume", () => expect(calculateSessionCompletion([log("A1", 2)], [set("s1"), set("s2")], false)).toMatchObject({ status: "completed", completionRate: 1, advancesRotation: true }));
  it("marca treino incompleto como parcial positivo", () => expect(calculateSessionCompletion([log("A1", 1)], [set("s1")], false)).toMatchObject({ status: "partial", completionRate: .5, advancesRotation: true }));
  it("não avança rotação quando nenhuma série foi feita", () => expect(calculateSessionCompletion([log("A1")], [], false)).toMatchObject({ status: "abandoned", advancesRotation: false }));
  it("mantém treino rápido como parcial mesmo completo", () => expect(calculateSessionCompletion([log("A1", 2)], [set("s1"), set("s2")], true).status).toBe("partial"));
});
