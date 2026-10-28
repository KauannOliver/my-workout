"use client";

import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowDown,
  ArrowUp,
  Bell,
  CloudOff,
  Database,
  Download,
  FileArchive,
  FileText,
  Layers3,
  Moon,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/field";
import { deleteAllLocalData, getDb } from "@/db/database";
import { createBase, nowIso } from "@/lib/records";
import {
  createBackup,
  createCsvArchive,
  downloadBlob,
  inspectBackup,
  restoreBackup,
} from "@/services/backup/backup";
import type { AppSettings } from "@/types/models";
import {
  disableWebPush,
  enableWebPush,
  hasWebPushSubscription,
  webPushConfigured,
} from "@/services/notifications/push-client";

const weekDays = [
  { value: 0, label: "D" },
  { value: 1, label: "S" },
  { value: 2, label: "T" },
  { value: 3, label: "Q" },
  { value: 4, label: "Q" },
  { value: 5, label: "S" },
  { value: 6, label: "S" },
];

export default function ProfilePage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [pushConfigured, setPushConfigured] = useState(false);
  const [pushActive, setPushActive] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customMuscle, setCustomMuscle] = useState("");
  const [customEquipment, setCustomEquipment] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [restorePreview, setRestorePreview] = useState<{ content: string; name: string; sourceSchemaVersion: number; exportedAt: string; counts: Record<string, number> }>();
  const data = useLiveQuery(async () => {
    const db = getDb();
    return {
      profile: await db.profiles.toCollection().first(),
      settings: await db.appSettings.toCollection().first(),
      exercises: advancedOpen ? await db.exercises.orderBy("name").toArray() : [],
      prefs: await db.notificationPreferences.toArray(),
      templates: advancedOpen ? await db.workoutTemplates.orderBy("order").toArray() : [],
      items: advancedOpen ? await db.workoutTemplateItems.toArray().then((items) =>
        items.sort((a, b) => (a.orderInBlock ?? a.order) - (b.orderInBlock ?? b.order)),
      ) : [],
    };
  }, [advancedOpen]);
  useEffect(() => {
    let mounted = true;
    Promise.allSettled([webPushConfigured(), hasWebPushSubscription()]).then(
      ([configuration, subscription]) => {
        if (!mounted) return;
        setPushConfigured(
          configuration.status === "fulfilled" && Boolean(configuration.value),
        );
        setPushActive(
          subscription.status === "fulfilled" && subscription.value,
        );
      },
    );
    return () => { mounted = false; };
  }, []);
  if (!data?.profile || !data.settings) return <p>Carregando perfil…</p>;
  const updateSettings = async (changes: Partial<AppSettings>) => {
    await getDb().appSettings.update(data.settings!.id, {
      ...changes,
      updatedAt: nowIso(),
      recordVersion: data.settings!.recordVersion + 1,
    });
  };
  const backup = async () => {
    setBusy(true);
    try {
      downloadBlob(
        await createBackup(),
        `meu-treino-backup-${nowIso().slice(0, 10)}.json`,
        "application/json",
      );
      setMessage("Backup criado com sucesso.");
    } finally {
      setBusy(false);
    }
  };
  const exportCsv = async () => {
    setBusy(true);
    try {
      downloadBlob(
        await createCsvArchive(),
        `meu-treino-historico-${nowIso().slice(0, 10)}.zip`,
        "application/zip",
      );
      setMessage("Históricos exportados em CSV.");
    } finally {
      setBusy(false);
    }
  };
  const restore = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const content = await file.text();
      const preview = await inspectBackup(content);
      setRestorePreview({ content, name: file.name, ...preview });
      setMessage("Backup validado. Confira o resumo antes de restaurar.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Backup inválido.");
    } finally {
      setBusy(false);
    }
  };
  const confirmRestore = async () => {
    if (!restorePreview) return;
    setBusy(true);
    try {
      await restoreBackup(restorePreview.content);
      setMessage("Backup restaurado. Recarregando…");
      window.setTimeout(() => location.reload(), 500);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "A restauração falhou sem alterar os dados atuais.");
    } finally { setBusy(false); }
  };
  const requestNotifications = async () => {
    if (!("Notification" in window))
      return setMessage("Este navegador não oferece notificações do sistema.");
    const permission = await Notification.requestPermission();
    setMessage(
      permission === "granted"
        ? "Notificações permitidas. Os lembretes locais estão ativos quando o PWA estiver em execução."
        : "Permissão não concedida. Você ainda verá mensagens dentro do aplicativo.",
    );
  };
  const createExercise = async () => {
    if (!customName.trim() || !customMuscle.trim())
      return setMessage("Informe nome e grupo muscular do exercício.");
    await getDb().exercises.add({
      ...createBase(),
      name: customName.trim(),
      muscleGroup: customMuscle.trim(),
      equipment: customEquipment.trim() || "Personalizado",
      instructions: "Execução personalizada pelo usuário.",
      backCare: "Use amplitude confortável e interrompa em caso de dor.",
      alternatives: [],
      loadIncrement: 1,
      active: true,
      custom: true,
      favorite: false,
    });
    setCustomName("");
    setCustomMuscle("");
    setCustomEquipment("");
    setMessage("Exercício personalizado criado.");
  };
  const moveItem = async (itemId: string, direction: -1 | 1) => {
    const item = data.items.find((entry) => entry.id === itemId);
    if (!item) return;
    const siblings = data.items
      .filter((entry) => entry.workoutTemplateId === item.workoutTemplateId)
      .sort((a, b) => a.order - b.order);
    const index = siblings.findIndex((entry) => entry.id === itemId);
    const target = siblings[index + direction];
    if (!target) return;
    await getDb().transaction("rw", getDb().workoutTemplateItems, async () => {
      await getDb().workoutTemplateItems.update(item.id, {
        order: target.order,
        updatedAt: nowIso(),
        recordVersion: item.recordVersion + 1,
      });
      await getDb().workoutTemplateItems.update(target.id, {
        order: item.order,
        updatedAt: nowIso(),
        recordVersion: target.recordVersion + 1,
      });
    });
  };
  return (
    <div className="space-y-5">
      <PageHeader
        title={data.profile.name}
        description="Preferências, exercícios, privacidade e dados locais."
      />
      {message && (
        <div
          className="rounded-2xl bg-green-50 p-4 text-sm font-medium text-green-900 dark:bg-green-950 dark:text-green-100"
          role="status"
        >
          {message}
        </div>
      )}
      <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
        <div className="flex gap-3">
          <Database className="shrink-0 text-green-700" />
          <div>
            <h2 className="font-black text-green-900 dark:text-green-100">
              Dados salvos neste dispositivo
            </h2>
            <p className="mt-1 text-sm text-green-800 dark:text-green-200">
              Treinos, medidas e fotos não são enviados para a nuvem. Limpar os
              dados do navegador pode apagar seu histórico.
            </p>
          </div>
        </div>
      </Card>
      <Card>
        <h2 className="flex items-center gap-2 text-lg font-black"><Layers3 className="text-green-600"/>Meus planos</h2>
        <p className="mt-1 text-sm text-slate-500">Crie rotações A–G, monte séries simples, bisets, trisets e circuitos.</p>
        <Link href="/planos"><Button variant="secondary" className="mt-4 w-full">Abrir meus planos</Button></Link>
      </Card>
      <Card>
        <h2 className="flex items-center gap-2 text-lg font-black">
          <Moon className="text-green-600" />
          Aparência e treino
        </h2>
        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="theme">Tema</Label>
            <Select
              id="theme"
              value={data.settings.theme}
              onChange={(event) =>
                updateSettings({
                  theme: event.target.value as AppSettings["theme"],
                })
              }
            >
              <option value="system">Seguir o dispositivo</option>
              <option value="light">Claro</option>
              <option value="dark">Escuro</option>
            </Select>
          </div>
          <Toggle
            label="Som nos temporizadores"
            checked={data.settings.soundEnabled}
            onChange={(soundEnabled) => updateSettings({ soundEnabled })}
          />
          <Toggle
            label="Vibração"
            checked={data.settings.vibrationEnabled}
            onChange={(vibrationEnabled) =>
              updateSettings({ vibrationEnabled })
            }
          />
          <Toggle
            label="Reduzir animações"
            checked={data.settings.reducedMotion}
            onChange={(reducedMotion) => updateSettings({ reducedMotion })}
          />
          <div>
            <Label htmlFor="unit">Unidade de peso</Label>
            <Select
              id="unit"
              value={data.settings.weightUnit}
              onChange={(event) =>
                updateSettings({
                  weightUnit: event.target.value as "kg" | "lb",
                })
              }
            >
              <option value="kg">Quilogramas</option>
              <option value="lb">Libras</option>
            </Select>
          </div>
        </div>
      </Card>
      <Card>
        <h2 className="flex items-center gap-2 text-lg font-black">
          <Bell className="text-green-600" />
          Lembretes pessoais
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Escolha quando quer ser lembrado. O processamento básico acontece
          neste dispositivo.
        </p>
        <Button
          variant="secondary"
          className="mt-4 w-full"
          onClick={requestNotifications}
        >
          <Bell size={17} />
          Permitir notificações do sistema
        </Button>
        {data.prefs.map((pref) => (
          <div
            key={pref.id}
            className="mt-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-700"
          >
            <Toggle
              label="Lembrete de treino"
              checked={pref.enabled}
              onChange={(enabled) =>
                getDb().notificationPreferences.update(pref.id, {
                  enabled,
                  updatedAt: nowIso(),
                  recordVersion: pref.recordVersion + 1,
                })
              }
            />
            <div className="mt-4">
              <Label htmlFor={`reminder-time-${pref.id}`}>
                Horário preferido
              </Label>
              <Input
                id={`reminder-time-${pref.id}`}
                type="time"
                value={pref.time}
                onChange={(event) =>
                  getDb().notificationPreferences.update(pref.id, {
                    time: event.target.value,
                    updatedAt: nowIso(),
                    recordVersion: pref.recordVersion + 1,
                  })
                }
              />
            </div>
            <fieldset className="mt-4">
              <legend className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Dias da semana
              </legend>
              <div className="mt-2 grid grid-cols-7 gap-1">
                {weekDays.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    aria-label={`${pref.days.includes(day.value) ? "Remover" : "Adicionar"} dia ${day.value}`}
                    aria-pressed={pref.days.includes(day.value)}
                    onClick={() => {
                      const days = pref.days.includes(day.value)
                        ? pref.days.filter((value) => value !== day.value)
                        : [...pref.days, day.value].sort();
                      void getDb().notificationPreferences.update(pref.id, {
                        days,
                        updatedAt: nowIso(),
                        recordVersion: pref.recordVersion + 1,
                      });
                    }}
                    className={`grid min-h-11 place-items-center rounded-xl text-sm font-black ${pref.days.includes(day.value) ? "bg-green-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        ))}
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-800">
          <strong>Com o aplicativo fechado</strong>
          <p className="mt-1 text-slate-500">
            {pushConfigured
              ? "Web Push está disponível neste ambiente."
              : "Web Push opcional está desativado; seus lembretes internos continuam funcionando."}
          </p>
          {pushConfigured && (
            <Button
              size="sm"
              variant={pushActive ? "danger" : "secondary"}
              className="mt-3"
              onClick={async () => {
                try {
                  const pref = data.prefs[0];
                  if (pushActive) {
                    await disableWebPush();
                    setPushActive(false);
                    setMessage("Web Push desativado.");
                  } else {
                    await enableWebPush({
                      time: pref?.time ?? "18:00",
                      days: pref?.days ?? [1, 3, 5],
                    });
                    setPushActive(true);
                    setMessage("Web Push ativado.");
                  }
                } catch (error) {
                  setMessage(
                    error instanceof Error
                      ? error.message
                      : "Falha ao configurar Web Push.",
                  );
                }
              }}
            >
              {pushActive ? "Desativar Web Push" : "Ativar Web Push"}
            </Button>
          )}
        </div>
      </Card>
      <Card>
        <h2 className="flex items-center gap-2 text-lg font-black">
          <FileArchive className="text-green-600" />
          Backup e exportação
        </h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Button variant="secondary" disabled={busy} onClick={backup}>
            <Download size={17} />
            Backup JSON
          </Button>
          <Button variant="secondary" disabled={busy} onClick={exportCsv}>
            <FileArchive size={17} />
            Exportar CSV
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={17} />
            Restaurar
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => restore(e.target.files?.[0])}
          />
        </div>
        {restorePreview && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <strong className="block">Confirmar substituição integral</strong>
          <p className="mt-1">{restorePreview.name} · backup v{restorePreview.sourceSchemaVersion} · {new Date(restorePreview.exportedAt).toLocaleString("pt-BR")}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><span>{restorePreview.counts.workoutSessions ?? 0} sessões</span><span>{restorePreview.counts.setLogs ?? 0} séries</span><span>{restorePreview.counts.bodyMeasurements ?? 0} medidas</span><span>{restorePreview.counts.progressPhotos ?? 0} fotos</span></div>
          <p className="mt-3 font-medium">Os dados atuais só serão apagados dentro da mesma transação que gravará o backup. Se algo falhar, a operação será revertida.</p>
          <div className="mt-4 flex gap-2"><Button variant="danger" disabled={busy} onClick={confirmRestore}>Substituir e restaurar</Button><Button variant="ghost" onClick={() => setRestorePreview(undefined)}>Cancelar</Button></div>
        </div>}
      </Card>
      <Card>
        <h2 className="flex items-center gap-2 text-lg font-black">
          <FileText className="text-green-600" />
          Relatório das 12 semanas
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Acompanhe adesão, tempo, cardio, recordes, peso e bem-estar; exporte
          em PDF quando quiser.
        </p>
        <Link href="/relatorio">
          <Button variant="secondary" className="mt-4 w-full">
            Abrir relatório
          </Button>
        </Link>
      </Card>
      <details className="group" open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}>
        <summary className="cursor-pointer list-none rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-green-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-200 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black">Personalização avançada</h2>
              <p className="mt-1 text-sm text-slate-500">Catálogo, exercícios próprios e edição das fichas A–D.</p>
            </div>
            <span className="shrink-0 text-sm font-bold text-green-700 group-open:hidden dark:text-green-400">Abrir</span>
            <span className="hidden shrink-0 text-sm font-bold text-green-700 group-open:inline dark:text-green-400">Recolher</span>
          </div>
        </summary>
        {advancedOpen && <div className="mt-5 space-y-5">
      <Card>
        <h2 className="text-lg font-black">Catálogo e incrementos</h2>
        <p className="mt-1 text-sm text-slate-500">
          Ajustes alteram os próximos treinos; o histórico mantém o snapshot
          original.
        </p>
        <div className="mt-4 max-h-96 space-y-2 overflow-auto">
          {data.exercises.map((exercise) => (
            <div
              key={exercise.id}
              className="flex min-h-14 items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800"
            >
              <div className="flex-1">
                <strong className="block text-sm">{exercise.name}</strong>
                <span className="text-xs text-slate-500">
                  {exercise.muscleGroup} · {exercise.equipment}
                </span>
              </div>
              <label className="text-xs text-slate-500">
                Incremento
                <Input
                  aria-label={`Incremento de ${exercise.name}`}
                  type="number"
                  step="0.5"
                  value={exercise.loadIncrement}
                  onChange={(e) =>
                    getDb().exercises.update(exercise.id, {
                      loadIncrement: Number(e.target.value),
                      updatedAt: nowIso(),
                    })
                  }
                  className="mt-1 h-10 min-h-10 w-20 px-2 text-center"
                />
              </label>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <h2 className="text-lg font-black">Novo exercício personalizado</h2>
        <p className="mt-1 text-sm text-slate-500">
          Cadastre uma alternativa própria e use-a em qualquer ficha.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="customName">Nome</Label>
            <Input
              id="customName"
              value={customName}
              onChange={(event) => setCustomName(event.target.value)}
              placeholder="Ex.: remada unilateral"
            />
          </div>
          <div>
            <Label htmlFor="customMuscle">Grupo muscular</Label>
            <Input
              id="customMuscle"
              value={customMuscle}
              onChange={(event) => setCustomMuscle(event.target.value)}
              placeholder="Costas"
            />
          </div>
          <div>
            <Label htmlFor="customEquipment">Equipamento</Label>
            <Input
              id="customEquipment"
              value={customEquipment}
              onChange={(event) => setCustomEquipment(event.target.value)}
              placeholder="Halter"
            />
          </div>
        </div>
        <Button className="mt-3" onClick={createExercise}>
          <Plus size={17} />
          Adicionar ao catálogo
        </Button>
      </Card>
      <Card>
        <h2 className="text-lg font-black">Personalização das fichas A–D</h2>
        <p className="mt-1 text-sm text-slate-500">
          Troque exercícios, repetições, descanso e ordem. Novos treinos usarão
          a ficha atual; sessões antigas permanecem intactas.
        </p>
        <div className="mt-5 space-y-5">
          {data.templates.map((template) => (
            <section key={template.id}>
              <h3 className="mb-2 font-black text-green-700">
                Treino {template.code} · {template.name}
              </h3>
              <div className="space-y-2">
                {data.items
                  .filter((item) => item.workoutTemplateId === template.id)
                  .sort((a, b) => a.order - b.order)
                  .map((item, index, items) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700"
                    >
                      <div className="grid gap-2 sm:grid-cols-[1fr_6rem_6rem_7rem_auto]">
                        <div>
                          <Label htmlFor={`exercise-${item.id}`}>
                            Exercício · bloco {item.block}
                          </Label>
                          <Select
                            id={`exercise-${item.id}`}
                            value={item.exerciseId}
                            onChange={(event) =>
                              getDb().workoutTemplateItems.update(item.id, {
                                exerciseId: event.target.value,
                                updatedAt: nowIso(),
                                recordVersion: item.recordVersion + 1,
                              })
                            }
                          >
                            {data.exercises
                              .filter((exercise) => exercise.active)
                              .map((exercise) => (
                                <option key={exercise.id} value={exercise.id}>
                                  {exercise.name}
                                </option>
                              ))}
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor={`min-${item.id}`}>Rep. mín.</Label>
                          <Input
                            id={`min-${item.id}`}
                            type="number"
                            min="1"
                            value={item.minReps}
                            onChange={(event) =>
                              getDb().workoutTemplateItems.update(item.id, {
                                minReps: Number(event.target.value),
                                updatedAt: nowIso(),
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor={`max-${item.id}`}>Rep. máx.</Label>
                          <Input
                            id={`max-${item.id}`}
                            type="number"
                            min="1"
                            value={item.maxReps}
                            onChange={(event) =>
                              getDb().workoutTemplateItems.update(item.id, {
                                maxReps: Number(event.target.value),
                                updatedAt: nowIso(),
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor={`rest-${item.id}`}>
                            Descanso (s)
                          </Label>
                          <Input
                            id={`rest-${item.id}`}
                            type="number"
                            min="0"
                            step="15"
                            value={item.restSeconds}
                            onChange={(event) =>
                              getDb().workoutTemplateItems.update(item.id, {
                                restSeconds: Number(event.target.value),
                                updatedAt: nowIso(),
                              })
                            }
                          />
                        </div>
                        <div className="flex items-end gap-1">
                          <Button
                            aria-label="Mover para cima"
                            title="Mover para cima"
                            size="sm"
                            variant="secondary"
                            disabled={index === 0}
                            onClick={() => moveItem(item.id, -1)}
                          >
                            <ArrowUp size={16} />
                          </Button>
                          <Button
                            aria-label="Mover para baixo"
                            title="Mover para baixo"
                            size="sm"
                            variant="secondary"
                            disabled={index === items.length - 1}
                            onClick={() => moveItem(item.id, 1)}
                          >
                            <ArrowDown size={16} />
                          </Button>
                          <Button
                            aria-label="Restaurar exercício original"
                            title="Restaurar exercício original"
                            size="sm"
                            variant="ghost"
                            disabled={
                              item.exerciseId === item.originalExerciseId
                            }
                            onClick={() =>
                              getDb().workoutTemplateItems.update(item.id, {
                                exerciseId: item.originalExerciseId,
                                updatedAt: nowIso(),
                                recordVersion: item.recordVersion + 1,
                              })
                            }
                          >
                            <RotateCcw size={16} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>
      </Card>
        </div>}
      </details>
      <Card>
        <h2 className="flex items-center gap-2 text-lg font-black">
          <ShieldCheck className="text-green-600" />
          Privacidade
        </h2>
        <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <p>
            <CloudOff className="mr-2 inline" size={16} />
            Nenhum rastreamento invasivo ou upload de fotos.
          </p>
          <p>
            Importações são validadas antes de substituir o banco. Não
            registramos dados sensíveis em logs.
          </p>
          <p>
            O aplicativo oferece orientação geral e não substitui profissionais
            de saúde ou educação física.
          </p>
        </div>
      </Card>
      <Card className="border-red-200">
        <h2 className="text-lg font-black text-red-700">
          Apagar todos os dados
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Esta ação remove perfil, treinos, fotos e preferências deste
          navegador.
        </p>
        <Button
          variant="danger"
          className="mt-4"
          onClick={async () => {
            if (
              confirm(
                "Apagar definitivamente todos os dados locais? Faça um backup antes se quiser recuperá-los.",
              )
            ) {
              await deleteAllLocalData();
              location.assign("/onboarding");
            }
          }}
        >
          <Trash2 size={17} />
          Apagar dados locais
        </Button>
      </Card>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="mt-3 flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
      <span className="font-medium">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-6 w-6 accent-green-600"
      />
    </label>
  );
}
