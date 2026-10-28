import { differenceInCalendarWeeks, startOfDay } from "date-fns";
import type { ProgramWeekRule, WorkoutCode } from "@/types/models";

export const WEEK_RULES: ProgramWeekRule[] = Array.from({ length: 12 }, (_, index) => {
  const week = index + 1;
  if (week <= 2) return { week, phase: "Reaclimatação", weeklyGoal: 3, setsByBlock: { A: 2, B: 2, C: 2 }, targetRir: 4, loadFactor: 1, cardio: "continuous", note: "Volte ao ritmo sem comparar cargas antigas." };
  if (week === 3) return { week, phase: "Reaclimatação", weeklyGoal: 4, setsByBlock: { A: 2, B: 2, C: 2 }, targetRir: 3, loadFactor: 1, cardio: "continuous", note: "Consolide a técnica e a frequência." };
  if (week === 4) return { week, phase: "Redução técnica", weeklyGoal: 3, setsByBlock: { A: 1, B: 1, C: 1 }, targetRir: 4, loadFactor: 0.875, cardio: "continuous", note: "Menos volume também faz parte do progresso." };
  if (week <= 7) return { week, phase: "Construção", weeklyGoal: 4, setsByBlock: { A: 3, B: 2, C: 2 }, targetRir: week === 5 ? 3 : 2, loadFactor: 1, cardio: "interval-30-60", note: "Aumente repetições antes de aumentar a carga." };
  if (week === 8) return { week, phase: "Redução de fadiga", weeklyGoal: 3, setsByBlock: { A: 2, B: 1, C: 1 }, targetRir: 4, loadFactor: 0.875, cardio: "continuous", note: "Recupere para voltar mais consistente." };
  if (week <= 11) return { week, phase: "Intensificação", weeklyGoal: 4, setsByBlock: { A: 3, B: 3, C: 2 }, targetRir: week === 9 ? 2 : 1, loadFactor: 1, cardio: "interval-45-75", note: "Intensidade com técnica, nunca até a falha." };
  return { week, phase: "Consolidação", weeklyGoal: 4, setsByBlock: { A: 3, B: 3, C: 2 }, targetRir: 2, loadFactor: 1, cardio: "continuous", note: "Busque recordes de repetições sem testar 1RM." };
});

export function getProgramWeek(startDate: string, now = new Date()): number {
  const elapsed = differenceInCalendarWeeks(startOfDay(now), startOfDay(new Date(`${startDate}T00:00:00`)), { weekStartsOn: 1 });
  return Math.min(12, Math.max(1, elapsed + 1));
}

export const getWeekRule = (week: number) => WEEK_RULES[Math.min(12, Math.max(1, week)) - 1];

export const WORKOUT_CODES: WorkoutCode[] = ["A", "B", "C", "D", "E", "F", "G"];

export function nextWorkout(code: WorkoutCode, availableCodes: WorkoutCode[] = WORKOUT_CODES): WorkoutCode {
  const codes: WorkoutCode[] = availableCodes.length ? availableCodes : ["A"];
  const currentIndex = codes.indexOf(code);
  return codes[(currentIndex < 0 ? 0 : currentIndex + 1) % codes.length];
}
