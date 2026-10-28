import { z } from "zod";

export const onboardingSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome"),
  sex: z.enum(["female", "male", "other", "not-informed"]),
  birthDate: z.string().min(1, "Informe sua data de nascimento"),
  height: z.coerce.number().min(100).max(250),
  currentWeight: z.coerce.number().min(30).max(400),
  targetWeight: z.coerce.number().min(30).max(400),
  bodyFat: z.union([z.coerce.number().min(2).max(70), z.literal("")]).optional(),
  experienceLevel: z.enum(["beginner", "intermediate", "advanced"]),
  preferredWorkoutDays: z.array(z.number().int().min(0).max(6)).min(1),
  preferredWorkoutTime: z.string().regex(/^\d{2}:\d{2}$/),
  preferredCardio: z.string().min(1),
  trainingLocation: z.string().trim().min(2),
  primaryGoal: z.string().trim().min(2),
  hasBackDiscomfort: z.boolean(),
  initialBackPain: z.coerce.number().int().min(0).max(10),
  notificationsEnabled: z.boolean(),
  notificationTime: z.string().regex(/^\d{2}:\d{2}$/),
  weightUnit: z.enum(["kg", "lb"]),
});

export type OnboardingInput = z.input<typeof onboardingSchema>;
export type OnboardingData = z.output<typeof onboardingSchema>;

export const setInputSchema = z.object({
  weight: z.coerce.number().min(0).max(1000),
  reps: z.coerce.number().int().min(0).max(200),
  rir: z.coerce.number().int().min(0).max(10),
  technique: z.enum(["poor", "fair", "good", "excellent"]),
});

export const measurementSchema = z.object({
  weight: z.coerce.number().min(30).max(400),
  bodyFat: z.union([z.coerce.number().min(2).max(70), z.literal("")]).optional(),
  waist: z.union([z.coerce.number().min(20).max(300), z.literal("")]).optional(),
  abdomen: z.union([z.coerce.number().min(20).max(300), z.literal("")]).optional(),
  arm: z.union([z.coerce.number().min(10).max(100), z.literal("")]).optional(),
  chest: z.union([z.coerce.number().min(20).max(300), z.literal("")]).optional(),
  hip: z.union([z.coerce.number().min(20).max(300), z.literal("")]).optional(),
  thigh: z.union([z.coerce.number().min(10).max(150), z.literal("")]).optional(),
  calf: z.union([z.coerce.number().min(10).max(100), z.literal("")]).optional(),
  notes: z.string().max(1000).optional(),
});

export const backupEnvelopeSchema = z.object({
  format: z.literal("meu-treino-backup"),
  schemaVersion: z.number().int().positive(),
  exportedAt: z.iso.datetime(),
  checksum: z.string().min(8),
  data: z.record(z.string(), z.array(z.unknown())),
});
