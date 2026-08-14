-- Apply this after initial schema if your Supabase project is already provisioned.

alter table public.profiles add column if not exists email text;
create unique index if not exists profiles_email_unique_idx on public.profiles (email) where email is not null;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_upsert_own_or_admin" on public.profiles;
drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

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

alter table public.participants add column if not exists current_title text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'participants'
      and column_name = 'current_role'
  ) then
    execute 'update public.participants set current_title = coalesce(current_title, "current_role")';
  end if;
end
$$;

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

alter table public.notifications enable row level security;

create table if not exists public.prototype_states (
  participant_id uuid primary key references public.participants(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'prototype_states_state_object_chk'
      and conrelid = 'public.prototype_states'::regclass
  ) then
    alter table public.prototype_states
      add constraint prototype_states_state_object_chk
      check (jsonb_typeof(state) = 'object');
  end if;
end
$$;

create index if not exists prototype_states_updated_at_idx on public.prototype_states (updated_at desc);
create index if not exists prototype_states_state_gin_idx on public.prototype_states using gin (state);

alter table public.prototype_states enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists prototype_states_set_updated_at on public.prototype_states;
create trigger prototype_states_set_updated_at
before update on public.prototype_states
for each row execute function public.set_updated_at();

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
