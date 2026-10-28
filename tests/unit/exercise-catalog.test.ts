import { describe, expect, it } from "vitest";
import { EXERCISE_CATALOG } from "@/db/seed/exercise-catalog.generated";

describe("catálogo geral de exercícios", () => {
  it("contém 133 exercícios únicos em 10 grupos e um Farmer carry", () => {
    const normalized = EXERCISE_CATALOG.map((exercise) => exercise.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
    expect(EXERCISE_CATALOG).toHaveLength(133);
    expect(new Set(normalized).size).toBe(133);
    expect(new Set(EXERCISE_CATALOG.flatMap((exercise) => exercise.muscleGroups ?? [exercise.muscleGroup])).size).toBe(10);
    expect(normalized.filter((name) => name === "farmer carry")).toHaveLength(1);
  });

  it("usa a classificação lombar mais conservadora e incrementos editáveis", () => {
    const advanced = EXERCISE_CATALOG.find((exercise) => exercise.name === "Levantamento terra convencional");
    expect(advanced?.backDemand).toBe("very-high");
    expect(advanced?.technicalLevel).toBe("advanced");
    expect(EXERCISE_CATALOG.find((exercise) => exercise.name === "Prancha frontal")?.loadIncrement).toBe(0);
  });
});
