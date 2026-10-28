"use client";

import { formatDuration } from "@/lib/utils";
import { useElapsed } from "@/hooks/use-elapsed";

export function WorkoutTimer({ startedAt, pausedAt, pausedDurationSeconds }: { startedAt: string; pausedAt?: string; pausedDurationSeconds: number }) {
  const elapsed = useElapsed(startedAt, pausedAt, pausedDurationSeconds);
  return <span className="font-black tabular-nums" aria-label={`Tempo de treino ${formatDuration(elapsed)}`}>{formatDuration(elapsed)}</span>;
}
