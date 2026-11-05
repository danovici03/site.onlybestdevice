import { HttpTypes } from "@medusajs/types"

import { getPricesForVariant } from "./get-product-price"
import { convertToLocale } from "./money"

/**
 * Produse Second Hand: bifa „Second Hand" din admin (tagul `second-hand`) +
 * datele din `metadata` (grad, baterie, garanție, observații) + serviciile
 * „Baterie nouă 100%" / „Folie de sticlă montată" de pe produsul ascuns
 * `servicii-second-hand`.
 *
 * Cheile trebuie să rămână aliniate cu `backend/src/lib/second-hand.ts`.
 */

export const SECOND_HAND_TAG = "second-hand"
export const SECOND_HAND_BADGE_LABEL = "Second Hand"
export const SH_SERVICES_HANDLE = "servicii-second-hand"

/** Cheile din metadata liniei de serviciu: ce produs din coș deservește. */
export const ADDON_FOR = "addon_for"
export const ADDON_FOR_TITLE = "addon_for_title"

export type SecondHandGrade = "bun" | "foarte-bun" | "excelent" | "ca-nou"

/** Gradele, de la cel mai bun la cel mai slab, cu textul arătat clientului. */
export const SH_GRADES: Record<
  SecondHandGrade,
  { label: string; description: string; level: number }
> = {
  "ca-nou": {
    label: "Ca nou",
    description:
      "Arată ca nou. Fără zgârieturi vizibile pe ecran sau carcasă. Funcționează perfect.",
    level: 4,
  },
  excelent: {
    label: "Excelent",
    description:
      "Arată excelent. Poate avea urme fine de utilizare, vizibile doar de aproape. Funcționează perfect.",
    level: 3,
  },
  "foarte-bun": {
    label: "Foarte bun",
    description:
      "Urme ușoare de utilizare pe carcasă sau ramă; ecranul nu are zgârieturi vizibile cu ecranul aprins. Funcționează perfect.",
    level: 2,
  },
  bun: {
    label: "Bun",
    description:
      "Urme vizibile de utilizare (zgârieturi, mici lovituri) care nu afectează funcționarea. Funcționează perfect.",
    level: 1,
  },
}

export type SecondHandDetails = {
  grade: SecondHandGrade | null
  batteryHealth: number | null
  warrantyMonths: number | null
  notes: string | null
}

const positive = (raw: unknown): number | null => {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && raw.trim()
        ? Number(raw.replace(",", "."))
        : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

export const isSecondHandProduct = (
  product?: { tags?: { value?: string | null }[] | null } | null
): boolean =>
  (product?.tags ?? []).some(
    (t) => (t.value ?? "").toLowerCase() === SECOND_HAND_TAG
  )

export const secondHandDetails = (
  metadata?: Record<string, unknown> | null
): SecondHandDetails => {
  const grade = metadata?.sh_grade
  const battery = positive(metadata?.sh_battery_health)
  const notes = metadata?.sh_notes
  return {
    grade:
      typeof grade === "string" && grade in SH_GRADES
        ? (grade as SecondHandGrade)
        : null,
    batteryHealth: battery !== null ? Math.min(100, Math.round(battery)) : null,
    warrantyMonths: positive(metadata?.sh_warranty_months),
    notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
  }
}

type AddonKey = "battery" | "screen_protector"

const ADDON_META: Record<AddonKey, string> = {
  battery: "sh_battery_price",
  screen_protector: "sh_screen_protector_price",
}

const ADDON_SKU: Record<AddonKey, string> = {
  battery: "sh-baterie-noua",
  screen_protector: "sh-folie-sticla",
}

const addonOfVariant = (variant: {
  sku?: string | null
  title?: string | null
}): AddonKey | null => {
  const sku = (variant.sku ?? "").toLowerCase()
  for (const key of Object.keys(ADDON_SKU) as AddonKey[]) {
    if (sku === ADDON_SKU[key]) return key
  }
  const title = (variant.title ?? "").toLowerCase()
  if (title.includes("baterie")) return "battery"
  if (title.includes("folie")) return "screen_protector"
  return null
}

export type AddonOption = {
  key: AddonKey
  variantId: string
  title: string
  amount: number
  /** Suma formatată. */
  price: string
}

/**
 * Serviciile oferite pentru un produs SH, cu prețul produsului (metadata) sau
 * cel implicit al variantei. Doar pentru afișare — prețul real se decide pe
 * server, în `/store/carts/:id/addon`.
 */
export function addonOptionsFor(
  target: HttpTypes.StoreProduct | null | undefined,
  services?: HttpTypes.StoreProduct | null
): AddonOption[] {
  if (!isSecondHandProduct(target)) return []
  const variants = services?.variants ?? []
  const currency =
    variants
      .map((v) => (v as any).calculated_price?.currency_code)
      .find((c: unknown): c is string => typeof c === "string" && !!c) ?? "ron"

  const options = variants.flatMap((variant) => {
    const key = variant.id ? addonOfVariant(variant) : null
    if (!key || !variant.id) return []
    const own = positive(
      (target?.metadata as Record<string, unknown> | null)?.[ADDON_META[key]]
    )
    const amount =
      own ?? getPricesForVariant(variant)?.calculated_price_number ?? null
    if (amount == null) return []
    return [
      {
        key,
        variantId: variant.id,
        title: variant.title ?? "",
        amount,
        price: convertToLocale({ amount, currency_code: currency }),
      },
    ]
  })

  // Bateria nu are sens pe un produs cu bateria deja la 100%.
  const { batteryHealth } = secondHandDetails(
    target?.metadata as Record<string, unknown> | null
  )
  return options.filter((o) => !(o.key === "battery" && batteryHealth === 100))
}

type AnyLine = {
  product_handle?: string | null
  variant?: { product?: { handle?: string | null } | null } | null
}

export function isAddonLine(item: AnyLine): boolean {
  return (
    item.product_handle === SH_SERVICES_HANDLE ||
    item.variant?.product?.handle === SH_SERVICES_HANDLE
  )
}
