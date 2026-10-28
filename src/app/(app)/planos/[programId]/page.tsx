"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, CheckCircle2, Circle, Dumbbell, GripVertical, Info, Plus, Save, Search, Star, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/field";
import { getDb } from "@/db/database";
import {
  activatePlan, addBlock, addExerciseToBlock, addWorkoutTemplate, deactivateWorkoutTemplate,
  removeBlock, removeTemplateItem, reorderBlockItems, reorderBlocks, reorderTemplates,
  updateBlock, updatePlan, updateTemplateItem, updateWorkoutTemplate, validatePlan,
} from "@/db/repositories/plans";
import { getGroupKind } from "@/domain/workout/bisets";
import { nowIso } from "@/lib/records";
import type { BackDemand, Exercise } from "@/types/models";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const backDemandLabel: Record<BackDemand, string> = { "very-low": "Muito baixa", low: "Baixa", moderate: "Moderada", high: "Alta", "very-high": "Muito alta" };
const swap = (ids: string[], id: string, direction: -1 | 1) => {
  const index = ids.indexOf(id); const target = index + direction;
  if (index < 0 || target < 0 || target >= ids.length) return ids;
  const copy = [...ids]; [copy[index], copy[target]] = [copy[target], copy[index]]; return copy;
};

const builderSteps = [
  { id: 1, label: "Objetivo", description: "Nome e frequência" },
  { id: 2, label: "Fichas", description: "Organize A–G" },
  { id: 3, label: "Montagem", description: "Blocos e exercícios" },
  { id: 4, label: "Revisão", description: "Confira e ative" },
] as const;

