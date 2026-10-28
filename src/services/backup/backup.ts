import JSZip from "jszip";
import { z } from "zod";
import { backupEnvelopeSchema } from "@/db/schema";
import { deleteAllLocalData, getDb } from "@/db/database";
import { nowIso } from "@/lib/records";

export const BACKUP_SCHEMA_VERSION = 2;
export const BACKUP_TABLES_V1 = ["profiles", "appSettings", "programs", "programWeekRules", "exercises", "workoutTemplates", "workoutTemplateItems", "workoutSessions", "exerciseLogs", "setLogs", "cardioLogs", "bodyMeasurements", "progressPhotos", "notificationPreferences", "notificationInbox", "achievementDefinitions", "userAchievements", "mutationJournal"] as const;
export const BACKUP_TABLES = ["profiles", "appSettings", "programs", "programWeekRules", "exercises", "workoutTemplates", "workoutBlocks", "workoutTemplateItems", "workoutSessions", "exerciseLogs", "setLogs", "cardioLogs", "bodyMeasurements", "progressPhotos", "notificationPreferences", "notificationInbox", "achievementDefinitions", "userAchievements", "mutationJournal"] as const;

const baseRecordSchema = z.object({
  id: z.string().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  recordVersion: z.number().int().positive(),
}).passthrough();

const weekRuleBackupSchema = z.object({
  week: z.number().int().min(1).max(12),
  phase: z.string().min(1),
  weeklyGoal: z.number().int().min(1).max(7),
  setsByBlock: z.object({ A: z.number().int().positive(), B: z.number().int().positive(), C: z.number().int().positive() }),
  targetRir: z.number().min(0).max(10),
  loadFactor: z.number().positive(),
  cardio: z.string().min(1),
  note: z.string(),
}).passthrough();

const photoBackupSchema = baseRecordSchema.extend({
  blob: z.object({ __blob: z.literal(true), mimeType: z.string().min(1), base64: z.string() }),
});

export function validateBackupData(data: Record<string, unknown[]>, schemaVersion = data.workoutBlocks ? 2 : 1) {
  const requiredTables = schemaVersion >= 2 ? BACKUP_TABLES : BACKUP_TABLES_V1;
  for (const name of requiredTables) {
    const records = data[name];
    if (!Array.isArray(records)) throw new Error(`O backup não contém a tabela obrigatória ${name}.`);
    const ids = new Set<string>();
    records.forEach((record, index) => {
      try {
        const parsed = name === "programWeekRules"
          ? weekRuleBackupSchema.parse(record)
          : name === "progressPhotos"
            ? photoBackupSchema.parse(record)
            : baseRecordSchema.parse(record);
        if ("id" in parsed) {
          if (ids.has(parsed.id as string)) throw new Error("ID duplicado");
          ids.add(parsed.id as string);
        }
      } catch {
        throw new Error(`Há um registro inválido em ${name}, posição ${index + 1}.`);
      }
    });
  }

  const idsFor = (table: string) => new Set((data[table] ?? []).map((item) => (item as { id?: unknown }).id).filter((id): id is string => typeof id === "string"));
  const sessionIds = idsFor("workoutSessions");
  const exerciseLogIds = idsFor("exerciseLogs");
  const templateIds = idsFor("workoutTemplates");
  const blockIds = idsFor("workoutBlocks");
  const assertReference = (table: string, record: unknown, field: string, target: Set<string>, optional = false) => {
    const value = (record as Record<string, unknown>)[field];
    if (optional && value == null) return;
    if (typeof value === "string" && !target.has(value)) throw new Error(`O backup possui uma referência inválida em ${table}.${field}.`);
  };
  data.exerciseLogs.forEach((record) => assertReference("exerciseLogs", record, "sessionId", sessionIds));
  data.setLogs.forEach((record) => {
    assertReference("setLogs", record, "sessionId", sessionIds);
    assertReference("setLogs", record, "exerciseLogId", exerciseLogIds);
  });
  data.cardioLogs.forEach((record) => assertReference("cardioLogs", record, "sessionId", sessionIds, true));
  if (schemaVersion >= 2) {
    data.workoutBlocks.forEach((record) => assertReference("workoutBlocks", record, "workoutTemplateId", templateIds));
    data.workoutTemplateItems.forEach((record) => assertReference("workoutTemplateItems", record, "blockId", blockIds));
  }
}

async function blobToData(blob: Blob) {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (const byte of buffer) binary += String.fromCharCode(byte);
  return { __blob: true, mimeType: blob.type, base64: btoa(binary) };
}

function dataToBlob(value: { mimeType: string; base64: string }) {
  const binary = atob(value.base64); const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: value.mimeType });
}

