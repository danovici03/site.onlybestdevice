import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

import { resolveCurrencyCode } from "./currency"
import { readProductPrices } from "./pricing"

/**
 * Produse Second Hand: bifa din admin + datele produsului folosit + cele două
 * servicii care se pot adăuga la el („Baterie nouă 100%", „Folie de sticlă
 * montată").
 *
 * - Bifa e tagul `second-hand` (fostul `outlet`, nefolosit de nimic): tagul e
 *   singura etichetă filtrabilă din listări (pagina /second-hand, badge-ul).
 * - Datele (grad, baterie, garanție, observații) stau în `metadata` produsului.
 * - Serviciile sunt un singur produs ascuns, `servicii-second-hand`, cu câte o
 *   variantă per serviciu — exact ca „Garanție extinsă". Prețul implicit e al
 *   variantei; fiecare produs își poate pune suma proprie în metadata (o baterie
 *   de iPhone 15 nu costă cât una de iPhone 11).
 *
 * ATENȚIE la ștergere: `metadata` se scrie prin MERGE, iar cheia se scoate
 * trimițând **șir gol**, nu `null` (vezi `warranty-prices.ts`).
 *
 * Cheile și valorile trebuie să rămână aliniate cu
 * `storefront/src/lib/util/second-hand.ts`.
 */

export const SECOND_HAND_TAG = "second-hand"

/** Produsul de serviciu cu variantele „Baterie nouă" / „Folie montată". */
export const SH_SERVICES_HANDLE = "servicii-second-hand"

/** Cheile din metadata liniei de serviciu: ce produs din coș deservește. */
export const ADDON_FOR = "addon_for"
export const ADDON_FOR_TITLE = "addon_for_title"

export const SH_GRADES = ["bun", "foarte-bun", "excelent", "ca-nou"] as const
export type SecondHandGrade = (typeof SH_GRADES)[number]

export const SH_ADDONS = {
  battery: { sku: "sh-baterie-noua", meta: "sh_battery_price" },
  screen_protector: { sku: "sh-folie-sticla", meta: "sh_screen_protector_price" },
} as const
export type SecondHandAddon = keyof typeof SH_ADDONS

export const SH_META = {
  grade: "sh_grade",
  battery_health: "sh_battery_health",
  warranty_months: "sh_warranty_months",
  notes: "sh_notes",
} as const

export type SecondHandDetails = {
  grade: SecondHandGrade | null
  /** Procent, 1–100. */
  battery_health: number | null
  warranty_months: number | null
  notes: string | null
}

export type AddonPrices = Record<SecondHandAddon, number | null>

export type SecondHandCard = {
  enabled: boolean
  details: SecondHandDetails
  /** Prețurile proprii ale produsului; `null` = merge pe cel implicit. */
  prices: AddonPrices
  /** Prețurile de pe produsul de serviciu (placeholder în admin). */
  defaults: AddonPrices
  /** Produsul de serviciu nu există încă — rulează scriptul de creare. */
  services_missing: boolean
}

const round2 = (n: number) => Math.round(n * 100) / 100

const toNumber = (raw: unknown): number | null => {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(raw.replace(",", "."))
    return Number.isFinite(n) ? n : null
  }
  return null
}

const positive = (raw: unknown): number | null => {
  const n = toNumber(raw)
  return n !== null && n > 0 ? n : null
}

export const parseSecondHand = (
  metadata?: Record<string, unknown> | null
): SecondHandDetails => {
  const grade = metadata?.[SH_META.grade]
  const battery = positive(metadata?.[SH_META.battery_health])
  const notes = metadata?.[SH_META.notes]
  return {
    grade: SH_GRADES.includes(grade as SecondHandGrade)
      ? (grade as SecondHandGrade)
      : null,
    battery_health: battery !== null ? Math.min(100, Math.round(battery)) : null,
    warranty_months: positive(metadata?.[SH_META.warranty_months]),
    notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
  }
}

export const parseAddonPrices = (
  metadata?: Record<string, unknown> | null
): AddonPrices => ({
  battery: positive(metadata?.[SH_ADDONS.battery.meta]),
  screen_protector: positive(metadata?.[SH_ADDONS.screen_protector.meta]),
})

export const hasSecondHandTag = (product: {
  tags?: { value?: string | null }[] | null
}): boolean =>
  (product.tags ?? []).some(
    (t) => (t.value ?? "").toLowerCase() === SECOND_HAND_TAG
  )

/** Ce serviciu e o variantă, după SKU (pus de scriptul de creare). */
export const addonOfVariant = (variant: {
  sku?: string | null
  title?: string | null
}): SecondHandAddon | null => {
  const sku = (variant.sku ?? "").toLowerCase()
  for (const key of Object.keys(SH_ADDONS) as SecondHandAddon[]) {
    if (sku === SH_ADDONS[key].sku) return key
  }
  const title = (variant.title ?? "").toLowerCase()
  if (title.includes("baterie")) return "battery"
  if (title.includes("folie")) return "screen_protector"
  return null
}

type ServiceVariant = {
  id: string
  title: string
  sku: string | null
  addon: SecondHandAddon | null
}

