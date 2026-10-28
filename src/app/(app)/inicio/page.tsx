"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { addDays, endOfWeek, format, isWithinInterval, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, Award, CalendarDays, Clock3, Dumbbell, Flame, Layers3, Moon, Scale, Sparkles, Target } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/app-shell/page-header";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDb } from "@/db/database";
import { resolveCurrentTemplate } from "@/db/repositories/plans";
import { getProgramWeek, getWeekRule } from "@/domain/program/rules";
import { formatDuration, formatWeight } from "@/lib/utils";

const motivations = ["Hoje não precisa ser perfeito. Só precisa começar.", "Consistência é voltar, mesmo quando o ritmo muda.", "Boa técnica vale mais que uma carga apressada.", "Uma sessão parcial ainda é uma escolha pelo hábito."];
const average = (values: Array<number | undefined>) => { const valid = values.filter((value): value is number => value !== undefined); return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : undefined; };

export default function HomePage() {
  const data = useLiveQuery(async () => {
    const db = getDb();
    const [profile, program, settings, latestWeight, sessions, active, achievements, definitions] = await Promise.all([
      db.profiles.toCollection().first(), db.programs.where("status").equals("active").first(), db.appSettings.toCollection().first(),
      db.bodyMeasurements.orderBy("measuredAt").last(), db.workoutSessions.orderBy("startedAt").reverse().toArray(),
      db.workoutSessions.where("status").anyOf(["active", "paused"]).first(), db.userAchievements.toArray(),
      db.achievementDefinitions.toArray(),
    ]);
    const nextTemplate = program ? await resolveCurrentTemplate(program) : undefined;
    return { profile, program, settings, latestWeight, sessions, active, achievements, definitions, nextTemplate };
  }, []);

  if (!data?.profile || !data.program) return <div className="animate-pulse space-y-4"><div className="h-16 rounded-3xl bg-slate-200"/><div className="h-64 rounded-3xl bg-slate-200"/></div>;
  const week = getProgramWeek(data.program.startDate);
  const isStandard = (data.program.kind ?? "standard-12-week") === "standard-12-week";
  const rule = getWeekRule(week);
  const weeklyGoal = isStandard ? rule.weeklyGoal : data.program.weeklyGoal ?? 3;
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const sunday = endOfWeek(new Date(), { weekStartsOn: 1 });
  const validSessions = data.sessions.filter((session) => ["completed", "partial"].includes(session.status));
  const weekSessions = validSessions.filter((session) => session.programId === data.program!.id && isWithinInterval(new Date(session.startedAt), { start: monday, end: sunday }));
  const averageDuration = average(validSessions.map((session) => session.totalDurationSeconds));
  const averageEnjoyment = average(validSessions.map((session) => session.enjoymentAfter));
  const recent = validSessions.slice(0, 4);
  const sleepAverage = average(recent.map((session) => session.sleepHoursBefore));
  const lastSession = validSessions[0];
  const nextTemplate = data.nextTemplate;
  const todayPreferred = data.profile.preferredWorkoutDays.includes(new Date().getDay());
  const achievements = data.definitions.map((definition) => ({ definition, user: data.achievements.find((item) => item.achievementId === definition.id) })).sort((a, b) => Number(Boolean(b.user?.unlockedAt)) - Number(Boolean(a.user?.unlockedAt))).slice(0, 3);
  const motivation = motivations[new Date().getDate() % motivations.length];

  return <div className="space-y-5">
    <PageHeader eyebrow={isStandard ? `Semana ${week} · ${rule.phase}` : data.program.name} title={`Olá, ${data.profile.name.split(" ")[0]}!`} description={isStandard ? rule.note : `Plano livre · meta de ${weeklyGoal} treinos por semana`}/>
    {data.active && <Card className="border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-green-700">Treino em andamento</p><h2 className="mt-1 font-black">Treino {data.active.workoutCode}</h2><p className="text-sm text-green-900 dark:text-green-100">Seu progresso foi salvo automaticamente.</p></div><Button onClick={() => location.assign("/treinar/sessao")}>Continuar <ArrowRight size={17}/></Button></div></Card>}
    <Card className="overflow-hidden bg-gradient-to-br from-green-700 to-green-600 text-white"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-green-100">Próximo da rotação</p><h2 className="mt-1 text-4xl font-black">Treino {nextTemplate?.code ?? data.program.currentRotation}</h2><p className="mt-1 text-sm text-green-50">{nextTemplate?.name}</p><p className="mt-3 text-sm text-green-50">{weekSessions.length} de {weeklyGoal} sessões nesta semana{todayPreferred ? " · hoje é um dia preferido" : ""}</p></div><span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15"><Dumbbell size={28}/></span></div><div className="mt-6 h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, weekSessions.length / weeklyGoal * 100)}%` }}/></div><Link href="/treinar"><Button variant="secondary" size="lg" className="mt-5 w-full border-0 text-green-800">{data.active ? "Retomar treino" : "Preparar treino"}<ArrowRight size={18}/></Button></Link></Card>
    <Link href="/planos" className="flex min-h-14 items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4 font-bold shadow-sm dark:border-slate-800 dark:bg-slate-900"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-green-100 text-green-700"><Layers3/></span><span className="flex-1"><span className="block">Meus planos</span><span className="text-sm font-normal text-slate-500">Criar, editar ou trocar sua rotação</span></span><ArrowRight size={18}/></Link>
    {(lastSession?.backPainAfter !== undefined || sleepAverage !== undefined) && <Card className="border-blue-100 bg-blue-50 dark:border-blue-900 dark:bg-blue-950"><div className="flex gap-3"><Sparkles className="shrink-0 text-blue-600"/><div><p className="text-xs font-black uppercase tracking-wide text-blue-700">Leitura pessoal</p><p className="mt-1 font-semibold">{lastSession?.backPainAfter !== undefined && lastSession.backPainAfter >= 4 ? "A última sessão terminou com dor elevada. Hoje, preserve técnica e carga." : sleepAverage !== undefined && sleepAverage < 6.5 ? `Seu sono médio recente foi ${sleepAverage.toFixed(1)}h. Considere reduzir a exigência se a energia estiver baixa.` : "Seus registros recentes não mostram alerta de recuperação. Continue respeitando RIR e técnica."}</p></div></div></Card>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric icon={<Scale/>} label="Peso atual" value={data.latestWeight ? formatWeight(data.latestWeight.weight, data.settings?.weightUnit) : "—"}/><Metric icon={<Clock3/>} label="Tempo médio" value={averageDuration ? formatDuration(averageDuration) : "—"}/><Metric icon={<Flame/>} label="Sessões válidas" value={String(validSessions.length)}/><Metric icon={<Moon/>} label="Sono recente" value={sleepAverage ? `${sleepAverage.toFixed(1)}h` : "—"}/></div>
    <Card><div className="mb-4 flex items-center gap-2"><CalendarDays className="text-green-600"/><h2 className="font-black">Esta semana</h2></div><div className="grid grid-cols-7 gap-2">{Array.from({ length: 7 }, (_, index) => { const date = addDays(monday, index); const trained = weekSessions.some((session) => format(new Date(session.startedAt), "yyyy-MM-dd") === format(date, "yyyy-MM-dd")); const today = format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd"); return <div key={index} className="text-center"><p className="text-[11px] uppercase text-slate-400">{format(date, "EEE", { locale: ptBR }).slice(0, 3)}</p><div className={`mx-auto mt-2 grid h-9 w-9 place-items-center rounded-xl text-sm font-bold ${trained ? "bg-green-600 text-white" : today ? "border-2 border-green-600 text-green-700" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>{format(date, "d")}</div></div>; })}</div></Card>
    <div className="grid gap-4 lg:grid-cols-2"><Card><div className="flex items-center gap-2"><Target className="text-green-600"/><h2 className="font-black">Seu objetivo</h2></div><p className="mt-3 text-lg font-bold">{data.profile.primaryGoal}</p><p className="mt-2 text-sm text-slate-500">Prazer médio: {averageEnjoyment !== undefined ? `${averageEnjoyment.toFixed(1)}/10` : "—"} · Consistência semanal: {Math.min(100, Math.round(weekSessions.length / weeklyGoal * 100))}%</p></Card><Card className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700"><Sparkles/></span><div><p className="text-xs font-bold uppercase tracking-wide text-amber-700">Mensagem do dia</p><p className="mt-1 font-semibold">{motivation}</p></div></Card></div>
    <Card><div className="flex items-center gap-2"><Award className="text-green-600"/><h2 className="font-black">Conquistas</h2></div><div className="mt-4 grid gap-2 sm:grid-cols-3">{achievements.map(({ definition, user }) => <div key={definition.id} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800"><p className="font-bold">{user?.unlockedAt ? "✓ " : ""}{definition.name}</p><p className="mt-1 text-xs text-slate-500">{Math.min(definition.target, user?.progress ?? 0)}/{definition.target} · {definition.description}</p></div>)}</div></Card>
    <InstallPrompt/>
  </div>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <Card className="p-4"><span className="text-green-600">{icon}</span><p className="mt-4 text-xs text-slate-500">{label}</p><p className="text-xl font-black">{value}</p></Card>; }
