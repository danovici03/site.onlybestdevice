import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"

import { applyStock, type StockInput } from "./stock"

/**
 * Crearea produselor venite din ERP-ul Laravel.
 *
 * Un produs nou se naste in gestiune (acolo intra marfa la receptie), deci ERP-ul
 * il impinge aici ca sa nu fie tastat a doua oara. Il cream ca **draft**: pretul,
 * pozele, categoria si textele se completeaza in Admin inainte de publicare —
 * gestiunea nu are din ce sa le umple.
 *
 * Un produs Laravel = un produs Medusa cu o singura varianta (aceeasi forma pe
 * care o are un produs simplu importat din WooCommerce: optiunea "Variantă" cu
 * valoarea "Standard"). Varianta e unitatea de stoc, deci ERP-ul retine
 * `variant_id` si de acolo incolo merge pe drumul obisnuit, /admin/erp/stock.
 *
 * De ce ruta custom si nu /admin/products: un produs cu stoc inseamna produs +
 * optiune + varianta + inventory_item + nivel de stoc. Native ar fi 3-4 apeluri
 * din PHP, cu ERP-ul ramas la jumatate daca pica al doilea, plus cunoasterea in
 * PHP a sales channel-ului, a profilului de livrare si a monedei. Aici e un apel.
 *
 * Idempotent pe SKU: daca SKU-ul exista deja in Medusa, NU cream un duplicat —
 * intoarcem varianta gasita, ca ERP-ul sa se lege de ea. Asa, un retry dupa un
 * timeout sau un produs creat intre timp manual in Admin se rezolva de la sine.
 */

export type ProductInput = {
  sku: string
  title: string
  description?: string | null
  handle?: string | null
  /** Pretul de raft, in unitati intregi de moneda (RON, nu bani). */
  price?: number | null
  /** Stocul disponibil online; aplicat prin acelasi mecanism ca /admin/erp/stock. */
  quantity?: number | null
  ean?: string | null
  /**
   * Fisa tehnica, plata: { "Display": "6.7 inch", "RAM": "8GB" }. Ajunge in
   * `product.metadata.specs`, de unde o citeste tab-ul de specificatii din
   * storefront (acelasi loc in care scrie si extract-product-specs.ts).
   */
  specs?: Record<string, unknown> | null
  status?: "draft" | "published" | null
}

export type ProductResult = {
  created: number
  linked: number
  currency_code: string
  results: Array<{
    sku: string
    product_id: string
    variant_id: string
    handle: string | null
    created: boolean
  }>
  errors: Array<{ sku?: string; message: string }>
}

/** Forma unui produs simplu, identica cu cea a importului din WooCommerce. */
const OPTION_TITLE = "Variantă"
const OPTION_VALUE = "Standard"

const slugify = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[șş]/gi, "s")
    .replace(/[țţ]/gi, "t")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

/**
 * Fisa tehnica, curatata pentru storefront: doar perechi text → text, in ordinea
 * primita. Storefront-ul afiseaza fiecare valoare cu String(value), deci ce nu e
 * scalar ar aparea ca "[object Object]" — mai bine lipseste.
 */
const normalizeSpecs = (specs: ProductInput["specs"]): Record<string, string> | null => {
  if (!specs || typeof specs !== "object" || Array.isArray(specs)) return null

  const clean: Record<string, string> = {}

  for (const [rawLabel, rawValue] of Object.entries(specs)) {
    const label = String(rawLabel ?? "").trim()
    if (!label) continue

    const value =
      typeof rawValue === "boolean"
        ? rawValue
          ? "Da"
          : "Nu"
        : typeof rawValue === "string" || typeof rawValue === "number"
          ? String(rawValue).trim()
          : ""

    if (value) clean[label] = value
  }

  return Object.keys(clean).length ? clean : null
}

/**
 * Moneda implicita a magazinului. ERP-ul trimite doar numarul; daca am hardcoda
 * "ron" aici, un magazin configurat pe alta moneda ar primi tacut preturi in
 * moneda gresita.
 */
