import { startOfWeek } from "date-fns";
import { getDb } from "@/db/database";
import { createBase, nowIso } from "@/lib/records";

export async function refreshAchievements() {
  const db = getDb();
  const [definitions, sessions, sets, current] = await Promise.all([db.achievementDefinitions.toArray(), db.workoutSessions.orderBy("startedAt").toArray(), db.setLogs.orderBy("completedAt").toArray(), db.userAchievements.toArray()]);
  const valid = sessions.filter((session) => ["completed", "partial"].includes(session.status));
  const full = sessions.filter((session) => session.status === "completed");
  const standardValid = valid.filter((session) => (session.programKind ?? "standard-12-week") === "standard-12-week");
  const standardFull = full.filter((session) => (session.programKind ?? "standard-12-week") === "standard-12-week");
  const weekKeys = valid.map((session) => startOfWeek(new Date(session.startedAt), { weekStartsOn: 1 }).toISOString().slice(0, 10));
  const activeWeeks = new Set(weekKeys).size;
  const bestWeek = Math.max(0, ...weekKeys.map((week) => weekKeys.filter((candidate) => candidate === week).length));
  const hasIncrease = [...new Set(sets.map((set) => set.exerciseId))].some((exerciseId) => { const values = sets.filter((set) => set.exerciseId === exerciseId && set.type === "working" && set.status === "completed").map((set) => set.weight); return values.some((value, index) => index > 0 && value > Math.max(...values.slice(0, index))); });
  const hasReturn = valid.some((session, index) => index > 0 && new Date(session.startedAt).getTime() - new Date(valid[index - 1].startedAt).getTime() >= 7 * 86400_000);
  const progress: Record<string, number> = {
    "first-workout": valid.length, "minimum-week": Math.min(3, bestWeek), "full-rotation": Math.min(4, new Set(standardFull.map((session) => session.workoutCode)).size),
    "four-weeks": activeWeeks, "first-increase": hasIncrease ? 1 : 0, "ten-records": sets.filter((set) => set.personalRecord).length,
    "fast-workout": full.some((session) => (session.totalDurationSeconds ?? Infinity) < 2700) ? 1 : 0, "return": hasReturn ? 1 : 0,
    "deload": standardValid.some((session) => [4, 8].includes(session.week)) ? 1 : 0, "twelve-weeks": standardValid.some((session) => session.week === 12) ? 12 : Math.max(0, ...standardValid.map((session) => session.week)),
  };
  await db.transaction("rw", db.userAchievements, async () => {
    for (const definition of definitions) {
      const value = Math.min(definition.target, progress[definition.code] ?? 0); const record = current.find((item) => item.achievementId === definition.id);
      if (record) await db.userAchievements.update(record.id, { progress: value, unlockedAt: record.unlockedAt ?? (value >= definition.target ? nowIso() : undefined), updatedAt: nowIso(), recordVersion: record.recordVersion + 1 });
      else await db.userAchievements.add({ ...createBase(), achievementId: definition.id, progress: value, unlockedAt: value >= definition.target ? nowIso() : undefined });
    }
  });
}
