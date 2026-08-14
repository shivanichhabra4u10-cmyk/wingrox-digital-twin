-- WinGroX Digital Twin: initial production schema
-- Apply this in Supabase SQL editor.

create extension if not exists "pgcrypto";

-- Roles for workflow users
create type user_role as enum ('participant', 'architect', 'coach', 'sponsor', 'admin');

-- Seven-stage workflow keys from prototype
create type stage_key as enum ('profile', 'persona', 'validate', 'diagnostic', 'mirror', 'coach', 'journey');

-- Document categories mapped from prototype taxonomy
create type document_category as enum (
  'resume',
  'linkedin_export',
  'biography',
  'assessment_report',
  'career_history',
  'recommendation',
  'work_samples',
  'performance_feedback',
  'personal_notes',
  'other'
);

create type privacy_level as enum ('private', 'architect', 'coach', 'summary', 'hidden');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text not null,
  role user_role not null default 'participant',
  mobile text,
  country_code text,
  city text,
  country text,
  linkedin_url text,
  current_title text,
  organization text,
  about text,
  help_with text,
  preferred_language text,
  timezone text,
  career_history text,
  education text,
  achievements text,
  interests text,
  family_life_considerations text,
  current_goals text,
  preferred_communication_style text,
  accessibility_needs text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  mobile text,
  country_code text,
  city text,
  country text,
  linkedin_url text,
  current_title text,
  organization text,
  about text,
  help_with text,
  preferred_language text,
  timezone text,
  career_history text,
  education text,
  achievements text,
  interests text,
  family_life_considerations text,
  current_goals text,
  preferred_communication_style text,
  accessibility_needs text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_participant_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  role user_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, participant_id, role)
);

create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  consent_key text not null,
  accepted boolean not null default false,
  accepted_at timestamptz,
  version text not null default 'v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (participant_id, consent_key)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  file_name text not null,
  storage_bucket text not null,
  storage_path text not null,
  file_size_bytes bigint,
  mime_type text,
  sha256 text,
  category document_category not null default 'other',
  privacy privacy_level not null default 'architect',
  scan_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stage_progress (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  stage stage_key not null,
  is_complete boolean not null default false,
  unlocked boolean not null default false,
  released_by_architect boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (participant_id, stage)
);

create table if not exists public.stage_payloads (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  stage stage_key not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (participant_id, stage)
);

