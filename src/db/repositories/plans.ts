import { getDb } from "@/db/database";
import { WORKOUT_CODES } from "@/domain/program/rules";
import { createBase, nowIso } from "@/lib/records";
import type { Program, WorkoutBlock, WorkoutTemplate, WorkoutTemplateItem } from "@/types/models";

export interface NewCustomPlanInput {
  name: string;
  weeklyGoal: number;
  workoutCount: number;
}

export async function getProgramTemplates(programId: string) {
  return getDb().workoutTemplates.where("programId").equals(programId).sortBy("order");
}

export async function resolveCurrentTemplate(program: Program) {
  const templates = (await getProgramTemplates(program.id)).filter((template) => template.active !== false);
  if (!templates.length) return undefined;
  return templates.find((template) => template.id === program.currentTemplateId)
    ?? templates.find((template) => template.code === program.currentRotation)
    ?? templates[0];
}

export function getNextTemplate(templates: WorkoutTemplate[], currentTemplateId?: string) {
  const active = templates.filter((template) => template.active !== false).sort((a, b) => a.order - b.order);
  if (!active.length) return undefined;
  const index = active.findIndex((template) => template.id === currentTemplateId);
  return active[(index < 0 ? 0 : index + 1) % active.length];
}

export async function createCustomPlan(input: NewCustomPlanInput) {
  const db = getDb();
  const workoutCount = Math.min(7, Math.max(1, Math.round(input.workoutCount)));
  const weeklyGoal = Math.min(7, Math.max(1, Math.round(input.weeklyGoal)));
  const plan: Program = {
    ...createBase(), name: input.name.trim() || "Meu plano", kind: "custom", startDate: nowIso().slice(0, 10),
    weeklyGoal, status: "draft", currentRotation: "A",
  };
  const templates: WorkoutTemplate[] = Array.from({ length: workoutCount }, (_, index) => ({
    ...createBase(), programId: plan.id, code: WORKOUT_CODES[index], name: `Treino ${WORKOUT_CODES[index]}`,
    description: "Ficha personalizada", order: index, active: true, cardioProtocol: "none",
  }));
  plan.currentTemplateId = templates[0].id;
  await db.transaction("rw", [db.programs, db.workoutTemplates], async () => {
    await db.programs.add(plan);
    await db.workoutTemplates.bulkAdd(templates);
  });
  return plan;
}

export async function validatePlan(programId: string) {
  const db = getDb();
  const templates = (await getProgramTemplates(programId)).filter((template) => template.active !== false);
  if (!templates.length) throw new Error("Adicione pelo menos uma ficha ao plano.");
  for (const template of templates) {
    const blocks = (await db.workoutBlocks.where("workoutTemplateId").equals(template.id).toArray()).filter((block) => block.active);
    if (!blocks.length) throw new Error(`O treino ${template.code} precisa ter pelo menos um bloco.`);
    for (const block of blocks) {
      const items = (await db.workoutTemplateItems.where("blockId").equals(block.id).toArray()).filter((item) => item.active);
      if (!items.length) throw new Error(`O bloco “${block.name}” do treino ${template.code} está vazio.`);
      if (new Set(items.map((item) => item.exerciseId)).size !== items.length) throw new Error(`O bloco “${block.name}” possui exercício duplicado.`);
    }
  }
  return { templates };
}

export async function activatePlan(programId: string) {
  const db = getDb();
  const activeSession = await db.workoutSessions.where("status").anyOf(["active", "paused"]).first();
  if (activeSession) throw new Error("Finalize ou abandone a sessão em andamento antes de trocar de plano.");
  const program = await db.programs.get(programId);
  if (!program) throw new Error("Plano não encontrado.");
  const { templates } = await validatePlan(programId);
  const now = nowIso();
  await db.transaction("rw", db.programs, async () => {
    const current = await db.programs.where("status").equals("active").toArray();
    for (const item of current) {
      if (item.id !== programId) await db.programs.update(item.id, { status: "paused", updatedAt: now, recordVersion: item.recordVersion + 1 });
    }
    const selected = templates.find((template) => template.id === program.currentTemplateId) ?? templates[0];
    await db.programs.update(programId, {
      status: "active", currentTemplateId: selected.id, currentRotation: selected.code,
      startDate: program.status === "draft" ? now.slice(0, 10) : program.startDate,
      updatedAt: now, recordVersion: program.recordVersion + 1,
    });
  });
}

export async function updatePlan(programId: string, changes: Pick<Program, "name" | "weeklyGoal">) {
  const db = getDb();
  const program = await db.programs.get(programId);
  if (!program) throw new Error("Plano não encontrado.");
  await db.programs.update(programId, {
    name: changes.name.trim() || program.name,
    weeklyGoal: Math.min(7, Math.max(1, Math.round(changes.weeklyGoal ?? program.weeklyGoal ?? 3))),
    updatedAt: nowIso(), recordVersion: program.recordVersion + 1,
  });
}

