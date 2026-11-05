/** Aceeași verificare ca în backend (`backend/src/lib/buyback/cnp.ts`).
 *
 * CNP românesc: 13 cifre, prima 1–9, data nașterii validă, cifră de control
 * cu cheia 279146358279. Îl cerem pentru borderoul de achiziție de la
 * persoane fizice.
 */
const KEY = "279146358279"

export const normalizeCnp = (v: string) => v.replace(/\s+/g, "")

export function isValidCnp(raw: string): boolean {
  const cnp = normalizeCnp(raw ?? "")
  if (!/^[1-9]\d{12}$/.test(cnp)) return false
  const s = Number(cnp[0])
  const century = s === 1 || s === 2 ? 1900 : s === 3 || s === 4 ? 1800 : s === 5 || s === 6 ? 2000 : null
  const yy = Number(cnp.slice(1, 3))
  const mm = Number(cnp.slice(3, 5))
  const dd = Number(cnp.slice(5, 7))
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return false
  // 7/8 = rezidenți străini, 9 = străini: secolul nu se poate deduce, verificăm doar luna/ziua.
  if (century != null) {
    const d = new Date(Date.UTC(century + yy, mm - 1, dd))
    if (d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== dd) return false
  }
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(cnp[i]) * Number(KEY[i])
  const control = sum % 11 === 10 ? 1 : sum % 11
  return control === Number(cnp[12])
}
