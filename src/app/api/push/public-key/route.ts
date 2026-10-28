import { NextResponse } from "next/server";

export function GET() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  return NextResponse.json(
    key ? { configured: true, key } : { configured: false },
    { headers: { "Cache-Control": "no-store" } },
  );
}