export async function addWorkoutTemplate(programId: string) {
  const db = getDb();
  const templates = await getProgramTemplates(programId);
  const used = new Set(templates.filter((template) => template.active !== false).map((template) => template.code));
  const code = WORKOUT_CODES.find((candidate) => !used.has(candidate));
  if (!code) throw new Error("Este plano já possui as sete fichas disponíveis (A–G).");
  const inactive = templates.find((template) => template.code === code && template.active === false);
  if (inactive) {
    await db.workoutTemplates.update(inactive.id, { active: true, order: used.size, updatedAt: nowIso(), recordVersion: inactive.recordVersion + 1 });
    return { ...inactive, active: true };
  }
  const template: WorkoutTemplate = {
    ...createBase(), programId, code, name: `Treino ${code}`, description: "Ficha personalizada",
    order: used.size, active: true, cardioProtocol: "none",
  };
  await db.workoutTemplates.add(template);
  return template;
}

export async function updateWorkoutTemplate(templateId: string, changes: Partial<Pick<WorkoutTemplate, "name" | "description" | "cardioProtocol" | "cardioTargetMinutes" | "order">>) {
  const db = getDb();
  const template = await db.workoutTemplates.get(templateId);
  if (!template) return;
  await db.workoutTemplates.update(templateId, { ...changes, updatedAt: nowIso(), recordVersion: template.recordVersion + 1 });
}

export async function deactivateWorkoutTemplate(templateId: string) {
  const db = getDb();
  const template = await db.workoutTemplates.get(templateId);
  if (!template?.programId) return;
  const active = (await getProgramTemplates(template.programId)).filter((item) => item.active !== false);
  if (active.length <= 1) throw new Error("O plano precisa manter pelo menos uma ficha.");
  const program = await db.programs.get(template.programId);
  const remaining = active.filter((item) => item.id !== templateId).sort((a, b) => a.order - b.order);
  await db.transaction("rw", [db.workoutTemplates, db.programs], async () => {
    await db.workoutTemplates.update(templateId, { active: false, updatedAt: nowIso(), recordVersion: template.recordVersion + 1 });
    if (program?.currentTemplateId === templateId) await db.programs.update(program.id, { currentTemplateId: remaining[0].id, currentRotation: remaining[0].code, updatedAt: nowIso(), recordVersion: program.recordVersion + 1 });
  });
}

export async function reorderTemplates(programId: string, orderedIds: string[]) {
  const db = getDb();
  await db.transaction("rw", db.workoutTemplates, async () => {
    for (let index = 0; index < orderedIds.length; index += 1) {
      const template = await db.workoutTemplates.get(orderedIds[index]);
      if (template?.programId === programId) await db.workoutTemplates.update(template.id, { order: index, updatedAt: nowIso(), recordVersion: template.recordVersion + 1 });
    }
  });
}

export async function reorderBlocks(templateId: string, orderedIds: string[]) {
  const db = getDb();
  await db.transaction("rw", db.workoutBlocks, async () => {
    for (let index = 0; index < orderedIds.length; index += 1) {
      const block = await db.workoutBlocks.get(orderedIds[index]);
      if (block?.workoutTemplateId === templateId) await db.workoutBlocks.update(block.id, { order: index, updatedAt: nowIso(), recordVersion: block.recordVersion + 1 });
    }
  });
}

export async function reorderBlockItems(blockId: string, orderedIds: string[]) {
  const db = getDb();
  await db.transaction("rw", db.workoutTemplateItems, async () => {
    for (let index = 0; index < orderedIds.length; index += 1) {
      const item = await db.workoutTemplateItems.get(orderedIds[index]);
      if (item?.blockId === blockId) await db.workoutTemplateItems.update(item.id, { orderInBlock: index, order: index, updatedAt: nowIso(), recordVersion: item.recordVersion + 1 });
    }
  });
}

export async function archivePlan(programId: string) {
  const db = getDb();
  const program = await db.programs.get(programId);
  if (!program) return;
  const activeSession = await db.workoutSessions.where("status").anyOf(["active", "paused"]).first();
  if (activeSession?.programId === programId) throw new Error("Finalize ou abandone a sessão em andamento antes de arquivar este plano.");
  await db.programs.update(programId, { status: "archived", updatedAt: nowIso(), recordVersion: program.recordVersion + 1 });
}

