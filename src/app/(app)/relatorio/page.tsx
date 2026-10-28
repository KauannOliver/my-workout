"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { subDays } from "date-fns";
import { Download, FileText, Share2 } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { getDb } from "@/db/database";
import { downloadBlob } from "@/services/backup/backup";
import { createCyclePdf } from "@/services/pdf/report";
import { formatDuration } from "@/lib/utils";

export default function ReportPage() {
  const [programId, setProgramId] = useState("");
  const [period, setPeriod] = useState(84);
  const data = useLiveQuery(async () => { const db = getDb(); return { profile: await db.profiles.toCollection().first(), programs: await db.programs.toArray(), sessions: await db.workoutSessions.toArray(), sets: await db.setLogs.toArray(), cardio: await db.cardioLogs.toArray(), measurements: await db.bodyMeasurements.orderBy("measuredAt").toArray() }; }, []);
  if (!data?.profile) return <p>Gerando relatório…</p>;
  const effectiveProgramId = programId || data.programs.find((program) => program.status === "active")?.id || data.programs[0]?.id || "";
  const program = data.programs.find((item) => item.id === effectiveProgramId);
  const start = period ? subDays(new Date(), period) : undefined;
  const sessions = data.sessions.filter((session) => session.programId === effectiveProgramId && (!start || new Date(session.startedAt) >= start));
  const completed = sessions.filter((session) => session.status === "completed");
  const partial = sessions.filter((session) => session.status === "partial");
  const valid = [...completed, ...partial];
  const sessionIds = new Set(valid.map((session) => session.id));
  const records = data.sets.filter((set) => set.personalRecord && sessionIds.has(set.sessionId)).length;
  const total = valid.reduce((sum, session) => sum + (session.totalDurationSeconds ?? 0), 0);
  const cardio = data.cardio.filter((item) => sessionIds.has(item.sessionId)).reduce((sum, item) => sum + item.durationSeconds, 0);
  const standard = (program?.kind ?? "standard-12-week") === "standard-12-week";
  const planned = standard ? 44 : Math.max(1, Math.round((period || 84) / 7) * (program?.weeklyGoal ?? 3));
  const metrics = { name: data.profile.name, completed: completed.length, partial: partial.length, planned, totalSeconds: total, cardioSeconds: cardio, records, startWeight: data.measurements[0]?.weight, endWeight: data.measurements.at(-1)?.weight, averageEnergy: valid.length ? valid.reduce((sum, item) => sum + item.energyBefore, 0) / valid.length : undefined, averageEnjoyment: valid.length ? valid.reduce((sum, item) => sum + (item.enjoymentAfter ?? 0), 0) / valid.length : undefined, averagePain: valid.length ? valid.reduce((sum, item) => sum + (item.backPainAfter ?? 0), 0) / valid.length : undefined };
  const pdf = async (share = false) => { const bytes = await createCyclePdf(metrics); const filename = standard ? "relatorio-12-semanas.pdf" : `relatorio-${program?.name ?? "plano"}.pdf`; const file = new File([bytes as BlobPart], filename, { type: "application/pdf" }); if (share && navigator.canShare?.({ files: [file] })) await navigator.share({ title: "Relatório Meu Treino", files: [file] }); else downloadBlob(bytes as BlobPart, filename, "application/pdf"); };

  return <div className="space-y-5">
    <PageHeader title={standard ? "Relatório das 12 semanas" : "Relatório do plano"} description={standard ? "Visão exclusiva do ciclo guiado de 12 semanas." : "Acompanhamento por período do seu plano personalizado."}/>
    <Card className="grid gap-3 sm:grid-cols-2"><Select aria-label="Plano do relatório" value={effectiveProgramId} onChange={(event) => setProgramId(event.target.value)}>{data.programs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select><Select aria-label="Período do relatório" value={standard ? 0 : period} disabled={standard} onChange={(event) => setPeriod(Number(event.target.value))}>{standard && <option value={0}>Ciclo completo</option>}<option value={28}>Últimos 28 dias</option><option value={84}>Últimas 12 semanas</option><option value={0}>Todo o período</option></Select></Card>
    <Card className="bg-gradient-to-br from-green-700 to-green-600 text-white"><FileText size={34}/><h2 className="mt-4 text-2xl font-black">{program?.name}</h2><p className="mt-2 text-green-50">O relatório é gerado localmente e inclui somente as sessões deste plano.</p><div className="mt-5 grid grid-cols-2 gap-3"><Button variant="secondary" onClick={() => pdf(false)}><Download size={17}/>Baixar PDF</Button><Button variant="secondary" onClick={() => pdf(true)}><Share2 size={17}/>Compartilhar</Button></div></Card>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric label="Concluídas" value={String(completed.length)}/><Metric label="Parciais" value={String(partial.length)}/><Metric label="Tempo total" value={formatDuration(total)}/><Metric label="Recordes" value={String(records)}/><Metric label="Cardio" value={`${Math.round(cardio / 60)} min`}/><Metric label="Aderência estimada" value={`${Math.round(valid.length / planned * 100)}%`}/><Metric label="Energia média" value={metrics.averageEnergy?.toFixed(1) ?? "—"}/><Metric label="Prazer médio" value={metrics.averageEnjoyment?.toFixed(1) ?? "—"}/></div>
    <Card><h2 className="font-black">Leitura responsável</h2><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Use frequência, técnica, repetições, RIR e bem-estar em conjunto. Não teste 1RM e procure orientação profissional antes de mudanças relevantes.</p></Card>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <Card className="p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></Card>; }
