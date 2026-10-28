import { afterEach, describe, expect, it } from "vitest";
import { MeuTreinoDatabase } from "@/db/database";
import { WEEK_RULES } from "@/domain/program/rules";

let db: MeuTreinoDatabase | undefined;
afterEach(async () => { await db?.delete(); db = undefined; });

describe("IndexedDB", () => {
  it("cria todas as tabelas versionadas", async () => {
    db = new MeuTreinoDatabase(); await db.open();
    expect(db.verno).toBe(2);
    expect(db.tables.map((table) => table.name)).toEqual(expect.arrayContaining(["profiles", "programs", "workoutBlocks", "workoutSessions", "setLogs", "bodyMeasurements", "progressPhotos", "mutationJournal"]));
  });

  it("aceita as 12 regras semanais usando week como chave", async () => {
    db = new MeuTreinoDatabase(); await db.open(); await db.programWeekRules.bulkPut(WEEK_RULES);
    expect(await db.programWeekRules.count()).toBe(12);
    expect((await db.programWeekRules.get(12))?.phase).toBe("Consolidação");
  });
});
