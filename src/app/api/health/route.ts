import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export function GET() { return NextResponse.json({ status: "ok", app: "meu-treino", version: process.env.npm_package_version ?? "1.0.0", timestamp: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } }); }
