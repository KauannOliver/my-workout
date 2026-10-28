"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronDown, ChevronUp, Clock3, Copy, Download, Dumbbell, HeartPulse, Pencil, Search, Trash2, Trophy } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { getDb } from "@/db/database";
import { deleteSession, duplicateSession, updateSessionNotes } from "@/db/repositories/workouts";
import { formatDuration } from "@/lib/utils";
import { downloadBlob } from "@/services/backup/backup";
import type { WorkoutSession, WorkoutStatus } from "@/types/models";

type HistoryFilter = "all" | "completed" | "partial" | "abandoned";

const statusLabel: Record<WorkoutStatus, string> = {
  active: "Em andamento",
  paused: "Pausado",
  completed: "Concluído",
  partial: "Parcial",
  abandoned: "Interrompido",
};

const statusClass: Record<WorkoutStatus, string> = {
  active: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  paused: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  partial: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  abandoned: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
};

export default function HistoryPage() {
  const searchParams = useSearchParams();
  const justCompleted = searchParams.get("concluido") ?? undefined;
  const [open, setOpen] = useState<string | undefined>(justCompleted);
  const [message, setMessage] = useState<string>();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [programFilter, setProgramFilter] = useState("all");
  const [editing, setEditing] = useState<string>();
  const [noteDraft, setNoteDraft] = useState("");
  const data = useLiveQuery(async () => {
    const db = getDb();
    return {
      sessions: await db.workoutSessions.orderBy("startedAt").reverse().toArray(),
      logs: await db.exerciseLogs.toArray(),
      sets: await db.setLogs.toArray(),
      cardio: await db.cardioLogs.toArray(),
      programs: await db.programs.toArray(),
    };
  }, []);

  const filteredSessions = useMemo(() => {
    if (!data) return [];
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return data.sessions.filter((session) => {
      if (filter !== "all" && session.status !== filter) return false;
      if (programFilter !== "all" && session.programId !== programFilter) return false;
      if (!normalized) return true;
      const exerciseNames = data.logs.filter((log) => log.sessionId === session.id).map((log) => log.exerciseName).join(" ");
      return `${session.workoutCode} ${session.workoutName} ${session.notes ?? ""} ${exerciseNames}`.toLocaleLowerCase("pt-BR").includes(normalized);
    });
  }, [data, filter, programFilter, query]);

  if (!data) return <p>Carregando histórico…</p>;

  const highlighted = justCompleted ? data.sessions.find((session) => session.id === justCompleted) : undefined;
  const exportSession = (sessionId: string) => {
    const session = data.sessions.find((item) => item.id === sessionId);
    const logs = data.logs.filter((item) => item.sessionId === sessionId);
    const sets = data.sets.filter((item) => item.sessionId === sessionId);
    const cardio = data.cardio.filter((item) => item.sessionId === sessionId);
    downloadBlob(JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), session, logs, sets, cardio }, null, 2), `meu-treino-sessao-${session?.workoutCode}-${session?.startedAt.slice(0, 10)}.json`, "application/json");
    setMessage("Sessão exportada em JSON.");
  };

  return <div className="space-y-4">
    <PageHeader title="Histórico" description="Encontre padrões reais sem apagar o contexto de cada treino."/>
    {message && <div role="status" className="rounded-2xl bg-green-50 p-4 text-sm font-medium text-green-900 dark:bg-green-950 dark:text-green-100">{message}</div>}
    {highlighted && <CompletionBanner session={highlighted}/>} 

    {data.sessions.length > 0 && <Card className="grid gap-3 p-4 sm:grid-cols-[1fr_12rem_14rem]">
      <div><Label htmlFor="history-search">Buscar no histórico</Label><div className="relative"><Search className="pointer-events-none absolute left-4 top-3.5 text-slate-400" size={20}/><Input id="history-search" className="pl-11" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Treino, exercício ou observação"/></div></div>
      <div><Label htmlFor="history-filter">Situação</Label><Select id="history-filter" value={filter} onChange={(event) => setFilter(event.target.value as HistoryFilter)}><option value="all">Todas</option><option value="completed">Concluídas</option><option value="partial">Parciais</option><option value="abandoned">Interrompidas</option></Select></div>
      <div><Label htmlFor="history-plan">Plano</Label><Select id="history-plan" value={programFilter} onChange={(event) => setProgramFilter(event.target.value)}><option value="all">Todos os planos</option>{data.programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</Select></div>
    </Card>}

    {data.sessions.length === 0 && <Card className="py-12 text-center"><Dumbbell className="mx-auto text-slate-300" size={42}/><h2 className="mt-4 font-black">Seu histórico começa no primeiro treino</h2><p className="mt-1 text-sm text-slate-500">Não há sessões registradas ainda.</p></Card>}
    {data.sessions.length > 0 && filteredSessions.length === 0 && <Card className="py-10 text-center"><Search className="mx-auto text-slate-300"/><h2 className="mt-3 font-black">Nenhuma sessão encontrada</h2><p className="mt-1 text-sm text-slate-500">Limpe a busca ou mude o filtro.</p></Card>}

    {filteredSessions.map((session) => {
      const logs = data.logs.filter((item) => item.sessionId === session.id);
      const sets = data.sets.filter((item) => item.sessionId === session.id && item.status === "completed");
      const volume = sets.reduce((sum, item) => sum + item.weight * item.reps, 0);
      const records = sets.filter((item) => item.personalRecord).length;
      const cardio = data.cardio.find((item) => item.sessionId === session.id);
      const previous = data.sessions.find((item) => item.programId === session.programId && item.workoutTemplateId === session.workoutTemplateId && item.startedAt < session.startedAt && ["completed", "partial"].includes(item.status));
      const previousVolume = previous ? data.sets.filter((item) => item.sessionId === previous.id && item.status === "completed").reduce((sum, item) => sum + item.weight * item.reps, 0) : undefined;
      const expanded = open === session.id;
      const volumeDelta = previousVolume && previousVolume > 0 ? Math.round(((volume - previousVolume) / previousVolume) * 100) : undefined;
      const completion = session.completionRate ?? (session.status === "completed" ? 1 : undefined);
      return <Card key={session.id} className="overflow-hidden p-0">
        <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? undefined : session.id)} className="flex min-h-24 w-full items-center gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-green-200">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-green-100 text-xl font-black text-green-700 dark:bg-green-950 dark:text-green-300">{session.workoutCode}</span>
          <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="font-black">Treino {session.workoutCode} · Semana {session.week}</span><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${statusClass[session.status]}`}>{statusLabel[session.status]}</span></span><span className="mt-1 block text-sm text-slate-500">{data.programs.find((program) => program.id === session.programId)?.name ?? "Plano preservado"} · {format(new Date(session.startedAt), "d 'de' MMM, HH:mm", { locale: ptBR })}{completion !== undefined ? ` · ${Math.round(completion * 100)}% das séries` : ""}</span></span>
          {expanded ? <ChevronUp aria-hidden="true"/> : <ChevronDown aria-hidden="true"/>}
        </button>
        {expanded && <div className="border-t border-slate-100 p-4 dark:border-slate-800">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Stat icon={<Clock3/>} label="Duração" value={formatDuration(session.totalDurationSeconds ?? 0)}/><Stat icon={<Dumbbell/>} label="Volume" value={`${Math.round(volume)} kg`}/><Stat icon={<Trophy/>} label="Recordes" value={String(records)}/><Stat icon={<HeartPulse/>} label="Dor após" value={session.backPainAfter !== undefined ? `${session.backPainAfter}/10` : "—"}/></div>
          {previous && <div className="mt-4 rounded-2xl border border-green-100 bg-green-50 p-4 text-sm text-green-950 dark:border-green-900 dark:bg-green-950 dark:text-green-100"><strong>Comparação com o Treino {previous.workoutCode} anterior</strong><p className="mt-1">Volume: {Math.round(previousVolume ?? 0)} kg → {Math.round(volume)} kg {volumeDelta !== undefined && <span className={volumeDelta >= 0 ? "font-bold text-green-700 dark:text-green-300" : "font-bold text-amber-700"}>({volumeDelta >= 0 ? "+" : ""}{volumeDelta}%)</span>}</p><p>Duração: {formatDuration(previous.totalDurationSeconds ?? 0)} → {formatDuration(session.totalDurationSeconds ?? 0)}</p></div>}
          <div className="mt-4 space-y-3">{logs.map((log) => <div key={log.id} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800"><div className="flex justify-between gap-3"><strong>{log.exerciseName}</strong><span className="shrink-0 text-xs text-slate-500">{log.completedSets}/{log.targetSets}</span></div><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{sets.filter((item) => item.exerciseLogId === log.id).map((item) => `${item.weight} kg × ${item.reps}`).join(" · ") || "Não realizado"}</p></div>)}</div>
          {cardio && <p className="mt-4 rounded-2xl bg-green-50 p-3 text-sm text-green-900 dark:bg-green-950 dark:text-green-100">Cardio: {cardio.type} · {formatDuration(cardio.durationSeconds)} · RPE {cardio.rpe}{cardio.distance ? ` · ${cardio.distance} km` : ""}{cardio.averageHeartRate ? ` · ${cardio.averageHeartRate} bpm` : ""}</p>}
          {editing === session.id ? <div className="mt-4"><Label htmlFor={`note-${session.id}`}>Observação pessoal</Label><Textarea id={`note-${session.id}`} value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} maxLength={1000}/><div className="mt-2 flex gap-2"><Button size="sm" onClick={async () => { await updateSessionNotes(session.id, noteDraft.trim()); setEditing(undefined); setMessage("Observação atualizada."); }}>Salvar</Button><Button variant="ghost" size="sm" onClick={() => setEditing(undefined)}>Cancelar</Button></div></div> : session.notes && <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm italic text-slate-600 dark:bg-slate-800 dark:text-slate-300">“{session.notes}”</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setEditing(session.id); setNoteDraft(session.notes ?? ""); }}><Pencil size={16}/>Observação</Button>
            <Button variant="secondary" size="sm" onClick={async () => { if (confirm("Criar uma cópia independente desta sessão no histórico?")) { const id = await duplicateSession(session.id); setOpen(id); setMessage("Sessão duplicada com seus snapshots."); } }}><Copy size={16}/>Duplicar</Button>
            <Button variant="secondary" size="sm" onClick={() => exportSession(session.id)}><Download size={16}/>Exportar</Button>
            <Button variant="danger" size="sm" onClick={async () => { if (confirm("Excluir esta sessão e todas as séries?")) await deleteSession(session.id); }}><Trash2 size={16}/>Excluir</Button>
          </div>
        </div>}
      </Card>;
    })}
  </div>;
}

function CompletionBanner({ session }: { session: WorkoutSession }) {
  if (session.status === "completed") return <div className="rounded-3xl bg-green-600 p-5 text-white"><Trophy/><h2 className="mt-3 text-xl font-black">Treino concluído. Objetivo cumprido.</h2><p className="mt-1 text-green-50">Seu histórico, recordes e próxima rotação foram atualizados.</p></div>;
  if (session.status === "partial") return <div className="rounded-3xl bg-amber-100 p-5 text-amber-950 dark:bg-amber-950 dark:text-amber-100"><Dumbbell/><h2 className="mt-3 text-xl font-black">Sessão parcial salva — e ela conta.</h2><p className="mt-1">Você preservou o que fez hoje e a rotação segue sem criar dívida.</p></div>;
  return <div className="rounded-3xl bg-slate-200 p-5 text-slate-800 dark:bg-slate-800 dark:text-slate-100"><Clock3/><h2 className="mt-3 text-xl font-black">Sessão encerrada sem séries concluídas.</h2><p className="mt-1">Nada foi perdido e sua rotação permanece no mesmo treino.</p></div>;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800"><span className="text-green-600">{icon}</span><p className="mt-2 text-xs text-slate-500">{label}</p><strong>{value}</strong></div>;
}
