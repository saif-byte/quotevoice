-- Live updates: the painter's app hears about changes to their own quotes (row-level security still applies).
alter publication supabase_realtime add table public.quotes;

-- When the painter last looked at their notifications, so "unread" is the same on every device.
alter table public.profiles add column notifications_seen_at timestamptz;
