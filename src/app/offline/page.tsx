import Link from "next/link";
import { Dumbbell, WifiOff } from "lucide-react";

export default function OfflinePage() { return <main className="grid min-h-dvh place-items-center bg-slate-50 p-6 text-center"><div className="max-w-sm"><span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-green-600 text-white"><WifiOff/></span><h1 className="mt-5 text-2xl font-black">Você está offline</h1><p className="mt-2 text-slate-600">Os dados já carregados continuam no dispositivo. Abra seu treino para continuar registrando normalmente.</p><Link href="/treinar" className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-green-600 px-5 font-bold text-white"><Dumbbell/>Continuar treino</Link></div></main>; }
