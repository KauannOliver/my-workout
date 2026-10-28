import { createBase } from "@/lib/records";
import type { AchievementDefinition, Exercise, WorkoutBlock, WorkoutTemplate, WorkoutTemplateItem } from "@/types/models";

const EXERCISE_NAMES = [
  ["supino-barra", "Supino reto com barra", "Peito", "Barra e banco", 2.5, "Mantenha os pés firmes e as escápulas apoiadas.", "Evite arquear excessivamente a lombar."],
  ["remada-maquina", "Remada em máquina com peito apoiado", "Costas", "Máquina", 5, "Puxe os cotovelos sem tirar o peito do apoio.", "O apoio no peito reduz a demanda lombar."],
  ["supino-inclinado", "Supino inclinado com halteres", "Peito", "Halteres e banco", 2, "Controle a descida e mantenha os punhos neutros.", "Use encosto e amplitude confortável."],
  ["puxada-neutra", "Puxada frontal com pegada neutra", "Costas", "Polia", 5, "Puxe em direção ao peito sem balançar.", "Mantenha o tronco estável."],
  ["triceps-corda", "Tríceps na corda", "Tríceps", "Polia", 2.5, "Estenda os cotovelos sem mover os ombros.", "Fique em base estável e sem inclinar o tronco."],
  ["elevacao-lateral", "Elevação lateral", "Ombros", "Halteres", 1, "Eleve com controle até a linha dos ombros.", "Pode ser feita sentada com encosto."],
  ["extensora", "Cadeira extensora", "Quadríceps", "Máquina", 5, "Alinhe o joelho ao eixo da máquina.", "Mantenha a lombar apoiada."],
  ["flexora-sentada", "Cadeira ou mesa flexora", "Posterior de coxa", "Máquina", 5, "Flexione sem tirar o quadril do apoio.", "Escolha a variação com maior conforto lombar."],
  ["desenvolvimento-maquina", "Desenvolvimento em máquina com encosto", "Ombros", "Máquina", 5, "Empurre sem elevar os ombros.", "Mantenha toda a coluna apoiada."],
  ["pallof", "Pallof press", "Core", "Polia", 2.5, "Resista à rotação e respire normalmente.", "Use carga que permita pelve e tronco neutros."],
  ["dead-bug", "Dead bug", "Core", "Peso corporal", 0, "Estenda membros opostos sem perder o controle.", "Reduza a amplitude se a lombar sair do apoio."],
  ["supino-halteres", "Supino reto com halteres", "Peito", "Halteres e banco", 2, "Controle a descida e mantenha simetria.", "Mantenha a lombar confortável no banco."],
  ["remada-baixa", "Remada baixa sentada com pegada neutra", "Costas", "Polia", 5, "Puxe sem projetar o tronco para trás.", "Use postura sentada estável."],
  ["crucifixo-maquina", "Crucifixo na máquina", "Peito", "Máquina", 5, "Feche os braços sem perder o apoio.", "Mantenha cabeça e coluna apoiadas."],
  ["puxada-supinada", "Puxada frontal supinada ou neutra", "Costas", "Polia", 5, "Conduza os cotovelos para baixo.", "Evite balanço do tronco."],
  ["rosca-ez", "Rosca direta com barra W ou EZ", "Bíceps", "Barra W", 2.5, "Mantenha cotovelos próximos ao corpo.", "Pode ser feita sentada ou junto à parede."],
  ["leg-press", "Leg press 45 graus", "Quadríceps", "Máquina", 10, "Desça até onde a pelve permaneça apoiada.", "Não deixe a lombar arredondar no fundo."],
  ["flexora-deitada", "Flexora deitada", "Posterior de coxa", "Máquina", 5, "Flexione os joelhos sem levantar o quadril.", "Ajuste o apoio para não comprimir a lombar."],
  ["panturrilha-maquina", "Panturrilha em máquina", "Panturrilha", "Máquina", 5, "Use amplitude controlada e pausa no topo.", "Mantenha o tronco apoiado quando possível."],
  ["rosca-inclinada", "Rosca inclinada com halteres", "Bíceps", "Halteres e banco", 2, "Mantenha os braços atrás do tronco e controle a descida.", "Use banco com encosto firme."],
  ["triceps-frances", "Tríceps francês na corda", "Tríceps", "Polia", 2.5, "Estenda os cotovelos sem compensar com o tronco.", "Use posição estável e abdômen ativo."],
] as const;

