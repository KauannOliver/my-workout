import { describe, expect, it } from "vitest";
import { validateBackupData } from "@/services/backup/backup";

const tables = ["profiles", "appSettings", "programs", "programWeekRules", "exercises", "workoutTemplates", "workoutTemplateItems", "workoutSessions", "exerciseLogs", "setLogs", "cardioLogs", "bodyMeasurements", "progressPhotos", "notificationPreferences", "notificationInbox", "achievementDefinitions", "userAchievements", "mutationJournal"];
const emptyBackup = () => Object.fromEntries(tables.map((table) => [table, []])) as Record<string, unknown[]>;
const record = (id: string) => ({ id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), recordVersion: 1 });

describe("validação de backup", () => {
  it("aceita a estrutura completa sem registros", () => expect(() => validateBackupData(emptyBackup())).not.toThrow());

  it("rejeita tabela ausente", () => {
    const data = emptyBackup();
    delete data.setLogs;
    expect(() => validateBackupData(data)).toThrow(/setLogs/);
  });

  it("rejeita registro sem metadados de versão", () => {
    const data = emptyBackup();
    data.profiles = [{ id: "profile" }];
    expect(() => validateBackupData(data)).toThrow(/profiles/);
  });

  it("rejeita série ligada a uma sessão inexistente", () => {
    const data = emptyBackup();
    data.exerciseLogs = [{ ...record("log"), sessionId: "missing" }];
    expect(() => validateBackupData(data)).toThrow(/exerciseLogs.sessionId/);
  });

  it("aceita a estrutura real de programWeekRules", () => {
    const data = emptyBackup();
    data.programWeekRules = [{ week: 1, phase: "Reaclimatação", weeklyGoal: 3, setsByBlock: { A: 2, B: 2, C: 2 }, targetRir: 4, loadFactor: 1, cardio: "continuous", note: "Técnica" }];
    expect(() => validateBackupData(data)).not.toThrow();
  });

  it("exige workoutBlocks em backups v2", () => {
    const data = emptyBackup();
    expect(() => validateBackupData(data, 2)).toThrow(/workoutBlocks/);
  });
});
