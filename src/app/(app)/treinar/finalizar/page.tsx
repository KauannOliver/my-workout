"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { CheckCircle2, HeartPulse, SkipForward } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { CardioTimer } from "@/components/cardio/cardio-timer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { getDb } from "@/db/database";
import { finishWorkout } from "@/db/repositories/workouts";
import { getWeekRule } from "@/domain/program/rules";
import { calculateSessionCompletion } from "@/domain/workout/completion";
import { cn } from "@/lib/utils";
import { useCardioStore } from "@/stores/cardio-ui";
import { useWorkoutUiStore } from "@/stores/workout-ui";

export default function FinishWorkoutPage() {
  const router = useRouter();
  const [cardioDuration, setCardioDuration] = useState(0);
  const [skipCardio, setSkipCardio] = useState(false);
  const [cardioType, setCardioType] = useState("Esteira");
  const [rpe, setRpe] = useState(5);
  const [distance, setDistance] = useState(""); const [speed, setSpeed] = useState(""); const [incline, setIncline] = useState(""); const [level, setLevel] = useState(""); const [heartRate, setHeartRate] = useState(""); const [calories, setCalories] = useState("");
  const [enjoyment, setEnjoyment] = useState(8); const [pain, setPain] = useState(0); const [technique, setTechnique] = useState<"poor"|"fair"|"good"|"excellent">("good"); const [notes, setNotes] = useState(""); const [saving, setSaving] = useState(false);
  const resetCardio = useCardioStore((state) => state.reset);
  const resetWorkoutUi = useWorkoutUiStore((state) => state.resetWorkoutUi);
  const data = useLiveQuery(async () => { const db = getDb(); const session = await db.workoutSessions.where("status").anyOf(["active", "paused"]).first(); if (!session) return null; const [logs, sets, template] = await Promise.all([db.exerciseLogs.where("sessionId").equals(session.id).toArray(), db.setLogs.where("sessionId").equals(session.id).toArray(), db.workoutTemplates.get(session.workoutTemplateId)]); return { session, logs, sets, template }; }, []);
  const durationChanged = useCallback((value: number) => setCardioDuration(value), []);

  if (data === undefined) return <p>Carregando resumo do treino…</p>;
  if (data === null) return <Card><p>Nenhum treino aguardando finalização.</p><Button className="mt-4" onClick={() => router.replace("/treinar")}>Voltar</Button></Card>;
  const { session } = data;
  const rule = getWeekRule(session.week);
  const configuredProtocol = data.template?.cardioProtocol ?? ((session.programKind ?? "standard-12-week") === "standard-12-week" ? rule.cardio : "none");
  const hasCardio = session.quickMode || configuredProtocol !== "none";
  const timerProtocol = configuredProtocol === "interval-30-60" || configuredProtocol === "interval-45-75" ? configuredProtocol : "continuous";
  const completion = calculateSessionCompletion(data.logs, data.sets, session.quickMode);
  const optionalNumber = (value: string) => value === "" ? undefined : Number(value);
  const submit = async () => { setSaving(true); try { const id = await finishWorkout({ session, enjoymentAfter: enjoyment, backPainAfter: pain, techniqueRating: technique, notes, cardio: !hasCardio || skipCardio || cardioDuration === 0 ? undefined : { type: cardioType, durationSeconds: cardioDuration, rpe, distance: optionalNumber(distance), speed: optionalNumber(speed), incline: optionalNumber(incline), level: optionalNumber(level), averageHeartRate: optionalNumber(heartRate), calories: optionalNumber(calories) } }); resetCardio(); resetWorkoutUi(); router.replace(`/historico?concluido=${id}`); } finally { setSaving(false); } };

  return <div className="space-y-5"><PageHeader eyebrow={`Treino ${session.workoutCode}`} title="Cardio e finalização" description="Revise o que foi feito antes de salvar a sessão."/>
    <Card className={cn("border-2", completion.status === "completed" ? "border-green-300 bg-green-50 dark:bg-green-950" : completion.status === "partial" ? "border-amber-300 bg-amber-50 dark:bg-amber-950" : "border-slate-300")}><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wide">Resumo da musculação</p><h2 className="mt-1 text-xl font-black">{completion.completedSets} de {completion.plannedSets} séries realizadas</h2><p className="mt-1 text-sm">{completion.status === "completed" ? "Volume planejado concluído." : completion.status === "partial" ? "Será registrada como sessão parcial positiva e a rotação avançará." : "Sem séries realizadas: ficará como interrompida e a rotação não avançará."}</p></div><span className="text-2xl font-black">{Math.round(completion.completionRate * 100)}%</span></div></Card>
    {hasCardio && !skipCardio && <Card><div className="mb-4 flex items-center gap-3"><HeartPulse className="text-green-600"/><div><h2 className="font-black">Cardio planejado</h2><p className="text-sm text-slate-500">{session.quickMode ? "10 minutos leves" : data.template?.cardioTargetMinutes ? `${data.template.cardioTargetMinutes} minutos configurados nesta ficha` : "Protocolo configurado nesta ficha"}</p></div></div><CardioTimer protocol={timerProtocol} quick={session.quickMode} targetSeconds={data.template?.cardioTargetMinutes ? data.template.cardioTargetMinutes * 60 : undefined} onDuration={durationChanged}/><div className="mt-4 grid grid-cols-2 gap-3"><div><Label htmlFor="cardioType">Modalidade</Label><Select id="cardioType" value={cardioType} onChange={(event) => setCardioType(event.target.value)}><option>Esteira</option><option>Bicicleta</option><option>Caminhada</option><option>Personalizado</option></Select></div><div><Label htmlFor="rpe">RPE: {rpe}/10</Label><Input id="rpe" type="range" min="1" max="10" value={rpe} onChange={(event) => setRpe(Number(event.target.value))}/></div></div><details className="mt-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-700"><summary className="cursor-pointer font-semibold">Métricas opcionais do equipamento</summary><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"><Metric id="distance" label="Distância (km)" value={distance} setValue={setDistance} step="0.01"/><Metric id="speed" label="Velocidade (km/h)" value={speed} setValue={setSpeed} step="0.1"/><Metric id="incline" label="Inclinação (%)" value={incline} setValue={setIncline} step="0.5"/><Metric id="level" label="Nível" value={level} setValue={setLevel} step="1"/><Metric id="heartRate" label="Frequência média" value={heartRate} setValue={setHeartRate} step="1"/><Metric id="calories" label="Calorias (kcal)" value={calories} setValue={setCalories} step="1"/></div></details></Card>}
    {hasCardio ? <button type="button" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900" onClick={() => setSkipCardio(!skipCardio)}><SkipForward size={17}/>{skipCardio ? "Incluir cardio" : "Finalizar sem cardio"}</button> : <div className="rounded-2xl bg-slate-100 p-4 text-center text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">Esta ficha não possui cardio planejado. Você pode finalizar diretamente.</div>}
    <Card><h2 className="text-xl font-black">Como foi o treino?</h2><div className="mt-5 space-y-5"><Score label="Prazer após o treino" value={enjoyment} setValue={setEnjoyment}/><Score label="Dor lombar agora" value={pain} setValue={setPain} danger/><div><Label htmlFor="technique">Qualidade técnica geral</Label><Select id="technique" value={technique} onChange={(event) => setTechnique(event.target.value as typeof technique)}><option value="excellent">Excelente</option><option value="good">Boa</option><option value="fair">Regular</option><option value="poor">Ruim</option></Select></div><div><Label htmlFor="notes">Observações</Label><Textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} placeholder="Como você se sentiu? Algum ajuste para a próxima sessão?"/></div></div></Card>
    {pain >= 4 && <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-800"><strong>A progressão ficará bloqueada nesta sessão.</strong> Se houver dor irradiada, dormência ou fraqueza, interrompa e procure avaliação profissional.</div>}
    <Button size="lg" className="w-full" disabled={saving} onClick={submit}><CheckCircle2/>{saving ? "Finalizando…" : completion.status === "abandoned" ? "Encerrar como interrompido" : completion.status === "partial" ? "Salvar sessão parcial" : "Concluir treino"}</Button>
  </div>;
}

function Score({ label, value, setValue, danger = false }: { label: string; value: number; setValue: (value: number) => void; danger?: boolean }) { return <fieldset><legend className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{label}: {value}/10</legend><div className="grid grid-cols-10 gap-1">{Array.from({ length: 10 }, (_, index) => index + 1).map((score) => <button type="button" key={score} onClick={() => setValue(score)} className={cn("min-h-11 rounded-xl border text-xs font-bold", value === score ? danger && score >= 4 ? "border-red-600 bg-red-600 text-white" : "border-green-600 bg-green-600 text-white" : "border-slate-200 dark:border-slate-700")}>{score}</button>)}</div></fieldset>; }
function Metric({ id, label, value, setValue, step }: { id: string; label: string; value: string; setValue: (value: string) => void; step: string }) { return <div><Label htmlFor={id}>{label}</Label><Input id={id} type="number" min="0" step={step} inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)}/></div>; }
