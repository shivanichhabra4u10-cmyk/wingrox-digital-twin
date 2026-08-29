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
