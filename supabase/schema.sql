-- WinGroX Digital Twin: initial production schema
-- Apply this in Supabase SQL editor.

create extension if not exists "pgcrypto";

-- Roles for workflow users
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'user_role' and n.nspname = 'public'
  ) then
    create type public.user_role as enum ('participant', 'architect', 'coach', 'sponsor', 'admin');
  end if;
end
$$;

-- Seven-stage workflow keys from prototype
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'stage_key' and n.nspname = 'public'
  ) then
    create type public.stage_key as enum ('profile', 'persona', 'validate', 'diagnostic', 'mirror', 'coach', 'journey');
  end if;
end
$$;

-- Document categories mapped from prototype taxonomy
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'document_category' and n.nspname = 'public'
  ) then
    create type public.document_category as enum (
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
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'privacy_level' and n.nspname = 'public'
  ) then
    create type public.privacy_level as enum ('private', 'architect', 'coach', 'summary', 'hidden');
  end if;
end
$$;

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

create table if not exists public.diagnostic_questionnaires (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  source text not null default 'prototype',
  bank_name text,
  total_questions integer not null default 0,
  is_submitted boolean not null default false,
  submitted_at timestamptz,
  is_released boolean not null default false,
  released_at timestamptz,
  report_opened_at timestamptz,
  raw_diagnostic jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diagnostic_questionnaires_participant_source_uk unique (participant_id, source),
  constraint diagnostic_questionnaires_source_chk check (source in ('prototype', 'app')),
  constraint diagnostic_questionnaires_total_questions_chk check (total_questions >= 0),
  constraint diagnostic_questionnaires_raw_object_chk check (jsonb_typeof(raw_diagnostic) = 'object')
);