export default function PlanBuilderPage() {
  const { programId } = useParams<{ programId: string }>();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>();
  const [catalogBlockId, setCatalogBlockId] = useState<string>();
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState("");
  const [safetyFilter, setSafetyFilter] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [message, setMessage] = useState<string>();
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [draggedBlock, setDraggedBlock] = useState<string>();
  const [draggedItem, setDraggedItem] = useState<string>();
  const data = useLiveQuery(async () => {
    const db = getDb();
    const [program, templates, blocks, items, exercises, activeSession] = await Promise.all([
      db.programs.get(programId),
      db.workoutTemplates.where("programId").equals(programId).sortBy("order"),
      db.workoutBlocks.toArray(), db.workoutTemplateItems.toArray(), db.exercises.orderBy("name").toArray(),
      db.workoutSessions.where("status").anyOf(["active", "paused"]).first(),
    ]);
    return { program, templates: templates.filter((template) => template.active !== false), blocks, items, exercises, activeSession };
  }, [programId]);

  const groups = useMemo(() => [...new Set(data?.exercises.flatMap((exercise) => exercise.muscleGroups ?? [exercise.muscleGroup]) ?? [])].sort(), [data?.exercises]);
  const equipment = useMemo(() => [...new Set(data?.exercises.map((exercise) => exercise.equipment) ?? [])].sort(), [data?.exercises]);
  if (!data) return <p>Carregando construtor…</p>;
  if (!data.program) return <Card><h1 className="font-black">Plano não encontrado</h1><Link href="/planos"><Button className="mt-4">Voltar</Button></Link></Card>;
  if (data.program.kind !== "custom") return <Card><h1 className="text-xl font-black">O programa de 12 semanas permanece protegido</h1><p className="mt-2 text-slate-500">Duplique-o em “Meus planos” para criar uma versão personalizada sem alterar o ciclo original.</p><Link href="/planos"><Button className="mt-4"><ArrowLeft/>Meus planos</Button></Link></Card>;

  const selectedTemplate = data.templates.find((template) => template.id === selectedTemplateId) ?? data.templates[0];
  const blocks = selectedTemplate ? data.blocks.filter((block) => block.workoutTemplateId === selectedTemplate.id && block.active).sort((a, b) => a.order - b.order) : [];
  const templateSummaries = data.templates.map((template) => {
    const templateBlocks = data.blocks.filter((block) => block.workoutTemplateId === template.id && block.active);
    const exerciseCount = templateBlocks.reduce((total, block) => total + data.items.filter((item) => item.blockId === block.id && item.active).length, 0);
    const emptyBlocks = templateBlocks.filter((block) => !data.items.some((item) => item.blockId === block.id && item.active)).length;
    return { template, blockCount: templateBlocks.length, exerciseCount, ready: templateBlocks.length > 0 && emptyBlocks === 0 };
  });
  const planReady = templateSummaries.length > 0 && templateSummaries.every((summary) => summary.ready);
  const run = async (action: () => Promise<unknown>, success?: string) => {
    setSaveState("saving");
    try {
      await action();
      setSaveState("saved");
      if (success) { setMessage(success); setMessageTone("success"); }
    } catch (error) {
      setSaveState("error");
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar a alteração.");
    }
  };
  const filteredExercises = data.exercises.filter((exercise) => {
    const haystack = normalize([exercise.name, ...(exercise.aliases ?? [])].join(" "));
    return exercise.active && haystack.includes(normalize(search))
      && (!groupFilter || (exercise.muscleGroups ?? [exercise.muscleGroup]).includes(groupFilter))
      && (!equipmentFilter || exercise.equipment === equipmentFilter)
      && (!safetyFilter || exercise.backDemand === safetyFilter)
      && (!favoritesOnly || exercise.favorite);
  });

  return <div className="space-y-5">
    <Link href="/planos" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-green-700"><ArrowLeft size={18}/>Meus planos</Link>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <PageHeader eyebrow="Construtor guiado A–G" title={data.program.name} description="Uma etapa por vez. Toda alteração é salva automaticamente neste dispositivo."/>
      <div className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold ${saveState === "error" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`} role="status">
        {saveState === "saving" ? <Circle className="animate-pulse" size={16}/> : saveState === "error" ? <AlertTriangle size={16}/> : <Save size={16}/>}
        {saveState === "saving" ? "Salvando…" : saveState === "error" ? "Falha ao salvar" : "Alterações salvas"}
      </div>
    </div>
    {message && <div role="status" className={`rounded-2xl border p-4 text-sm font-semibold ${messageTone === "error" ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100" : "border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100"}`}>{message}</div>}
    <nav aria-label="Etapas do construtor" className="grid grid-cols-4 gap-2">
      {builderSteps.map((item) => <button key={item.id} type="button" onClick={() => setStep(item.id)} aria-current={step === item.id ? "step" : undefined} className={`min-h-16 rounded-2xl border px-2 py-3 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-200 ${step === item.id ? "border-green-600 bg-green-600 text-white shadow-sm" : item.id < step ? "border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100" : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}>
        <span className="flex items-center gap-1 text-xs font-black uppercase tracking-wide">{item.id < step ? <Check size={14}/> : `${item.id}.`} {item.label}</span>
        <span className="mt-1 hidden text-xs opacity-80 sm:block">{item.description}</span>
      </button>)}
    </nav>

    {step === 1 && <Card className="border-green-200">
      <div className="flex gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-green-100 font-black text-green-700">1</span><div><h2 className="text-lg font-black">Defina a intenção do plano</h2><p className="mt-1 text-sm text-slate-500">A meta semanal mede consistência. A quantidade de fichas define apenas a rotação, não dias fixos.</p></div></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_12rem]">
        <div><Label htmlFor="builder-name">Nome do plano</Label><Input id="builder-name" defaultValue={data.program.name} maxLength={80} placeholder="Ex.: Hipertrofia — segundo semestre" onBlur={(event) => run(() => updatePlan(programId, { name: event.target.value, weeklyGoal: data.program!.weeklyGoal ?? 4 }), "Informações salvas.")}/></div>
        <div><Label htmlFor="builder-goal">Meta por semana</Label><Select id="builder-goal" value={data.program.weeklyGoal ?? 4} onChange={(event) => run(() => updatePlan(programId, { name: data.program!.name, weeklyGoal: Number(event.target.value) }))}>{Array.from({ length: 7 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value} treino{value > 1 ? "s" : ""}</option>)}</Select></div>
      </div>
      <div className="mt-4 flex gap-2 rounded-2xl bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-100"><Info className="shrink-0" size={18}/><p>Exemplo: uma rotação A–D pode ter meta de 3 treinos por semana. Ao concluir A, o próximo será B, mesmo que a semana mude.</p></div>
    </Card>}

    {step === 2 && <Card>
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-black">2. Fichas da rotação</h2><p className="text-sm text-slate-500">A ordem abaixo define o próximo treino, sem prender a um dia da semana.</p></div><Button size="sm" onClick={() => run(() => addWorkoutTemplate(programId), "Ficha adicionada.")} disabled={data.templates.length >= 7}><Plus/>Ficha</Button></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{templateSummaries.map(({ template, blockCount, exerciseCount, ready }, index) => <div key={template.id} className={`rounded-2xl border p-3 ${template.id === selectedTemplate?.id ? "border-green-500 bg-green-50 ring-2 ring-green-100 dark:bg-green-950 dark:ring-green-900" : "border-slate-200 dark:border-slate-700"}`}>
        <button type="button" onClick={() => setSelectedTemplateId(template.id)} className="flex min-h-14 w-full items-center gap-3 text-left">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl font-black ${template.id === selectedTemplate?.id ? "bg-green-600 text-white" : "bg-slate-100 dark:bg-slate-800"}`}>{template.code}</span>
          <span className="min-w-0 flex-1"><strong className="block truncate">{template.name}</strong><span className="text-xs text-slate-500">{blockCount} bloco{blockCount !== 1 ? "s" : ""} · {exerciseCount} exercício{exerciseCount !== 1 ? "s" : ""}</span></span>
          {ready ? <CheckCircle2 className="shrink-0 text-green-600" size={19}/> : <Circle className="shrink-0 text-slate-300" size={19}/>} 
        </button>
        <div className="mt-2 flex justify-end gap-1 border-t border-slate-100 pt-2 dark:border-slate-800"><button aria-label={`Mover treino ${template.code} para a esquerda`} disabled={index === 0} onClick={() => run(() => reorderTemplates(programId, swap(data.templates.map((item) => item.id), template.id, -1)))} className="grid h-11 w-11 place-items-center rounded-xl hover:bg-white disabled:opacity-30 dark:hover:bg-slate-800">←</button><button aria-label={`Mover treino ${template.code} para a direita`} disabled={index === data.templates.length - 1} onClick={() => run(() => reorderTemplates(programId, swap(data.templates.map((item) => item.id), template.id, 1)))} className="grid h-11 w-11 place-items-center rounded-xl hover:bg-white disabled:opacity-30 dark:hover:bg-slate-800">→</button></div>
      </div>)}</div>
    </Card>}

    {step === 2 && selectedTemplate && <Card className="border-green-200">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-green-700">Treino {selectedTemplate.code}</p><h2 className="text-lg font-black">Identidade e finalização</h2><p className="mt-1 text-sm text-slate-500">Dê um nome fácil de reconhecer durante o treino e escolha se haverá cardio.</p></div>{data.templates.length > 1 && <Button size="sm" variant="ghost" onClick={() => run(() => deactivateWorkoutTemplate(selectedTemplate.id), "Ficha removida da rotação.")}><Trash2 size={16}/>Remover</Button>}</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div><Label htmlFor="template-name">Nome da ficha</Label><Input id="template-name" defaultValue={selectedTemplate.name} onBlur={(event) => run(() => updateWorkoutTemplate(selectedTemplate.id, { name: event.target.value }))}/></div>
          <div><Label htmlFor="template-cardio">Cardio após a musculação</Label><Select id="template-cardio" value={selectedTemplate.cardioProtocol ?? "none"} onChange={(event) => run(() => updateWorkoutTemplate(selectedTemplate.id, { cardioProtocol: event.target.value as typeof selectedTemplate.cardioProtocol }))}><option value="none">Sem cardio planejado</option><option value="continuous">Contínuo</option><option value="interval-30-60">Intervalado 30/60</option><option value="interval-45-75">Intervalado 45/75</option><option value="custom">Personalizado</option></Select></div>
          {selectedTemplate.cardioProtocol !== "none" && <div><Label htmlFor="cardio-minutes">Meta de cardio (min)</Label><Input id="cardio-minutes" type="number" min="1" max="180" value={selectedTemplate.cardioTargetMinutes ?? 10} onChange={(event) => run(() => updateWorkoutTemplate(selectedTemplate.id, { cardioTargetMinutes: Number(event.target.value) }))}/></div>}
        </div>
      </Card>}

    {step === 3 && selectedTemplate && <>
      <div className="flex gap-2 overflow-x-auto rounded-2xl bg-slate-100 p-2 dark:bg-slate-800" aria-label="Escolher ficha para montar">{templateSummaries.map(({ template, ready }) => <button key={template.id} type="button" onClick={() => setSelectedTemplateId(template.id)} className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-black ${template.id === selectedTemplate.id ? "bg-white text-green-700 shadow-sm dark:bg-slate-900 dark:text-green-400" : "text-slate-600 dark:text-slate-300"}`}>Treino {template.code}{ready && <Check size={15}/>}</button>)}</div>
      <div className="flex gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100"><Info className="shrink-0" size={19}/><div><strong>Como funciona um bloco?</strong><p className="mt-1">1 exercício: descansa após cada série. 2 ou mais: executa todos em sequência e descansa somente no final da rodada.</p></div></div>
      <div className="flex items-center justify-between"><div><h2 className="text-xl font-black">3. Blocos do treino {selectedTemplate.code}</h2><p className="text-sm text-slate-500">O descanso acontece depois do último exercício ativo de cada rodada.</p></div><Button onClick={() => run(() => addBlock(selectedTemplate.id), "Bloco criado.")}><Plus/>Bloco</Button></div>
      {blocks.length === 0 && <Card className="border-dashed text-center"><Dumbbell className="mx-auto text-slate-400"/><h3 className="mt-3 font-black">Comece adicionando um bloco</h3><p className="mt-1 text-sm text-slate-500">Um exercício vira série simples; dois, biset; três, triset; quatro ou mais, circuito.</p></Card>}
      {blocks.map((block, blockIndex) => {
        const items = data.items.filter((item) => item.blockId === block.id && item.active).sort((a, b) => (a.orderInBlock ?? a.order) - (b.orderInBlock ?? b.order));
        const kind = getGroupKind(items.length);
        return <Card key={block.id} draggable onDragStart={() => setDraggedBlock(block.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (!draggedBlock || draggedBlock === block.id) return; const ids = blocks.map((item) => item.id); const from = ids.indexOf(draggedBlock); const to = ids.indexOf(block.id); ids.splice(to, 0, ids.splice(from, 1)[0]); void run(() => reorderBlocks(selectedTemplate.id, ids)); setDraggedBlock(undefined); }} className="p-0 overflow-hidden">
          <div className="border-b border-slate-100 p-4 dark:border-slate-800">
            <div className="flex items-center gap-3"><GripVertical className="cursor-grab text-slate-400"/><span className="grid h-11 w-11 place-items-center rounded-2xl bg-green-100 font-black text-green-700">{blockIndex + 1}</span><div className="flex-1"><Input aria-label="Nome do bloco" defaultValue={block.name} className="min-h-10 border-0 bg-transparent px-0 text-lg font-black shadow-none" onBlur={(event) => run(() => updateBlock(block.id, { name: event.target.value }))}/><p className="text-sm text-slate-500">{kind}{items.length > 6 ? " · grupo longo" : ""}</p></div><Button aria-label="Excluir bloco" size="sm" variant="ghost" onClick={() => { if (confirm("Excluir este bloco e seus exercícios?")) void run(() => removeBlock(block.id), "Bloco removido."); }}><Trash2 size={17}/></Button></div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><div><Label htmlFor={`rounds-${block.id}`}>{items.length <= 1 ? "Séries" : "Rodadas"}</Label><Input id={`rounds-${block.id}`} type="number" min="1" max="10" value={block.rounds} onChange={(event) => run(() => updateBlock(block.id, { rounds: Number(event.target.value) }))}/></div><div><Label htmlFor={`rest-${block.id}`}>Descanso (s)</Label><Input id={`rest-${block.id}`} type="number" min="0" max="600" step="15" value={block.restSeconds} onChange={(event) => run(() => updateBlock(block.id, { restSeconds: Number(event.target.value) }))}/></div><label className="col-span-2 flex min-h-12 items-center gap-3 self-end rounded-2xl bg-amber-50 px-4 text-sm font-bold text-amber-900"><input type="checkbox" checked={block.quickModeIncluded} onChange={(event) => run(() => updateBlock(block.id, { quickModeIncluded: event.target.checked }))} className="h-5 w-5 accent-green-600"/>Incluir no treino rápido</label></div>
            <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200"><strong>Fluxo durante a sessão:</strong> {items.length === 0 ? "adicione um exercício para visualizar." : <>{items.map((item) => data.exercises.find((exercise) => exercise.id === item.exerciseId)?.name ?? "Exercício").join(" → ")} → <span className="font-bold text-green-700 dark:text-green-400">descanso de {block.restSeconds}s</span> · repetir {block.rounds}x</>}</div>
            {items.length > 6 && <div className="mt-3 flex gap-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="shrink-0" size={18}/><p>Este circuito tem mais de seis exercícios. Ele continua válido, mas pode gerar fadiga e tornar o registro menos prático.</p></div>}
            <div className="mt-3 flex gap-2"><Button size="sm" variant="secondary" disabled={blockIndex === 0} onClick={() => run(() => reorderBlocks(selectedTemplate.id, swap(blocks.map((item) => item.id), block.id, -1)))}><ArrowUp size={16}/>Subir</Button><Button size="sm" variant="secondary" disabled={blockIndex === blocks.length - 1} onClick={() => run(() => reorderBlocks(selectedTemplate.id, swap(blocks.map((item) => item.id), block.id, 1)))}><ArrowDown size={16}/>Descer</Button></div>
          </div>
          <div className="space-y-2 p-3">{items.map((item, itemIndex) => {
            const exercise = data.exercises.find((candidate) => candidate.id === item.exerciseId);
            return <div key={item.id} draggable onDragStart={(event) => { event.stopPropagation(); setDraggedItem(item.id); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); if (!draggedItem || draggedItem === item.id) return; const ids = items.map((candidate) => candidate.id); const from = ids.indexOf(draggedItem); const to = ids.indexOf(item.id); ids.splice(to, 0, ids.splice(from, 1)[0]); void run(() => reorderBlockItems(block.id, ids)); setDraggedItem(undefined); }} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex items-start gap-3"><GripVertical className="mt-2 cursor-grab text-slate-400" size={18}/><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-sm font-black dark:bg-slate-800">{itemIndex + 1}</span><div className="flex-1"><strong>{exercise?.name ?? "Exercício indisponível"}</strong><p className="text-xs text-slate-500">{exercise?.muscleGroup} · {exercise?.equipment}</p></div><Button aria-label="Remover exercício" size="sm" variant="ghost" onClick={() => run(() => removeTemplateItem(item.id))}><Trash2 size={16}/></Button></div>
              {(exercise?.backDemand === "high" || exercise?.backDemand === "very-high") && <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900"><strong>Alta demanda lombar.</strong> O exercício continua disponível, mas requer técnica segura e atenção aos sintomas.</div>}
              <div className="mt-3 grid grid-cols-3 gap-2"><div><Label htmlFor={`min-${item.id}`}>Mín.</Label><Input id={`min-${item.id}`} type="number" min="1" value={item.minReps} onChange={(event) => run(() => updateTemplateItem(item.id, { minReps: Number(event.target.value) }))}/></div><div><Label htmlFor={`max-${item.id}`}>Máx.</Label><Input id={`max-${item.id}`} type="number" min="1" value={item.maxReps} onChange={(event) => run(() => updateTemplateItem(item.id, { maxReps: Number(event.target.value) }))}/></div><div><Label htmlFor={`rir-${item.id}`}>RIR</Label><Input id={`rir-${item.id}`} type="number" min="0" max="10" value={item.targetRir ?? 2} onChange={(event) => run(() => updateTemplateItem(item.id, { targetRir: Number(event.target.value) }))}/></div></div>
              <div className="mt-2 flex gap-2"><Button size="sm" variant="ghost" disabled={itemIndex === 0} onClick={() => run(() => reorderBlockItems(block.id, swap(items.map((candidate) => candidate.id), item.id, -1)))}><ArrowUp size={15}/></Button><Button size="sm" variant="ghost" disabled={itemIndex === items.length - 1} onClick={() => run(() => reorderBlockItems(block.id, swap(items.map((candidate) => candidate.id), item.id, 1)))}><ArrowDown size={15}/></Button></div>
            </div>;
          })}
          <Button variant="secondary" className="w-full" onClick={() => setCatalogBlockId(catalogBlockId === block.id ? undefined : block.id)}><Plus/>Adicionar exercício</Button>
          </div>
        </Card>;
      })}
      {catalogBlockId && blocks.find((block) => block.id === catalogBlockId) && (() => {
        const targetBlock = blocks.find((block) => block.id === catalogBlockId)!;
        const targetItems = data.items.filter((item) => item.blockId === targetBlock.id && item.active);
        return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={`Adicionar exercício em ${targetBlock.name}`}>
          <div className="max-h-[92dvh] w-full max-w-3xl overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:rounded-3xl">
            <ExerciseCatalog exercises={filteredExercises} existingIds={new Set(targetItems.map((item) => item.exerciseId))} search={search} setSearch={setSearch} groups={groups} groupFilter={groupFilter} setGroupFilter={setGroupFilter} equipment={equipment} equipmentFilter={equipmentFilter} setEquipmentFilter={setEquipmentFilter} safetyFilter={safetyFilter} setSafetyFilter={setSafetyFilter} favoritesOnly={favoritesOnly} setFavoritesOnly={setFavoritesOnly} onClose={() => setCatalogBlockId(undefined)} onAdd={(exerciseId, warning) => run(async () => { await addExerciseToBlock(targetBlock, exerciseId); if (warning) { setMessageTone("success"); setMessage("Exercício adicionado. O alerta de demanda lombar continuará visível no bloco e antes da sessão."); } }, warning ? undefined : "Exercício adicionado.")}/>
          </div>
        </div>;
      })()}
    </>}

    {step === 4 && <>
      <Card className={planReady ? "border-green-300 bg-green-50 dark:bg-green-950" : "border-amber-300 bg-amber-50 dark:bg-amber-950"}>
        <div className="flex gap-3">{planReady ? <CheckCircle2 className="shrink-0 text-green-700"/> : <AlertTriangle className="shrink-0 text-amber-700"/>}<div><h2 className="text-lg font-black">{planReady ? "Seu plano está pronto" : "Ainda faltam alguns detalhes"}</h2><p className="mt-1 text-sm opacity-80">Cada ficha precisa ter pelo menos um bloco, e cada bloco precisa conter um exercício.</p></div></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">{templateSummaries.map(({ template, blockCount, exerciseCount, ready }) => <button type="button" key={template.id} onClick={() => { setSelectedTemplateId(template.id); setStep(ready ? 2 : 3); }} className={`flex min-h-20 items-center gap-3 rounded-2xl border bg-white p-4 text-left dark:bg-slate-900 ${ready ? "border-green-200" : "border-amber-300"}`}>
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl font-black ${ready ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-800"}`}>{template.code}</span><span className="min-w-0 flex-1"><strong className="block truncate">{template.name}</strong><span className="text-xs text-slate-500">{blockCount} bloco{blockCount !== 1 ? "s" : ""} · {exerciseCount} exercício{exerciseCount !== 1 ? "s" : ""}</span></span>{ready ? <CheckCircle2 className="text-green-600" size={19}/> : <ArrowRight className="text-amber-700" size={19}/>} 
        </button>)}</div>
        <div className="mt-5 rounded-2xl bg-white/80 p-4 text-sm dark:bg-slate-900/70"><strong>Depois de ativar</strong><p className="mt-1 text-slate-600 dark:text-slate-300">A rotação começará pelo treino A. Alterações futuras valerão somente para novas sessões; seu histórico continuará intacto.</p></div>
        <Button size="lg" className="mt-5 w-full" disabled={!planReady || Boolean(data.activeSession && data.activeSession.programId !== programId)} onClick={() => run(async () => { await validatePlan(programId); await activatePlan(programId); router.push("/inicio"); }, "Plano ativado.")}><Dumbbell/>Ativar e começar a usar</Button>
        {data.activeSession && data.activeSession.programId !== programId && <p className="mt-3 text-center text-sm font-medium text-amber-800">Finalize a sessão atual antes de trocar de plano.</p>}
      </Card>
    </>}

    <div className="sticky bottom-20 z-30 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 lg:bottom-4">
      <Button variant="secondary" disabled={step === 1} onClick={() => setStep((current) => Math.max(1, current - 1))}><ArrowLeft size={17}/>Voltar</Button>
      <div className="hidden text-center text-xs text-slate-500 sm:block"><strong className="block text-slate-800 dark:text-slate-100">Etapa {step} de 4</strong>{builderSteps[step - 1].description}</div>
      {step < 4 ? <Button onClick={() => setStep((current) => Math.min(4, current + 1))}>{step === 3 ? "Revisar plano" : "Continuar"}<ArrowRight size={17}/></Button> : <Button variant="secondary" onClick={() => setStep(3)}>Editar montagem</Button>}
    </div>
  </div>;
}