const resolveCurrencyCode = async (container: any): Promise<string> => {
  const forced = process.env.ERP_CURRENCY
  if (forced) return forced.toLowerCase()

  try {
    const storeService = container.resolve(Modules.STORE)
    const stores = await storeService.listStores()
    const currencies = stores?.[0]?.supported_currencies ?? []
    const preferred =
      currencies.find((c: any) => c.is_default) ?? currencies[0]

    if (preferred?.currency_code) return String(preferred.currency_code).toLowerCase()
  } catch {
    // cade pe implicit
  }

  return "ron"
}

/**
 * Handle liber pornind de la cel dorit. Handle-ul e unic in Medusa, iar doua
 * produse cu acelasi nume (ex. acelasi model in alta culoare) ar pica la creare;
 * dezambiguam cu SKU-ul, care e oricum unic in gestiune.
 */
const resolveHandles = async (
  container: any,
  items: ProductInput[],
): Promise<Map<string, string>> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const candidates = new Map<string, string[]>()
  for (const item of items) {
    const base = slugify(item.handle || item.title) || slugify(item.sku) || "produs"
    candidates.set(item.sku, [base, `${base}-${slugify(item.sku)}`])
  }

  const all = [...new Set([...candidates.values()].flat())]
  const taken = new Set<string>()

  if (all.length) {
    const { data } = await query.graph({
      entity: "product",
      fields: ["handle"],
      filters: { handle: all },
    })
    for (const p of (data ?? []) as any[]) {
      if (p.handle) taken.add(p.handle)
    }
  }

  const resolved = new Map<string, string>()
  for (const [sku, options] of candidates) {
    // Rezervam handle-ul ales si pentru restul lotului: doua produse noi cu
    // acelasi nume nu se vad unul pe altul in interogarea de mai sus.
    let handle = options.find((h) => h && !taken.has(h))

    if (!handle) {
      const base = options[options.length - 1] || slugify(sku)
      let suffix = 2
      while (taken.has(`${base}-${suffix}`) && suffix < 50) suffix++
      handle = `${base}-${suffix}`
    }

    taken.add(handle)
    resolved.set(sku, handle)
  }

  return resolved
}

