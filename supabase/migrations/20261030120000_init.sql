-- QuoteVoice database: one row of settings per painter, and their quotes.
-- Row-level security means a painter can only ever read or change their own rows.
-- Homeowners never touch the tables directly: two small functions return only the
-- customer-facing copy of a quote and record an acceptance.

-- ---------- painter settings ----------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  business jsonb not null default '{}'::jsonb,
  rates jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Painters read their own settings" on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Painters create their own settings" on public.profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Painters update their own settings" on public.profiles
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------- quotes ----------
create table public.quotes (
  id text primary key,                          -- generated in the app
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  number text not null,
  status text not null check (status in ('draft', 'sent', 'won', 'lost')),
  data jsonb not null,                          -- the full quote as the app uses it
  shared jsonb,                                 -- the customer-facing copy only
  share_token text unique check (share_token is null or length(share_token) >= 10),
  accepted_name text,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quotes_user_id_idx on public.quotes (user_id);

alter table public.quotes enable row level security;

create policy "Painters read their own quotes" on public.quotes
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Painters add their own quotes" on public.quotes
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Painters change their own quotes" on public.quotes
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Painters delete their own quotes" on public.quotes
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------- what a homeowner can see ----------
-- Returns only the customer copy, and only for finished quotes, by share code.
create function public.get_shared_quote(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'quote', q.shared,
    'status', q.status,
    'acceptedName', q.accepted_name,
    'acceptedAt', q.accepted_at
  )
  from public.quotes q
  where q.share_token = p_token
    and q.status <> 'draft'
    and q.shared is not null
    and length(p_token) >= 10;
$$;

-- Records "accepted by <name>" once, for an open quote, and marks it won.
create function public.accept_quote(p_token text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := left(btrim(coalesce(p_name, '')), 120);
  v_row public.quotes%rowtype;
begin
  if length(v_name) < 2 then
    raise exception 'Please type your full name to accept.';
  end if;

  update public.quotes q
     set accepted_name = v_name,
         accepted_at = now(),
         status = 'won',
         data = jsonb_set(q.data, '{status}', '"won"'::jsonb),
         updated_at = now()
   where q.share_token = p_token
     and length(p_token) >= 10
     and q.status = 'sent'
     and q.accepted_at is null
  returning * into v_row;

  if not found then
    raise exception 'This estimate can''t be accepted. It may already be accepted or no longer open.';
  end if;

  return jsonb_build_object('acceptedName', v_row.accepted_name, 'acceptedAt', v_row.accepted_at);
end;
$$;

-- Tiny call used by a daily GitHub Action so the free project is never paused for inactivity.
create function public.ping()
returns text
language sql
stable
set search_path = ''
as $$ select 'ok'::text; $$;

revoke all on function public.get_shared_quote(text) from public;
revoke all on function public.accept_quote(text, text) from public;
revoke all on function public.ping() from public;
grant execute on function public.get_shared_quote(text) to anon, authenticated;
grant execute on function public.accept_quote(text, text) to anon, authenticated;
grant execute on function public.ping() to anon, authenticated;