export async function addBlock(templateId: string, name?: string) {
  const db = getDb();
  const existing = await db.workoutBlocks.where("workoutTemplateId").equals(templateId).sortBy("order");
  const block: WorkoutBlock = {
    ...createBase(), workoutTemplateId: templateId, name: name?.trim() || `Bloco ${existing.length + 1}`,
    order: existing.length, rounds: 3, restSeconds: 90, quickModeIncluded: existing.length === 0, active: true,
  };
  await db.workoutBlocks.add(block);
  return block;
}

export async function updateBlock(blockId: string, changes: Partial<Pick<WorkoutBlock, "name" | "rounds" | "restSeconds" | "quickModeIncluded" | "active" | "order">>) {
  const db = getDb();
  const block = await db.workoutBlocks.get(blockId);
  if (!block) return;
  await db.workoutBlocks.update(blockId, {
    ...changes,
    rounds: changes.rounds === undefined ? block.rounds : Math.min(10, Math.max(1, Math.round(changes.rounds))),
    restSeconds: changes.restSeconds === undefined ? block.restSeconds : Math.min(600, Math.max(0, Math.round(changes.restSeconds))),
    updatedAt: nowIso(), recordVersion: block.recordVersion + 1,
  });
}

export async function addExerciseToBlock(block: WorkoutBlock, exerciseId: string) {
  const db = getDb();
  const duplicate = await db.workoutTemplateItems.where("blockId").equals(block.id).filter((item) => item.exerciseId === exerciseId && item.active).first();
  if (duplicate) throw new Error("Este exercício já está no bloco.");
  const exercise = await db.exercises.get(exerciseId);
  if (!exercise) throw new Error("Exercício não encontrado.");
  const items = await db.workoutTemplateItems.where("blockId").equals(block.id).sortBy("orderInBlock");
  const item: WorkoutTemplateItem = {
    ...createBase(), workoutTemplateId: block.workoutTemplateId, exerciseId, originalExerciseId: exerciseId,
    blockId: block.id, block: block.id, order: block.order * 100 + items.length, orderInBlock: items.length,
    minReps: exercise.defaultMinReps ?? 8, maxReps: exercise.defaultMaxReps ?? 12,
    targetRir: 2, restSeconds: block.restSeconds, notes: "", active: true,
  };
  await db.workoutTemplateItems.add(item);
  return item;
}

export async function updateTemplateItem(itemId: string, changes: Partial<Pick<WorkoutTemplateItem, "minReps" | "maxReps" | "targetRir" | "notes" | "active" | "orderInBlock">>) {
  const db = getDb();
  const item = await db.workoutTemplateItems.get(itemId);
  if (!item) return;
  await db.workoutTemplateItems.update(itemId, { ...changes, updatedAt: nowIso(), recordVersion: item.recordVersion + 1 });
}

export async function removeTemplateItem(itemId: string) {
  await getDb().workoutTemplateItems.delete(itemId);
}

export async function removeBlock(blockId: string) {
  const db = getDb();
  await db.transaction("rw", [db.workoutBlocks, db.workoutTemplateItems], async () => {
    await db.workoutTemplateItems.where("blockId").equals(blockId).delete();
    await db.workoutBlocks.delete(blockId);
  });
}

export async function duplicatePlan(programId: string) {
  const db = getDb();
  const source = await db.programs.get(programId);
  if (!source) throw new Error("Plano não encontrado.");
  const sourceTemplates = await getProgramTemplates(programId);
  const copy: Program = { ...source, ...createBase(), name: `${source.name} (cópia)`, kind: "custom", status: "draft", currentTemplateId: undefined };
  await db.transaction("rw", [db.programs, db.workoutTemplates, db.workoutBlocks, db.workoutTemplateItems], async () => {
    await db.programs.add(copy);
    for (const template of sourceTemplates) {
      const newTemplate = { ...template, ...createBase(), programId: copy.id };
      await db.workoutTemplates.add(newTemplate);
      if (!copy.currentTemplateId) copy.currentTemplateId = newTemplate.id;
      const blocks = await db.workoutBlocks.where("workoutTemplateId").equals(template.id).sortBy("order");
      for (const block of blocks) {
        const newBlock = { ...block, ...createBase(), workoutTemplateId: newTemplate.id };
        await db.workoutBlocks.add(newBlock);
        const items = await db.workoutTemplateItems.where("blockId").equals(block.id).toArray();
        await db.workoutTemplateItems.bulkAdd(items.map((item) => ({ ...item, ...createBase(), workoutTemplateId: newTemplate.id, blockId: newBlock.id, block: newBlock.id })));
      }
    }
    if (copy.currentTemplateId) await db.programs.update(copy.id, { currentTemplateId: copy.currentTemplateId });
  });
  return copy;
}
