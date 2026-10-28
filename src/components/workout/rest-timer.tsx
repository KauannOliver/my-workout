"use client";

import { FastForward, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/utils";
import { useWorkoutUiStore } from "@/stores/workout-ui";
import { getDb } from "@/db/database";

export function RestTimer() {
  const { restEndsAt, restTotalSeconds, restBlock, restRound, restNextExercise, extendRest, skipRest } = useWorkoutUiStore();
  const settings = useLiveQuery(() => getDb().appSettings.toCollection().first(), []);
  const [remaining, setRemaining] = useState(0);
  const notified = useRef(false);
  const lastBeep = useRef(0);

  useEffect(() => {
    const update = () => setRemaining(restEndsAt ? Math.max(0, Math.ceil((restEndsAt - Date.now()) / 1000)) : 0);
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [restEndsAt]);

  useEffect(() => {
    if (restEndsAt && remaining > 0) notified.current = false;
    if (restEndsAt && remaining > 0 && remaining <= 3 && settings?.soundEnabled && lastBeep.current !== remaining) {
      lastBeep.current = remaining;
      try { const audio = new AudioContext(); const oscillator = audio.createOscillator(); const gain = audio.createGain(); oscillator.frequency.value = remaining === 1 ? 880 : 660; gain.gain.value = .06; oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + .09); oscillator.addEventListener("ended", () => void audio.close()); } catch { /* navegador sem áudio disponível */ }
    }
    if (restEndsAt && Date.now() >= restEndsAt && !notified.current) {
      notified.current = true;
      if (settings?.vibrationEnabled) navigator.vibrate?.([150, 80, 150]);
      skipRest();
    }
  }, [remaining, restEndsAt, settings?.soundEnabled, settings?.vibrationEnabled, skipRest]);

  if (!restEndsAt) return null;

  return <div className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-md rounded-3xl bg-slate-950 p-4 text-white shadow-2xl lg:bottom-6" aria-live="polite">
    <div className="flex items-center gap-4">
      <div className="grid h-16 w-20 place-items-center rounded-2xl bg-green-600 text-2xl font-black tabular-nums">{formatDuration(remaining)}</div>
      <div className="flex-1">
        <p className="font-black">Descanso · {restBlock}{restRound ? ` · rodada ${restRound}` : ""}</p>
        <p className="text-sm text-slate-300">{restNextExercise ? `Depois: ${restNextExercise}` : "Último bloco concluído. Recupere-se antes do cardio."}</p>
      </div>
    </div>
    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full bg-green-500 transition-[width]" style={{ width: `${restTotalSeconds ? Math.min(100, remaining/restTotalSeconds*100) : 0}%` }}/></div>
    <div className="mt-3 grid grid-cols-3 gap-2">
      <Button variant="secondary" size="sm" onClick={() => extendRest(15)}><Plus size={15}/>15s</Button>
      <Button variant="secondary" size="sm" onClick={() => extendRest(30)}><Plus size={15}/>30s</Button>
      <Button variant="ghost" size="sm" className="text-white" onClick={skipRest}><FastForward size={15}/>Pular</Button>
    </div>
  </div>;
}
