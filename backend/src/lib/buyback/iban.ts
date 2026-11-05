/**
 * Validarea IBAN-ului (cifra de control mod 97, ISO 13616). Acceptăm orice
 * țară — un client poate avea cont într-o bancă străină — dar românesc e
 * cazul obișnuit: RO + 2 cifre + 4 litere bancă + 16 caractere = 24.
 */
const LENGTHS: Record<string, number> = { RO: 24 }

export function normalizeIban(raw: string): string {
  return String(raw ?? "").replace(/[\s-]/g, "").toUpperCase()
}

export function isValidIban(raw: string): boolean {
  const iban = normalizeIban(raw)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false
  const expected = LENGTHS[iban.slice(0, 2)]
  if (expected && iban.length !== expected) return false
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let rem = 0
  for (const ch of rearranged) {
    const v = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55)
    for (const d of v) rem = (rem * 10 + Number(d)) % 97
  }
  return rem === 1
}

/** „RO49 AAAA 1B31 …” — pentru afișare. */
export const formatIban = (raw: string) => normalizeIban(raw).replace(/(.{4})/g, "$1 ").trim()