create table if not exists public.prototype_states (
  participant_id uuid primary key references public.participants(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prototype_states_state_object_chk check (jsonb_typeof(state) = 'object')
);

create index if not exists prototype_states_updated_at_idx on public.prototype_states (updated_at desc);
create index if not exists prototype_states_state_gin_idx on public.prototype_states using gin (state);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  participant_id uuid references public.participants(id) on delete set null,
  action text not null,
  entity_name text not null,
  entity_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid references public.participants(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  target_role user_role,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists participants_set_updated_at on public.participants;
create trigger participants_set_updated_at
before update on public.participants
for each row execute function public.set_updated_at();

drop trigger if exists consents_set_updated_at on public.consents;
create trigger consents_set_updated_at
before update on public.consents
for each row execute function public.set_updated_at();

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

drop trigger if exists stage_payloads_set_updated_at on public.stage_payloads;
create trigger stage_payloads_set_updated_at
before update on public.stage_payloads
for each row execute function public.set_updated_at();

drop trigger if exists prototype_states_set_updated_at on public.prototype_states;
create trigger prototype_states_set_updated_at
before update on public.prototype_states
for each row execute function public.set_updated_at();

-- RLS
alter table public.profiles enable row level security;
alter table public.participants enable row level security;
alter table public.user_participant_roles enable row level security;
alter table public.consents enable row level security;
alter table public.documents enable row level security;
alter table public.stage_progress enable row level security;
alter table public.stage_payloads enable row level security;
alter table public.prototype_states enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;

-- Profiles: keep non-recursive policies to avoid auth bootstrap loops.
create policy "profiles_select_authenticated" on public.profiles
for select using (
  auth.uid() is not null
);

create policy "profiles_insert_own" on public.profiles
for insert with check (
  auth.uid() = id
);

create policy "profiles_update_own" on public.profiles
for update using (
  auth.uid() = id
)
with check (
  auth.uid() = id
);

-- Helper view rule: user can access participant if linked in role map.
create policy "participants_select_assigned" on public.participants
for select using (
  owner_user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'architect'
  )
  or exists (
    select 1
    from public.user_participant_roles upr
    where upr.participant_id = participants.id
      and upr.user_id = auth.uid()
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "participants_update_owner_architect_admin" on public.participants
for update using (
  owner_user_id = auth.uid()
  or exists (
    select 1
    from public.user_participant_roles upr
    where upr.participant_id = participants.id
      and upr.user_id = auth.uid()
      and upr.role in ('architect', 'admin')
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  owner_user_id = auth.uid()
  or exists (
    select 1
    from public.user_participant_roles upr
    where upr.participant_id = participants.id
      and upr.user_id = auth.uid()
      and upr.role in ('architect', 'admin')
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "participants_insert_self_or_admin" on public.participants
for insert with check (
  owner_user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "upr_select_assigned_or_admin" on public.user_participant_roles
for select using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.user_participant_roles me
    where me.participant_id = user_participant_roles.participant_id
      and me.user_id = auth.uid()
      and me.role in ('architect', 'admin')
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "upr_insert_architect_admin" on public.user_participant_roles
for insert with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('architect', 'admin')
  )
);

create policy "consents_select_assigned" on public.consents
for select using (
  exists (
    select 1 from public.participants pa
    where pa.id = consents.participant_id
      and (
        pa.owner_user_id = auth.uid()
        or exists (
          select 1 from public.user_participant_roles upr
          where upr.participant_id = pa.id and upr.user_id = auth.uid()
        )
      )
  )
);

create policy "consents_modify_owner_architect_admin" on public.consents
for all using (
  exists (
    select 1 from public.participants pa
    where pa.id = consents.participant_id
      and (
        pa.owner_user_id = auth.uid()
        or exists (
          select 1 from public.user_participant_roles upr
          where upr.participant_id = pa.id and upr.user_id = auth.uid() and upr.role in ('architect', 'admin')
        )
      )
  )
)
with check (
  exists (
    select 1 from public.participants pa
    where pa.id = consents.participant_id
      and (
        pa.owner_user_id = auth.uid()
        or exists (
          select 1 from public.user_participant_roles upr
          where upr.participant_id = pa.id and upr.user_id = auth.uid() and upr.role in ('architect', 'admin')
        )
      )
  )
);

create policy "documents_select_assigned" on public.documents
for select using (
  exists (
    select 1 from public.participants pa
    where pa.id = documents.participant_id
      and pa.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.user_participant_roles upr
    where upr.participant_id = documents.participant_id
      and upr.user_id = auth.uid()
      and upr.role in ('architect', 'admin')
  )
  or exists (
    select 1
    from public.user_participant_roles upr
    where upr.participant_id = documents.participant_id
      and upr.user_id = auth.uid()
      and upr.role = 'coach'
      and documents.privacy in ('coach', 'summary')
  )
  or exists (
    select 1
    from public.user_participant_roles upr
    where upr.participant_id = documents.participant_id
      and upr.user_id = auth.uid()
      and upr.role = 'sponsor'
      and documents.privacy = 'summary'
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "documents_insert_owner_architect_admin" on public.documents
for insert with check (
  uploaded_by = auth.uid()
  and exists (
    select 1 from public.participants pa
    where pa.id = documents.participant_id
      and (
        pa.owner_user_id = auth.uid()
        or exists (
          select 1 from public.user_participant_roles upr
          where upr.participant_id = pa.id and upr.user_id = auth.uid() and upr.role in ('architect', 'admin')
        )
      )
  )
);

create policy "documents_update_owner_architect_admin" on public.documents
for update using (
  exists (
    select 1 from public.participants pa
    where pa.id = documents.participant_id
      and (
        pa.owner_user_id = auth.uid()
        or exists (
          select 1 from public.user_participant_roles upr
          where upr.participant_id = pa.id and upr.user_id = auth.uid() and upr.role in ('architect', 'admin')
        )
      )
  )
)
with check (
  exists (
    select 1 from public.participants pa
    where pa.id = documents.participant_id
      and (
        pa.owner_user_id = auth.uid()
        or exists (
          select 1 from public.user_participant_roles upr
          where upr.participant_id = pa.id and upr.user_id = auth.uid() and upr.role in ('architect', 'admin')
        )
      )
  )
);

create policy "stage_progress_select_assigned" on public.stage_progress
for select using (
  exists (
    select 1 from public.participants pa
    where pa.id = stage_progress.participant_id
      and (
        pa.owner_user_id = auth.uid()
        or exists (
          select 1 from public.user_participant_roles upr
          where upr.participant_id = pa.id and upr.user_id = auth.uid()
        )
      )
  )
);

create policy "stage_progress_modify_owner_architect_admin" on public.stage_progress
for all using (
  exists (
    select 1 from public.participants pa
    where pa.id = stage_progress.participant_id
      and (
        pa.owner_user_id = auth.uid()
        or exists (
          select 1 from public.user_participant_roles upr
          where upr.participant_id = pa.id and upr.user_id = auth.uid() and upr.role in ('architect', 'admin')
        )
      )
  )
)
with check (
  exists (
    select 1 from public.participants pa
    where pa.id = stage_progress.participant_id
      and (
        pa.owner_user_id = auth.uid()
        or exists (
          select 1 from public.user_participant_roles upr
          where upr.participant_id = pa.id and upr.user_id = auth.uid() and upr.role in ('architect', 'admin')
        )
      )
  )
);

create policy "stage_payloads_select_assigned" on public.stage_payloads
for select using (
  exists (
    select 1 from public.participants pa
    where pa.id = stage_payloads.participant_id
      and (
        pa.owner_user_id = auth.uid()
        or exists (
          select 1 from public.user_participant_roles upr
          where upr.participant_id = pa.id and upr.user_id = auth.uid()
        )
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role in ('architect', 'admin')
        )
      )
  )
);

create policy "stage_payloads_modify_owner_architect_admin" on public.stage_payloads
for all using (
  exists (
    select 1 from public.participants pa
    where pa.id = stage_payloads.participant_id
      and (
        pa.owner_user_id = auth.uid()
        or exists (
          select 1 from public.user_participant_roles upr
          where upr.participant_id = pa.id and upr.user_id = auth.uid() and upr.role in ('architect', 'admin')
        )
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role in ('architect', 'admin')
        )
      )
  )
)
with check (
  exists (
    select 1 from public.participants pa
    where pa.id = stage_payloads.participant_id
      and (
        pa.owner_user_id = auth.uid()
        or exists (
          select 1 from public.user_participant_roles upr
          where upr.participant_id = pa.id and upr.user_id = auth.uid() and upr.role in ('architect', 'admin')
        )
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role in ('architect', 'admin')
        )
      )
  )
);

create policy "prototype_states_select_assigned" on public.prototype_states
for select using (
  exists (
    select 1 from public.participants pa
    where pa.id = prototype_states.participant_id
      and (
        pa.owner_user_id = auth.uid()
        or exists (
          select 1 from public.user_participant_roles upr
          where upr.participant_id = pa.id and upr.user_id = auth.uid()
        )
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role in ('architect', 'admin')
        )
      )
  )
);

create policy "prototype_states_modify_owner_architect_admin" on public.prototype_states
for all using (
  exists (
    select 1 from public.participants pa
    where pa.id = prototype_states.participant_id
      and (
        pa.owner_user_id = auth.uid()
        or exists (
          select 1 from public.user_participant_roles upr
          where upr.participant_id = pa.id and upr.user_id = auth.uid() and upr.role in ('architect', 'admin')
        )
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role in ('architect', 'admin')
        )
      )
  )
)
with check (
  exists (
    select 1 from public.participants pa
    where pa.id = prototype_states.participant_id
      and (
        pa.owner_user_id = auth.uid()
        or exists (
          select 1 from public.user_participant_roles upr
          where upr.participant_id = pa.id and upr.user_id = auth.uid() and upr.role in ('architect', 'admin')
        )
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role in ('architect', 'admin')
        )
      )
  )
);

create policy "audit_select_admin_only" on public.audit_logs
for select using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "audit_insert_authenticated" on public.audit_logs
for insert with check (actor_user_id = auth.uid());

create policy "notifications_select_assigned" on public.notifications
for select using (
  target_user_id = auth.uid()
  or exists (
    select 1 from public.participants pa
    where pa.id = notifications.participant_id
      and (
        pa.owner_user_id = auth.uid()
        or exists (
          select 1 from public.user_participant_roles upr
          where upr.participant_id = pa.id and upr.user_id = auth.uid()
        )
      )
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "notifications_insert_authenticated" on public.notifications
for insert with check (actor_user_id = auth.uid());

create policy "notifications_update_target_or_admin" on public.notifications
for update using (
  target_user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  target_user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Storage policies for private document bucket
drop policy if exists "storage_docs_select" on storage.objects;
create policy "storage_docs_select" on storage.objects
for select to authenticated using (
  bucket_id = 'wingrox-docs'
  and exists (
    select 1
    from public.documents d
    join public.participants pa on pa.id = d.participant_id
    where d.storage_bucket = storage.objects.bucket_id
      and d.storage_path = storage.objects.name
      and (
        pa.owner_user_id = auth.uid()
        or exists (
          select 1 from public.user_participant_roles upr
          where upr.participant_id = pa.id
            and upr.user_id = auth.uid()
            and upr.role in ('architect', 'admin')
        )
        or exists (
          select 1 from public.user_participant_roles upr
          where upr.participant_id = pa.id
            and upr.user_id = auth.uid()
            and upr.role = 'coach'
            and d.privacy in ('coach', 'summary')
        )
        or exists (
          select 1 from public.user_participant_roles upr
          where upr.participant_id = pa.id
            and upr.user_id = auth.uid()
            and upr.role = 'sponsor'
            and d.privacy = 'summary'
        )
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
      )
  )
);

drop policy if exists "storage_docs_insert" on storage.objects;
create policy "storage_docs_insert" on storage.objects
for insert to authenticated with check (
  bucket_id = 'wingrox-docs'
  and (
    exists (
      select 1
      from public.participants pa
      where pa.owner_user_id = auth.uid()
        and storage.objects.name like pa.id::text || '/%'
    )
    or exists (
      select 1
      from public.user_participant_roles upr
      join public.participants pa on pa.id = upr.participant_id
      where upr.user_id = auth.uid()
        and upr.role in ('architect', 'admin')
        and storage.objects.name like pa.id::text || '/%'
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
);

drop policy if exists "storage_docs_update" on storage.objects;
create policy "storage_docs_update" on storage.objects
for update to authenticated using (
  bucket_id = 'wingrox-docs'
) with check (
  bucket_id = 'wingrox-docs'
);

drop policy if exists "storage_docs_delete" on storage.objects;
create policy "storage_docs_delete" on storage.objects
for delete to authenticated using (
  bucket_id = 'wingrox-docs'
  and (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('architect', 'admin')
    )
    or exists (
      select 1
      from public.documents d
      join public.participants pa on pa.id = d.participant_id
      where d.storage_bucket = storage.objects.bucket_id
        and d.storage_path = storage.objects.name
        and pa.owner_user_id = auth.uid()
    )
  )
);
