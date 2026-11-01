/** The shared recruiter demo account. Shown on the site on purpose; the database locks its
 *  email and password and resets its data when idle (supabase/migrations/…_demo_account.sql). */
export const DEMO_EMAIL = 'demo@quotevoice.test'
export const DEMO_PASSWORD = 'QuoteVoice-demo-2026'

export const isDemoEmail = (email: string | null | undefined) => email?.toLowerCase() === DEMO_EMAIL

export const CONTACT = {
  name: 'Saifullah Khan',
  email: 'saif4rmkhan@gmail.com',
  repo: 'https://github.com/saif-byte/quotevoice',
}