const exerciseId = (index: number) => `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
const templateId = (index: number) => `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
const itemId = (index: number) => `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
const blockId = (template: number, block: number) => `35000000-0000-4000-${String(template + 1).padStart(4, "0")}-${String(block + 1).padStart(12, "0")}`;

export const SEED_EXERCISES: Exercise[] = EXERCISE_NAMES.map(([slug, name, muscleGroup, equipment, loadIncrement, instructions, backCare], index) => ({
  ...createBase(exerciseId(index)),
  name,
  muscleGroup,
  equipment,
  instructions,
  backCare,
  alternatives: slug === "dead-bug" ? ["Bird dog com amplitude reduzida"] : [`Variação segura de ${name.toLowerCase()}`],
  loadIncrement,
  active: true,
  custom: false,
  favorite: false,
}));

export const SEED_TEMPLATES: WorkoutTemplate[] = [
  { ...createBase(templateId(0)), code: "A", name: "Peito, costas, tríceps e ombros", description: "Três bisets de membros superiores", order: 1 },
  { ...createBase(templateId(1)), code: "B", name: "Pernas, ombros e core", description: "Pernas estáveis, ombros apoiados e core", order: 2 },
  { ...createBase(templateId(2)), code: "C", name: "Peito, costas e braços", description: "Três bisets de membros superiores", order: 3 },
  { ...createBase(templateId(3)), code: "D", name: "Pernas, core e braços", description: "Pernas, anti-rotação e braços", order: 4 },
];

export const SEED_BLOCKS: WorkoutBlock[] = SEED_TEMPLATES.flatMap((template, templateIndex) => ["A", "B", "C"].map((code, blockIndex) => ({
  ...createBase(blockId(templateIndex, blockIndex)), workoutTemplateId: template.id, name: `Bloco ${code}`,
  order: blockIndex, rounds: 2, restSeconds: [90, 75, 60][blockIndex], quickModeIncluded: blockIndex < 2,
  active: true, legacyCode: code as "A" | "B" | "C",
})));

type ItemSeed = [number, number, "A" | "B" | "C", number, number, number, string];
const ITEMS: ItemSeed[] = [
  [0, 0, "A", 6, 10, 90, "Controle a descida."], [0, 1, "A", 8, 12, 90, "Peito sempre apoiado."],
  [0, 2, "B", 8, 12, 75, "Use amplitude confortável."], [0, 3, "B", 8, 12, 75, "Evite balanço."],
  [0, 4, "C", 10, 15, 60, "Cotovelos estáveis."], [0, 5, "C", 12, 20, 60, "Movimento controlado."],
  [1, 6, "A", 10, 15, 90, "Ajuste o eixo da máquina."], [1, 7, "A", 10, 15, 90, "Mantenha o quadril apoiado."],
  [1, 8, "B", 8, 12, 75, "Coluna no encosto."], [1, 5, "B", 12, 20, 75, "Prefira execução sentada."],
  [1, 9, "C", 10, 12, 60, "Repetições por lado."], [1, 10, "C", 8, 10, 60, "Repetições por lado."],
  [2, 11, "A", 8, 12, 90, "Controle e simetria."], [2, 12, "A", 8, 12, 90, "Tronco estável."],
  [2, 13, "B", 10, 15, 75, "Não force a amplitude."], [2, 14, "B", 8, 12, 75, "Sem inclinar o tronco."],
  [2, 15, "C", 10, 15, 60, "Sem embalo."], [2, 4, "C", 10, 15, 60, "Cotovelos estáveis."],
  [3, 16, "A", 8, 12, 90, "Não arredonde a lombar."], [3, 17, "A", 10, 15, 90, "Quadril apoiado."],
  [3, 18, "B", 10, 15, 75, "Pausa no topo."], [3, 9, "B", 10, 12, 75, "Repetições por lado."],
  [3, 19, "C", 10, 15, 60, "Use o encosto."], [3, 20, "C", 10, 15, 60, "Evite compensar com a lombar."],
];

export const SEED_TEMPLATE_ITEMS: WorkoutTemplateItem[] = ITEMS.map(([template, exercise, block, minReps, maxReps, restSeconds, notes], index) => ({
  ...createBase(itemId(index)),
  workoutTemplateId: templateId(template),
  exerciseId: exerciseId(exercise),
  originalExerciseId: exerciseId(exercise),
  blockId: blockId(template, ["A", "B", "C"].indexOf(block)),
  block,
  order: index % 6,
  orderInBlock: index % 2,
  minReps,
  maxReps,
  targetRir: 2,
  restSeconds,
  notes,
  active: true,
}));

const achievements = [
  ["first-workout", "Primeiro treino", "Você começou seu ciclo.", 1, "Dumbbell"],
  ["minimum-week", "Semana mínima", "Três sessões concluídas na semana.", 3, "CalendarCheck"],
  ["full-rotation", "Rotação completa", "Treinos A, B, C e D concluídos.", 4, "RefreshCw"],
  ["four-weeks", "Quatro semanas consistentes", "Quatro semanas ativas.", 4, "Flame"],
  ["first-increase", "Primeiro aumento", "Primeira progressão de carga.", 1, "TrendingUp"],
  ["ten-records", "Dez recordes", "Dez recordes pessoais registrados.", 10, "Trophy"],
  ["fast-workout", "Treino eficiente", "Sessão concluída em menos de 45 minutos.", 1, "Timer"],
  ["return", "Volta consistente", "Você voltou depois de uma pausa.", 1, "RotateCcw"],
  ["deload", "Redução concluída", "Semana de redução respeitada.", 1, "BatteryCharging"],
  ["twelve-weeks", "Ciclo completo", "Doze semanas concluídas.", 12, "Medal"],
] as const;

export const SEED_ACHIEVEMENTS: AchievementDefinition[] = achievements.map(([code, name, description, target, icon], index) => ({
  ...createBase(`40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`), code, name, description, target, icon,
}));
