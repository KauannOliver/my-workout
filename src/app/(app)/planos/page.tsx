"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Archive, ArrowRight, Copy, Dumbbell, Layers3, Plus, RotateCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/field";
import { getDb } from "@/db/database";
import { activatePlan, archivePlan, createCustomPlan, duplicatePlan } from "@/db/repositories/plans";

export default function PlansPage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("Meu plano personalizado");
  const [weeklyGoal, setWeeklyGoal] = useState(4);
  const [workoutCount, setWorkoutCount] = useState(4);
  const [message, setMessage] = useState<string>();
  const [creatingPlan, setCreatingPlan] = useState(false);
  const data = useLiveQuery(async () => {
    const db = getDb();
    const [programs, templates, activeSession] = await Promise.all([
      db.programs.toArray().then((items) => items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
      db.workoutTemplates.toArray(),
      db.workoutSessions.where("status").anyOf(["active", "paused"]).first(),
    ]);
    return { programs, templates, activeSession };
  }, []);

  if (!data) return <p>Carregando seus planos…</p>;
  const visible = data.programs.filter((program) => program.status !== "archived");
  const archived = data.programs.filter((program) => program.status === "archived");
  const run = async (action: () => Promise<unknown>, success: string) => {
    try { await action(); setMessage(success); } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível concluir a ação."); }
  };

  return <div className="space-y-5">
    <PageHeader eyebrow="Personalize sem perder seu histórico" title="Meus planos" description="Guarde vários planos, alterne quando quiser e mantenha somente um ativo."/>
    {message && <div role="status" className="rounded-2xl bg-green-50 p-4 text-sm font-semibold text-green-900 dark:bg-green-950 dark:text-green-100">{message}</div>}
    {data.activeSession && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Troca de plano protegida</strong><p className="mt-1">Existe uma sessão ativa ou pausada. Você pode editar planos futuros, mas só poderá trocar o plano ativo depois de finalizar essa sessão.</p></div>}

    <Button size="lg" className="w-full" onClick={() => setCreating((value) => !value)}><Plus/>Criar meu plano</Button>
    {creating && <Card className="border-green-300 shadow-lg shadow-green-100/50 dark:shadow-none">
      <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-green-100 text-green-700"><Layers3/></span><div><p className="text-xs font-black uppercase tracking-wide text-green-700">Novo plano personalizado</p><h2 className="text-lg font-black">Configure apenas o essencial</h2><p className="text-sm text-slate-500">Depois você montará cada ficha em um construtor guiado, uma etapa por vez.</p></div></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-3"><Label htmlFor="plan-name">1. Como quer chamar este plano?</Label><Input id="plan-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Ex.: Hipertrofia — segundo semestre"/><p className="mt-1 text-xs text-slate-500">Use um nome que você reconheça rapidamente no dashboard.</p></div>
        <div><Label htmlFor="weekly-goal">2. Meta semanal</Label><Select id="weekly-goal" value={weeklyGoal} onChange={(event) => setWeeklyGoal(Number(event.target.value))}>{Array.from({ length: 7 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value} treino{value > 1 ? "s" : ""}</option>)}</Select><p className="mt-1 text-xs text-slate-500">Serve para medir consistência.</p></div>
        <div><Label htmlFor="workout-count">3. Fichas na rotação</Label><Select id="workout-count" value={workoutCount} onChange={(event) => setWorkoutCount(Number(event.target.value))}>{Array.from({ length: 7 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value} · {Array.from({ length: value }, (_, item) => String.fromCharCode(65 + item)).join("–")}</option>)}</Select><p className="mt-1 text-xs text-slate-500">Você poderá adicionar ou remover depois.</p></div>
      </div>
      <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-800"><strong>Seu ponto de partida</strong><p className="mt-1 text-slate-600 dark:text-slate-300">Meta de {weeklyGoal} treino{weeklyGoal > 1 ? "s" : ""}/semana · rotação {Array.from({ length: workoutCount }, (_, item) => String.fromCharCode(65 + item)).join(" → ")} · sem vínculo obrigatório com dias.</p></div>
      <Button className="mt-5 w-full" disabled={creatingPlan || !name.trim()} onClick={async () => { setCreatingPlan(true); try { const plan = await createCustomPlan({ name, weeklyGoal, workoutCount }); window.location.assign(`/planos/${plan.id}`); } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível criar o plano."); setCreatingPlan(false); } }}>{creatingPlan ? "Criando plano…" : "Continuar para o construtor"} {!creatingPlan && <ArrowRight/>}</Button>
    </Card>}

    <div className="grid gap-4 lg:grid-cols-2">{visible.map((program) => {
      const templates = data.templates.filter((template) => template.programId === program.id && template.active !== false).sort((a, b) => a.order - b.order);
      const isActive = program.status === "active";
      return <Card key={program.id} className={isActive ? "border-green-400 ring-2 ring-green-100 dark:ring-green-950" : undefined}>
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-green-700">{program.kind === "custom" ? "Plano personalizado" : "Programa de 12 semanas"}</p><h2 className="mt-1 text-xl font-black">{program.name}</h2><p className="mt-1 text-sm text-slate-500">{templates.length} ficha{templates.length !== 1 ? "s" : ""} · meta de {program.weeklyGoal ?? 4}/semana</p></div>{isActive && <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-700">Ativo</span>}</div>
        <div className="mt-4 flex gap-2 overflow-x-auto">{templates.map((template) => <span key={template.id} className="grid h-10 min-w-10 place-items-center rounded-xl bg-slate-100 font-black dark:bg-slate-800">{template.code}</span>)}</div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          {program.kind === "custom" ? <Link href={`/planos/${program.id}`}><Button variant="secondary" className="w-full">Editar <ArrowRight size={16}/></Button></Link> : <Button variant="secondary" onClick={() => run(async () => { const copy = await duplicatePlan(program.id); router.push(`/planos/${copy.id}`); }, "Cópia criada.")}><Copy size={16}/>Usar como base</Button>}
          {!isActive && <Button onClick={() => run(() => activatePlan(program.id), "Plano ativado.")} disabled={Boolean(data.activeSession)}><RotateCw size={16}/>Ativar</Button>}
          {program.kind === "custom" && <Button variant="ghost" onClick={() => run(async () => { const copy = await duplicatePlan(program.id); router.push(`/planos/${copy.id}`); }, "Cópia criada.")}><Copy size={16}/>Duplicar</Button>}
          {program.kind === "custom" && !isActive && <Button variant="ghost" onClick={() => run(() => archivePlan(program.id), "Plano arquivado.")}><Archive size={16}/>Arquivar</Button>}
        </div>
      </Card>;
    })}</div>

    {archived.length > 0 && <details><summary className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 font-bold dark:border-slate-800 dark:bg-slate-900">Planos arquivados ({archived.length})</summary><div className="mt-3 space-y-2">{archived.map((program) => <div key={program.id} className="flex items-center justify-between rounded-2xl bg-slate-100 p-4 dark:bg-slate-800"><span><strong className="block">{program.name}</strong><span className="text-sm text-slate-500">Histórico preservado</span></span><Button size="sm" variant="secondary" onClick={() => run(() => activatePlan(program.id), "Plano retomado.")} disabled={Boolean(data.activeSession)}><Dumbbell size={16}/>Retomar</Button></div>)}</div></details>}
  </div>;
}
