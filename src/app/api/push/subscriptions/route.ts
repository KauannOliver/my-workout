import { NextRequest, NextResponse } from "next/server";
import { getRedis, PUSH_SET, pushKey, pushSubscriptionSchema, subscriptionId } from "@/lib/push-server";

function sameOrigin(request: NextRequest) { const origin = request.headers.get("origin"); return !origin || origin === request.nextUrl.origin; }

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const redis = getRedis(); if (!redis) return NextResponse.json({ error: "Web Push não configurado." }, { status: 503 });
  const parsed = pushSubscriptionSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Inscrição inválida." }, { status: 400 });
  const id = subscriptionId(parsed.data.endpoint); await redis.set(pushKey(id), { ...parsed.data, id }); await redis.sadd(PUSH_SET, id);
  return NextResponse.json({ ok: true, id }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const redis = getRedis(); if (!redis) return NextResponse.json({ error: "Web Push não configurado." }, { status: 503 });
  const body = await request.json().catch(() => null) as { endpoint?: string } | null; if (!body?.endpoint) return NextResponse.json({ error: "Endpoint obrigatório." }, { status: 400 });
  const id = subscriptionId(body.endpoint); await redis.del(pushKey(id)); await redis.srem(PUSH_SET, id); return NextResponse.json({ ok: true });
}
