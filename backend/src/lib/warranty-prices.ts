import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

import { resolveCurrencyCode } from "./currency"
import { readProductPrices } from "./pricing"

/**
 * Prețul garanției extinse, setat manual pe fiecare produs acoperit.
 *
 * Garanția rămâne un singur produs de serviciu (`garantie-extinsa`, variantele
 * „+1 an" / „+2 ani"): el dă etichetele, id-urile de variantă și prețul
 * implicit. Ce se schimbă aici e că fiecare produs poate purta propriile sume —
 * o garanție pe un telefon de 6.000 lei nu costă cât una pe unul de 900.
 *
 * Sumele stau în `metadata` pe produsul acoperit, nu ca variante noi ale
 * produsului de serviciu: altfel fiecare preț distinct din catalog ar cere o
 * variantă proprie, cu SKU și inventar, doar ca să existe un rând de preț.
 *
 * ATENȚIE la ștergere: `metadata` se scrie prin MERGE (vezi `mergeMetadata` din
 * `@medusajs/utils`), iar cheia se scoate trimițând **șir gol**, nu `null` —
 * `null` s-ar salva ca valoare și ar fi citit apoi ca „preț 0".
 */

/** Produsul de serviciu; același handle ca în storefront și în scripturi. */
export const WARRANTY_HANDLE = "garantie-extinsa"

/** Bifa „Garanție extinsă" de pe produsele acoperite (tag cu aceeași valoare). */
export const WARRANTY_TAG = "garantie-extinsa"

/**
 * Sub pragul ăsta garanția nu se afișează, oricât ar fi produsul de bifat și
 * de tarifat. Cardul din admin îl folosește doar ca avertisment.
 *
 * A treia copie a aceleiași valori — celelalte sunt `WARRANTY_MIN_PRICE` din
 * storefront (`lib/util/warranty.ts`) și din `scripts/seed-warranty-tag.ts`,
 * care rulează izolat pe prod și de aceea nu importă de aici.
 */
export const WARRANTY_MIN_PRICE = Number(process.env.WARRANTY_MIN_PRICE || 400)

export const WARRANTY_META_KEYS = {
  one_year: "warranty_price_1y",
  two_years: "warranty_price_2y",
} as const

export type WarrantyTerm = keyof typeof WARRANTY_META_KEYS

export type WarrantyPrices = {
  /** `null` = produsul n-are preț propriu, se folosește cel de pe serviciu. */
  one_year: number | null
  two_years: number | null
}

export type WarrantyCard = WarrantyPrices & {
  /** Prețurile de pe produsul de serviciu, arătate ca placeholder în admin. */
  defaults: WarrantyPrices
  /** Pragul sub care garanția nu apare pe site, oricât ar fi tarifată. */
  min_price: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Numărul dintr-o valoare de metadata, care poate fi și șir („199"). */
const toAmount = (raw: unknown): number | null => {
  if (typeof raw === "number") return Number.isFinite(raw) && raw > 0 ? raw : null
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(raw.replace(",", "."))
    return Number.isFinite(n) && n > 0 ? n : null
  }
  return null
}

export const parseWarrantyPrices = (
  metadata?: Record<string, unknown> | null
): WarrantyPrices => ({
  one_year: toAmount(metadata?.[WARRANTY_META_KEYS.one_year]),
  two_years: toAmount(metadata?.[WARRANTY_META_KEYS.two_years]),
})

type WarrantyVariant = {
  id: string
  title: string
  sku: string | null
  /** `null` = variantă a serviciului pe care n-o putem lega de o durată. */
  term: WarrantyTerm | null
}

/**
 * Ce durată acoperă o variantă a produsului de serviciu.
 *
 * SKU-ul e criteriul principal, pentru că e pus de `create-warranty-product.ts`
 * și nu se schimbă la o redenumire de variantă. Titlul e plasa de siguranță
 * pentru o instalație unde variantele au fost create de mână din admin.
 */
const termOf = (variant: {
  sku?: string | null
  title?: string | null
}): WarrantyTerm | null => {
  const sku = (variant.sku ?? "").toLowerCase()
  if (sku.endsWith("-1an")) return "one_year"
  if (sku.endsWith("-2ani")) return "two_years"

  const title = (variant.title ?? "").toLowerCase()
  if (title.includes("2 ani")) return "two_years"
  if (title.includes("1 an")) return "one_year"

  return null
}

/** Produsul de serviciu cu variantele lui, sau `null` dacă nu există încă. */
export const loadWarrantyProduct = async (
  container: any
): Promise<{ id: string; variants: WarrantyVariant[] } | null> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "variants.id", "variants.title", "variants.sku"],
    filters: { handle: WARRANTY_HANDLE },
  })

  const product = (products as any[])[0]
  if (!product) return null

  // Variantele fără durată recunoscută rămân în listă, cu `term: null`. Dacă
  // le-am filtra, o variantă redenumită și fără SKU ar dispărea de aici, dar ar
  // rămâne vizibilă în storefront (care le arată pe toate) — clientul ar apăsa
  // pe o opțiune afișată și ar primi eroare. Așa, pierde doar prețul propriu și
  // intră în coș cu prețul standard.
  const variants = ((product.variants ?? []) as any[]).map((v) => ({
    id: v.id,
    title: v.title ?? "",
    sku: v.sku ?? null,
    term: termOf(v),
  }))

  return { id: product.id, variants }
}

