-- A quote the homeowner accepted can't be pushed back to open or draft by an older copy
-- saved from another device. (The painter can still mark it lost, e.g. if the job is cancelled.)
-- Acceptance and view tracking can only be set by the public functions, never by the painter's app.
create function public.keep_accepted_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.accepted_at is not null and new.status in ('draft', 'sent') then
    new.status := old.status;
    new.data := jsonb_set(new.data, '{status}', to_jsonb(old.status));
  end if;
  new.accepted_name := old.accepted_name;
  new.accepted_at := old.accepted_at;
  new.first_viewed_at := old.first_viewed_at;
  new.last_viewed_at := old.last_viewed_at;
  new.view_count := old.view_count;
  return new;
end;
$$;

create trigger quotes_keep_accepted_status
  before update on public.quotes
  for each row
  when (current_user = 'authenticated')
  execute function public.keep_accepted_status();
