/**
 * বাংলাদেশি মোবাইল নম্বর স্বাভাবিক করে (01XXXXXXXXX)।
 * Supabase-এর normalize_phone() ফাংশনের সাথে হুবহু মিল রাখা হয়েছে।
 */
const BN_DIGITS = '০১২৩৪৫৬৭৮৯'

export function normalizePhone(input: string | null | undefined): string {
  const ascii = (input || '').replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)))
  const x = ascii.replace(/[^0-9]/g, '')
  if (/^8801[0-9]{9}$/.test(x)) return x.slice(2)
  if (/^1[0-9]{9}$/.test(x)) return '0' + x
  return x
}

export function isValidPhone(input: string | null | undefined): boolean {
  return /^01[0-9]{9}$/.test(normalizePhone(input))
}
