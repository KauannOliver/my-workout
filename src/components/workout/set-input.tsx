"use client";

import { Check, Copy, Flame, RotateCcw, ShieldCheck, SkipForward } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/field";
import { setInputSchema } from "@/db/schema";
import { saveSet } from "@/db/repositories/workouts";
import type { ExerciseLog, SetLog } from "@/types/models";
import { useWorkoutUiStore } from "@/stores/workout-ui";

interface SetInputProps {
  log: ExerciseLog;
  previous?: SetLog;
  steps: number[];
  loadFactor?: number;
  increment?: number;
  defaultBackPain?: number;
  vibrationEnabled?: boolean;
  onSaved?: (set: SetLog, advancesRound: boolean) => void;
}

const roundToIncrement = (value: number, increment: number) => increment > 0 ? Math.max(0, Math.round(value / increment) * increment) : Math.max(0, value);

export function SetInput({ log, previous, steps, loadFactor = 1, increment = .5, defaultBackPain = 0, vibrationEnabled = true, onSaved }: SetInputProps) {
  const suggestedWeight = useMemo(() => previous ? roundToIncrement(previous.weight * loadFactor, increment) : 0, [increment, loadFactor, previous]);
  const [weight, setWeight] = useState(suggestedWeight);
  const [reps, setReps] = useState(previous?.reps ?? log.minReps);
  const [rir, setRir] = useState(log.targetRir);
  const [technique, setTechnique] = useState<SetLog["technique"]>("good");
  const [backPain, setBackPain] = useState(defaultBackPain);
  const [rangeReduced, setRangeReduced] = useState(false);
  const [warmup, setWarmup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const { setLastSetId } = useWorkoutUiStore();

  const submit = async (status: SetLog["status"] = "completed") => {
    const parsed = setInputSchema.safeParse({ weight, reps, rir, technique });
    if (status === "completed" && !parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revise os valores da série."); return; }
    setError(undefined); setSaving(true);
    try {
      const set = await saveSet({ exerciseLogId: log.id, sessionId: log.sessionId, exerciseId: log.exerciseId, setNumber: log.completedSets + 1, type: warmup ? "warmup" : "working", weight, reps, rir, status, technique, rangeOfMotionReduced: rangeReduced, backPain });
      setLastSetId(set.id); if (vibrationEnabled) navigator.vibrate?.(45); onSaved?.(set, !warmup);
    } finally { setSaving(false); }
  };

  return <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">
    <div className="mb-3 flex items-center justify-between"><p className="font-black">Série {log.completedSets + 1} de {log.targetSets}</p><label className="flex items-center gap-2 text-sm text-slate-500"><input type="checkbox" checked={warmup} onChange={(event) => setWarmup(event.target.checked)} className="h-5 w-5 accent-green-600"/>Aquecimento</label></div>
    {previous && <button type="button" onClick={() => { setWeight(suggestedWeight); setReps(previous.reps); setRir(Math.max(log.targetRir, previous.rir)); }} className="mb-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 px-3 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"><Copy size={16}/>{loadFactor < 1 ? `Usar carga reduzida: ${suggestedWeight} kg` : `Repetir última: ${previous.weight} kg × ${previous.reps}`}</button>}
    {loadFactor < 1 && <p className="mb-3 rounded-2xl bg-blue-50 p-3 text-sm text-blue-900">Semana de redução: sugestão de {Math.round((1-loadFactor)*100)}% a menos na carga anterior.</p>}
    <div className="grid grid-cols-3 gap-2"><div><Label htmlFor={`weight-${log.id}`}>Carga</Label><Input id={`weight-${log.id}`} type="number" min="0" max="1000" inputMode="decimal" step="0.5" value={weight} onChange={(event) => setWeight(Number(event.target.value))} className="px-2 text-center text-lg font-black"/></div><div><Label htmlFor={`reps-${log.id}`}>Reps</Label><Input id={`reps-${log.id}`} type="number" min="0" max="200" inputMode="numeric" value={reps} onChange={(event) => setReps(Number(event.target.value))} className="px-2 text-center text-lg font-black"/></div><div><Label htmlFor={`rir-${log.id}`}>RIR</Label><Select id={`rir-${log.id}`} value={rir} onChange={(event) => setRir(Number(event.target.value))} className="px-2 text-center text-lg font-black">{[0,1,2,3,4,5].map((value) => <option key={value}>{value}</option>)}</Select></div></div>
    <div className="mt-3 grid grid-cols-6 gap-1">{steps.map((step) => <button type="button" key={step} onClick={() => setWeight((value) => Math.max(0, value + step))} className="min-h-11 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{step > 0 ? `+${step}` : step}</button>)}</div>
    <details className="mt-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-700"><summary className="cursor-pointer font-semibold"><ShieldCheck className="mr-2 inline text-green-600" size={17}/>Técnica e segurança</summary><div className="mt-4 space-y-4"><div><Label htmlFor={`technique-${log.id}`}>Qualidade técnica</Label><Select id={`technique-${log.id}`} value={technique} onChange={(event) => setTechnique(event.target.value as SetLog["technique"])}><option value="excellent">Excelente</option><option value="good">Boa</option><option value="fair">Regular</option><option value="poor">Ruim</option></Select></div><div><div className="flex justify-between text-sm font-semibold"><label htmlFor={`pain-${log.id}`}>Dor lombar nesta série</label><span>{backPain}/10</span></div><input id={`pain-${log.id}`} type="range" min="0" max="10" value={backPain} onChange={(event) => setBackPain(Number(event.target.value))} className="mt-2 w-full accent-green-600"/></div><label className="flex min-h-12 items-center gap-3 rounded-2xl bg-slate-50 p-3 text-sm dark:bg-slate-800"><input type="checkbox" checked={rangeReduced} onChange={(event) => setRangeReduced(event.target.checked)} className="h-5 w-5 accent-green-600"/>Precisei reduzir a amplitude</label></div></details>
    <FieldError>{error}</FieldError>
    <Button className="mt-4 w-full" size="lg" disabled={saving || (!warmup && log.completedSets >= log.targetSets)} onClick={() => submit()}>{saving ? <RotateCcw className="animate-spin"/> : <Check/>}Concluir e salvar</Button>
    <button type="button" disabled={saving} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 text-sm font-semibold text-slate-500" onClick={() => submit("skipped")}><SkipForward size={16}/>Marcar série como não realizada</button>
    {previous?.personalRecord && <p className="mt-2 flex items-center justify-center gap-1 text-sm font-bold text-amber-600"><Flame size={16}/>Última série foi recorde pessoal</p>}
  </div>;
}
