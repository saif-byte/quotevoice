# Security

Last full review: 2026-10-30. This page covers what QuoteVoice protects, how, and the
settings that live outside the code.

## Reporting a problem

Please open a private security advisory on this repository (Security tab → Report a vulnerability)
rather than a public issue.

## What's protected and how

| Risk | Protection |
| --- | --- |
| One painter reading or changing another's quotes | Row-level security on `quotes` and `profiles`: every read and write is limited to `auth.uid() = user_id`. Tested by attacking as a second account (read, update, delete, insert-as, id hijack: all blocked). |
| Anonymous visitors reading the database | No table access at all for `anon`. Homeowners only reach three narrow functions (`get_shared_quote`, `mark_quote_viewed`, `accept_quote`) that need a 16-character random share code. |
| Guessing share codes | 16 random letters and digits from `crypto.getRandomValues` (about 95 bits). Codes are format-checked in the database. |
| Faking an acceptance | Only `accept_quote` can set acceptance; a trigger stops painters editing acceptance or view fields themselves. Acceptance needs an open (sent, not accepted, not expired) estimate and locks the row while it runs. |
| Expired estimates being accepted | `accept_quote` refuses after the estimate's "valid for" days. |
| Filling the free database | Size limits on every stored field, 5,000 quotes per painter, 4,000-character notes. |
| Draining the AI quota / using it as a free AI proxy | The `read-note` function requires a signed-in painter, allows 100 notes per painter and 1,500 in total per day (`use_ai_quota`), only accepts a note, and always sends the fixed QuoteVoice prompt. The Gemini key is a server secret and never reaches the browser. |
| Leaking the AI key or internals | Generic error messages to the browser; details only in server logs. No secrets in the repo or its history; only the publishable Supabase key ships to the browser (it's meant to be public). |
| Cross-site scripting | React escapes all text; no `dangerouslySetInnerHTML`, `eval` or `innerHTML`. A Content Security Policy only allows the site's own scripts and connections to Supabase and Gemini. |
| Crafted share links | Data from links and the server is cleaned to the expected fields, types and sizes before showing. Contact links are only made from valid emails and phone numbers. Long `#/view/` links say they aren't verified by QuoteVoice, since the estimate lives in the link itself; short links (from the database) are the trusted kind. |
| Clickjacking | The app refuses to run inside a frame. |
| Vulnerable packages | `npm audit`: 0 known vulnerabilities at review. Dependabot checks npm and GitHub Actions weekly. |
| Database going away (free tier pauses after 7 idle days) | A daily GitHub Action calls `ping()`. |

## Settings outside the code (project owner)

These can only be changed in dashboards:

- **Supabase → Authentication → Providers → Email**: minimum password length 8 or more; turn on
  **leaked password protection** (if available on your plan).
- **Supabase → Authentication → Attack Protection**: optionally turn on CAPTCHA (Cloudflare Turnstile is free) to stop bot sign-ups.
- **Supabase → Authentication → Rate Limits**: keep the defaults or lower them.
- **Google AI Studio**: keep the Gemini key on the free tier (no billing attached), so it can never run up a bill.
- **GitHub → Settings → Code security**: turn on secret scanning, push protection and Dependabot alerts.

## Known limits

- GitHub Pages can't send HTTP security headers, so the policy is a `<meta>` tag, which covers scripts and connections but not every header-only protection.
- Painters' own Gemini keys (optional, in Settings) are stored in that browser only. Anyone with access to that browser profile could read them.
- Long share links can be made by anyone; that's why they carry the "not verified" notice.
