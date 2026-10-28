import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { getRedis, PUSH_SET, pushKey, type StoredPush } from "@/lib/push-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET; if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const redis = getRedis(); const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY; const priv = process.env.VAPID_PRIVATE_KEY; const subject = process.env.VAPID_SUBJECT;
  if (!redis || !pub || !priv || !subject) return NextResponse.json({ error: "Web Push não configurado." }, { status: 503 });
  webpush.setVapidDetails(subject, pub, priv); const ids = await redis.smembers<string[]>(PUSH_SET); let sent = 0; let removed = 0;
  for (const id of ids) {
    const subscription = await redis.get<StoredPush>(pushKey(id)); if (!subscription?.preferences.enabled) continue;
    const now = new Date(); const parts = new Intl.DateTimeFormat("en-US", { timeZone: subscription.timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now); const weekday = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(parts.find((part)=>part.type==="weekday")?.value ?? ""); const time = `${parts.find((part)=>part.type==="hour")?.value}:${parts.find((part)=>part.type==="minute")?.value}`; const sendKey = `${now.toISOString().slice(0,10)}:${subscription.preferences.time}`;
    if (!subscription.preferences.days.includes(weekday) || time !== subscription.preferences.time || subscription.lastSentKey === sendKey) continue;
    try { await webpush.sendNotification({ endpoint: subscription.endpoint, expirationTime: subscription.expirationTime, keys: subscription.keys }, JSON.stringify({ title: "Hora do Meu Treino", body: "Hoje não precisa ser perfeito. Só precisa começar.", url: "/treinar" }), { TTL: 3600 }); await redis.set(pushKey(id), { ...subscription, lastSentKey: sendKey }); sent++; }
    catch (error) { const status = (error as { statusCode?: number }).statusCode; if (status === 404 || status === 410) { await redis.del(pushKey(id)); await redis.srem(PUSH_SET, id); removed++; } }
  }
  return NextResponse.json({ ok: true, sent, removed });
}
