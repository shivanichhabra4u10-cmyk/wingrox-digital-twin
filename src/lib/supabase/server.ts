import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";

export async function createClient() {
  const env = getPublicSupabaseEnv();

  if (!env.isConfigured) {
    throw new Error(
      `Supabase env is missing: ${env.missing.join(", ")}. Add values to .env.local.`
    );
  }

  const cookieStore = await cookies();

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // In Server Components, cookie mutation throws; Route Handlers/Server Actions can set.
        cookiesToSet.forEach(({ name, value, options }) => {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Ignore in non-mutable contexts and rely on middleware/session refresh.
          }
        });
      },
    },
  });
}
