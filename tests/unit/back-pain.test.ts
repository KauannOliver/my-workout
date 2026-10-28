import { describe, expect, it } from "vitest";
import { getBackPainGuidance } from "@/domain/wellbeing/back-pain";

describe("orientação lombar", () => {
  it.each([[0,"low"],[2,"low"],[3,"medium"],[4,"high"],[10,"high"]])("classifica dor %s", (pain, level) => expect(getBackPainGuidance(pain).level).toBe(level));
  it("não diagnostica", () => expect(getBackPainGuidance(8).message.toLowerCase()).not.toContain("diagnóstico"));
});
