import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { USER_ROLES, type UserRole } from "@/lib/auth/types";

type ProfileRecord = {
  id: string;
  full_name: string;
  role: UserRole;
};

function resolveRole(rawRole: unknown): UserRole {
  if (typeof rawRole === "string" && USER_ROLES.includes(rawRole as UserRole)) {
    return rawRole as UserRole;
  }
  return "participant";
}

function fallbackFullName(email?: string | null) {
  if (!email) {
    return "User";
  }

  const firstPart = email.split("@")[0]?.trim();
  return firstPart && firstPart.length > 1 ? firstPart : "User";
}

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}

export async function requireProfile() {
  const { supabase, user } = await requireUser();

  let { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .maybeSingle<ProfileRecord>();

  if (!profile) {
    const metadata = user.user_metadata ?? {};
    const fullNameRaw = typeof metadata.full_name === "string" ? metadata.full_name.trim() : "";
    const fullName = fullNameRaw.length >= 2 ? fullNameRaw : fallbackFullName(user.email);
    const role = resolveRole(metadata.role);

    const { error: upsertError } = await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email ?? null,
      full_name: fullName,
      role,
    });

    if (upsertError) {
      redirect(`/login?error=${encodeURIComponent("Unable to initialize user profile.")}`);
    }

    const { data: createdProfile } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", user.id)
      .maybeSingle<ProfileRecord>();

    profile = createdProfile ?? null;
  }

  if (!profile) {
    redirect(`/login?error=${encodeURIComponent("Profile missing for this account.")}`);
  }

  return { supabase, user, profile };
}
