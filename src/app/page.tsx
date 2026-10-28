"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getDb } from "@/db/database";

export default function RootPage() {
  const router = useRouter();
  const settings = useLiveQuery(() => getDb().appSettings.toCollection().first());
  useEffect(() => { if (settings) router.replace(settings.onboardingCompleted ? "/inicio" : "/onboarding"); }, [router, settings]);
  return <main className="grid min-h-dvh place-items-center"><p className="text-slate-500">Abrindo seu treino…</p></main>;
}