create table if not exists public.diagnostic_questions (
  id uuid primary key default gen_random_uuid(),
  questionnaire_id uuid not null references public.diagnostic_questionnaires(id) on delete cascade,
  question_id integer not null,
  display_order integer not null default 1,
  dimension text,
  question_text text,
  options jsonb not null default '[]'::jsonb,
  scores jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diagnostic_questions_questionnaire_question_uk unique (questionnaire_id, question_id),
  constraint diagnostic_questions_question_id_chk check (question_id > 0),
  constraint diagnostic_questions_display_order_chk check (display_order > 0),
  constraint diagnostic_questions_options_array_chk check (jsonb_typeof(options) = 'array'),
  constraint diagnostic_questions_scores_array_chk check (jsonb_typeof(scores) = 'array'),
  constraint diagnostic_questions_metadata_object_chk check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.diagnostic_question_responses (
  id uuid primary key default gen_random_uuid(),
  questionnaire_id uuid not null references public.diagnostic_questionnaires(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  question_id integer not null,
  ranked_choices smallint[] not null default '{}'::smallint[],
  confidence text,
  comment text,
  other_text text,
  is_private boolean not null default false,
  answer_payload jsonb not null default '{}'::jsonb,
  answered_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diagnostic_question_responses_questionnaire_question_uk unique (questionnaire_id, question_id),
  constraint diagnostic_question_responses_question_id_chk check (question_id > 0),
  constraint diagnostic_question_responses_ranked_choices_size_chk check (cardinality(ranked_choices) <= 10),
  constraint diagnostic_question_responses_payload_object_chk check (jsonb_typeof(answer_payload) = 'object')
);

create index if not exists diagnostic_questionnaires_participant_idx
  on public.diagnostic_questionnaires (participant_id, updated_at desc);
create index if not exists diagnostic_questions_questionnaire_idx
  on public.diagnostic_questions (questionnaire_id, display_order);
create index if not exists diagnostic_question_responses_participant_idx
  on public.diagnostic_question_responses (participant_id, answered_at desc);
create index if not exists diagnostic_question_responses_questionnaire_idx
  on public.diagnostic_question_responses (questionnaire_id, question_id);
create index if not exists diagnostic_question_responses_payload_gin_idx
  on public.diagnostic_question_responses using gin (answer_payload);

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

drop trigger if exists diagnostic_questionnaires_set_updated_at on public.diagnostic_questionnaires;
create trigger diagnostic_questionnaires_set_updated_at
before update on public.diagnostic_questionnaires
for each row execute function public.set_updated_at();

drop trigger if exists diagnostic_questions_set_updated_at on public.diagnostic_questions;
create trigger diagnostic_questions_set_updated_at
before update on public.diagnostic_questions
for each row execute function public.set_updated_at();

drop trigger if exists diagnostic_question_responses_set_updated_at on public.diagnostic_question_responses;
create trigger diagnostic_question_responses_set_updated_at
before update on public.diagnostic_question_responses
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
alter table public.diagnostic_questionnaires enable row level security;
alter table public.diagnostic_questions enable row level security;
alter table public.diagnostic_question_responses enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;

-- Profiles: keep non-recursive policies to avoid auth bootstrap loops.
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles
for select using (
  auth.uid() is not null
);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert with check (
  auth.uid() = id
);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update using (
  auth.uid() = id
)
with check (
  auth.uid() = id
);

-- Helper view rule: user can access participant if linked in role map.
drop policy if exists "participants_select_assigned" on public.participants;
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

drop policy if exists "participants_update_owner_architect_admin" on public.participants;
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

drop policy if exists "participants_insert_self_or_admin" on public.participants;
create policy "participants_insert_self_or_admin" on public.participants
for insert with check (
  owner_user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

create or replace function public.current_user_is_upr_admin_for_participant(p_participant_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.user_participant_roles
    where participant_id = p_participant_id
      and user_id = auth.uid()
      and role in ('architect', 'admin')
  );
$$;

drop policy if exists "upr_select_assigned_or_admin" on public.user_participant_roles;
create policy "upr_select_assigned_or_admin" on public.user_participant_roles
for select using (
  user_id = auth.uid()
  or public.current_user_is_upr_admin_for_participant(participant_id)
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "upr_insert_architect_admin" on public.user_participant_roles;
create policy "upr_insert_architect_admin" on public.user_participant_roles
for insert with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('architect', 'admin')
  )
);

drop policy if exists "consents_select_assigned" on public.consents;
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

drop policy if exists "consents_modify_owner_architect_admin" on public.consents;
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

drop policy if exists "documents_select_assigned" on public.documents;
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

drop policy if exists "documents_insert_owner_architect_admin" on public.documents;
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

drop policy if exists "documents_update_owner_architect_admin" on public.documents;
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

drop policy if exists "stage_progress_select_assigned" on public.stage_progress;
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

drop policy if exists "stage_progress_modify_owner_architect_admin" on public.stage_progress;
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

drop policy if exists "stage_payloads_select_assigned" on public.stage_payloads;
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

drop policy if exists "stage_payloads_modify_owner_architect_admin" on public.stage_payloads;
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

drop policy if exists "prototype_states_select_assigned" on public.prototype_states;
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

drop policy if exists "prototype_states_modify_owner_architect_admin" on public.prototype_states;
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

drop policy if exists "diagnostic_questionnaires_select_assigned" on public.diagnostic_questionnaires;
create policy "diagnostic_questionnaires_select_assigned" on public.diagnostic_questionnaires
for select using (
  exists (
    select 1 from public.participants pa
    where pa.id = diagnostic_questionnaires.participant_id
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

drop policy if exists "diagnostic_questionnaires_modify_owner_architect_admin" on public.diagnostic_questionnaires;
create policy "diagnostic_questionnaires_modify_owner_architect_admin" on public.diagnostic_questionnaires
for all using (
  exists (
    select 1 from public.participants pa
    where pa.id = diagnostic_questionnaires.participant_id
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
    where pa.id = diagnostic_questionnaires.participant_id
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

drop policy if exists "diagnostic_questions_select_assigned" on public.diagnostic_questions;
create policy "diagnostic_questions_select_assigned" on public.diagnostic_questions
for select using (
  exists (
    select 1
    from public.diagnostic_questionnaires dq
    join public.participants pa on pa.id = dq.participant_id
    where dq.id = diagnostic_questions.questionnaire_id
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

drop policy if exists "diagnostic_questions_modify_owner_architect_admin" on public.diagnostic_questions;
create policy "diagnostic_questions_modify_owner_architect_admin" on public.diagnostic_questions
for all using (
  exists (
    select 1
    from public.diagnostic_questionnaires dq
    join public.participants pa on pa.id = dq.participant_id
    where dq.id = diagnostic_questions.questionnaire_id
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
    select 1
    from public.diagnostic_questionnaires dq
    join public.participants pa on pa.id = dq.participant_id
    where dq.id = diagnostic_questions.questionnaire_id
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

drop policy if exists "diagnostic_responses_select_assigned" on public.diagnostic_question_responses;
create policy "diagnostic_responses_select_assigned" on public.diagnostic_question_responses
for select using (
  exists (
    select 1 from public.participants pa
    where pa.id = diagnostic_question_responses.participant_id
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

drop policy if exists "diagnostic_responses_modify_owner_architect_admin" on public.diagnostic_question_responses;
create policy "diagnostic_responses_modify_owner_architect_admin" on public.diagnostic_question_responses
for all using (
  exists (
    select 1 from public.participants pa
    where pa.id = diagnostic_question_responses.participant_id
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
    where pa.id = diagnostic_question_responses.participant_id
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

drop policy if exists "audit_select_admin_only" on public.audit_logs;
create policy "audit_select_admin_only" on public.audit_logs
for select using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "audit_insert_authenticated" on public.audit_logs;
create policy "audit_insert_authenticated" on public.audit_logs
for insert with check (actor_user_id = auth.uid());

drop policy if exists "notifications_select_assigned" on public.notifications;
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

drop policy if exists "notifications_insert_authenticated" on public.notifications;
create policy "notifications_insert_authenticated" on public.notifications
for insert with check (actor_user_id = auth.uid());

drop policy if exists "notifications_update_target_or_admin" on public.notifications;
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
