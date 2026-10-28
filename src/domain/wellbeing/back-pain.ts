export function getBackPainGuidance(pain: number) {
  if (pain >= 4) return { level: "high" as const, title: "Atenção à lombar", message: "Não recomendamos progressão hoje. Reduza ou interrompa se houver piora. Dor irradiada, dormência ou fraqueza exigem avaliação profissional." };
  if (pain === 3) return { level: "medium" as const, title: "Treine com cautela", message: "Considere reduzir carga ou amplitude e priorize movimentos estáveis." };
  return { level: "low" as const, title: "Tudo certo para começar", message: "Mantenha a técnica e registre qualquer mudança durante a sessão." };
}
