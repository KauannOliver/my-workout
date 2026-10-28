"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Check, Dumbbell, HeartPulse, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError, Input, Label, Select } from "@/components/ui/field";
import { onboardingSchema, type OnboardingInput } from "@/db/schema";
import { completeOnboarding } from "@/db/repositories/profile";
import { createCustomPlan } from "@/db/repositories/plans";
import { cn } from "@/lib/utils";

const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [programChoice, setProgramChoice] = useState<"standard" | "custom">("standard");
  const { register, handleSubmit, setValue, control, trigger, formState: { errors } } = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { sex: "not-informed", experienceLevel: "beginner", preferredWorkoutDays: [1, 3, 5], preferredWorkoutTime: "18:00", preferredCardio: "Esteira contínua", trainingLocation: "Academia", primaryGoal: "Ganhar consistência e força", hasBackDiscomfort: false, initialBackPain: 0, notificationsEnabled: false, notificationTime: "18:00", weightUnit: "kg" },
  });
  const selectedDays = useWatch({ control, name: "preferredWorkoutDays" }) ?? [];
  const initialBackPain = Number(useWatch({ control, name: "initialBackPain" }) ?? 0);
  const notificationsEnabled = Boolean(useWatch({ control, name: "notificationsEnabled" }));
  const next = async () => {
    const fields: (keyof OnboardingInput)[][] = [["name", "sex", "birthDate", "height", "currentWeight", "targetWeight", "bodyFat"], ["experienceLevel", "preferredWorkoutDays", "preferredWorkoutTime", "preferredCardio", "trainingLocation", "primaryGoal"], ["hasBackDiscomfort", "initialBackPain", "notificationsEnabled", "notificationTime", "weightUnit"]];
    if (await trigger(fields[step])) setStep((value) => Math.min(2, value + 1));
  };
  const submit = handleSubmit(async (data) => {
    setSaving(true);
    try {
      await completeOnboarding(onboardingSchema.parse(data));
      if (programChoice === "custom") {
        const plan = await createCustomPlan({ name: "Meu plano personalizado", weeklyGoal: selectedDays.length || 3, workoutCount: Math.min(7, Math.max(1, selectedDays.length || 3)) });
        router.replace(`/planos/${plan.id}`);
      } else router.replace("/inicio");
    }
    finally { setSaving(false); }
  });
  return <main className="min-h-dvh bg-gradient-to-b from-green-50 to-slate-50 px-4 py-6 dark:from-green-950 dark:to-slate-950">
    <div className="mx-auto max-w-2xl">
      <header className="mb-7 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-green-600 text-white shadow-lg shadow-green-200 dark:shadow-none"><Dumbbell /></span><h1 className="mt-4 text-3xl font-black">Seu treino, do seu jeito.</h1><p className="mt-2 text-slate-600 dark:text-slate-300">Escolha o programa guiado ou monte sua própria rotação. Tudo fica salvo neste dispositivo.</p></header>
      <div className="mb-5 flex gap-2" aria-label={`Etapa ${step + 1} de 3`}>{[0, 1, 2].map((item) => <div key={item} className={cn("h-2 flex-1 rounded-full bg-slate-200", item <= step && "bg-green-600")} />)}</div>
      <Card><form onSubmit={submit}>
        {step === 0 && <section className="space-y-4"><div className="mb-5 flex items-center gap-3"><HeartPulse className="text-green-600" /><div><h2 className="text-xl font-black">Sobre você</h2><p className="text-sm text-slate-500">Usado somente para personalizar sua experiência.</p></div></div>
          <fieldset><legend className="mb-2 text-sm font-semibold text-slate-700">Como quer começar?</legend><div className="grid gap-2 sm:grid-cols-2"><button type="button" aria-pressed={programChoice === "standard"} onClick={() => setProgramChoice("standard")} className={cn("min-h-24 rounded-2xl border p-4 text-left", programChoice === "standard" ? "border-green-600 bg-green-50 ring-2 ring-green-100" : "border-slate-200")}><strong className="block">Programa de 12 semanas</strong><span className="mt-1 block text-sm text-slate-500">Estrutura pronta A–D com progressão guiada.</span></button><button type="button" aria-pressed={programChoice === "custom"} onClick={() => setProgramChoice("custom")} className={cn("min-h-24 rounded-2xl border p-4 text-left", programChoice === "custom" ? "border-green-600 bg-green-50 ring-2 ring-green-100" : "border-slate-200")}><strong className="block">Criar meu plano</strong><span className="mt-1 block text-sm text-slate-500">Monte fichas A–G e seus próprios blocos.</span></button></div></fieldset>
          <div><Label htmlFor="name">Nome</Label><Input id="name" autoComplete="name" {...register("name")} /><FieldError>{errors.name?.message}</FieldError></div>
          <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="sex">Sexo</Label><Select id="sex" {...register("sex")}><option value="not-informed">Prefiro não informar</option><option value="female">Feminino</option><option value="male">Masculino</option><option value="other">Outro</option></Select></div><div><Label htmlFor="birthDate">Data de nascimento</Label><Input id="birthDate" type="date" {...register("birthDate")} /><FieldError>{errors.birthDate?.message}</FieldError></div></div>
          <div className="grid grid-cols-2 gap-4"><div><Label htmlFor="height">Altura (cm)</Label><Input id="height" type="number" inputMode="decimal" {...register("height")} /><FieldError>{errors.height?.message}</FieldError></div><div><Label htmlFor="bodyFat">Gordura % (opcional)</Label><Input id="bodyFat" type="number" inputMode="decimal" step="0.1" {...register("bodyFat")} /></div></div>
          <div className="grid grid-cols-2 gap-4"><div><Label htmlFor="currentWeight">Peso atual</Label><Input id="currentWeight" type="number" inputMode="decimal" step="0.1" {...register("currentWeight")} /><FieldError>{errors.currentWeight?.message}</FieldError></div><div><Label htmlFor="targetWeight">Peso desejado</Label><Input id="targetWeight" type="number" inputMode="decimal" step="0.1" {...register("targetWeight")} /><FieldError>{errors.targetWeight?.message}</FieldError></div></div>
        </section>}
        {step === 1 && <section className="space-y-4"><h2 className="text-xl font-black">Sua rotina</h2>
          <div><Label htmlFor="experienceLevel">Experiência</Label><Select id="experienceLevel" {...register("experienceLevel")}><option value="beginner">Iniciante</option><option value="intermediate">Intermediário</option><option value="advanced">Avançado</option></Select></div>
          <fieldset><legend className="mb-2 text-sm font-semibold text-slate-700">Dias preferidos</legend><div className="grid grid-cols-7 gap-1">{days.map((day, index) => <button type="button" key={day} onClick={() => setValue("preferredWorkoutDays", selectedDays.includes(index) ? selectedDays.filter((value) => value !== index) : [...selectedDays, index], { shouldValidate: true })} className={cn("min-h-11 rounded-xl border text-xs font-bold", selectedDays.includes(index) ? "border-green-600 bg-green-600 text-white" : "border-slate-200")}>{day}</button>)}</div><FieldError>{typeof errors.preferredWorkoutDays?.message === "string" ? errors.preferredWorkoutDays.message : undefined}</FieldError></fieldset>
          <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="preferredWorkoutTime">Horário preferido</Label><Input id="preferredWorkoutTime" type="time" {...register("preferredWorkoutTime")} /></div><div><Label htmlFor="preferredCardio">Cardio preferido</Label><Select id="preferredCardio" {...register("preferredCardio")}><option>Esteira contínua</option><option>Bicicleta contínua</option><option>Caminhada leve</option><option>Esteira intervalada</option><option>Bicicleta intervalada</option></Select></div></div>
          <div><Label htmlFor="trainingLocation">Academia ou local</Label><Input id="trainingLocation" {...register("trainingLocation")} /></div><div><Label htmlFor="primaryGoal">Objetivo principal</Label><Input id="primaryGoal" {...register("primaryGoal")} /></div>
        </section>}
        {step === 2 && <section className="space-y-5"><div className="flex items-center gap-3"><ShieldCheck className="text-green-600" /><h2 className="text-xl font-black">Conforto e preferências</h2></div>
          <label className="flex min-h-14 items-center gap-3 rounded-2xl border border-slate-200 p-4"><input type="checkbox" className="h-5 w-5 accent-green-600" {...register("hasBackDiscomfort")} /><span className="font-medium">Tenho desconforto lombar atualmente</span></label>
          <div><Label htmlFor="initialBackPain">Dor lombar agora: {initialBackPain}/10</Label><input id="initialBackPain" type="range" min="0" max="10" className="w-full accent-green-600" {...register("initialBackPain")} /></div>
          <div><Label htmlFor="weightUnit">Unidade de peso</Label><Select id="weightUnit" {...register("weightUnit")}><option value="kg">Quilogramas (kg)</option><option value="lb">Libras (lb)</option></Select></div>
          <label className="flex min-h-14 items-center gap-3 rounded-2xl border border-slate-200 p-4"><input type="checkbox" className="h-5 w-5 accent-green-600" {...register("notificationsEnabled")} /><span><strong className="block">Lembretes motivacionais</strong><span className="text-sm text-slate-500">A permissão do navegador será explicada depois.</span></span></label>
          {notificationsEnabled && <div><Label htmlFor="notificationTime">Horário do lembrete</Label><Input id="notificationTime" type="time" {...register("notificationTime")} /></div>}
          <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"><strong>Aviso importante:</strong> o Meu Treino não substitui acompanhamento médico, fisioterapêutico ou de educação física. Interrompa diante de dor irradiada, dormência ou fraqueza.</div>
        </section>}
        <div className="mt-7 flex gap-3">{step > 0 && <Button type="button" variant="secondary" className="flex-1" onClick={() => setStep((value) => value - 1)}>Voltar</Button>}{step < 2 ? <Button type="button" className="flex-1" onClick={next}>Continuar <ArrowRight size={18} /></Button> : <Button type="submit" className="flex-1" disabled={saving}>{saving ? "Salvando…" : <><Check size={18} /> {programChoice === "custom" ? "Montar meu plano" : "Começar programa"}</>}</Button>}</div>
      </form></Card>
    </div>
  </main>;
}
