-- When the painter finished (or skipped) the first-sign-in walkthrough.
-- Stored on the account, so the guide shows once per account, not once per device.
alter table public.profiles add column onboarded_at timestamptz;
