-- Persist extended profile fields as first-class relational columns.
-- This covers profile areas used in the UI: career/education/achievements/interests,
-- family-life considerations, goals, communication style, accessibility needs.

alter table public.participants add column if not exists career_history text;
alter table public.participants add column if not exists education text;
alter table public.participants add column if not exists achievements text;
alter table public.participants add column if not exists interests text;
alter table public.participants add column if not exists family_life_considerations text;
alter table public.participants add column if not exists current_goals text;
alter table public.participants add column if not exists preferred_communication_style text;
alter table public.participants add column if not exists accessibility_needs text;

alter table public.profiles add column if not exists career_history text;
alter table public.profiles add column if not exists education text;
alter table public.profiles add column if not exists achievements text;
alter table public.profiles add column if not exists interests text;
alter table public.profiles add column if not exists family_life_considerations text;
alter table public.profiles add column if not exists current_goals text;
alter table public.profiles add column if not exists preferred_communication_style text;
alter table public.profiles add column if not exists accessibility_needs text;

-- Backfill participants from legacy prototype state payload, if available.
update public.participants pa
set
  career_history = coalesce(pa.career_history, nullif(ps.state->'profile'->>'career', '')),
  education = coalesce(pa.education, nullif(ps.state->'profile'->>'education', '')),
  achievements = coalesce(pa.achievements, nullif(ps.state->'profile'->>'achievements', '')),
  interests = coalesce(pa.interests, nullif(ps.state->'profile'->>'interests', '')),
  family_life_considerations = coalesce(pa.family_life_considerations, nullif(ps.state->'profile'->>'family', '')),
  current_goals = coalesce(pa.current_goals, nullif(ps.state->'profile'->>'goals', '')),
  preferred_communication_style = coalesce(pa.preferred_communication_style, nullif(ps.state->'profile'->>'commStyle', '')),
  accessibility_needs = coalesce(pa.accessibility_needs, nullif(ps.state->'profile'->>'access', ''))
from public.prototype_states ps
where ps.participant_id = pa.id;

-- Mirror to profiles for owner-bound access.
update public.profiles p
set
  career_history = coalesce(p.career_history, pa.career_history),
  education = coalesce(p.education, pa.education),
  achievements = coalesce(p.achievements, pa.achievements),
  interests = coalesce(p.interests, pa.interests),
  family_life_considerations = coalesce(p.family_life_considerations, pa.family_life_considerations),
  current_goals = coalesce(p.current_goals, pa.current_goals),
  preferred_communication_style = coalesce(p.preferred_communication_style, pa.preferred_communication_style),
  accessibility_needs = coalesce(p.accessibility_needs, pa.accessibility_needs)
from public.participants pa
where pa.owner_user_id = p.id;