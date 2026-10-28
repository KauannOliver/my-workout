import { getDb } from "@/db/database";
import { createBase } from "@/lib/records";

const messages = [
  "Hoje não precisa ser perfeito. Só precisa começar.",
  "Boa técnica e consistência formam uma progressão sustentável.",
  "Uma semana de redução também faz parte do progresso.",
  "Seu maior progresso pode ser manter a frequência.",
];

const localDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const localTime = (date = new Date()) => `${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`;

async function addOnce(kind: string, title: string, body: string) {
  const db = getDb(); const today = localDateKey();
  const exists = await db.notificationInbox.where("kind").equals(kind).filter((item) => localDateKey(new Date(item.scheduledFor)) === today).first();
  if (exists) return;
  const item = { ...createBase(), title, body, kind, scheduledFor: new Date().toISOString() };
  await db.notificationInbox.add(item);
  if (typeof Notification !== "undefined" && typeof navigator !== "undefined" && Notification.permission === "granted" && navigator.serviceWorker?.controller) {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(item.title, { body: item.body, icon: "/icons/icon-192.png", tag: `local-${kind}-${today}` });
  }
}

export async function checkLocalReminders() {
  const db = getDb(); const now = new Date(); const time = localTime(now);
  const [preference, active, settings] = await Promise.all([
    db.notificationPreferences.filter((item) => item.enabled).first(),
    db.workoutSessions.where("status").anyOf(["active", "paused"]).first(),
    db.appSettings.toCollection().first(),
  ]);

  if (active && now.getTime() - new Date(active.startedAt).getTime() >= 4 * 60 * 60 * 1000) {
    await addOnce("interrupted-workout", "Seu treino continua salvo", `O Treino ${active.workoutCode} está disponível para retomada exatamente de onde você parou.`);
  }
  const backupReference = settings?.lastBackupAt ?? settings?.createdAt;
  if (backupReference && now.getTime() - new Date(backupReference).getTime() >= 30 * 86400_000) {
    await addOnce("backup", "Hora de proteger seu histórico", "Faz 30 dias ou mais desde o último backup. Exporte uma cópia no Perfil.");
  }
  if (!preference || !preference.days.includes(now.getDay()) || time < preference.time) return;
  const inQuietHours = preference.quietStart > preference.quietEnd ? time >= preference.quietStart || time < preference.quietEnd : time >= preference.quietStart && time < preference.quietEnd;
  if (inQuietHours) return;
  await addOnce("motivation", "Seu momento de consistência", messages[now.getDate() % messages.length]);
}
