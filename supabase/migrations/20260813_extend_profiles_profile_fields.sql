-- Extend profiles to store participant-facing profile fields for one-to-one owner accounts.
-- Keeps auth-level profile data aligned with the editable UI profile payload.

alter table public.profiles add column if not exists mobile text;
alter table public.profiles add column if not exists country_code text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists linkedin_url text;
alter table public.profiles add column if not exists current_title text;
alter table public.profiles add column if not exists organization text;
alter table public.profiles add column if not exists about text;
alter table public.profiles add column if not exists help_with text;
alter table public.profiles add column if not exists preferred_language text;
alter table public.profiles add column if not exists timezone text;

-- Backfill from participant rows where owner_user_id maps one-to-one to profiles.id.
update public.profiles p
set
  mobile = coalesce(p.mobile, pa.mobile),
  country_code = coalesce(p.country_code, pa.country_code),
  city = coalesce(p.city, pa.city),
  country = coalesce(p.country, pa.country),
  linkedin_url = coalesce(p.linkedin_url, pa.linkedin_url),
  current_title = coalesce(p.current_title, pa.current_title),
  organization = coalesce(p.organization, pa.organization),
  about = coalesce(p.about, pa.about),
  help_with = coalesce(p.help_with, pa.help_with),
  preferred_language = coalesce(p.preferred_language, pa.preferred_language),
  timezone = coalesce(p.timezone, pa.timezone)
from public.participants pa
where pa.owner_user_id = p.id;