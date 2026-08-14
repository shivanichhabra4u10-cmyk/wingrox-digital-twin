# Supabase Setup (Quick)

## 1. Project + Keys
- Create new Supabase project.
- Copy from Settings -> API:
  - Project URL (example: https://your-ref.supabase.co)
  - Anon key

## 2. Environment
Set in [/.env.local](../.env.local):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=wingrox-docs
```

## 3. Storage
- Create bucket: wingrox-docs
- Keep bucket Private

## 4. SQL (Order matters)
1. Run [/supabase/schema.sql](schema.sql)
2. Run [/supabase/migrations/20260812_security_patch.sql](migrations/20260812_security_patch.sql)
3. Run [/supabase/migrations/20260813_fix_upr_rls_recursion.sql](migrations/20260813_fix_upr_rls_recursion.sql)
4. Run [/supabase/migrations/20260813_extend_profiles_profile_fields.sql](migrations/20260813_extend_profiles_profile_fields.sql)
5. Run [/supabase/migrations/20260813_store_extended_profile_fields.sql](migrations/20260813_store_extended_profile_fields.sql)

## 5. Verify
Run in SQL editor:

```sql
select
  to_regclass('public.profiles') as profiles_table,
  to_regclass('public.participants') as participants_table;
```

Expected: both values are not null.

## 6. Run App
- npm run dev
- Open http://localhost:3000/login

## 7. If you get current_role error
- Use latest [schema.sql](schema.sql) from repo (it uses current_title).
- Re-run step 4.

## 8. If you get email rate limit exceeded
- Supabase -> Authentication -> Providers -> Email
- Turn off Confirm email (for dev only)
- Save and retry signup
- Alternative: Authentication -> Users -> Add user with auto-confirm

## 9. If login keeps loading after successful auth
- Cause: user exists in auth but missing row in public.profiles
- Status: app now auto-creates missing profile on first `/app` visit
- If still blocked, sign out and sign in once again

## 10. Vercel deploy auth settings
In Supabase -> Authentication -> URL Configuration:
- Set **Site URL** to your production Vercel URL.
- Add **Redirect URLs**:
  - `http://localhost:3000/**`
  - `https://<your-project>.vercel.app/**`
  - `https://*.vercel.app/**`
