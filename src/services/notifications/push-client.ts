function decodeVapidKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4); const base64 = (value + padding).replaceAll("-", "+").replaceAll("_", "/");
  const raw = atob(base64); return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

export async function webPushConfigured() {
  try {
    const response = await fetch("/api/push/public-key", { cache: "no-store" });
    if (!response.ok) return undefined;
    return (await response.json() as { configured?: boolean; key?: string }).key;
  } catch {
    return undefined;
  }
}

export async function enableWebPush(input: { time: string; days: number[] }) {
  const publicKey = await webPushConfigured(); if (!publicKey) throw new Error("Web Push não está configurado neste ambiente.");
  if (Notification.permission !== "granted" && await Notification.requestPermission() !== "granted") throw new Error("Permissão de notificações não concedida.");
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeVapidKey(publicKey) });
  const response = await fetch("/api/push/subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...subscription.toJSON(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, preferences: { enabled: true, time: input.time, days: input.days } }) });
  if (!response.ok) { await subscription.unsubscribe(); throw new Error("Não foi possível registrar o Web Push."); }
  return subscription;
}

export async function disableWebPush() {
  const registration = await navigator.serviceWorker.ready; const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await fetch("/api/push/subscriptions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) }).catch(() => undefined);
  await subscription.unsubscribe();
}

export async function hasWebPushSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    return Boolean(await registration?.pushManager.getSubscription());
  } catch {
    return false;
  }
}
