import { getDb } from "@/db/database";
import type { OnboardingData } from "@/db/schema";
import { createBase, nowIso, uuid } from "@/lib/records";

export async function completeOnboarding(data: OnboardingData) {
  const db = getDb();
  const profileId = uuid();
  const programId = uuid();
  const settings = await db.appSettings.toCollection().first();
  const templates = await db.workoutTemplates.orderBy("order").toArray();
  await db.transaction("rw", [db.profiles, db.programs, db.workoutTemplates, db.bodyMeasurements, db.notificationPreferences, db.appSettings], async () => {
    const currentSettings = await db.appSettings.toCollection().first();
    if (currentSettings?.onboardingCompleted && await db.profiles.count() > 0) return;
    await db.profiles.add({
      ...createBase(profileId), name: data.name, sex: data.sex, birthDate: data.birthDate, height: data.height,
      targetWeight: data.targetWeight, bodyFat: data.bodyFat === "" ? undefined : data.bodyFat,
      experienceLevel: data.experienceLevel, preferredWorkoutDays: data.preferredWorkoutDays,
      preferredWorkoutTime: data.preferredWorkoutTime, preferredCardio: data.preferredCardio,
      trainingLocation: data.trainingLocation, primaryGoal: data.primaryGoal,
      hasBackDiscomfort: data.hasBackDiscomfort, initialBackPain: data.initialBackPain,
    });
    await db.programs.add({ ...createBase(programId), name: "Meu Treino — 12 semanas", kind: "standard-12-week", durationWeeks: 12, weeklyGoal: 4, startDate: nowIso().slice(0, 10), currentRotation: "A", currentTemplateId: templates[0]?.id, status: "active" });
    for (const template of templates) await db.workoutTemplates.update(template.id, { programId, active: true, updatedAt: nowIso(), recordVersion: template.recordVersion + 1 });
    await db.bodyMeasurements.add({ ...createBase(), profileId, measuredAt: nowIso(), weight: data.currentWeight, bodyFat: data.bodyFat === "" ? undefined : data.bodyFat });
    await db.notificationPreferences.add({ ...createBase(), profileId, type: "motivation", enabled: data.notificationsEnabled, time: data.notificationTime, days: data.preferredWorkoutDays, quietStart: "22:00", quietEnd: "07:00" });
    if (currentSettings ?? settings) {
      const target = currentSettings ?? settings!;
      await db.appSettings.update(target.id, { onboardingCompleted: true, weightUnit: data.weightUnit, databaseVersion: 2, updatedAt: nowIso(), recordVersion: target.recordVersion + 1 });
    }
  });
}
