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
    <main className="min-h-screen bg-[#0f0f14] flex items-center justify-center px-4 py-12">
      <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[1fr_420px]">

        {/* ── Left: Brand panel ── */}
        <section className="flex flex-col justify-center py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-400">WinGroX AI</p>
          <h1 className="mt-3 text-4xl font-bold leading-[1.1] text-white">
            Your personal growth<br />journey, guided end to end
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-slate-400">
            An individual growth intelligence system that takes you from self-discovery to a coached 12-week journey — with a digital twin that evolves as you do.
          </p>

          <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-white/10">
            {[
              ["01", "Profile",           "Build your baseline — who you are, where you are, and what matters most."],
              ["02", "Persona Discovery", "Pre-immersion analysis + live immersion call to surface your values, strengths and blind spots."],
              ["03", "Validation",        "Review and confirm your persona with your Growth Sprint Architect before moving forward."],
              ["04", "Growth Diagnostic", "50 structured questions mapping your pain areas and behaviour patterns into a Navigator report."],
              ["05", "Growth Mirror",     "Your digital twin — capital, blockages, career options, opportunity scorecard and 5-year roadmap."],
              ["06", "Coach Activation",  "Meet shortlisted coaches, run a chemistry call, choose your match and get a personalised plan."],
              ["07", "Growth Journey",    "A structured 12-week sprint with weekly check-ins, tracked milestones and monthly reviews."],
            ].map(([num, title, desc]) => (
              <div key={num} className="flex gap-4 bg-white/[0.03] px-5 py-4 hover:bg-white/[0.06] transition-colors">
                <span className="mt-0.5 shrink-0 text-[11px] font-bold tabular-nums text-amber-400/70">{num}</span>
                <div>
                  <p className="text-[13px] font-semibold text-amber-300">{title}</p>
                  <p className="mt-0.5 text-[13px] leading-snug text-slate-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Right: Auth forms ── */}
        <section className="flex flex-col gap-5">
          {error ? (
            <div className="rounded-xl border border-rose-400/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
              {error}
            </div>
          ) : null}

          <form action={signInAction} className="rounded-2xl border border-white/10 bg-white/[0.05] p-7 backdrop-blur">
            <h2 className="text-lg font-semibold text-white">Sign in</h2>
            <p className="mt-1 text-sm text-slate-400">Welcome back. Enter your credentials to continue.</p>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-1.5 text-sm font-medium text-slate-300">
                Email
                <input name="email" type="email" required placeholder="you@example.com"
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/30" />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-300">
                Password
                <input name="password" type="password" required minLength={8} placeholder="••••••••"
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/30" />
              </label>
            </div>
            <button type="submit"
              className="mt-5 w-full rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-300 transition-colors">
              Sign in
            </button>
          </form>

          <form action={signUpAction} className="rounded-2xl border border-white/10 bg-white/[0.05] p-7 backdrop-blur">
            <h2 className="text-lg font-semibold text-white">Create account</h2>
            <p className="mt-1 text-sm text-slate-400">New here? Set up your account and role to begin.</p>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-1.5 text-sm font-medium text-slate-300">
                Full name
                <input name="fullName" type="text" required minLength={2} placeholder="Your full name"
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/30" />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-300">
                Email
                <input name="email" type="email" required placeholder="you@example.com"
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/30" />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-300">
                Password
                <input name="password" type="password" required minLength={8} placeholder="Min 8 characters"
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/30" />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-300">
                Role
                <select name="role" required
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/30">
                  {USER_ROLES.map((role) => (
                    <option key={role} value={role} className="bg-slate-900">{role}</option>
                  ))}
                </select>
              </label>
            </div>
            <button type="submit"
              className="mt-5 w-full rounded-lg border border-amber-400/40 bg-transparent px-4 py-2.5 text-sm font-semibold text-amber-300 hover:bg-amber-400/10 transition-colors">
              Create account
            </button>
          </form>
        </section>

      </div>
    </main>
  );
}
