-- Recruiter demo account: demo@quotevoice.test (password shown on the site, on purpose).
--  - Its email and password can't be changed, so nobody can lock others out.
--  - Its data goes back to the seed 30 minutes after the last change (pg_cron, every 10 minutes),
--    with all dates moved so the quotes always look recent.
--  - The seed (supabase/demo/seed.json) is made by running real voice notes through the real
--    pipeline: scripts/demo-seed.gen.ts.

create extension if not exists pg_cron;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.demo_seed (id int primary key default 1 check (id = 1), seed jsonb not null);
-- Filled from the repo by private.load_demo_seed() (keeps the 58 KB seed out of this file).
create extension if not exists http with schema extensions;

create or replace function private.load_demo_seed()
returns void language plpgsql security definer set search_path = '' as $$
declare v_body text; v_status int;
begin
  select status, content into v_status, v_body
  from extensions.http_get('https://raw.githubusercontent.com/saif-byte/quotevoice/main/supabase/demo/seed.json');
  if v_status <> 200 then raise exception 'Could not load demo seed (HTTP %)', v_status; end if;
  insert into private.demo_seed (id, seed) values (1, v_body::jsonb)
  on conflict (id) do update set seed = excluded.seed;
end;
$$;
revoke all on function private.load_demo_seed() from public, anon, authenticated;

-- Edits from the app should move updated_at, so the reset knows the demo is in use.
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
create trigger quotes_touch_updated_at before update on public.quotes for each row execute function public.touch_updated_at();
create trigger profiles_touch_updated_at before update on public.profiles for each row execute function public.touch_updated_at();

-- The demo login.
do $$
declare v_uid uuid := gen_random_uuid();
begin
  if not exists (select 1 from auth.users where email = 'demo@quotevoice.test') then
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', 'demo@quotevoice.test',
            extensions.crypt('QuoteVoice-demo-2026', extensions.gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}', '{"demo":true}', now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_uid, v_uid::text,
            jsonb_build_object('sub', v_uid::text, 'email', 'demo@quotevoice.test', 'email_verified', true),
            'email', now(), now(), now());
  end if;
end $$;

-- Nobody can change the demo login's email or password.
create or replace function private.protect_demo_login()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.email = 'demo@quotevoice.test' then
    new.email := old.email;
    new.encrypted_password := old.encrypted_password;
    new.email_change := '';
    new.email_change_token_new := '';
    new.phone := old.phone;
  end if;
  return new;
end;
$$;
create trigger protect_demo_login before update on auth.users for each row execute function private.protect_demo_login();

-- "2026-11-01T10:00:00Z" + shift, written back in the app's ISO format.
create or replace function private.shift_ts(j jsonb, k text, d interval)
returns jsonb language sql immutable set search_path = '' as $$
  select case when j ? k and jsonb_typeof(j -> k) = 'string'
    then jsonb_set(j, array[k], to_jsonb(to_char(((j ->> k)::timestamptz + d) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
    else j end
$$;

create or replace function private.reset_demo_account()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_seed jsonb;
  v_shift interval;
begin
  select id into v_uid from auth.users where email = 'demo@quotevoice.test';
  if v_uid is null then return; end if;
  select seed into v_seed from private.demo_seed where id = 1;
  if v_seed is null then return; end if;
  v_shift := now() - (v_seed ->> 't0')::timestamptz;

  delete from public.quotes where user_id = v_uid;
  delete from public.ai_usage where user_id = v_uid;

  insert into public.profiles (user_id, business, rates, notifications_seen_at, onboarded_at, updated_at)
  values (v_uid, v_seed -> 'business', v_seed -> 'rates', now() - interval '1 day', now(), now())
  on conflict (user_id) do update set business = excluded.business, rates = excluded.rates,
    notifications_seen_at = excluded.notifications_seen_at, onboarded_at = excluded.onboarded_at, updated_at = now();

  insert into public.quotes (id, user_id, number, status, data, shared, share_token, accepted_name, accepted_at,
                             first_viewed_at, last_viewed_at, view_count, created_at, updated_at)
  select q ->> 'id', v_uid, q ->> 'number', q ->> 'status',
         private.shift_ts(private.shift_ts(private.shift_ts(private.shift_ts(q -> 'data', 'createdAt', v_shift), 'captureStartedAt', v_shift), 'finalizedAt', v_shift), 'decidedAt', v_shift),
         case when jsonb_typeof(q -> 'shared') = 'object' then private.shift_ts(q -> 'shared', 'date', v_shift) end,
         q ->> 'share_token', q ->> 'accepted_name',
         (q ->> 'accepted_at')::timestamptz + v_shift,
         (q ->> 'first_viewed_at')::timestamptz + v_shift,
         (q ->> 'last_viewed_at')::timestamptz + v_shift,
         coalesce((q ->> 'view_count')::int, 0),
         (q -> 'data' ->> 'createdAt')::timestamptz + v_shift,
         now()
  from jsonb_array_elements(v_seed -> 'quotes') as q;
end;
$$;

-- Reset only when nobody has touched the demo for 30 minutes, so a recruiter is never cut off mid-look.
create or replace function private.reset_demo_if_idle()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_last timestamptz;
begin
  select id into v_uid from auth.users where email = 'demo@quotevoice.test';
  if v_uid is null then return; end if;
  select greatest(
    (select max(updated_at) from public.quotes where user_id = v_uid),
    (select max(created_at) from public.quotes where user_id = v_uid and created_at > now() - interval '1 day'),
    (select updated_at from public.profiles where user_id = v_uid)
  ) into v_last;
  if v_last is null or v_last < now() - interval '30 minutes' then
    perform private.reset_demo_account();
  end if;
end;
$$;

revoke all on function private.reset_demo_account() from public, anon, authenticated;
revoke all on function private.reset_demo_if_idle() from public, anon, authenticated;
revoke all on function private.shift_ts(jsonb, text, interval) from public, anon, authenticated;
revoke all on function private.protect_demo_login() from public, anon, authenticated;

select private.load_demo_seed();
select private.reset_demo_account();
select cron.schedule('reset-demo-account', '*/10 * * * *', 'select private.reset_demo_if_idle()');
