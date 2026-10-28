import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface ReportMetrics {
  name: string; completed: number; partial: number; planned: number; totalSeconds: number; cardioSeconds: number;
  records: number; startWeight?: number; endWeight?: number; averageEnergy?: number; averageEnjoyment?: number; averagePain?: number;
}

export async function createCyclePdf(metrics: ReportMetrics) {
  const pdf = await PDFDocument.create(); const page = pdf.addPage([595, 842]); const regular = await pdf.embedFont(StandardFonts.Helvetica); const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  page.drawRectangle({ x: 0, y: 720, width: 595, height: 122, color: rgb(0.086, 0.639, 0.29) });
  page.drawText("MEU TREINO", { x: 48, y: 794, size: 12, font: bold, color: rgb(1,1,1) });
  page.drawText("Relatorio do ciclo de 12 semanas", { x: 48, y: 758, size: 24, font: bold, color: rgb(1,1,1) });
  page.drawText(metrics.name, { x: 48, y: 735, size: 12, font: regular, color: rgb(.9,1,.93) });
  const adherence = metrics.planned ? Math.round((metrics.completed + metrics.partial) / metrics.planned * 100) : 0;
  const lines = [
    ["Sessoes concluidas", String(metrics.completed)], ["Sessoes parciais", String(metrics.partial)], ["Taxa de adesao", `${adherence}%`],
    ["Tempo total", `${Math.round(metrics.totalSeconds / 3600)} horas`], ["Cardio acumulado", `${Math.round(metrics.cardioSeconds / 60)} minutos`], ["Recordes pessoais", String(metrics.records)],
    ["Peso inicial", metrics.startWeight ? `${metrics.startWeight.toFixed(1)} kg` : "Sem registro"], ["Peso atual", metrics.endWeight ? `${metrics.endWeight.toFixed(1)} kg` : "Sem registro"],
    ["Energia media", metrics.averageEnergy ? `${metrics.averageEnergy.toFixed(1)}/10` : "Sem registro"], ["Prazer medio", metrics.averageEnjoyment ? `${metrics.averageEnjoyment.toFixed(1)}/10` : "Sem registro"], ["Dor lombar media", metrics.averagePain !== undefined ? `${metrics.averagePain.toFixed(1)}/10` : "Sem registro"],
  ];
  page.drawText("Resumo", { x: 48, y: 680, size: 20, font: bold, color: rgb(.07,.1,.15) });
  lines.forEach(([label, value], index) => { const y = 645 - index * 39; page.drawText(label, {x: 48, y, size: 10, font: regular, color: rgb(.4,.44,.5)}); page.drawText(value, {x: 270, y, size: 13, font: bold, color: rgb(.07,.1,.15)}); page.drawLine({start:{x:48,y:y-12},end:{x:547,y:y-12},thickness:.5,color:rgb(.88,.9,.92)}); });
  page.drawText("Consistencia inclui comparecer, adaptar e voltar. Continue priorizando tecnica, recuperacao e bem-estar.", { x: 48, y: 165, size: 10, font: regular, color: rgb(.25,.3,.36), maxWidth: 490, lineHeight: 15 });
  page.drawText(`Gerado em ${new Date().toLocaleDateString("pt-BR")} - dados processados somente neste dispositivo`, { x: 48, y: 48, size: 8, font: regular, color: rgb(.45,.5,.56) });
  return pdf.save();
}
