"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { USER_ROLES } from "@/lib/auth/types";

function fail(message: string): never {
  redirect(`/login?error=${encodeURIComponent(message)}`);
}

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const signupSchema = authSchema.extend({
  fullName: z.string().min(2),
  role: z.enum(USER_ROLES),
});

export async function signInAction(formData: FormData) {
  const parsed = authSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    fail("Enter a valid email and password (minimum 8 characters).");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    fail(error.message);
  }

  revalidatePath("/", "layout");
  redirect("/app");
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
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: data.user.id,
      email: parsed.data.email,
      full_name: parsed.data.fullName,
      role: parsed.data.role,
    });

    if (profileError) {
      fail(profileError.message);
    }
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
