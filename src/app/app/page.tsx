import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";

export default async function AppHomePage() {
  const env = getPublicSupabaseEnv();

  if (!env.isConfigured) {
    redirect("/setup");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  redirect("/prototype/index.html");
}