export const loadServicesProduct = async (
  container: any
): Promise<{ id: string; variants: ServiceVariant[] } | null> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "variants.id", "variants.title", "variants.sku"],
    filters: { handle: SH_SERVICES_HANDLE },
  })
  const product = (data as any[])[0]
  if (!product) return null
  return {
    id: product.id,
    variants: ((product.variants ?? []) as any[]).map((v) => ({
      id: v.id,
      title: v.title ?? "",
      sku: v.sku ?? null,
      addon: addonOfVariant(v),
    })),
  }
}

const loadDefaults = async (
  container: any
): Promise<{ defaults: AddonPrices; missing: boolean }> => {
  const services = await loadServicesProduct(container)
  const defaults: AddonPrices = { battery: null, screen_protector: null }
  if (!services) return { defaults, missing: true }

  const { variants } = await readProductPrices(container, services.id)
  const byId = new Map(variants.map((v) => [v.id, v]))
  for (const v of services.variants) {
    if (!v.addon) continue
    const p = byId.get(v.id)
    defaults[v.addon] = p?.sale_price ?? p?.price ?? null
  }
  return { defaults, missing: false }
}

const loadProduct = async (container: any, productId: string) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "title", "handle", "metadata", "tags.value"],
    filters: { id: productId },
  })
  const product = (data as any[])[0]
  if (!product) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Produsul nu există")
  }
  return product
}

export const readSecondHandCard = async (
  container: any,
  productId: string
): Promise<SecondHandCard> => {
  const product = await loadProduct(container, productId)
  const { defaults, missing } = await loadDefaults(container)
  return {
    enabled: hasSecondHandTag(product),
    details: parseSecondHand(product.metadata),
    prices: parseAddonPrices(product.metadata),
    defaults,
    services_missing: missing,
  }
}

export type SecondHandUpdate = {
  details?: Partial<SecondHandDetails>
  prices?: Partial<AddonPrices>
}

/**
 * Scrie datele Second Hand în metadata. `null` pe un câmp îl golește.
 * Tagul (bifa) îl pune admin-ul separat, prin `setProductTag`, ca restul bifelor.
 */
export const writeSecondHand = async (
  container: any,
  productId: string,
  { details = {}, prices = {} }: SecondHandUpdate
): Promise<void> => {
  const metadata: Record<string, unknown> = {}
  const clear = ""

  if (details.grade !== undefined) {
    if (details.grade !== null && !SH_GRADES.includes(details.grade)) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Grad necunoscut")
    }
    metadata[SH_META.grade] = details.grade ?? clear
  }
  if (details.battery_health !== undefined) {
    const v = details.battery_health
    if (v !== null && !(v >= 1 && v <= 100)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Sănătatea bateriei trebuie să fie între 1 și 100%"
      )
    }
    metadata[SH_META.battery_health] = v === null ? clear : Math.round(v)
  }
  if (details.warranty_months !== undefined) {
    const v = details.warranty_months
    if (v !== null && !(v >= 1 && v <= 60)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Garanția trebuie să fie între 1 și 60 de luni"
      )
    }
    metadata[SH_META.warranty_months] = v === null ? clear : Math.round(v)
  }
  if (details.notes !== undefined) {
    metadata[SH_META.notes] = details.notes?.trim() || clear
  }

  for (const key of Object.keys(SH_ADDONS) as SecondHandAddon[]) {
    const v = prices[key]
    if (v === undefined) continue
    if (v !== null && !(v > 0)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Prețul serviciului trebuie să fie mai mare decât zero"
      )
    }
    metadata[SH_ADDONS[key].meta] = v === null ? clear : round2(v)
  }

  if (!Object.keys(metadata).length) return

  await updateProductsWorkflow(container).run({
    input: { selector: { id: productId }, update: { metadata } as any },
  })
}

/**
 * Prețul cu care intră serviciul în coș pentru un produs anume. Suma se decide
 * aici, pe server — din browser vine doar ce produs se deservește.
 */
export const resolveAddonUnitPrice = async (
  container: any,
  targetProductId: string,
  serviceVariantId: string,
  cartCurrency?: string
): Promise<{ amount?: number; targetTitle: string }> => {
  const services = await loadServicesProduct(container)
  const variant = services?.variants.find((v) => v.id === serviceVariantId)
  if (!variant) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Varianta cerută nu aparține serviciilor Second Hand"
    )
  }

  const product = await loadProduct(container, targetProductId)
  if (!hasSecondHandTag(product)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Serviciul se poate adăuga doar la produse Second Hand"
    )
  }
  // Aceeași regulă ca în storefront (`addonOptionsFor`): pe o baterie deja la
  // 100% opțiunea nu se oferă, deci nici nu se vinde printr-un apel direct.
  if (
    variant.addon === "battery" &&
    parseSecondHand(product.metadata).battery_health === 100
  ) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Produsul are deja bateria la 100%"
    )
  }

  const storeCurrency = await resolveCurrencyCode(container)
  const sameCurrency =
    !cartCurrency || cartCurrency.toLowerCase() === storeCurrency
  const own =
    variant.addon && sameCurrency
      ? parseAddonPrices(product.metadata)[variant.addon]
      : null

  return { amount: own ?? undefined, targetTitle: product.title ?? "" }
}
