import { defaultCache } from "@serwist/next/worker";
import { NetworkOnly, Serwist } from "serwist";

declare global {
  interface ServiceWorkerGlobalScope { __SW_MANIFEST: Array<{ url: string; revision?: string | null }> }
}
declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [{ matcher: ({ sameOrigin, url }) => sameOrigin && (url.pathname.startsWith("/api/push") || url.pathname.startsWith("/api/cron")), handler: new NetworkOnly() }, ...defaultCache],
  fallbacks: { entries: [{ url: "/offline", matcher: ({ request }) => request.destination === "document" }] },
});

serwist.addEventListeners();

self.addEventListener("push", (event: PushEvent) => {
  const payload = event.data?.json() as { title?: string; body?: string; url?: string } | undefined;
  event.waitUntil(self.registration.showNotification(payload?.title ?? "Meu Treino", {
    body: payload?.body ?? "Seu próximo passo pode ser simples: começar.", icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { url: payload?.url ?? "/inicio" }, tag: "meu-treino-reminder",
  }));
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow((event.notification.data as { url?: string })?.url ?? "/inicio"));
});
