import { HttpTypes } from "@medusajs/types"

/**
 * Citește gruparea de telefoane scrisă de scriptul backend
 * `link-phone-variants.ts` în `product.metadata`. Produsele de același model
 * (ex. toate variantele iPhone 16) rămân produse separate, dar sunt legate
 * prin `phone_siblings` ca să poți comuta între stocări/culori.
 */

export type PhoneSibling = {
  handle: string
  storage: string | null
  gb: number | null
  color: string | null
  color_hex: string | null
  thumbnail: string | null
}

type Meta = Record<string, unknown>

const meta = (product: HttpTypes.StoreProduct): Meta =>
  (product.metadata ?? {}) as Meta

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim().length > 0 ? v : null

export const getPhoneSpec = (product: HttpTypes.StoreProduct): string | null =>
  str(meta(product).phone_spec)

export const getPhoneModel = (product: HttpTypes.StoreProduct): string | null =>
  str(meta(product).phone_model)

const currentStorage = (product: HttpTypes.StoreProduct) =>
  str(meta(product).storage)
const currentColor = (product: HttpTypes.StoreProduct) =>
  str(meta(product).color)

export function getPhoneSiblings(
  product: HttpTypes.StoreProduct
): PhoneSibling[] {
  const raw = meta(product).phone_siblings
  if (!Array.isArray(raw)) return []
  return raw
    .map((s): PhoneSibling | null => {
      if (!s || typeof s !== "object") return null
      const o = s as Record<string, unknown>
      if (typeof o.handle !== "string") return null
      return {
        handle: o.handle,
        storage: str(o.storage),
        gb: typeof o.gb === "number" ? o.gb : null,
        color: str(o.color),
        color_hex: str(o.color_hex),
        thumbnail: str(o.thumbnail),
      }
    })
    .filter((s): s is PhoneSibling => s !== null)
}

export type PhoneSwatch = {
  color: string
  hex: string | null
  handle: string
  thumbnail: string | null
  isCurrent: boolean
}

/**
 * Culorile distincte ale grupului, pentru pastilele de pe card. Fiecare pastilă
 * leagă spre produsul acelei culori (preferând aceeași stocare ca produsul
 * curent, ca să nu schimbe și capacitatea când doar comuți culoarea).
 */
export function getPhoneColorSwatches(
  product: HttpTypes.StoreProduct
): PhoneSwatch[] {
  const siblings = getPhoneSiblings(product)
  if (siblings.length < 2) return []

  const curColor = currentColor(product)?.toLowerCase() ?? null
  const curStorage = currentStorage(product)

  const byColor = new Map<string, PhoneSibling[]>()
  for (const s of siblings) {
    if (!s.color) continue
    const key = s.color.toLowerCase()
    const arr = byColor.get(key) ?? []
    arr.push(s)
    byColor.set(key, arr)
  }
  if (byColor.size < 2) return []

  const swatches: PhoneSwatch[] = []
  for (const [key, arr] of Array.from(byColor.entries())) {
    const rep = arr.find((s) => s.storage === curStorage) ?? arr[0]
    swatches.push({
      color: rep.color as string,
      hex: rep.color_hex,
      handle: rep.handle,
      thumbnail: rep.thumbnail,
      isCurrent: key === curColor,
    })
  }
  return swatches
}

export type PhoneMatrix = {
  storages: { label: string; gb: number }[]
  colors: { label: string; hex: string | null }[]
  /** key = `${storage}|${color.toLowerCase()}` → handle-ul produsului */
  combos: Map<string, string>
  current: { storage: string | null; color: string | null }
}

const comboKey = (storage: string | null, color: string | null) =>
  `${storage ?? ""}|${(color ?? "").toLowerCase()}`

/**
 * Matricea stocare × culoare pentru selectorul de pe pagina produsului.
 * Întoarce null când produsul nu are un grup cu ≥ 2 variante.
 */
export function buildPhoneMatrix(
  product: HttpTypes.StoreProduct
): PhoneMatrix | null {
  const siblings = getPhoneSiblings(product)
  if (siblings.length < 2) return null

  const storageMap = new Map<string, number>()
  const colorMap = new Map<string, string | null>()
  const combos = new Map<string, string>()

  for (const s of siblings) {
    if (s.storage) storageMap.set(s.storage, s.gb ?? 0)
    if (s.color && !colorMap.has(s.color.toLowerCase())) {
      colorMap.set(s.color.toLowerCase(), s.color_hex)
    }
    combos.set(comboKey(s.storage, s.color), s.handle)
  }

  const storages = Array.from(storageMap.entries())
    .map(([label, gb]) => ({ label, gb }))
    .sort((a, b) => a.gb - b.gb)

  // Etichetele de culoare cu majuscula originală (din primul sibling).
  const labelByLower = new Map<string, string>()
  for (const s of siblings) {
    if (s.color && !labelByLower.has(s.color.toLowerCase())) {
      labelByLower.set(s.color.toLowerCase(), s.color)
    }
  }
  const colors = Array.from(colorMap.entries()).map(([lower, hex]) => ({
    label: labelByLower.get(lower) ?? lower,
    hex,
  }))

  if (storages.length < 2 && colors.length < 2) return null

  return {
    storages,
    colors,
    combos,
    current: { storage: currentStorage(product), color: currentColor(product) },
  }
}

export const phoneComboKey = comboKey
