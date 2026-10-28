"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { initializeDatabase } from "@/db/database";

const ReadyContext = createContext(false);

export function Providers({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    initializeDatabase().then(() => setReady(true)).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Não foi possível abrir o banco local."));
  }, []);
  if (error) return <main className="grid min-h-screen place-items-center p-6"><div className="max-w-md rounded-3xl bg-red-50 p-6 text-red-800"><h1 className="text-xl font-bold">Falha no armazenamento local</h1><p className="mt-2">{error}</p><p className="mt-2 text-sm">Verifique se o navegador permite IndexedDB neste dispositivo.</p></div></main>;
  if (!ready) return <main className="grid min-h-screen place-items-center" aria-busy="true"><div className="text-center"><div className="mx-auto h-12 w-12 animate-pulse rounded-2xl bg-green-600" /><p className="mt-4 font-medium text-slate-600">Preparando seu treino…</p></div></main>;
  return <ReadyContext.Provider value>{children}</ReadyContext.Provider>;
}

export const useDatabaseReady = () => useContext(ReadyContext);
