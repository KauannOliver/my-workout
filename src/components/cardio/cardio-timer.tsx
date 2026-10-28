"use client";

import { Pause, Play, RotateCcw, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/utils";
import { cardioElapsed, useCardioStore } from "@/stores/cardio-ui";

type Protocol = "continuous" | "interval-30-60" | "interval-45-75";
type Phase = { label: string; seconds: number; intensity: "Leve" | "Forte" };

function phases(protocol: Protocol, quick: boolean, targetSeconds?: number): Phase[] {
  if (quick) return [{ label: "Cardio leve", seconds: 600, intensity: "Leve" }];
  if (protocol === "interval-30-60") return [{ label: "Aquecimento", seconds: 180, intensity: "Leve" }, ...Array.from({length: 6}, (_, index) => [{label: `Forte ${index + 1}/6`, seconds: 30, intensity: "Forte" as const}, {label: `Recuperação ${index + 1}/6`, seconds: 60, intensity: "Leve" as const}]).flat(), { label: "Desaquecimento", seconds: 180, intensity: "Leve" }];
  if (protocol === "interval-45-75") return [{ label: "Aquecimento", seconds: 180, intensity: "Leve" }, ...Array.from({length: 5}, (_, index) => [{label: `Forte ${index + 1}/5`, seconds: 45, intensity: "Forte" as const}, {label: `Recuperação ${index + 1}/5`, seconds: 75, intensity: "Leve" as const}]).flat(), { label: "Desaquecimento", seconds: 120, intensity: "Leve" }];
  return [{ label: "Cardio contínuo", seconds: targetSeconds ?? 900, intensity: "Leve" }];
}

export function CardioTimer({ protocol, quick, targetSeconds, onDuration }: { protocol: Protocol; quick: boolean; targetSeconds?: number; onDuration: (seconds: number) => void }) {
  const store = useCardioStore();
  const [now, setNow] = useState(0);
  const lastPhase = useRef(-1);
  const sequence = useMemo(() => phases(protocol, quick, targetSeconds), [protocol, quick, targetSeconds]);
  const total = sequence.reduce((sum, phase) => sum + phase.seconds, 0);
  const elapsed = store.startedAt ? cardioElapsed(store) : store.finishedElapsed;
  const currentIndex = sequence.findIndex((_, index) => elapsed < sequence.slice(0, index + 1).reduce((sum, phase) => sum + phase.seconds, 0));
  const index = currentIndex === -1 ? sequence.length - 1 : currentIndex;
  const before = sequence.slice(0, index).reduce((sum, phase) => sum + phase.seconds, 0);
  const phase = sequence[index];
  const phaseRemaining = Math.max(0, phase.seconds - (elapsed - before));
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 250); return () => window.clearInterval(timer); }, []);
  useEffect(() => { void now; if (store.startedAt && index !== lastPhase.current) { if (lastPhase.current >= 0) navigator.vibrate?.([100,60,100]); lastPhase.current = index; } if (store.startedAt && elapsed >= total) { const value = store.finish(); onDuration(value); navigator.vibrate?.([150,80,150]); } }, [elapsed, index, now, onDuration, store, total]);
  const finish = () => { const value = store.finish(); onDuration(value); };
  return <div className={`rounded-3xl p-5 text-white ${phase.intensity === "Forte" ? "bg-amber-600" : "bg-slate-950"}`}><div className="flex items-start justify-between"><div><p className="text-sm font-semibold opacity-75">{phase.intensity}</p><h3 className="text-xl font-black">{phase.label}</h3></div><span className="text-sm font-bold">{formatDuration(Math.max(0, total - elapsed))} total</span></div><div className="my-7 text-center"><p className="text-6xl font-black tabular-nums" aria-live="polite">{formatDuration(phaseRemaining)}</p><div className="mx-auto mt-4 h-2 max-w-xs overflow-hidden rounded-full bg-white/20"><div className="h-full bg-white" style={{ width: `${Math.min(100, elapsed / total * 100)}%` }}/></div></div><div className="grid grid-cols-2 gap-2">{!store.startedAt && !store.finishedElapsed && <Button variant="secondary" className="col-span-2" onClick={store.start}><Play/>Iniciar cardio</Button>}{store.startedAt && !store.pausedAt && <Button variant="secondary" onClick={store.pause}><Pause/>Pausar</Button>}{store.startedAt && store.pausedAt && <Button variant="secondary" onClick={store.resume}><Play/>Retomar</Button>}{store.startedAt && <Button variant="ghost" className="text-white" onClick={finish}><Square/>Encerrar</Button>}{store.finishedElapsed > 0 && <Button variant="secondary" className="col-span-2" onClick={() => { store.reset(); onDuration(0); }}><RotateCcw/>Reiniciar</Button>}</div></div>;
}
