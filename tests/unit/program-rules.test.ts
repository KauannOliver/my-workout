import { describe, expect, it } from "vitest";
import { getProgramWeek, getWeekRule, nextWorkout, WEEK_RULES } from "@/domain/program/rules";

describe("programa de 12 semanas", () => {
  it("possui todas as semanas e fases esperadas", () => {
    expect(WEEK_RULES).toHaveLength(12);
    expect(getWeekRule(1)).toMatchObject({ phase: "Reaclimatação", weeklyGoal: 3, targetRir: 4 });
    expect(getWeekRule(4)).toMatchObject({ phase: "Redução técnica", setsByBlock: { A: 1, B: 1, C: 1 } });
    expect(getWeekRule(8)).toMatchObject({ phase: "Redução de fadiga", loadFactor: 0.875 });
    expect(getWeekRule(12)).toMatchObject({ phase: "Consolidação", weeklyGoal: 4 });
  });

  it("limita a semana entre 1 e 12", () => {
    expect(getProgramWeek("2026-01-05", new Date("2025-12-01"))).toBe(1);
    expect(getProgramWeek("2026-01-05", new Date("2027-01-05"))).toBe(12);
  });

  it("mantém a rotação do programa padrão A-B-C-D", () => {
    const standard = ["A", "B", "C", "D"] as const;
    expect(nextWorkout("A", [...standard])).toBe("B"); expect(nextWorkout("B", [...standard])).toBe("C");
    expect(nextWorkout("C", [...standard])).toBe("D"); expect(nextWorkout("D", [...standard])).toBe("A");
  });

  it("faz rotação A–G e respeita a quantidade real de fichas", () => {
    expect(nextWorkout("G")).toBe("A");
    expect(nextWorkout("C", ["A", "B", "C"])).toBe("A");
    expect(nextWorkout("A", ["A"])).toBe("A");
  });
});
