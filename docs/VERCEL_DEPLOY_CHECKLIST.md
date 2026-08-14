# Vercel Deploy Checklist

## 1. Vercel Project
- Import repository in Vercel.
- Framework preset: Next.js.
- Build command: npm run build.
- Install command: npm ci.
- Node version: 20.x or newer.

## 2. Environment Variables (Vercel Project Settings -> Environment Variables)
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET (default: wingrox-docs)

Use [.env.example](../.env.example) as the source of required keys.

## 3. Supabase Auth URL Settings
In Supabase -> Authentication -> URL Configuration:
- Site URL: your production Vercel URL.
- Redirect URLs:
  - http://localhost:3000/**
  - https://<your-project>.vercel.app/**
  - https://*.vercel.app/** (preview deployments)

## 4. Database Migrations (must be applied)
Run SQL in this order:
1. [supabase/schema.sql](../supabase/schema.sql)
2. [supabase/migrations/20260812_security_patch.sql](../supabase/migrations/20260812_security_patch.sql)
3. [supabase/migrations/20260813_fix_upr_rls_recursion.sql](../supabase/migrations/20260813_fix_upr_rls_recursion.sql)
4. [supabase/migrations/20260813_extend_profiles_profile_fields.sql](../supabase/migrations/20260813_extend_profiles_profile_fields.sql)
5. [supabase/migrations/20260813_store_extended_profile_fields.sql](../supabase/migrations/20260813_store_extended_profile_fields.sql)

## 5. Smoke Check After Deploy
- GET /api/health returns status=ok and supabaseConfigured=true.
- Login works.
- Save in Step 1 persists and reload restores.
- Workflow state save/load works across refresh for steps 1-7.

## 6. Suggested Production Hardening
- Disable public signup if onboarding is admin-controlled.
- Keep Supabase Storage bucket private.
- Rotate anon key if exposed by accident.
- Restrict Supabase Auth providers to required ones only.
