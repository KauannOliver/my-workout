"use client";

import { Download, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }

export function InstallPrompt() {
  const [event, setEvent] = useState<InstallEvent>();
  const [ios, setIos] = useState(false);
  const [standalone, setStandalone] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => { setStandalone(window.matchMedia("(display-mode: standalone)").matches); setIos(/iphone|ipad|ipod/i.test(navigator.userAgent)); }, 0);
    const handle = (value: Event) => { value.preventDefault(); setEvent(value as InstallEvent); };
    window.addEventListener("beforeinstallprompt", handle);
    return () => { window.clearTimeout(timer); window.removeEventListener("beforeinstallprompt", handle); };
  }, []);
  if (standalone || (!event && !ios)) return null;
  return <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950"><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-green-600 text-white"><Smartphone /></span><div className="flex-1"><h2 className="font-black">Instale o Meu Treino</h2><p className="mt-1 text-sm text-green-900 dark:text-green-100">{ios ? "No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início." : "Acesso rápido, tela cheia e funcionamento offline."}</p>{event && <Button size="sm" className="mt-3" onClick={async () => { await event.prompt(); if ((await event.userChoice).outcome === "accepted") setEvent(undefined); }}><Download size={17} />Instalar aplicativo</Button>}</div></div></Card>;
}
