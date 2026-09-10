import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signInAction, signUpAction } from "@/app/login/actions";
import { USER_ROLES } from "@/lib/auth/types";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";
import styles from "./login.module.css";

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

  const circles = Array.from({length: 14}, (_, i) => (
    <circle key={i} cx="470" cy="392" r={70 + i * 46} />
  ));

  return (
    <main className={styles.screen}>
      <aside className={styles.cover}>
        <svg className={styles.engrave} viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          {circles}
        </svg>

        <div className={styles.coverInner}>
          <div className={styles.mark}>
            <svg className={styles.markIcon} width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
              <rect width="32" height="32" rx="4" fill="#A67C34"/>
              <path d="M7 10l4 12 5-9 5 9 4-12" fill="none" stroke="#0C1A2B" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div>
              <div className={styles.name}>WinGroX</div>
              <div className={styles.kicker}>Individual Growth Intelligence</div>
            </div>
          </div>

          <div className={styles.lede}>
            <p className={styles.quote}>
              From self&#8209;awareness<br/>to self&#8209;authorship.
            </p>
            <span className={styles.rule}/>
            <div className={styles.path} aria-label="Programme path">
              {[
                ["01", "Profile"],
                ["02", "Discovery"],
                ["03", "Mirror"],
                ["04", "Coach"],
              ].map(([number, label]) => (
                <div key={number} className={styles.pathItem}>
                  <span>{number}</span>
                  <strong>{label}</strong>
                </div>
              ))}
            </div>
          </div>

          <footer className={styles.footer}>
            <span>Confidential</span><span>Secure Workspace</span><span>{new Date().getFullYear()}</span>
          </footer>
        </div>
      </aside>

      <section className={styles.panel} aria-labelledby="login-title">
        <div className={styles.formShell}>
          <div className={styles.eyebrow}>Programme access</div>
          <h1 id="login-title" className={styles.title}>Sign in</h1>
          <p className={styles.subtitle}>Your username or email and password decide which screen opens.</p>

          {error && (
            <div className={styles.error} role="alert">
              {error}
            </div>
          )}

          <form action={signInAction} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="identifier">Username or email</label>
              <input id="identifier" name="identifier" type="text" required placeholder="e.g. dipti or dipti@example.com" autoComplete="username" />
            </div>
            <div className={styles.field}>
              <label htmlFor="password">Password</label>
              <input id="password" name="password" type="password" required minLength={8} placeholder="Enter your password" autoComplete="current-password" />
            </div>
            <button type="submit" className={styles.button}>
              Sign in →
            </button>
          </form>

          <details className={styles.details}>
            <summary>
              <span>Create account</span>
            </summary>
            <form action={signUpAction} className={styles.signupForm}>
              <div className={styles.field}>
                <label htmlFor="fullName">Full name</label>
                <input id="fullName" name="fullName" type="text" required minLength={2} placeholder="Your full name" />
              </div>
              <div className={styles.field}>
                <label htmlFor="email">Email</label>
                <input id="email" name="email" type="email" required placeholder="you@example.com" />
              </div>
              <div className={styles.field}>
                <label htmlFor="signupPassword">Password</label>
                <input id="signupPassword" name="password" type="password" required minLength={8} placeholder="Min 8 characters" />
              </div>
              <div className={styles.field}>
                <label htmlFor="role">Role</label>
                <select id="role" name="role" required>
                  {USER_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </div>
              <button type="submit" className={styles.outlineButton}>
                Create account
              </button>
            </form>
          </details>

          <p className={styles.legal}>
            <strong>Important.</strong> Use assigned credentials only and share account details through approved secure channels.
          </p>
          <p className={styles.note}>
            Demo usernames supported here: dipti, architect, coach, sponsor.
          </p>
        </div>
      </section>
    </main>
  );
}


