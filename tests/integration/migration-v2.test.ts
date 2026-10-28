import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { MeuTreinoDatabase } from "@/db/database";

let upgraded: MeuTreinoDatabase | undefined;
afterEach(async () => { await upgraded?.delete(); upgraded = undefined; });

describe("migração Dexie v1 para v2", () => {
  it("preserva sessão ativa, série, recorde, foto e todos os IDs", async () => {
    const legacy = new Dexie("MeuTreinoDB");
    legacy.version(1).stores({
      profiles: "id, name, updatedAt", appSettings: "id, onboardingCompleted", programs: "id, status, startDate", programWeekRules: "week, phase",
      exercises: "id, name, muscleGroup, active, custom", workoutTemplates: "id, code, order", workoutTemplateItems: "id, workoutTemplateId, exerciseId, block, order, active",
      workoutSessions: "id, programId, workoutTemplateId, workoutCode, status, startedAt, finishedAt, week", exerciseLogs: "id, sessionId, exerciseId, templateItemId, block, order",
      setLogs: "id, exerciseLogId, sessionId, exerciseId, completedAt, personalRecord", cardioLogs: "id, sessionId, type", bodyMeasurements: "id, profileId, measuredAt, weight",
      progressPhotos: "id, measurementId, type", notificationPreferences: "id, profileId, type, enabled", notificationInbox: "id, kind, scheduledFor, readAt",
      achievementDefinitions: "id, &code", userAchievements: "id, achievementId, unlockedAt", mutationJournal: "id, table, recordId, synced, createdAt",
    });
    await legacy.open();
    const timestamp = new Date().toISOString();
    const base = (id: string) => ({ id, createdAt: timestamp, updatedAt: timestamp, recordVersion: 1 });
    await legacy.table("programs").add({ ...base("program-v1"), name: "Ciclo original", startDate: "2026-08-01", currentRotation: "A", status: "active" });
    await legacy.table("workoutTemplates").add({ ...base("template-v1"), code: "A", name: "Treino A", description: "", order: 1 });
    await legacy.table("exercises").add({ ...base("exercise-v1"), name: "Supino", muscleGroup: "Peitoral", equipment: "Barra", instructions: "", backCare: "", alternatives: [], loadIncrement: 2.5, active: true, custom: false, favorite: true });
    await legacy.table("workoutTemplateItems").add({ ...base("item-v1"), workoutTemplateId: "template-v1", exerciseId: "exercise-v1", originalExerciseId: "exercise-v1", block: "A", order: 0, minReps: 8, maxReps: 12, restSeconds: 90, notes: "", active: true });
    await legacy.table("workoutSessions").add({ ...base("session-v1"), programId: "program-v1", workoutTemplateId: "template-v1", workoutCode: "A", workoutName: "Treino A", week: 1, phase: "Reaclimatação", startedAt: timestamp, pausedDurationSeconds: 0, status: "active", quickMode: false, energyBefore: 7, backPainBefore: 0 });
    await legacy.table("exerciseLogs").add({ ...base("log-v1"), sessionId: "session-v1", exerciseId: "exercise-v1", templateItemId: "item-v1", exerciseName: "Supino", block: "A", order: 0, minReps: 8, maxReps: 12, targetRir: 3, targetSets: 2, restSeconds: 90, completedSets: 1, skipped: false });
    await legacy.table("setLogs").add({ ...base("set-v1"), exerciseLogId: "log-v1", sessionId: "session-v1", exerciseId: "exercise-v1", setNumber: 1, type: "working", weight: 40, reps: 10, rir: 3, status: "completed", technique: "good", rangeOfMotionReduced: false, personalRecord: true, completedAt: timestamp });
    await legacy.table("progressPhotos").add({ ...base("photo-v1"), measurementId: "measurement-v1", type: "front", blob: new Blob(["photo"], { type: "image/webp" }), mimeType: "image/webp" });
    legacy.close();

    upgraded = new MeuTreinoDatabase(); await upgraded.open();
    expect(upgraded.verno).toBe(2);
    expect(await upgraded.workoutSessions.get("session-v1")).toMatchObject({ id: "session-v1", status: "active" });
    expect(await upgraded.setLogs.get("set-v1")).toMatchObject({ id: "set-v1", personalRecord: true });
    expect(await upgraded.progressPhotos.get("photo-v1")).toBeDefined();
    expect(await upgraded.workoutBlocks.count()).toBe(1);
    expect(await upgraded.workoutTemplateItems.get("item-v1")).toMatchObject({ blockId: "legacy-block:template-v1:A", orderInBlock: 0 });
    expect(await upgraded.programs.get("program-v1")).toMatchObject({ kind: "standard-12-week", currentTemplateId: "template-v1" });
  });
});
