"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Dumbbell, History, House, UserRound, WifiOff } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/db/database";
import { useRouter } from "next/navigation";
import { checkLocalReminders } from "@/services/notifications/local";
import { nowIso } from "@/lib/records";

const links = [
  { href: "/inicio", label: "Início", icon: House },
  { href: "/treinar", label: "Treinar", icon: Dumbbell, featured: true },
  { href: "/evolucao", label: "Evolução", icon: BarChart3 },
  { href: "/historico", label: "Histórico", icon: History },
  { href: "/perfil", label: "Perfil", icon: UserRound },
];

const subscribeOnline = (callback: () => void) => { window.addEventListener("online", callback); window.addEventListener("offline", callback); return () => { window.removeEventListener("online", callback); window.removeEventListener("offline", callback); }; };
const getOnline = () => navigator.onLine;
const getServerOnline = () => true;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const settings = useLiveQuery(() => getDb().appSettings.toCollection().first());
  const notification = useLiveQuery(() => getDb().notificationInbox.filter((item) => !item.readAt).last());
  const browserOnline = useSyncExternalStore(subscribeOnline, getOnline, getServerOnline);
  const [reachable, setReachable] = useState(true);
  useEffect(() => {
    if (!settings) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = settings.theme === "dark" || (settings.theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.classList.toggle("reduce-motion", settings.reducedMotion);
    };
    apply(); media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [settings]);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 3000);
    fetch("/api/health", { cache: "no-store", signal: controller.signal }).then(() => { if (active) setReachable(true); }).catch(() => { if (active) setReachable(false); }).finally(() => window.clearTimeout(timeout));
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [browserOnline]);
  const online = browserOnline && reachable;
  useEffect(() => { if (settings && !settings.onboardingCompleted) router.replace("/onboarding"); }, [router, settings]);
  useEffect(() => { if (settings?.onboardingCompleted) void checkLocalReminders(); }, [settings?.onboardingCompleted]);
  return <div className="min-h-dvh bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
    <a href="#main-content" className="sr-only z-[60] rounded-xl bg-white p-3 font-bold text-green-800 focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Pular para o conteúdo</a>
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white p-5 lg:block dark:border-slate-800 dark:bg-slate-900">
      <Link href="/inicio" className="flex items-center gap-3 text-xl font-black"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-green-600 text-white"><Dumbbell size={22} /></span>Meu Treino</Link>
      <nav aria-label="Navegação principal" className="mt-10 space-y-2">{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={pathname.startsWith(href) ? "page" : undefined} className={cn("flex min-h-12 items-center gap-3 rounded-2xl px-4 font-semibold text-slate-600", pathname.startsWith(href) && "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200")}><Icon aria-hidden="true" size={21} />{label}</Link>)}</nav>
      <div className="absolute inset-x-5 bottom-6 rounded-2xl bg-slate-50 p-4 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"><div className="font-semibold text-green-700 dark:text-green-400">Dados salvos neste dispositivo</div><p className="mt-1">Faça backups periódicos no Perfil.</p></div>
    </aside>
    {!online && <div role="status" className="fixed inset-x-0 top-0 z-50 flex min-h-11 items-center justify-center gap-2 bg-amber-500 px-4 text-sm font-semibold text-amber-950"><WifiOff aria-hidden="true" size={16} />Offline — seus registros continuam salvos</div>}
    <main id="main-content" tabIndex={-1} className={cn("mx-auto min-h-dvh max-w-6xl px-4 pb-28 pt-5 outline-none sm:px-6 lg:ml-64 lg:pb-10 lg:pt-8", !online && "pt-16")}>{notification && <div className="mb-4 flex items-start gap-3 rounded-2xl bg-green-50 p-4 text-green-950 dark:bg-green-950 dark:text-green-100"><div className="flex-1"><strong>{notification.title}</strong><p className="mt-1 text-sm">{notification.body}</p></div><button className="min-h-11 px-2 text-sm font-bold" onClick={() => getDb().notificationInbox.update(notification.id, { readAt: nowIso(), updatedAt: nowIso(), recordVersion: notification.recordVersion + 1 })}>Fechar</button></div>}{children}</main>
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/95 px-[max(.5rem,env(safe-area-inset-left))] pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/95">
      {links.map(({ href, label, icon: Icon, featured }) => <Link key={href} href={href} aria-current={pathname.startsWith(href) ? "page" : undefined} className={cn("relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold text-slate-500", pathname.startsWith(href) && "text-green-700 dark:text-green-400", featured && "-mt-5")}><span className={cn("grid h-9 w-9 place-items-center rounded-2xl", featured && "h-13 w-13 bg-green-600 text-white shadow-lg shadow-green-200 dark:shadow-none")}><Icon size={featured ? 25 : 21} /></span>{label}</Link>)}
    </nav>
  </div>;
}
