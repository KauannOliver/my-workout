import type { BaseRecord } from "@/types/models";

export const nowIso = () => new Date().toISOString();
export const uuid = () => crypto.randomUUID();

export function createBase(id = uuid()): BaseRecord {
  const timestamp = nowIso();
  return { id, createdAt: timestamp, updatedAt: timestamp, recordVersion: 1 };
}
