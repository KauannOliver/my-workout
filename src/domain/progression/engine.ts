import type { SetLog } from "@/types/models";

export interface ProgressionResult {
  action: "fill" | "maintain" | "confirm" | "increase" | "reduce" | "blocked";
  reason: string;
  suggestedWeight?: number;
}

interface ProgressionInput {
  currentSets: SetLog[];
  previousQualified: boolean;
  targetRir: number;
  minReps: number;
  maxReps: number;
  backPain: number;
  increment: number;
}

export function evaluateProgression(input: ProgressionInput): ProgressionResult {
  const skipped = input.currentSets.some((set) => set.type === "working" && set.status === "skipped");
  const sets = input.currentSets.filter((set) => set.type === "working" && set.status === "completed");
  if (skipped) return { action: "blocked", reason: "Houve uma série não realizada; complete o volume planejado antes de aumentar a carga." };
  if (!sets.length) return { action: "fill", reason: "Conclua as séries de trabalho para receber uma recomendação." };
  if (input.backPain >= 4) return { action: "blocked", reason: "Progressão bloqueada porque a dor lombar foi 4 ou mais." };
  if (sets.some((set) => (set.backPain ?? 0) >= 4)) return { action: "blocked", reason: "Progressão bloqueada porque houve dor 4 ou mais durante uma série." };
  if (sets.some((set) => set.technique === "poor" || set.rangeOfMotionReduced)) return { action: "blocked", reason: "Mantenha a carga e consolide técnica e amplitude." };
  if (sets.some((set) => set.rir < input.targetRir)) return { action: "reduce", reason: "O RIR ficou abaixo da meta; reduza de 5% a 10% ou repita com mais controle." };
  if (sets.some((set) => set.reps < input.minReps)) return { action: "reduce", reason: "Houve série abaixo da faixa mínima de repetições." };
  const qualified = sets.every((set) => set.reps >= input.maxReps);
  if (!qualified) return { action: "maintain", reason: "Mantenha a carga e some repetições dentro da faixa." };
  if (!input.previousQualified) return { action: "confirm", reason: "Topo da faixa atingido. Confirme o resultado na próxima aparição." };
  const weight = Math.max(...sets.map((set) => set.weight));
  return { action: "increase", reason: "Topo da faixa confirmado em duas aparições consecutivas com técnica e RIR adequados.", suggestedWeight: weight + input.increment };
}
