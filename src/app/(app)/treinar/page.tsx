"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, ArrowRight, Bolt, Dumbbell, Moon, PauseCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDb } from "@/db/database";
import { resolveCurrentTemplate } from "@/db/repositories/plans";
import { startWorkout } from "@/db/repositories/workouts";
import { getProgramWeek, getWeekRule } from "@/domain/program/rules";
import { getBackPainGuidance } from "@/domain/wellbeing/back-pain";
import { cn } from "@/lib/utils";

export default function TrainPage() {
  const router = useRouter();
  const [pain, setPain] = useState(0);
  const [energy, setEnergy] = useState(7);
  const [sleepHours, setSleepHours] = useState(7.5);
  const [quick, setQuick] = useState(false);
  const [starting, setStarting] = useState(false);
  const data = useLiveQuery(async () => {
    const db = getDb();
    const program = await db.programs.where("status").equals("active").first();
    const active = await db.workoutSessions.where("status").anyOf(["active", "paused"]).first();
    const template = program ? await resolveCurrentTemplate(program) : undefined;
    const items = template ? await db.workoutTemplateItems.where("workoutTemplateId").equals(template.id).toArray() : [];
    const exercises = (await db.exercises.bulkGet(items.map((item) => item.exerciseId))).filter(Boolean);
    const highDemand = exercises.filter((exercise) => exercise?.backDemand === "high" || exercise?.backDemand === "very-high");
    const essentialBlocks = template ? (await db.workoutBlocks.where("workoutTemplateId").equals(template.id).toArray()).filter((block) => block.active && block.quickModeIncluded).length : 0;
    return { program, active, template, highDemand, essentialBlocks };
  }, []);

  if (!data?.program || !data.template) return <p>Preparando ficha…</p>;
  if (data.active) return <><PageHeader title="Treino em andamento" description="Seu progresso está salvo neste dispositivo."/><Card><PauseCircle className="text-green-600" size={32}/><h2 className="mt-4 text-xl font-black">Treino {data.active.workoutCode}</h2><p className="mt-1 text-slate-500">Continue exatamente de onde parou.</p><Button className="mt-5 w-full" size="lg" onClick={() => router.push("/treinar/sessao")}>Continuar treino <ArrowRight/></Button></Card></>;

  const isStandard = (data.program.kind ?? "standard-12-week") === "standard-12-week";
  const week = getProgramWeek(data.program.startDate);
  const rule = isStandard ? getWeekRule(week) : undefined;
  const guidance = getBackPainGuidance(pain);
  const begin = async () => {
    setStarting(true);
    try {
      await startWorkout({ energyBefore: energy, backPainBefore: pain, sleepHoursBefore: sleepHours, quickMode: quick });
      window.location.assign("/treinar/sessao");
    } finally { setStarting(false); }
  };

  return <div className="space-y-5">
    <PageHeader eyebrow={isStandard ? `Semana ${week} · ${rule?.phase}` : data.program.name} title={`Treino ${data.template.code}`} description={data.template.name}/>
    {data.highDemand.length > 0 && <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"><div className="flex gap-3"><AlertTriangle className="shrink-0 text-red-700"/><div><h2 className="font-black text-red-900 dark:text-red-100">Atenção à demanda lombar</h2><p className="mt-1 text-sm text-red-800 dark:text-red-200">Esta ficha inclui {data.highDemand.map((exercise) => exercise!.name).join(", ")}. Eles continuam disponíveis, mas exigem técnica segura e devem ser interrompidos diante de sintomas.</p></div></div></Card>}
    <Card>
      <div className="flex items-center gap-2"><Moon className="text-green-600"/><h2 className="font-black">Recuperação de hoje</h2></div>
      <p className="mt-4 text-sm font-semibold">Energia: {energy}/10</p>
      <div className="mt-2 grid grid-cols-10 gap-1">{Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <button key={value} type="button" onClick={() => setEnergy(value)} className={cn("min-h-11 rounded-xl border text-sm font-bold", energy === value ? "border-green-600 bg-green-600 text-white" : "border-slate-200 dark:border-slate-700")}>{value}</button>)}</div>
      <div className="mt-5 flex items-center gap-4"><div className="flex-1"><label htmlFor="sleepHours" className="text-sm font-semibold">Sono na última noite</label><input id="sleepHours" aria-label="Horas de sono" type="range" min="3" max="12" step="0.5" value={sleepHours} onChange={(event) => setSleepHours(Number(event.target.value))} className="mt-2 w-full accent-green-600"/></div><span className="grid h-12 min-w-16 place-items-center rounded-2xl bg-slate-100 px-3 font-black dark:bg-slate-800">{sleepHours}h</span></div>
      {(energy <= 4 || sleepHours < 6) && <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">Recuperação baixa: priorize técnica, respeite o RIR e considere o modo rápido.</p>}
    </Card>
    <Card><h2 className="font-black">Como está sua lombar agora?</h2><div className="mt-3 flex items-center gap-4"><input aria-label="Dor lombar" type="range" min="0" max="10" value={pain} onChange={(event) => setPain(Number(event.target.value))} className="w-full accent-green-600"/><span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-lg font-black", pain >= 4 ? "bg-red-100 text-red-700" : pain === 3 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700")}>{pain}</span></div><div className={cn("mt-4 rounded-2xl p-4 text-sm", guidance.level === "high" ? "bg-red-50 text-red-800" : guidance.level === "medium" ? "bg-amber-50 text-amber-900" : "bg-green-50 text-green-900")}><strong className="flex items-center gap-2">{guidance.level !== "low" && <AlertTriangle size={16}/>} {guidance.title}</strong><p className="mt-1">{guidance.message}</p></div></Card>
    <button type="button" aria-pressed={quick} disabled={data.essentialBlocks === 0} onClick={() => setQuick(!quick)} className={cn("flex w-full items-center gap-4 rounded-3xl border bg-white p-5 text-left shadow-sm disabled:opacity-50 dark:bg-slate-900", quick ? "border-green-600 ring-4 ring-green-100 dark:ring-green-950" : "border-slate-200 dark:border-slate-700")}><span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-700"><Bolt/></span><span className="flex-1"><strong className="block">Treino rápido</strong><span className="text-sm text-slate-500">{data.essentialBlocks > 0 ? `${data.essentialBlocks} bloco${data.essentialBlocks > 1 ? "s" : ""} essencial${data.essentialBlocks > 1 ? "is" : ""} + 10 min leves. Conta como sessão parcial positiva.` : "Marque ao menos um bloco essencial no construtor para habilitar."}</span></span><span className={cn("h-6 w-6 rounded-full border", quick && "border-green-600 bg-green-600 shadow-[inset_0_0_0_5px_white]")}/></button>
    <Button size="lg" className="w-full" disabled={starting} onClick={begin}><Dumbbell/>{starting ? "Preparando…" : `Iniciar treino ${data.template.code}`}</Button>
    <p className="text-center text-xs text-slate-500">Não treine com dor irradiada, dormência ou fraqueza. Procure avaliação profissional.</p>
  </div>;
}
