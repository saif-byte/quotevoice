-- Security hardening (2026-10-30 review).

-- 1. Least privilege. Row-level security doesn't cover TRUNCATE, TRIGGER or REFERENCES,
--    so take those away, and give anonymous visitors no table access at all
--    (homeowners only use the three public functions).
revoke all on table public.quotes, public.profiles from anon;
revoke truncate, trigger, references on table public.quotes, public.profiles from authenticated;
revoke all on function public.keep_accepted_status() from public, anon, authenticated;

-- 2. Size and shape limits, so one account can't fill the free database or store junk.
alter table public.quotes
  add constraint quotes_id_size check (char_length(id) between 1 and 64),
  add constraint quotes_number_size check (char_length(number) between 1 and 32),
  add constraint quotes_data_size check (pg_column_size(data) <= 200000),
  add constraint quotes_shared_size check (shared is null or pg_column_size(shared) <= 100000),
  add constraint quotes_share_token_format check (share_token is null or share_token ~ '^[A-Za-z0-9]{10,64}$');

alter table public.profiles
  add constraint profiles_business_size check (pg_column_size(business) <= 10000),
  add constraint profiles_rates_size check (pg_column_size(rates) <= 10000);

-- At most 5,000 quotes per painter.
create function public.limit_quotes_per_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.quotes where user_id = new.user_id) >= 5000 then
    raise exception 'Quote limit reached for this account.';
  end if;
  return new;
end;
$$;
revoke all on function public.limit_quotes_per_user() from public, anon, authenticated;

create trigger quotes_limit_per_user
  before insert on public.quotes
  for each row execute function public.limit_quotes_per_user();

-- 3. Expired estimates can't be accepted (date + "valid for N days" from the customer copy).
create or replace function public.accept_quote(p_token text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := left(btrim(coalesce(p_name, '')), 120);
  v_row public.quotes%rowtype;
  v_valid_until timestamptz;
begin
  if length(v_name) < 2 then
    raise exception 'Please type your full name to accept.';
  end if;

  select * into v_row from public.quotes q
   where q.share_token = p_token and length(p_token) >= 10 and q.status = 'sent' and q.accepted_at is null
   for update;
  if not found then
    raise exception 'This estimate can''t be accepted. It may already be accepted or no longer open.';
  end if;

  begin
    v_valid_until := (v_row.shared ->> 'date')::timestamptz
      + make_interval(days => greatest(1, least(365, coalesce((v_row.shared -> 'business' ->> 'validDays')::int, 30))));
  exception when others then
    v_valid_until := null;
  end;
  if v_valid_until is not null and now() > v_valid_until then
    raise exception 'This estimate has expired. Please contact your painter for an updated price.';
  end if;

  update public.quotes q
     set accepted_name = v_name,
         accepted_at = now(),
         status = 'won',
         data = jsonb_set(q.data, '{status}', '"won"'::jsonb),
         updated_at = now()
   where q.id = v_row.id
  returning * into v_row;

  return jsonb_build_object('acceptedName', v_row.accepted_name, 'acceptedAt', v_row.accepted_at);
end;
$$;
revoke all on function public.accept_quote(text, text) from public;
grant execute on function public.accept_quote(text, text) to anon, authenticated;

-- 4. AI reading limits: signed-in painters only, 100 notes per painter per day,
--    and 1,500 per day across everyone, so the free AI quota can't be drained.
create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  count integer not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
-- No policies: nobody reads or writes this table directly, only use_ai_quota() below.
revoke all on table public.ai_usage from anon, authenticated;

create function public.use_ai_quota()
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
  returning count into v_mine;
  return v_mine <= 100;
end;
$$;
revoke all on function public.use_ai_quota() from public, anon;
grant execute on function public.use_ai_quota() to authenticated;