export const upsertProducts = async (
  container: any,
  items: ProductInput[],
): Promise<ProductResult> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const currencyCode = await resolveCurrencyCode(container)

  const result: ProductResult = {
    created: 0,
    linked: 0,
    currency_code: currencyCode,
    results: [],
    errors: [],
  }

  // Ultima pozitie cu acelasi SKU castiga: doua pozitii identice in acelasi apel
  // ar crea doua produse cu acelasi SKU, exact ce evitam prin idempotenta.
  const bySku = new Map<string, ProductInput>()
  for (const item of items) {
    const sku = String(item?.sku ?? "").trim()
    const title = String(item?.title ?? "").trim()

    if (!sku) {
      result.errors.push({ message: "pozitie fara SKU — nu se poate lega de ERP" })
      continue
    }
    if (!title) {
      result.errors.push({ sku, message: "pozitie fara titlu" })
      continue
    }

    bySku.set(sku, { ...item, sku, title })
  }

  if (!bySku.size) return result

  const stockItems: StockInput[] = []

  // ---- Ce exista deja: legam, nu duplicam ----------------------------------
  const { data: existingVariants } = await query.graph({
    entity: "product_variant",
    fields: ["id", "sku", "product_id", "product.handle"],
    filters: { sku: [...bySku.keys()] },
  })

  for (const variant of (existingVariants ?? []) as any[]) {
    const input = variant.sku ? bySku.get(variant.sku) : undefined
    if (!input) continue

    result.results.push({
      sku: variant.sku,
      product_id: variant.product_id,
      variant_id: variant.id,
      handle: variant.product?.handle ?? null,
      created: false,
    })
    result.linked++

    if (typeof input.quantity === "number") {
      stockItems.push({ variant_id: variant.id, quantity: input.quantity })
    }

    bySku.delete(variant.sku)
  }

  // ---- Restul: produse noi -------------------------------------------------
  const toCreate = [...bySku.values()]

  if (toCreate.length) {
    const salesChannelService = container.resolve(Modules.SALES_CHANNEL)
    const fulfillmentService = container.resolve(Modules.FULFILLMENT)

    const channels = await salesChannelService.listSalesChannels()
    const defaultChannel =
      channels.find((c: any) => c.name === "Default Sales Channel") ?? channels[0]
    if (!defaultChannel) {
      throw new Error("Niciun sales channel in Medusa — produsul nu ar fi vizibil nicaieri.")
    }

    const shippingProfiles = await fulfillmentService.listShippingProfiles()
    const shippingProfile = shippingProfiles[0]
    if (!shippingProfile) {
      throw new Error("Niciun shipping profile in Medusa — creeaza unul inainte de import.")
    }

    const handles = await resolveHandles(container, toCreate)

    for (const input of toCreate) {
      const handle = handles.get(input.sku)!
      const price =
        typeof input.price === "number" && input.price > 0
          ? Math.round(input.price * 100) / 100
          : null
      const specs = normalizeSpecs(input.specs)

      try {
        const { result: created } = await createProductsWorkflow(container).run({
          input: {
            products: [
              {
                title: input.title,
                handle,
                description: input.description || undefined,
                status:
                  input.status === "published"
                    ? ProductStatus.PUBLISHED
                    : ProductStatus.DRAFT,
                shipping_profile_id: shippingProfile.id,
                sales_channels: [{ id: defaultChannel.id }],
                // Acelasi loc pe care il scrie extract-product-specs.ts si il
                // citeste tab-ul de specificatii din storefront.
                metadata: specs ? { specs } : undefined,
                options: [{ title: OPTION_TITLE, values: [OPTION_VALUE] }],
                variants: [
                  {
                    title: input.title,
                    sku: input.sku,
                    ean: input.ean || undefined,
                    // Gestiunea e sursa de adevar pentru stoc; fara asta varianta
                    // ar fi mereu "in stoc" pe site si s-ar putea supravinde.
                    manage_inventory: true,
                    allow_backorder: false,
                    options: { [OPTION_TITLE]: OPTION_VALUE },
                    prices: price != null ? [{ amount: price, currency_code: currencyCode }] : [],
                  },
                ],
              } as any,
            ],
          },
        })

        const product = (created as any[])[0]
        const variant = product?.variants?.[0]

        if (!product?.id || !variant?.id) {
          result.errors.push({ sku: input.sku, message: "produs creat fara varianta" })
          continue
        }

        result.results.push({
          sku: input.sku,
          product_id: product.id,
          variant_id: variant.id,
          handle: product.handle ?? handle,
          created: true,
        })
        result.created++

        if (typeof input.quantity === "number") {
          stockItems.push({ variant_id: variant.id, quantity: input.quantity })
        }
      } catch (e) {
        // Un produs picat nu trebuie sa opreasca lotul: ERP-ul reia doar ce a ramas
        // nelegat (produsele fara medusa_variant_id).
        result.errors.push({ sku: input.sku, message: (e as Error).message })
      }
    }
  }

  // ---- Stocul initial ------------------------------------------------------
  // In acelasi apel, ca ERP-ul sa nu ramana cu un produs creat dar fara stoc:
  // legatura se salveaza in Laravel fara sa treaca prin observer, deci n-ar mai
  // veni un push separat pana la urmatoarea miscare de stoc.
  if (stockItems.length) {
    try {
      const stock = await applyStock(container, stockItems)
      for (const err of stock.errors) {
        result.errors.push({ sku: err.sku, message: `stoc: ${err.message}` })
      }
    } catch (e) {
      result.errors.push({ message: `stoc: ${(e as Error).message}` })
    }
  }

  return result
}
