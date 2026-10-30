-- Know when the homeowner opened the estimate, so the painter knows who to follow up with.
alter table public.quotes
  add column first_viewed_at timestamptz,
  add column last_viewed_at timestamptz,
  add column view_count integer not null default 0;

-- Called by the customer page. Only counts finished quotes, by share code.
-- Returns nothing, so it reveals nothing about whether a code exists.
create function public.mark_quote_viewed(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.quotes q
     set first_viewed_at = coalesce(q.first_viewed_at, now()),
         last_viewed_at = now(),
         view_count = q.view_count + 1
   where q.share_token = p_token
     and length(p_token) >= 10
     and q.status <> 'draft';
$$;

revoke all on function public.mark_quote_viewed(text) from public;
grant execute on function public.mark_quote_viewed(text) to anon, authenticated;
