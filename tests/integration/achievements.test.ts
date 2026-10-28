import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteAllLocalData, getDb, initializeDatabase } from "@/db/database";
import { refreshAchievements } from "@/domain/achievements/evaluate";
import { createBase } from "@/lib/records";

beforeEach(async () => {
  await deleteAllLocalData();
  await initializeDatabase();
});

afterEach(async () => {
  await getDb().delete();
});

describe("conquistas", () => {
  it("desbloqueia o primeiro treino e exige três sessões na mesma semana", async () => {
    const db = getDb();
    const base = {
      programId: "program", workoutTemplateId: "template", workoutCode: "A" as const,
      workoutName: "Treino A", week: 1, phase: "Reaclimatação", pausedDurationSeconds: 0,
      status: "completed" as const, quickMode: false, energyBefore: 7, backPainBefore: 0,
    };
    await db.workoutSessions.bulkAdd([
      { ...createBase(), ...base, startedAt: "2026-08-03T12:00:00.000Z" },
      { ...createBase(), ...base, startedAt: "2026-08-05T12:00:00.000Z" },
    ]);
    await refreshAchievements();

    const first = await db.achievementDefinitions.where("code").equals("first-workout").first();
    const minimum = await db.achievementDefinitions.where("code").equals("minimum-week").first();
    expect((await db.userAchievements.where("achievementId").equals(first!.id).first())?.unlockedAt).toBeTruthy();
    expect((await db.userAchievements.where("achievementId").equals(minimum!.id).first())?.progress).toBe(2);

    await db.workoutSessions.add({ ...createBase(), ...base, workoutCode: "B", startedAt: "2026-08-07T12:00:00.000Z" });
    await refreshAchievements();
    expect((await db.userAchievements.where("achievementId").equals(minimum!.id).first())?.unlockedAt).toBeTruthy();
  });
});
