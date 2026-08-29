"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { USER_ROLES } from "@/lib/auth/types";

function fail(message: string): never {
  redirect(`/login?error=${encodeURIComponent(message)}`);
}

const signInSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(8),
});

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  role: z.enum(USER_ROLES),
});

const DEMO_ACCOUNTS = {
  dipti: {
    email: "dipti@example.com",
    fullName: "Dipti M",
    role: "participant",
  },
  architect: {
    email: "architect@example.com",
    fullName: "R. Menon",
    role: "architect",
  },
  coach: {
    email: "coach@example.com",
    fullName: "Coach A",
    role: "coach",
  },
  sponsor: {
    email: "sponsor@example.com",
    fullName: "L. Rao",
    role: "sponsor",
  },
} as const;

type DemoUsername = keyof typeof DEMO_ACCOUNTS;

function isEmailIdentifier(value: string) {
  return value.includes("@");
}

function resolveDemoAccount(identifier: string) {
  return DEMO_ACCOUNTS[identifier as DemoUsername] ?? null;
}

async function ensureProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  email: string,
  fullName: string,
  role: (typeof USER_ROLES)[number]
) {
  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    email,
    full_name: fullName,
    role,
  });

  if (error) {
    fail(error.message);
  }
}

export async function signInAction(formData: FormData) {
  const parsed = signInSchema.safeParse({
    identifier: formData.get("identifier") ?? formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    fail("Enter a username or email and a password (minimum 8 characters).");
  }

  const identifier = parsed.data.identifier.trim().toLowerCase();
  const demoAccount = isEmailIdentifier(identifier) ? null : resolveDemoAccount(identifier);
  const email = demoAccount?.email ?? identifier;

  if (!isEmailIdentifier(email)) {
    fail("Use your account email or one of the demo usernames: dipti, architect, coach, sponsor.");
  }

  const supabase = await createClient();
  let { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });

  if (error && demoAccount && /invalid login credentials/i.test(error.message)) {
    const signUpResult = await supabase.auth.signUp({
      email,
      password: parsed.data.password,
      options: {
        data: {
          full_name: demoAccount.fullName,
          role: demoAccount.role,
        },
      },
    });

    if (signUpResult.error && !/already registered/i.test(signUpResult.error.message)) {
      fail(signUpResult.error.message);
    }

    if (signUpResult.data.user) {
      await ensureProfile(
        supabase,
        signUpResult.data.user.id,
        email,
        demoAccount.fullName,
        demoAccount.role
      );
    }

    const retry = await supabase.auth.signInWithPassword({
      email,
      password: parsed.data.password,
    });

    data = retry.data;
    error = retry.error;

    if (error && /email not confirmed/i.test(error.message)) {
      fail("Demo account exists but email confirmation is enabled in Supabase. Disable Confirm email for dev or auto-confirm the user, then sign in again.");
    }
  }

  if (error) {
    fail(error.message);
  }

  if (demoAccount && data.user) {
    await ensureProfile(supabase, data.user.id, email, demoAccount.fullName, demoAccount.role);
  }

  revalidatePath("/", "layout");
  redirect("/api/auth/confirm?next=/app");
}

export async function signUpAction(formData: FormData) {
  const parsed = signupSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    fail("Fill all sign up fields correctly.");
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        role: parsed.data.role,
      },
    },
  });

  if (error) {
    fail(error.message);
  }

  if (data.user) {
    await ensureProfile(
      supabase,
      data.user.id,
      parsed.data.email,
      parsed.data.fullName,
      parsed.data.role
    );
  }

  revalidatePath("/", "layout");
  redirect("/app");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/login");
}
