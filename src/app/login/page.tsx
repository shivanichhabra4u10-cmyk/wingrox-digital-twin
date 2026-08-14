import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signInAction, signUpAction } from "@/app/login/actions";
import { USER_ROLES } from "@/lib/auth/types";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const env = getPublicSupabaseEnv();

  if (!env.isConfigured) {
    redirect("/setup");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const params = await searchParams;
  const error = params.error;

  if (user) {
    redirect("/app");
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto grid w-full max-w-6xl gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-slate-950 p-8 text-slate-100">
          <p className="text-xs uppercase tracking-[0.18em] text-amber-300">WinGroX AI</p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight">Individual Growth Intelligence System</h1>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            Production stack: Next.js + Supabase Auth + Postgres + Storage. This is the secure runtime replacing prototype local data.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-slate-300">
            <li>Role-based access: Participant, Architect, Coach, Sponsor, Admin</li>
            <li>Workflow persistence for all 7 stages</li>
            <li>Secure document storage with privacy controls</li>
          </ul>
        </section>

        <section className="grid gap-6">
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
              {error}
            </div>
          ) : null}

          <form action={signInAction} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Sign in</h2>
            <p className="mt-1 text-sm text-slate-600">Use your existing account credentials.</p>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm font-medium text-slate-800">
                Email
                <input name="email" type="email" required className="rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-800">
                Password
                <input name="password" type="password" required minLength={8} className="rounded-lg border border-slate-300 px-3 py-2" />
              </label>
            </div>
            <button type="submit" className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              Sign in
            </button>
          </form>

          <form action={signUpAction} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Create account</h2>
            <p className="mt-1 text-sm text-slate-600">Create an account and assign a workflow role.</p>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm font-medium text-slate-800">
                Full name
                <input name="fullName" type="text" required minLength={2} className="rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-800">
                Email
                <input name="email" type="email" required className="rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-800">
                Password
                <input name="password" type="password" required minLength={8} className="rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-800">
                Role
                <select name="role" required className="rounded-lg border border-slate-300 px-3 py-2">
                  {USER_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button type="submit" className="mt-5 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600">
              Create account
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
