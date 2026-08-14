import { getPublicSupabaseEnv } from "@/lib/supabase/env";

export default function SetupPage() {
  const env = getPublicSupabaseEnv();

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Configuration required</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Connect Supabase to continue</h1>
        <p className="mt-3 text-sm text-slate-600">
          Add the required environment variables in .env.local and deployment secrets.
        </p>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-800">Missing keys:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {env.missing.map((key) => (
              <li key={key}>{key}</li>
            ))}
          </ul>
        </div>

        <div className="mt-5 rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-800">Add this to .env.local</p>
          <pre className="mt-2 overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
{`NEXT_PUBLIC_SUPABASE_URL=\nNEXT_PUBLIC_SUPABASE_ANON_KEY=\nNEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=wingrox-docs`}
          </pre>
        </div>
      </div>
    </main>
  );
}
