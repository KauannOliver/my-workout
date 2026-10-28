import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) throw new Error("Uso: node scripts/generate-exercise-catalog.mjs <anexo.txt> <saida.ts>");

const source = readFileSync(inputPath, "utf8");
const lines = source.split(/\r?\n/);
const rows = [];
let group = "";

for (const rawLine of lines) {
  const line = rawLine.trim();
  if (line.startsWith("# ")) {
    group = line.slice(2).trim();
    continue;
  }
  if (!group || !line.startsWith("|") || /^\|\s*-+/.test(line) || /Exercício\s*\|/i.test(line)) continue;
  const cells = line.slice(1, -1).split("|").map((cell) => cell.trim().replace(/\*\*/g, ""));
  if (cells.length < 6) continue;
  const [name, prescription, rest, instructions, alternative, backCare] = cells;
  rows.push({ name, group, prescription, rest, instructions, alternative, backCare });
}

const normalize = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const demandRank = { "very-low": 0, low: 1, moderate: 2, high: 3, "very-high": 4 };
const parseDemand = (value) => {
  const normalized = normalize(value);
  if (normalized.includes("muito-alta")) return "very-high";
  if (normalized.includes("alta")) return "high";
  if (normalized.includes("moderada")) return "moderate";
  if (normalized.includes("muito-baixa")) return "very-low";
  return "low";
};
const equipmentFor = (name) => {
  const value = normalize(name);
  if (/(maquina|cadeira|mesa-flexora|leg-press|hack|smith)/.test(value)) return "Máquina";
  if (/(cabo|corda|polia|crossover|pallof)/.test(value)) return "Cabo/polia";
  if (/(halter|farmer)/.test(value)) return "Halteres";
  if (/(barra|terra|stiff|agachamento-frontal|good-morning)/.test(value)) return "Barra";
  if (/(elastico|mini-band)/.test(value)) return "Elástico";
  if (/(flexao|prancha|dead-bug|bird-dog|hollow|superman|abdominal|elevacao-de-pernas|ponte|nordica)/.test(value)) return "Peso corporal";
  return "Equipamento variado";
};
const incrementFor = (row, equipment) => {
  const name = normalize(row.name);
  if (equipment === "Peso corporal" || /(farmer|prancha|isometr|carry|segurar|sustent)/.test(name)) return 0;
  if (equipment === "Máquina" || /(quadriceps|posteriores|gluteos|panturrilhas)/.test(normalize(row.group))) return 5;
  if (equipment === "Cabo/polia" || /(rosca|triceps|elevacao-lateral|crucifixo|voador|face-pull|pullover)/.test(name)) return 2.5;
  return 2.5;
};
const stableId = (name) => {
  const hex = createHash("sha256").update(`meu-treino:${normalize(name)}`).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};
const parseNumbers = (value) => [...value.matchAll(/\d+/g)].map((match) => Number(match[0]));

const merged = new Map();
for (const row of rows) {
  const normalizedName = normalize(row.name);
  const key = normalizedName === "stiff-com-barra" ? "levantamento-romeno-com-barra" : normalizedName;
  const current = merged.get(key);
  if (!current) {
    merged.set(key, { ...row, groups: [row.group], aliases: [] });
    continue;
  }
  current.groups = [...new Set([...current.groups, row.group])];
  if (normalize(current.name) !== normalizedName) current.aliases.push(row.name);
  if (demandRank[parseDemand(row.backCare)] > demandRank[parseDemand(current.backCare)]) current.backCare = row.backCare;
  current.alternative = [...new Set([current.alternative, row.alternative].filter(Boolean))].join("; ");
}

const generatedAt = "2026-08-04T00:00:00.000Z";
const catalog = [...merged.values()].map((row) => {
  const numbers = parseNumbers(row.prescription);
  const restNumbers = parseNumbers(row.rest);
  const equipment = equipmentFor(row.name);
  const backDemand = parseDemand(row.backCare);
  return {
    id: stableId(row.name), createdAt: generatedAt, updatedAt: generatedAt, recordVersion: 1,
    name: row.name, muscleGroup: row.groups[0], muscleGroups: row.groups, equipment,
    instructions: row.instructions, backCare: row.backCare,
    alternatives: row.alternative.split(";").map((item) => item.trim()).filter(Boolean), aliases: [...new Set(row.aliases)],
    defaultMinReps: numbers[0] ?? 8, defaultMaxReps: numbers[1] ?? numbers[0] ?? 12,
    defaultPrescription: row.prescription, defaultRestSeconds: restNumbers.at(-1) ?? 75,
    backDemand, technicalLevel: demandRank[backDemand] >= 3 ? "advanced" : demandRank[backDemand] === 2 ? "intermediate" : "beginner",
    source: "catalog", loadIncrement: incrementFor(row, equipment), active: true, custom: false, favorite: false,
  };
});

const output = `import type { Exercise } from "@/types/models";\n\nexport const EXERCISE_CATALOG: Exercise[] = ${JSON.stringify(catalog, null, 2)};\n`;
writeFileSync(outputPath, output, "utf8");
process.stdout.write(JSON.stringify({ rows: rows.length, unique: catalog.length, groups: new Set(catalog.flatMap((item) => item.muscleGroups)).size, farmerCarry: catalog.filter((item) => normalize(item.name) === "farmer-carry").length, counts: Object.fromEntries([...new Set(catalog.map((item) => item.muscleGroup))].map((groupName) => [groupName, catalog.filter((item) => item.muscleGroup === groupName).length])) }));
