-- Signed-in painters can call use_ai_quota() directly, so once a painter is over their
-- daily 100 it must stop counting; otherwise one account could push the shared daily
-- total to 1,500 and switch AI reading off for everyone.
create or replace function public.use_ai_quota()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_mine integer;
  v_total integer;
begin
  if v_user is null then
    return false;
  end if;
  select coalesce(sum(count), 0) into v_total from public.ai_usage where day = current_date;
  if v_total >= 1500 then
    return false;
  end if;
  insert into public.ai_usage (user_id, day, count) values (v_user, current_date, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
    where public.ai_usage.count < 100
  returning count into v_mine;
  return v_mine is not null;
end;
$$;
revoke all on function public.use_ai_quota() from public, anon;
grant execute on function public.use_ai_quota() to authenticated;
