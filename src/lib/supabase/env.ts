const requiredKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

export function getPublicSupabaseEnv() {
  const missing = requiredKeys.filter((key) => !process.env[key]);

  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    isConfigured: missing.length === 0,
    missing,
  };
}
