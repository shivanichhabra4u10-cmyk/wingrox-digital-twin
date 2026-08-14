# WinGroX Digital Twin v2

Production migration from single-file prototype to a live, role-based application using Next.js + Supabase.

## Current Status

- Next.js app scaffolded and building successfully
- Supabase auth integration added (sign in, sign up, sign out)
- Route protection middleware added
- Full workflow backend implemented for stages 1 to 7:
	- participant profile persistence
	- consent persistence
	- document upload metadata + privacy update + secure download route
	- stage notes and completion actions
	- architect release/unlock/complete controls
	- coach/sponsor/admin role-scoped workspace behavior
	- notifications and read-state updates
- SQL schema, migration patch, and role-aware RLS/storage policies created
- Original prototype preserved at `/prototype/index.html`

## Stack

- Next.js 16 (App Router, server actions)
- Supabase Auth + Postgres + Storage
- Tailwind CSS
- Vercel deployment target

## Local Setup

1. Install dependencies

```bash
npm install
```

2. Create `.env.local`

```bash
cp .env.example .env.local
```

Fill values in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=wingrox-docs
```

3. Apply DB schema + migrations (order matters)

1. [supabase/schema.sql](supabase/schema.sql)
2. [supabase/migrations/20260812_security_patch.sql](supabase/migrations/20260812_security_patch.sql)
3. [supabase/migrations/20260813_fix_upr_rls_recursion.sql](supabase/migrations/20260813_fix_upr_rls_recursion.sql)
4. [supabase/migrations/20260813_extend_profiles_profile_fields.sql](supabase/migrations/20260813_extend_profiles_profile_fields.sql)
5. [supabase/migrations/20260813_store_extended_profile_fields.sql](supabase/migrations/20260813_store_extended_profile_fields.sql)

4. Start app

```bash
npm run dev
```

5. Open

- [http://localhost:3000](http://localhost:3000)

If env is missing, app redirects to `/setup` with exact missing keys.

## Planning and Setup Docs

- 3-day execution plan: [docs/IMPLEMENTATION_PLAN_3_DAYS.md](docs/IMPLEMENTATION_PLAN_3_DAYS.md)
- Supabase setup steps: [supabase/SETUP.md](supabase/SETUP.md)

## Deployment

1. Push repository to GitHub.
2. Import repo in Vercel.
3. Set environment variables in Vercel project settings:
	- `NEXT_PUBLIC_SUPABASE_URL`
	- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
	- `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET`
4. In Supabase -> Authentication -> URL Configuration:
	- Site URL = your production Vercel URL
	- Redirect URLs include:
	  - `http://localhost:3000/**`
	  - `https://<your-project>.vercel.app/**`
	  - `https://*.vercel.app/**`
5. Deploy.
6. Verify health endpoint: `/api/health` returns `supabaseConfigured: true`.

Detailed checklist: [docs/VERCEL_DEPLOY_CHECKLIST.md](docs/VERCEL_DEPLOY_CHECKLIST.md)

## CI Validation

- GitHub Actions workflow runs `npm ci`, `npm run lint`, `npm run typecheck`, and `npm run build` on push/PR.

## Notes

- This repository still includes the original prototype source at [prototype/index.html](prototype/index.html).
- Remaining work is environment wiring and live smoke validation using real Supabase and Vercel settings.
