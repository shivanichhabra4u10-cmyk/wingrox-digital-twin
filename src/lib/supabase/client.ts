import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";

export function createClient() {
  const env = getPublicSupabaseEnv();

  if (!env.isConfigured) {
    throw new Error(
      `Supabase env is missing: ${env.missing.join(", ")}. Add values to .env.local.`
    );
  }

  return createBrowserClient(env.url, env.anonKey);
}
