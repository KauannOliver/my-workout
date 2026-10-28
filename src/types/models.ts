export type UUID = string;
export type ISODate = string;
export type WorkoutCode = "A" | "B" | "C" | "D" | "E" | "F" | "G";
export type WorkoutStatus = "active" | "paused" | "completed" | "partial" | "abandoned";
export type LegacyExerciseBlock = "A" | "B" | "C";
export type ExerciseBlock = string;
export type WeightUnit = "kg" | "lb";
export type ProgramKind = "standard-12-week" | "custom";
export type BackDemand = "very-low" | "low" | "moderate" | "high" | "very-high";
export type CardioProtocol = "none" | "continuous" | "interval-30-60" | "interval-45-75" | "custom";

export interface BaseRecord {
  id: UUID;
  createdAt: ISODate;
  updatedAt: ISODate;
  recordVersion: number;
}

export interface Profile extends BaseRecord {
  name: string;
  sex: "female" | "male" | "other" | "not-informed";
  birthDate: string;
  height: number;
  targetWeight: number;
  bodyFat?: number;
  experienceLevel: "beginner" | "intermediate" | "advanced";
  preferredWorkoutDays: number[];
  preferredWorkoutTime: string;
  preferredCardio: string;
  trainingLocation: string;
  primaryGoal: string;
  hasBackDiscomfort: boolean;
  initialBackPain: number;
}

export interface AppSettings extends BaseRecord {
  theme: "light" | "dark" | "system";
  weightUnit: WeightUnit;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  reducedMotion: boolean;
  onboardingCompleted: boolean;
  demoMode: boolean;
  loadSteps: number[];
  databaseVersion: number;
  lastBackupAt?: ISODate;
}

export interface Program extends BaseRecord {
  name: string;
  kind?: ProgramKind;
  durationWeeks?: number;
  startDate: string;
  currentRotation?: WorkoutCode;
  currentTemplateId?: UUID;
  weeklyGoal?: number;
  status: "draft" | "active" | "completed" | "paused" | "archived";
}

export interface ProgramWeekRule {
  week: number;
  phase: "Reaclimatação" | "Redução técnica" | "Construção" | "Redução de fadiga" | "Intensificação" | "Consolidação";
  weeklyGoal: 3 | 4;
  setsByBlock: Record<LegacyExerciseBlock, number>;
  targetRir: number;
  loadFactor: number;
  cardio: "continuous" | "interval-30-60" | "interval-45-75";
  note: string;
}

export interface Exercise extends BaseRecord {
  name: string;
  muscleGroup: string;
  muscleGroups?: string[];
  equipment: string;
  instructions: string;
  backCare: string;
  alternatives: string[];
  aliases?: string[];
  defaultMinReps?: number;
  defaultMaxReps?: number;
  defaultPrescription?: string;
  defaultRestSeconds?: number;
  backDemand?: BackDemand;
  technicalLevel?: "beginner" | "intermediate" | "advanced";
  source?: "catalog" | "legacy" | "custom";
  loadIncrement: number;
  active: boolean;
  custom: boolean;
  favorite: boolean;
}

export interface WorkoutTemplate extends BaseRecord {
  programId?: UUID;
  code: WorkoutCode;
  name: string;
  description: string;
  order: number;
  active?: boolean;
  cardioProtocol?: CardioProtocol;
  cardioTargetMinutes?: number;
}

export interface WorkoutBlock extends BaseRecord {
  workoutTemplateId: UUID;
  name: string;
  order: number;
  rounds: number;
  restSeconds: number;
  quickModeIncluded: boolean;
  active: boolean;
  legacyCode?: LegacyExerciseBlock;
}

export interface WorkoutTemplateItem extends BaseRecord {
  workoutTemplateId: UUID;
  exerciseId: UUID;
  blockId?: UUID;
  block: ExerciseBlock;
  order: number;
  orderInBlock?: number;
  minReps: number;
  maxReps: number;
  targetRir?: number;
  restSeconds: number;
  notes: string;
  originalExerciseId: UUID;
  active: boolean;
}

export interface WorkoutSession extends BaseRecord {
  programId: UUID;
  workoutTemplateId: UUID;
  workoutCode: WorkoutCode;
  workoutName: string;
  programKind?: ProgramKind;
  week: number;
  phase: string;
  startedAt: ISODate;
  finishedAt?: ISODate;
  pausedAt?: ISODate;
  pausedDurationSeconds: number;
  status: WorkoutStatus;
  quickMode: boolean;
  totalDurationSeconds?: number;
  cardioDurationSeconds?: number;
  energyBefore: number;
  sleepHoursBefore?: number;
  plannedWorkingSets?: number;
  completedWorkingSets?: number;
  completionRate?: number;
  enjoymentAfter?: number;
  backPainBefore: number;
  backPainAfter?: number;
  techniqueRating?: "poor" | "fair" | "good" | "excellent";
  notes?: string;
}

export interface ExerciseLog extends BaseRecord {
  sessionId: UUID;
  exerciseId: UUID;
  templateItemId: UUID;
  exerciseName: string;
  blockId?: UUID;
  block: ExerciseBlock;
  blockName?: string;
  blockOrder?: number;
  positionInBlock?: number;
  exercisesInBlock?: number;
  order: number;
  minReps: number;
  maxReps: number;
  targetRir: number;
  targetSets: number;
  restSeconds: number;
  completedSets: number;
  skipped: boolean;
  notes?: string;
}

export interface SetLog extends BaseRecord {
  exerciseLogId: UUID;
  sessionId: UUID;
  exerciseId: UUID;
  setNumber: number;
  type: "warmup" | "working";
  weight: number;
  reps: number;
  rir: number;
  status: "completed" | "skipped";
  completedAt?: ISODate;
  technique: "poor" | "fair" | "good" | "excellent";
  rangeOfMotionReduced: boolean;
  backPain?: number;
  personalRecord: boolean;
}

export interface CardioLog extends BaseRecord {
  sessionId: UUID;
  type: string;
  durationSeconds: number;
  distance?: number;
  speed?: number;
  incline?: number;
  level?: number;
  averageHeartRate?: number;
  calories?: number;
  rpe: number;
  notes?: string;
}

export interface BodyMeasurement extends BaseRecord {
  profileId: UUID;
  measuredAt: ISODate;
  weight: number;
  bodyFat?: number;
  arm?: number;
  chest?: number;
  waist?: number;
  abdomen?: number;
  hip?: number;
  thigh?: number;
  calf?: number;
  notes?: string;
}

export interface ProgressPhoto extends BaseRecord {
  measurementId: UUID;
  type: "front" | "side" | "back";
  blob: Blob;
  mimeType: string;
}

export interface NotificationPreference extends BaseRecord {
  profileId: UUID;
  type: string;
  enabled: boolean;
  time: string;
  days: number[];
  quietStart: string;
  quietEnd: string;
}

export interface NotificationInboxItem extends BaseRecord {
  title: string;
  body: string;
  kind: string;
  scheduledFor: ISODate;
  readAt?: ISODate;
}

export interface AchievementDefinition extends BaseRecord {
  code: string;
  name: string;
  description: string;
  target: number;
  icon: string;
}

export interface UserAchievement extends BaseRecord {
  achievementId: UUID;
  progress: number;
  unlockedAt?: ISODate;
}

export interface MutationJournalEntry extends BaseRecord {
  table: string;
  recordId: UUID;
  operation: "create" | "update" | "delete";
  synced: boolean;
}
