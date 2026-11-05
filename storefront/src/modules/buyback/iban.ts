/** Aceeași verificare ca în backend (`backend/src/lib/buyback/iban.ts`). */
export const normalizeIban = (raw: string) => String(raw ?? "").replace(/[\s-]/g, "").toUpperCase()

export function isValidIban(raw: string): boolean {
  const iban = normalizeIban(raw)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false
  if (iban.startsWith("RO") && iban.length !== 24) return false
  let rem = 0
  for (const ch of iban.slice(4) + iban.slice(0, 4)) {
    const v = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55)
    for (const d of v) rem = (rem * 10 + Number(d)) % 97
  }
  return rem === 1
}
