import { formatMoney } from './pricing'

/**
 * Sending a quote from the painter's own phone: no paid SMS or email service.
 * The app prepares the message and opens the phone's Messages or Mail app
 * (or the share sheet) with everything filled in. The painter just taps Send.
 */

/** Keeps digits; turns a 10-digit US number into +1XXXXXXXXXX for sms: links. */
export function phoneForLink(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return digits
}

/** "(614) 555-0182" for display. */
export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : phone
}

export function isValidPhone(phone: string): boolean {
  const d = phone.replace(/\D/g, '')
  return d.length === 10 || (d.length === 11 && d.startsWith('1'))
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export interface MessageInput {
  customerName: string
  businessName: string
  link: string
  total: number
  canAcceptOnline: boolean
}

export function firstName(name: string): string {
  const cleaned = name.replace(/^(mr|mrs|ms|dr)\.?\s+/i, '').trim()
  // "the Garcias" / "Garcias" → keep as is; "Sarah Johnson" → "Sarah"
  return cleaned.split(/\s+/)[0] ?? ''
}

export function buildMessage(m: MessageInput): string {
  const hi = m.customerName ? `Hi ${firstName(m.customerName)},` : 'Hi,'
  const from = m.businessName ? ` from ${m.businessName}` : ''
  const next = m.canAcceptOnline
    ? 'You can accept it right from the link, or reply here with any questions.'
    : 'Reply here with any questions, or let me know when you’d like to go ahead.'
  return `${hi} thanks for having me out today. Here’s your painting estimate${from} for ${formatMoney(m.total)}:\n${m.link}\n${next}`
}

export function smsHref(phone: string, body: string): string {
  // "sms:+1...?&body=" works on both iPhone and Android.
  return `sms:${phoneForLink(phone)}?&body=${encodeURIComponent(body)}`
}

export function mailtoHref(email: string, subject: string, body: string): string {
  return `mailto:${encodeURI(email.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
