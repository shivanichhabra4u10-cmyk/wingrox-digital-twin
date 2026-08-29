-- Normalize Growth Diagnostic data into relational tables while preserving
-- existing prototype snapshot persistence.

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

-- Updated-at triggers.
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

-- Backfill one questionnaire row per participant from prototype_states.
insert into public.diagnostic_questionnaires (
  participant_id,
  source,
  bank_name,
  total_questions,
  is_submitted,
  submitted_at,
  is_released,
  released_at,
  report_opened_at,
  raw_diagnostic,
  created_by,
  updated_by
)
select
  ps.participant_id,
  'prototype',
  nullif(ps.state->'diagnostic'->>'questionBankName', ''),
  greatest(
    case
      when jsonb_typeof(ps.state->'diagnostic'->'questionBank') = 'array'
      then jsonb_array_length(ps.state->'diagnostic'->'questionBank')
      else 0
    end,
    case
      when jsonb_typeof(ps.state->'diagnostic'->'answers') = 'object'
      then (
        select coalesce(max(e.key::integer), 0)
        from jsonb_each(ps.state->'diagnostic'->'answers') e
        where e.key ~ '^[0-9]+$'
      )
      else 0
    end
  ) as total_questions,
  coalesce((ps.state->'diagnostic'->>'submitted')::boolean, false),
  case
    when coalesce((ps.state->'diagnostic'->>'submitted')::boolean, false)
    then ps.updated_at
    else null
  end,
  coalesce((ps.state->'diagnostic'->>'released')::boolean, false),
  case
    when coalesce((ps.state->'diagnostic'->>'released')::boolean, false)
    then ps.updated_at
    else null
  end,
  case
    when coalesce((ps.state->'diagnostic'->>'reportOpened')::boolean, false)
    then ps.updated_at
    else null
  end,
  case
    when jsonb_typeof(ps.state->'diagnostic') = 'object'
    then ps.state->'diagnostic'
    else '{}'::jsonb
  end,
  ps.updated_by,
  ps.updated_by
from public.prototype_states ps
where jsonb_typeof(ps.state) = 'object'
on conflict (participant_id, source)
do update set
  bank_name = excluded.bank_name,
  total_questions = excluded.total_questions,
  is_submitted = excluded.is_submitted,
  submitted_at = excluded.submitted_at,
  is_released = excluded.is_released,
  released_at = excluded.released_at,
  report_opened_at = excluded.report_opened_at,
  raw_diagnostic = excluded.raw_diagnostic,
  updated_by = excluded.updated_by,
  updated_at = now();

-- Backfill question-bank content.
insert into public.diagnostic_questions (
  questionnaire_id,
  question_id,
  display_order,
  dimension,
  question_text,
  options,
  scores,
  metadata
)
select
  dq.id as questionnaire_id,
  case
    when (qb.value->>'id') ~ '^[0-9]+$' then (qb.value->>'id')::integer
    else qb.ordinality::integer
  end as question_id,
  qb.ordinality::integer as display_order,
  nullif(qb.value->>'dimension', ''),
  nullif(qb.value->>'q', ''),
  case
    when jsonb_typeof(qb.value->'o') = 'array' then qb.value->'o'
    else '[]'::jsonb
  end as options,
  case
    when jsonb_typeof(qb.value->'scores') = 'array' then qb.value->'scores'
    else '[]'::jsonb
  end as scores,
  qb.value as metadata
from public.prototype_states ps
join public.diagnostic_questionnaires dq
  on dq.participant_id = ps.participant_id
  and dq.source = 'prototype'
cross join lateral jsonb_array_elements(ps.state->'diagnostic'->'questionBank') with ordinality qb(value, ordinality)
where jsonb_typeof(ps.state->'diagnostic'->'questionBank') = 'array'
  and jsonb_typeof(qb.value) = 'object'
on conflict (questionnaire_id, question_id)
do update set
  display_order = excluded.display_order,
  dimension = excluded.dimension,
  question_text = excluded.question_text,
  options = excluded.options,
  scores = excluded.scores,
  metadata = excluded.metadata,
  updated_at = now();

-- Backfill answer payloads and normalized fields.
insert into public.diagnostic_question_responses (
  questionnaire_id,
  participant_id,
  question_id,
  ranked_choices,
  confidence,
  comment,
  other_text,
  is_private,
  answer_payload,
  answered_at,
  created_by,
  updated_by
)
select
  dq.id as questionnaire_id,
  ps.participant_id,
  ans.key::integer as question_id,
  coalesce(
    (
      select array_agg(choice.value::smallint order by choice.ordinality)
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(ans.value->'choices') = 'array' then ans.value->'choices'
          else '[]'::jsonb
        end
      ) with ordinality choice(value, ordinality)
      where choice.value ~ '^[0-9]+$'
    ),
    '{}'::smallint[]
  ) as ranked_choices,
  nullif(ans.value->>'conf', '') as confidence,
  nullif(ans.value->>'comment', '') as comment,
  nullif(ans.value->>'other', '') as other_text,
  coalesce((ans.value->>'priv')::boolean, false) as is_private,
  case
    when jsonb_typeof(ans.value) = 'object' then ans.value
    else '{}'::jsonb
  end as answer_payload,
  case
    when coalesce((jsonb_array_length(case when jsonb_typeof(ans.value->'choices') = 'array' then ans.value->'choices' else '[]'::jsonb end) > 0), false)
      or nullif(ans.value->>'conf', '') is not null
      or nullif(ans.value->>'comment', '') is not null
      or nullif(ans.value->>'other', '') is not null
      or coalesce((ans.value->>'priv')::boolean, false)
    then ps.updated_at
    else null
  end as answered_at,
  ps.updated_by,
  ps.updated_by
from public.prototype_states ps
join public.diagnostic_questionnaires dq
  on dq.participant_id = ps.participant_id
  and dq.source = 'prototype'
cross join lateral jsonb_each(
  case
    when jsonb_typeof(ps.state->'diagnostic'->'answers') = 'object' then ps.state->'diagnostic'->'answers'
    else '{}'::jsonb
  end
) ans
where ans.key ~ '^[0-9]+$'
on conflict (questionnaire_id, question_id)
do update set
  ranked_choices = excluded.ranked_choices,
  confidence = excluded.confidence,
  comment = excluded.comment,
  other_text = excluded.other_text,
  is_private = excluded.is_private,
  answer_payload = excluded.answer_payload,
  answered_at = excluded.answered_at,
  updated_by = excluded.updated_by,
  updated_at = now();

-- RLS policies.
alter table public.diagnostic_questionnaires enable row level security;
alter table public.diagnostic_questions enable row level security;
alter table public.diagnostic_question_responses enable row level security;

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