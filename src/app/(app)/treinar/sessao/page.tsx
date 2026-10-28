"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ArrowRight, Check, ChevronDown, ChevronUp, CircleCheck, Clock3, Dumbbell, Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RestTimer } from "@/components/workout/rest-timer";
import { SetInput } from "@/components/workout/set-input";
import { WorkoutTimer } from "@/components/workout/workout-timer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDb } from "@/db/database";
import { skipExercise, togglePause, undoSet } from "@/db/repositories/workouts";
import { evaluateProgression } from "@/domain/progression/engine";
import { getWeekRule } from "@/domain/program/rules";
import { buildBisetGroups, getCurrentBisetStep, getGroupKind, getStepAfterWorkingSet, shouldRestAfterWorkingSet } from "@/domain/workout/bisets";
import { cn } from "@/lib/utils";
import { useWorkoutUiStore } from "@/stores/workout-ui";

export default function ActiveWorkoutPage() {
  const router = useRouter();
  const [inspected, setInspected] = useState<string>();
  const { lastSetId, setLastSetId, startRest, skipRest } = useWorkoutUiStore();
  const data = useLiveQuery(async () => {
    const db = getDb();
    const session = await db.workoutSessions.where("status").anyOf(["active", "paused"]).first();
    if (!session) return null;
    const [logs, allLogs, sets, settings, exercises] = await Promise.all([
      db.exerciseLogs.where("sessionId").equals(session.id).sortBy("order"),
      db.exerciseLogs.toArray(), db.setLogs.toArray(), db.appSettings.toCollection().first(), db.exercises.toArray(),
    ]);
    return { session, logs, allLogs, sets, settings, exercises: new Map(exercises.map((item) => [item.id, item])) };
  }, []);

  if (data === undefined) return <div className="grid min-h-[60vh] place-items-center"><div className="text-center"><Dumbbell className="mx-auto text-green-600"/><p className="mt-3">Carregando treino salvo…</p></div></div>;
  if (data === null) return <Card><h1 className="text-xl font-black">Nenhum treino em andamento</h1><Button className="mt-4" onClick={() => router.replace("/treinar")}>Escolher treino</Button></Card>;

  const groups = buildBisetGroups(data.logs);
  const current = getCurrentBisetStep(data.logs);
  const plannedSets = data.logs.reduce((total, log) => total + log.targetSets, 0);
  const savedSets = data.logs.reduce((total, log) => total + Math.min(log.completedSets, log.targetSets), 0);
  const progress = plannedSets ? Math.round(savedSets / plannedSets * 100) : 0;
  const currentGroup = current ? groups.find((group) => group.id === current.groupId) : undefined;
  const weekRule = getWeekRule(data.session.week);
  const loadFactor = (data.session.programKind ?? "standard-12-week") === "standard-12-week" ? weekRule.loadFactor : 1;
  const currentParticipants = currentGroup?.logs.filter((log) => !log.skipped && log.targetSets >= (current?.round ?? 1)) ?? [];
  const nextWithoutRest = current && current.position < current.exercisesInRound ? currentParticipants[current.position] : undefined;
  const previousFor = (exerciseId: string, logId: string) => data.sets.filter((set) => set.exerciseId === exerciseId && set.exerciseLogId !== logId && set.status === "completed").sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))[0];

  const handleWorkingSet = (logId: string, advancesRound: boolean) => {
    if (!advancesRound) return;
    const log = data.logs.find((item) => item.id === logId);
    if (!log) return;
    const next = getStepAfterWorkingSet(data.logs, logId);
    if (shouldRestAfterWorkingSet(data.logs, logId)) {
      startRest(log.restSeconds, { block: log.blockName ?? log.block, round: log.completedSets + 1, nextExercise: next?.log.exerciseName });
    }
    setInspected(undefined);
  };

  return <div className="space-y-4">
    <header className="sticky top-0 z-20 -mx-4 -mt-5 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:top-0 lg:mx-0 lg:mt-0 lg:rounded-3xl lg:border dark:border-slate-800 dark:bg-slate-900/95">
      <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase text-green-700">Treino {data.session.workoutCode} · Semana {data.session.week}</p><WorkoutTimer startedAt={data.session.startedAt} pausedAt={data.session.pausedAt} pausedDurationSeconds={data.session.pausedDurationSeconds}/></div><div className="flex gap-2"><Button variant="secondary" size="sm" aria-label={data.session.status === "paused" ? "Retomar" : "Pausar"} onClick={() => togglePause(data.session)}>{data.session.status === "paused" ? <Play size={17}/> : <Pause size={17}/>}</Button><Link href="/treinar/finalizar"><Button size="sm">Finalizar</Button></Link></div></div>
      <div className="mt-3 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full bg-green-600 transition-all" style={{ width: `${progress}%` }}/></div><span className="whitespace-nowrap text-xs font-bold">{progress}% · salvo localmente</span></div>
    </header>

    {data.session.status === "paused" && <div className="rounded-3xl bg-amber-50 p-5 text-center text-amber-900"><Pause className="mx-auto"/><p className="mt-2 font-black">Treino pausado</p><Button className="mt-3" onClick={() => togglePause(data.session)}><Play size={17}/>Retomar</Button></div>}

    <details className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm dark:border-green-900 dark:bg-green-950">
      <summary className="cursor-pointer font-black text-green-900 dark:text-green-100">Como funcionam blocos e descansos</summary>
      <div className="mt-3 flex items-center justify-between gap-2 text-center text-xs font-bold"><span className="flex-1 rounded-xl bg-white p-2 dark:bg-slate-900">Exercícios do bloco</span><ArrowRight className="shrink-0 text-green-600"/><span className="flex-1 rounded-xl bg-slate-950 p-2 text-white">Descanso</span><ArrowRight className="shrink-0 text-green-600"/><span className="flex-1 rounded-xl bg-white p-2 dark:bg-slate-900">Próxima rodada</span></div>
      <p className="mt-3 text-green-900 dark:text-green-100">Em série simples, o descanso ocorre após cada série. Em biset, triset ou circuito, faça todos os exercícios ativos sem pausa; o cronômetro começa depois do último participante da rodada.</p>
    </details>

    {!current && <Card className="border-green-200 bg-green-50 text-center"><CircleCheck className="mx-auto text-green-600" size={38}/><h2 className="mt-2 text-xl font-black text-green-900">Todos os blocos foram concluídos</h2><p className="mt-1 text-sm text-green-800">Você pode respeitar o último descanso e seguir para o cardio.</p></Card>}

    {groups.map((group, groupIndex) => {
      const activeGroup = current?.groupId === group.id;
      const restSeconds = group.logs.at(-1)?.restSeconds ?? 0;
      const kind = getGroupKind(group.logs.filter((log) => !log.skipped).length || group.logs.length);
      return <Card key={group.id} className={cn("p-0 overflow-hidden", activeGroup && "border-green-400 ring-2 ring-green-100 dark:ring-green-950", group.complete && "bg-slate-50 dark:bg-slate-900")}>
        <div className="border-b border-slate-100 p-4 dark:border-slate-800">
          <div className="flex items-center gap-3"><span className={cn("grid h-12 w-12 place-items-center rounded-2xl text-lg font-black", group.complete ? "bg-green-100 text-green-700" : activeGroup ? "bg-green-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800")}>{group.complete ? <Check/> : groupIndex + 1}</span><div className="flex-1"><h2 className="font-black">{group.name}</h2><p className="text-sm text-slate-500">{kind} · {group.completedRounds}/{group.targetRounds} rodadas · descanso {restSeconds}s após {group.logs.length === 1 ? "cada série" : "o grupo"}</p></div>{activeGroup && <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">Em andamento</span>}</div>
          <div className="mt-3 flex gap-1" aria-label={`${group.completedRounds} de ${group.targetRounds} rodadas completas`}>{Array.from({ length: group.targetRounds }, (_, index) => <span key={index} className={cn("h-2 flex-1 rounded-full", index < group.completedRounds ? "bg-green-600" : activeGroup && index === group.completedRounds ? "bg-amber-400" : "bg-slate-200 dark:bg-slate-700")}/>)}</div>
          {activeGroup && current && <div className="mt-3 rounded-2xl bg-green-600 p-3 text-white"><p className="text-xs font-black uppercase text-green-100">Agora · rodada {current.round} de {current.targetRounds}</p><h3 className="mt-1 font-black">{current.log.exerciseName}</h3><p className="mt-1 text-sm text-green-50">{nextWithoutRest ? <>Depois: <strong>{nextWithoutRest.exerciseName}</strong>, sem descanso.</> : <>Ao salvar: <strong>descanso de {current.log.restSeconds}s</strong>.</>}</p></div>}
        </div>

        <div className="space-y-2 p-3">{group.logs.map((log, position) => {
          const isCurrent = current?.log.id === log.id;
          const done = log.skipped || log.completedSets >= log.targetSets;
          const open = isCurrent || inspected === log.id;
          const exercise = data.exercises.get(log.exerciseId);
          const ownSets = data.sets.filter((set) => set.exerciseLogId === log.id);
          const ownLastWorkingSet = ownSets.filter((set) => set.type === "working" && set.status === "completed").at(-1);
          const lastWorkingSet = ownSets.filter((set) => set.type === "working").at(-1);
          const previousLog = data.allLogs.filter((item) => item.exerciseId === log.exerciseId && item.sessionId !== log.sessionId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
          const previousSets = previousLog ? data.sets.filter((set) => set.exerciseLogId === previousLog.id && set.type === "working" && set.status === "completed") : [];
          const previousQualified = Boolean(previousLog && previousSets.length >= previousLog.targetSets && previousSets.every((set) => set.reps >= previousLog.maxReps && set.rir >= previousLog.targetRir && !set.rangeOfMotionReduced && set.technique !== "poor"));
          const recommendation = done && !log.skipped ? evaluateProgression({ currentSets: ownSets, previousQualified, targetRir: log.targetRir, minReps: log.minReps, maxReps: log.maxReps, backPain: data.session.backPainBefore, increment: exercise?.loadIncrement ?? 2.5 }) : undefined;
          return <div key={log.id} className={cn("rounded-2xl border", isCurrent ? "border-green-500 bg-white dark:bg-slate-950" : "border-slate-200 dark:border-slate-700", log.skipped && "opacity-60")}>
            <button type="button" onClick={() => !isCurrent && setInspected(open ? undefined : log.id)} className="flex min-h-20 w-full items-center gap-3 p-3 text-left" aria-expanded={open}>
              <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-2xl font-black", done ? "bg-green-100 text-green-700" : isCurrent ? "bg-green-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800")}>{done ? <CircleCheck size={21}/> : position + 1}</span>
              <span className="flex-1"><span className="block font-black">{log.exerciseName}</span><span className="text-sm text-slate-500">{log.minReps}–{log.maxReps} reps · RIR {log.targetRir} · {log.completedSets}/{log.targetSets}</span>{lastWorkingSet && <span className="mt-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Última: {lastWorkingSet.status === "skipped" ? "não realizada" : `${lastWorkingSet.weight} kg × ${lastWorkingSet.reps}`}</span>}{isCurrent && <span className="mt-1 block text-xs font-black uppercase text-green-700">Preencha esta série agora</span>}</span>
              {open ? <ChevronUp/> : <ChevronDown/>}
            </button>
            {open && <div className="px-3 pb-4">
              <details className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-200"><summary className="cursor-pointer font-bold text-slate-800 dark:text-slate-100">Execução e cuidados</summary><div className="mt-2"><p>{exercise?.instructions}</p><p className="mt-1 font-medium text-green-800 dark:text-green-300">Cuidado: {exercise?.backCare}</p>{exercise?.alternatives[0] && <p className="mt-1">Alternativa: {exercise.alternatives[0]}</p>}</div></details>
              {ownSets.length > 0 && <div className="mt-3 space-y-2">{ownSets.map((set) => <div key={set.id} className="flex min-h-11 items-center justify-between rounded-xl border border-slate-100 px-3 text-sm dark:border-slate-800"><span>{set.type === "warmup" ? "Aquecimento" : `Rodada ${set.setNumber}`}</span><strong>{set.status === "skipped" ? "Não realizada" : `${set.weight} kg × ${set.reps} · RIR ${set.rir}`}</strong></div>)}</div>}
              {recommendation && <div className={cn("mt-3 rounded-2xl p-3 text-sm", recommendation.action === "increase" ? "bg-green-50 text-green-900" : recommendation.action === "blocked" || recommendation.action === "reduce" ? "bg-amber-50 text-amber-900" : "bg-blue-50 text-blue-900")}><strong>{recommendation.action === "increase" ? `Aumentar para ${recommendation.suggestedWeight} kg` : recommendation.action === "confirm" ? "Confirmar no próximo treino" : recommendation.action === "maintain" ? "Manter carga e somar repetições" : recommendation.action === "reduce" ? "Considere reduzir a carga" : "Progressão não recomendada"}</strong><p className="mt-1">{recommendation.reason}</p></div>}
              {(exercise?.backDemand === "high" || exercise?.backDemand === "very-high") && <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-900"><strong>Alta demanda lombar</strong><p className="mt-1">Use apenas se estiver confortável e com técnica segura. Interrompa se houver dor, irradiação, dormência ou fraqueza.</p></div>}
              {isCurrent && data.session.status !== "paused" && <SetInput log={log} previous={ownLastWorkingSet ?? previousFor(log.exerciseId, log.id)} loadFactor={ownLastWorkingSet ? 1 : loadFactor} increment={exercise?.loadIncrement ?? .5} defaultBackPain={data.session.backPainBefore} vibrationEnabled={data.settings?.vibrationEnabled} steps={data.settings?.loadSteps ?? [-10, -5, -2.5, 2.5, 5, 10]} onSaved={(_, advancesRound) => handleWorkingSet(log.id, advancesRound)}/>} 
              {isCurrent && !done && <button type="button" onClick={async () => { if (confirm("Não realizar este exercício nas rodadas restantes?")) { const remaining = data.logs.map((item) => item.id === log.id ? { ...item, skipped: true } : item); const next = getCurrentBisetStep(remaining); await skipExercise(log.id); const leftCurrentGroup = !next || next.groupId !== current.groupId || next.round > current.round; if (leftCurrentGroup) startRest(log.restSeconds, { block: log.blockName ?? log.block, round: current.round, nextExercise: next?.log.exerciseName }); setInspected(undefined); } }} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 text-sm font-semibold text-slate-500"><SkipForward size={16}/>Não realizar este exercício</button>}
            </div>}
          </div>;
        })}</div>
      </Card>;
    })}

    {lastSetId && <button type="button" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900" onClick={async () => { await undoSet(lastSetId); skipRest(); setLastSetId(undefined); }}><RotateCcw size={17}/>Desfazer última série</button>}
    <Link href="/treinar/finalizar"><Button size="lg" className="w-full"><Clock3 size={18}/>{current ? "Encerrar musculação e ir ao cardio" : "Ir para cardio e finalizar"}</Button></Link>
    <RestTimer/>
  </div>;
}
