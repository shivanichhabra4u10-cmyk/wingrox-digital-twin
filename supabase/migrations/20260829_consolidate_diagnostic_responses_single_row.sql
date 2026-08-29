-- Consolidate diagnostic responses into a single row per participant.
-- This replaces per-question rows with a JSON snapshot for all answers.

create table if not exists public.diagnostic_response_snapshots (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  answered_count integer not null default 0,
  answered_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diagnostic_response_snapshots_participant_uk unique (participant_id),
  constraint diagnostic_response_snapshots_answers_object_chk check (jsonb_typeof(answers) = 'object'),
  constraint diagnostic_response_snapshots_answered_count_chk check (answered_count >= 0)
);

-- If the table already exists from an earlier revision, remove legacy questionnaire linkage.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'diagnostic_response_snapshots'
      and column_name = 'questionnaire_id'
  ) then
    alter table public.diagnostic_response_snapshots
      drop constraint if exists diagnostic_response_snapshots_questionnaire_uk;

    alter table public.diagnostic_response_snapshots
      drop column if exists questionnaire_id cascade;
  end if;
end
$$;

create index if not exists diagnostic_response_snapshots_participant_idx
  on public.diagnostic_response_snapshots (participant_id, answered_at desc);
create index if not exists diagnostic_response_snapshots_answers_gin_idx
  on public.diagnostic_response_snapshots using gin (answers);

drop trigger if exists diagnostic_response_snapshots_set_updated_at on public.diagnostic_response_snapshots;
create trigger diagnostic_response_snapshots_set_updated_at
before update on public.diagnostic_response_snapshots
for each row execute function public.set_updated_at();

-- Backfill from old per-question response rows when legacy table exists.
do $$
begin
  if to_regclass('public.diagnostic_question_responses') is not null then
    execute $sql$
      insert into public.diagnostic_response_snapshots (
        participant_id,
        answers,
        answered_count,
        answered_at,
        created_by,
        updated_by
      )
      select
        dqr.participant_id,
        coalesce(
          jsonb_object_agg(dqr.question_id::text, dqr.answer_payload order by dqr.question_id),
          '{}'::jsonb
        ) as answers,
        count(*) filter (
          where cardinality(dqr.ranked_choices) > 0
            or dqr.confidence is not null
            or dqr.comment is not null
            or dqr.other_text is not null
            or dqr.is_private
        )::integer as answered_count,
        max(dqr.answered_at) as answered_at,
        (array_remove(array_agg(dqr.created_by), null))[1] as created_by,
        (array_remove(array_agg(dqr.updated_by), null))[1] as updated_by
      from public.diagnostic_question_responses dqr
      group by dqr.participant_id
      on conflict (participant_id)
      do update set
        answers = excluded.answers,
        answered_count = excluded.answered_count,
        answered_at = excluded.answered_at,
        updated_by = excluded.updated_by,
        updated_at = now();
    $sql$;
  end if;
end
$$;

-- Safety backfill from prototype snapshot JSON if no normalized rows were present.
insert into public.diagnostic_response_snapshots (
  participant_id,
  answers,
  answered_count,
  answered_at,
  created_by,
  updated_by
)
select
  dq.participant_id,
  coalesce(
    (
      select jsonb_object_agg(ans.key, ans.value)
      from jsonb_each(ps.state->'diagnostic'->'answers') ans
      where ans.key ~ '^[0-9]+$'
        and jsonb_typeof(ans.value) = 'object'
    ),
    '{}'::jsonb
  ) as answers,
  coalesce(
    (
      select count(*)::integer
      from jsonb_each(ps.state->'diagnostic'->'answers') ans
      where ans.key ~ '^[0-9]+$'
        and jsonb_typeof(ans.value) = 'object'
    ),
    0
  ) as answered_count,
  case
    when jsonb_typeof(ps.state->'diagnostic'->'answers') = 'object'
    then ps.updated_at
    else null
  end as answered_at,
  ps.updated_by,
  ps.updated_by
from public.diagnostic_questionnaires dq
join public.prototype_states ps
  on ps.participant_id = dq.participant_id
where dq.source = 'prototype'
on conflict (participant_id)
do nothing;

alter table public.diagnostic_response_snapshots enable row level security;

drop policy if exists "diagnostic_responses_select_assigned" on public.diagnostic_response_snapshots;
create policy "diagnostic_responses_select_assigned" on public.diagnostic_response_snapshots
for select using (
  exists (
    select 1 from public.participants pa
    where pa.id = diagnostic_response_snapshots.participant_id
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

drop policy if exists "diagnostic_responses_modify_owner_architect_admin" on public.diagnostic_response_snapshots;
create policy "diagnostic_responses_modify_owner_architect_admin" on public.diagnostic_response_snapshots
for all using (
  exists (
    select 1 from public.participants pa
    where pa.id = diagnostic_response_snapshots.participant_id
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
    where pa.id = diagnostic_response_snapshots.participant_id
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

-- Retire old per-question storage model.
do $$
begin
  if to_regclass('public.diagnostic_question_responses') is not null then
    execute 'drop policy if exists "diagnostic_responses_select_assigned" on public.diagnostic_question_responses';
    execute 'drop policy if exists "diagnostic_responses_modify_owner_architect_admin" on public.diagnostic_question_responses';
    execute 'drop trigger if exists diagnostic_question_responses_set_updated_at on public.diagnostic_question_responses';
    execute 'drop table if exists public.diagnostic_question_responses';
  end if;
end
$$;