/** Prețurile implicite, citite din price set-ul produsului de serviciu. */
const loadDefaults = async (container: any): Promise<WarrantyPrices> => {
  const warranty = await loadWarrantyProduct(container)
  if (!warranty) return { one_year: null, two_years: null }

  const { variants } = await readProductPrices(container, warranty.id)
  const byId = new Map(variants.map((v) => [v.id, v]))

  const priceOf = (term: WarrantyTerm) => {
    const variant = warranty.variants.find((v) => v.term === term)
    if (!variant) return null
    const prices = byId.get(variant.id)
    return prices?.sale_price ?? prices?.price ?? null
  }

  return { one_year: priceOf("one_year"), two_years: priceOf("two_years") }
}

const loadProduct = async (container: any, productId: string) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title", "handle", "metadata", "tags.value"],
    filters: { id: productId },
  })

  const product = (products as any[])[0]
  if (!product) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Produsul nu există")
  }
  return product
}

export const hasWarrantyTag = (product: {
  tags?: { value?: string | null }[] | null
}): boolean =>
  (product.tags ?? []).some(
    (t) => (t.value ?? "").toLowerCase() === WARRANTY_TAG
  )

/**
 * Ce arată cardul din admin: prețurile proprii ale produsului plus cele
 * implicite, pentru placeholder.
 *
 * `null` pentru produsul de serviciu însuși — el n-are cum să-și pună preț de
 * garanție pe el, la fel ca bifa din „Marcaje produs".
 */
export const readWarrantyCard = async (
  container: any,
  productId: string
): Promise<WarrantyCard | null> => {
  const product = await loadProduct(container, productId)
  if (product.handle === WARRANTY_HANDLE) return null

  return {
    ...parseWarrantyPrices(product.metadata),
    defaults: await loadDefaults(container),
    min_price: WARRANTY_MIN_PRICE,
  }
}

/**
 * Scrie prețurile proprii ale produsului. `null` scoate prețul propriu și
 * lasă produsul pe cel implicit.
 */
export const writeWarrantyPrices = async (
  container: any,
  productId: string,
  prices: Partial<WarrantyPrices>
): Promise<void> => {
  const metadata: Record<string, unknown> = {}

  for (const term of ["one_year", "two_years"] as const) {
    const value = prices[term]
    if (value === undefined) continue

    if (value === null) {
      // Șir gol, nu `null`: așa scoate `mergeMetadata` cheia din obiect.
      metadata[WARRANTY_META_KEYS[term]] = ""
      continue
    }
    if (!(value > 0)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Prețul garanției trebuie să fie mai mare decât zero"
      )
    }
    metadata[WARRANTY_META_KEYS[term]] = round2(value)
  }

  if (!Object.keys(metadata).length) return

  await updateProductsWorkflow(container).run({
    input: { selector: { id: productId }, update: { metadata } as any },
  })
}

/**
 * Prețul cu care intră în coș garanția pentru un produs anume.
 *
 * `undefined` înseamnă „fără preț propriu" — apelantul lasă atunci Medusa să
 * calculeze prețul variantei de serviciu, ca până acum. Suma se citește
 * întotdeauna aici, pe server: prețul unei linii de coș nu poate veni din
 * browser, altfel garanția s-ar putea cumpăra cu 1 leu.
 */
export const resolveWarrantyUnitPrice = async (
  container: any,
  targetProductId: string,
  warrantyVariantId: string,
  /** Moneda coșului; prețul propriu se aplică doar în moneda magazinului. */
  cartCurrency?: string
): Promise<{ amount?: number; targetTitle: string }> => {
  const warranty = await loadWarrantyProduct(container)
  const variant = warranty?.variants.find((v) => v.id === warrantyVariantId)

  if (!variant) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Varianta cerută nu aparține produsului „Garanție extinsă”"
    )
  }

  const product = await loadProduct(container, targetProductId)
  if (!hasWarrantyTag(product)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Produsul nu are garanție extinsă"
    )
  }

  // Suma din `metadata` e un simplu număr, fără monedă: e implicit în moneda
  // magazinului. Pe un coș în altă monedă ar fi citită ca 499 EUR în loc de 499
  // RON, deci acolo lăsăm prețul variantei de serviciu, care are price set per
  // monedă. Azi magazinul e doar pe RON; garda e pentru ziua în care nu mai e.
  const storeCurrency = await resolveCurrencyCode(container)
  const sameCurrency =
    !cartCurrency || cartCurrency.toLowerCase() === storeCurrency

  const own =
    variant.term && sameCurrency
      ? parseWarrantyPrices(product.metadata)[variant.term]
      : null

  return { amount: own ?? undefined, targetTitle: product.title ?? "" }
}