async function checksum(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

type BackupEnvelope = z.infer<typeof backupEnvelopeSchema>;

function migrateV1Data(source: Record<string, unknown[]>) {
  const data = structuredClone(source);
  data.workoutBlocks = [];
  const programs = data.programs as Record<string, unknown>[];
  const templates = data.workoutTemplates as Record<string, unknown>[];
  const items = data.workoutTemplateItems as Record<string, unknown>[];
  const standardProgram = programs.find((program) => program.status === "active") ?? programs[0];

  for (const program of programs) {
    const programTemplates = templates.filter((template) => !template.programId || template.programId === program.id);
    const current = programTemplates.find((template) => template.code === program.currentRotation) ?? programTemplates[0];
    program.kind = program.kind ?? "standard-12-week";
    program.durationWeeks = program.durationWeeks ?? 12;
    program.weeklyGoal = program.weeklyGoal ?? 4;
    program.currentTemplateId = program.currentTemplateId ?? current?.id;
  }

  for (const template of templates) {
    template.programId = template.programId ?? standardProgram?.id;
    template.active = template.active ?? true;
    template.cardioProtocol = template.cardioProtocol ?? "continuous";
    const templateItems = items.filter((item) => item.workoutTemplateId === template.id);
    const blockCodes = [...new Set(templateItems.map((item) => String(item.block ?? "A")))];
    blockCodes.forEach((code, blockIndex) => {
      const blockItems = templateItems.filter((item) => String(item.block ?? "A") === code).sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
      const id = `legacy-block:${String(template.id)}:${code}`;
      const last = blockItems.at(-1);
      const timestamp = String(template.updatedAt ?? template.createdAt ?? nowIso());
      (data.workoutBlocks as unknown[]).push({
        id, createdAt: timestamp, updatedAt: timestamp, recordVersion: 1,
        workoutTemplateId: template.id, name: `Bloco ${code}`, order: blockIndex,
        rounds: 2, restSeconds: Number(last?.restSeconds ?? 60), quickModeIncluded: code !== "C",
        active: true, legacyCode: ["A", "B", "C"].includes(code) ? code : undefined,
      });
      blockItems.forEach((item, itemIndex) => {
        item.blockId = id;
        item.orderInBlock = itemIndex;
        item.targetRir = item.targetRir ?? 2;
      });
    });
  }
  const programKinds = new Map(programs.map((program) => [program.id, program.kind]));
  for (const session of data.workoutSessions as Record<string, unknown>[]) session.programKind = session.programKind ?? programKinds.get(session.programId);
  for (const settings of data.appSettings as Record<string, unknown>[]) settings.databaseVersion = 2;
  for (const table of BACKUP_TABLES) data[table] ??= [];
  return data;
}

async function parseBackup(content: string) {
  if (content.length > 100 * 1024 * 1024) throw new Error("O backup excede o limite de 100 MB.");
  let envelope: BackupEnvelope;
  try {
    envelope = backupEnvelopeSchema.parse(JSON.parse(content));
  } catch {
    throw new Error("O arquivo selecionado não é um backup válido do Meu Treino.");
  }
  if (envelope.schemaVersion > BACKUP_SCHEMA_VERSION) throw new Error("Este backup foi criado por uma versão mais nova do aplicativo.");
  if (await checksum(JSON.stringify(envelope.data)) !== envelope.checksum) throw new Error("O backup está corrompido ou foi alterado.");
  validateBackupData(envelope.data, envelope.schemaVersion);
  const data = envelope.schemaVersion === 1 ? migrateV1Data(envelope.data) : envelope.data;
  validateBackupData(data, 2);
  return { envelope, data };
}

export async function inspectBackup(content: string) {
  const { envelope, data } = await parseBackup(content);
  return {
    sourceSchemaVersion: envelope.schemaVersion,
    targetSchemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: envelope.exportedAt,
    counts: Object.fromEntries(BACKUP_TABLES.map((name) => [name, data[name]?.length ?? 0])),
  };
}

export async function createBackup() {
  const db = getDb(); const data: Record<string, unknown[]> = {};
  const settings = await db.appSettings.toCollection().first();
  if (settings) await db.appSettings.update(settings.id, { lastBackupAt: nowIso(), updatedAt: nowIso(), recordVersion: settings.recordVersion + 1 });
  for (const name of BACKUP_TABLES) {
    const records = await db.table(name).toArray();
    data[name] = await Promise.all(records.map(async (record: Record<string, unknown>) => record.blob instanceof Blob ? { ...record, blob: await blobToData(record.blob) } : record));
  }
  const serialized = JSON.stringify(data);
  return JSON.stringify({ format: "meu-treino-backup", schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: new Date().toISOString(), checksum: await checksum(serialized), data }, null, 2);
}

export async function restoreBackup(content: string) {
  const { data } = await parseBackup(content);
  const db = getDb();
  await db.transaction("rw", BACKUP_TABLES.map((name) => db.table(name)), async () => {
    for (const name of BACKUP_TABLES) await db.table(name).clear();
    for (const name of BACKUP_TABLES) {
      const records = (data[name] ?? []).map((record) => {
        const value = record as Record<string, unknown>;
        if (name === "progressPhotos" && value.blob && typeof value.blob === "object" && "__blob" in value.blob) return { ...value, blob: dataToBlob(value.blob as unknown as { mimeType: string; base64: string }) };
        return value;
      });
      if (records.length) await db.table(name).bulkAdd(records);
    }
  });
}

function csv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const keys = [...new Set(rows.flatMap(Object.keys))];
  const cell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return `\ufeff${keys.map(cell).join(",")}\n${rows.map((row) => keys.map((key) => cell(typeof row[key] === "object" ? JSON.stringify(row[key]) : row[key])).join(",")).join("\n")}`;
}

export async function createCsvArchive() {
  const db = getDb(); const zip = new JSZip();
  for (const name of ["workoutSessions", "exerciseLogs", "setLogs", "cardioLogs", "bodyMeasurements", "userAchievements"] as const) zip.file(`${name}.csv`, csv(await db.table(name).toArray()));
  return zip.generateAsync({ type: "blob" });
}

export function downloadBlob(content: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type })); const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export { deleteAllLocalData };