function ExerciseCatalog({ exercises, existingIds, search, setSearch, groups, groupFilter, setGroupFilter, equipment, equipmentFilter, setEquipmentFilter, safetyFilter, setSafetyFilter, favoritesOnly, setFavoritesOnly, onAdd, onClose }: {
  exercises: Exercise[]; existingIds: Set<string>; search: string; setSearch: (value: string) => void;
  groups: string[]; groupFilter: string; setGroupFilter: (value: string) => void; equipment: string[]; equipmentFilter: string; setEquipmentFilter: (value: string) => void;
  safetyFilter: string; setSafetyFilter: (value: string) => void; favoritesOnly: boolean; setFavoritesOnly: (value: boolean) => void; onAdd: (id: string, warning: boolean) => void; onClose: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);
  return <div className="flex max-h-[92dvh] flex-col">
    <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:p-5"><div><p className="text-xs font-black uppercase tracking-wide text-green-700">Catálogo de exercícios</p><h2 className="mt-1 text-xl font-black">Escolha um exercício</h2><p className="mt-1 text-sm text-slate-500">Use a busca ou combine filtros. Você pode adicionar vários sem fechar.</p></div><Button aria-label="Fechar catálogo" variant="ghost" onClick={onClose}><X/></Button></div>
    <div className="border-b border-slate-100 p-4 dark:border-slate-800 sm:p-5"><div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 text-slate-400" size={18}/><Input aria-label="Buscar exercício" autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou alternativa…" className="pl-10"/></div>
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4"><Select aria-label="Filtrar por grupo" value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}><option value="">Todos os grupos</option>{groups.map((group) => <option key={group}>{group}</option>)}</Select><Select aria-label="Filtrar por equipamento" value={equipmentFilter} onChange={(event) => setEquipmentFilter(event.target.value)}><option value="">Equipamentos</option>{equipment.map((item) => <option key={item}>{item}</option>)}</Select><Select aria-label="Filtrar por demanda lombar" value={safetyFilter} onChange={(event) => setSafetyFilter(event.target.value)}><option value="">Demanda lombar</option>{Object.entries(backDemandLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select><button type="button" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(!favoritesOnly)} className={`min-h-11 rounded-xl border px-3 text-sm font-bold ${favoritesOnly ? "border-amber-400 bg-amber-100 text-amber-900" : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"}`}><Star className="mr-1 inline" size={16}/>Favoritos</button></div></div>
    <div className="flex-1 space-y-2 overflow-auto p-4 sm:p-5">{exercises.slice(0, 60).map((exercise) => {
      const alreadyAdded = existingIds.has(exercise.id);
      const warning = exercise.backDemand === "high" || exercise.backDemand === "very-high";
      return <div key={exercise.id} className="flex items-start gap-3 rounded-2xl bg-white p-3 dark:bg-slate-900"><button type="button" aria-label={`${exercise.favorite ? "Remover" : "Adicionar"} ${exercise.name} dos favoritos`} onClick={() => getDb().exercises.update(exercise.id, { favorite: !exercise.favorite, updatedAt: nowIso(), recordVersion: exercise.recordVersion + 1 })} className="grid h-11 w-11 shrink-0 place-items-center"><Star size={18} className={exercise.favorite ? "fill-amber-400 text-amber-500" : "text-slate-400"}/></button><div className="flex-1"><strong className="text-sm">{exercise.name}</strong><p className="text-xs text-slate-500">{exercise.muscleGroup} · {exercise.equipment} · {backDemandLabel[exercise.backDemand ?? "moderate"]}</p>{warning && <p className="mt-1 text-xs font-bold text-red-700"><AlertTriangle className="mr-1 inline" size={13}/>Alta demanda lombar</p>}</div><Button aria-label={`Adicionar ${exercise.name} ao bloco`} size="sm" disabled={alreadyAdded} onClick={() => onAdd(exercise.id, warning)}><Plus size={15}/></Button></div>;
    })}{exercises.length === 0 && <p className="p-5 text-center text-sm text-slate-500">Nenhum exercício corresponde aos filtros.</p>}</div>
    <div className="flex items-center justify-between gap-3 border-t border-slate-200 p-4 text-xs text-slate-500 dark:border-slate-800"><span>Mostrando {Math.min(60, exercises.length)} de {exercises.length}. A busca ignora acentos.</span><Button variant="secondary" onClick={onClose}>Concluir</Button></div>
  </div>;
}
