import { NextResponse } from "next/server";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";

export async function GET() {
  const env = getPublicSupabaseEnv();

  return NextResponse.json({
    status: "ok",
    service: "wingrox-digital-twin-v2",
    timestamp: new Date().toISOString(),
    supabaseConfigured: env.isConfigured,
    missingEnv: env.missing,
  });
}
