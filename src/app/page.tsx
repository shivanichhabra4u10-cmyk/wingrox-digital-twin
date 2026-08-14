import { redirect } from "next/navigation";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const env = getPublicSupabaseEnv();

  if (!env.isConfigured) {
    redirect("/setup");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/app" : "/login");
}
