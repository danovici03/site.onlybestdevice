import { HttpTypes } from "@medusajs/types"

import { getPricesForVariant } from "./get-product-price"
import { convertToLocale } from "./money"

/** Produsul de serviciu din Medusa, ascuns din catalog. */
export const WARRANTY_HANDLE = "garantie-extinsa"

/**
 * Bifa „Garanție extinsă" de pe produs, scrisă ca tag din Admin.
 *
 * Garanția se oferă doar pentru produsele bifate — un telefon o merită, o husă
 * de 30 lei nu. Fără bifă nu se oferă nimic: un produs nou uitat nebifat costă
 * un upsell ratat, pe când inversul ar vinde garanție de 99 lei pe accesorii.
 *
 * Are aceeași valoare ca `WARRANTY_HANDLE`, dar sunt lucruri diferite: acolo e
 * handle-ul produsului de serviciu, aici e tagul de pe produsele acoperite.
 * Trebuie să rămână aliniat cu `WARRANTY_TAG` din `seed-warranty-tag.ts` și din
 * widgetul de admin.
 */
export const WARRANTY_TAG = "garantie-extinsa"

/**
 * Sub pragul ăsta nu arătăm cardul, oricât ar fi produsul de bifat.
 *
 * Garanția pleacă de la 99 lei (+1 an) / 169 lei (+2 ani) și urcă pe produsele
 * scumpe, deci pe un produs de 50 lei oferta e absurdă chiar dacă bifa e pusă
 * corect. 400 de lei ține garanția implicită la cel mult un sfert din preț.
 * Verificarea stă aici, la afișare, nu doar în migrare: prețurile se schimbă
 * din Admin fără să retagheze nimeni nimic.
 *
 * Aliniat cu `WARRANTY_MIN_PRICE` din `backend/src/scripts/seed-warranty-tag.ts`.
 */
export const WARRANTY_MIN_PRICE = 400

/** Cheia din metadata liniei de garanție care spune ce produs acoperă. */
export const WARRANTY_FOR = "warranty_for"
export const WARRANTY_FOR_TITLE = "warranty_for_title"

/**
 * Prețul garanției, setat pe fiecare produs acoperit din cardul „Preț" din
 * Admin. Cheile trăiesc în `metadata` produsului acoperit, nu pe serviciu:
 * o garanție pe un telefon de 6.000 lei nu costă cât una pe unul de 900.
 *
 * Trebuie să rămână aliniate cu `WARRANTY_META_KEYS` din
 * `backend/src/lib/warranty-prices.ts`.
 */
export const WARRANTY_PRICE_META = {
  one_year: "warranty_price_1y",
  two_years: "warranty_price_2y",
} as const

type WarrantyTerm = keyof typeof WARRANTY_PRICE_META

export type WarrantyOption = {
  variantId: string
  /** Eticheta variantei de serviciu: „+1 an" / „+2 ani". */
  title: string
  amount: number
  /** Suma formatată, gata de afișat. */
  price: string
  /** Prețul vine de pe produsul acoperit, nu de pe serviciu. */
  custom: boolean
}

/**
 * Ce durată acoperă o variantă a produsului de serviciu.
 *
 * SKU-ul primul, pentru că e pus de scriptul de creare și supraviețuiește unei
 * redenumiri de variantă; titlul e plasa de siguranță. Aceeași logică e și pe
 * server (`backend/src/lib/warranty-prices.ts`), pentru că acolo se decide
 * prețul real al liniei.
 */
function termOfVariant(variant: {
  sku?: string | null
  title?: string | null
}): WarrantyTerm | null {
  const sku = (variant.sku ?? "").toLowerCase()
  if (sku.endsWith("-1an")) return "one_year"
  if (sku.endsWith("-2ani")) return "two_years"

  const title = (variant.title ?? "").toLowerCase()
  if (title.includes("2 ani")) return "two_years"
  if (title.includes("1 an")) return "one_year"

  return null
}

function ownWarrantyPrice(
  metadata: Record<string, unknown> | null | undefined,
  term: WarrantyTerm
): number | null {
  const raw = metadata?.[WARRANTY_PRICE_META[term]]
  const value =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && raw.trim()
        ? Number(raw.replace(",", "."))
        : NaN

  return Number.isFinite(value) && value > 0 ? value : null
}

/**
 * Opțiunile de garanție pentru un produs anume: aceleași două durate, dar cu
 * prețul produsului acoperit acolo unde e setat, altfel cel de pe serviciu.
 *
 * Sumele astea sunt doar pentru afișare — prețul care ajunge pe linia de coș se
 * recalculează pe server, în `/store/carts/:id/warranty`.
 */
export function warrantyOptionsFor(
  target:
    | { metadata?: Record<string, unknown> | null }
    | null
    | undefined,
  warranty?: HttpTypes.StoreProduct | null
): WarrantyOption[] {
  const variants = warranty?.variants ?? []

  const currency =
    variants
      .map((v) => (v as any).calculated_price?.currency_code)
      .find((c: unknown): c is string => typeof c === "string" && !!c) ?? "ron"

  return variants.flatMap((variant) => {
    if (!variant.id) return []

    const term = termOfVariant(variant)
    const own = term ? ownWarrantyPrice(target?.metadata, term) : null
    const standard = getPricesForVariant(variant)?.calculated_price_number ?? null
    const amount = own ?? standard

    if (amount == null) return []

    return [
      {
        variantId: variant.id,
        title: variant.title ?? "",
        amount,
        price: convertToLocale({ amount, currency_code: currency }),
        custom: own != null,
      },
    ]
  })
}

type Line = HttpTypes.StoreCartLineItem

/**
 * Produsul e bifat pentru garanție extinsă?
 *
 * Atenție la `fields` în cererea care aduce produsul: tagurile trebuie cerute
 * explicit (`+tags` la produse, `*items.product.tags` la coș). Fără ele Medusa
 * întoarce tagurile ca `[{ id }]`, fără `value` — verificarea de mai jos ar da
 * tăcut `false` peste tot, iar garanția n-ar mai apărea nicăieri fără eroare.
 */
export function isWarrantyEligible(
  product?: { tags?: { value?: string | null }[] | null } | null
): boolean {
  return (product?.tags ?? []).some(
    (t) => (t.value ?? "").toLowerCase() === WARRANTY_TAG
  )
}

/**
 * Cel mai mic preț al produsului, ca să nu propunem garanție pe varianta ieftină
 * a unui produs care are și una scumpă.
 */
function lowestVariantPrice(product?: HttpTypes.StoreProduct | null): number | null {
  const amounts = (product?.variants ?? [])
    .map((v) => (v as any).calculated_price?.calculated_amount)
    .filter((n: unknown): n is number => typeof n === "number" && n > 0)
  return amounts.length ? Math.min(...amounts) : null
}

/**
 * Produsul poate primi garanție: e bifat ȘI trece pragul de preț.
 *
 * Prețul lipsă înseamnă „nu știm", deci nu propunem — mai bine ratăm o ofertă
 * decât s-o facem pe ceva ce s-ar putea să coste 40 de lei.
 */
export function canOfferWarrantyFor(
  product?: HttpTypes.StoreProduct | null
): boolean {
  if (!isWarrantyEligible(product)) return false
  const price = lowestVariantPrice(product)
  return price !== null && price >= WARRANTY_MIN_PRICE
}

export function isWarrantyLine(item: Line): boolean {
  return (
    item.product_handle === WARRANTY_HANDLE ||
    item.variant?.product?.handle === WARRANTY_HANDLE
  )
}

/** Produsul pe care îl acoperă o linie de garanție, dacă e legată de unul. */
export function warrantyTargetTitle(item: Line): string | null {
  const raw = (item.metadata as Record<string, unknown> | undefined)?.[
    WARRANTY_FOR_TITLE
  ]
  return typeof raw === "string" && raw.length > 0 ? raw : null
}

/**
 * Ce produse din coș au deja garanție extinsă.
 *
 * `hasUnlinked` acoperă garanțiile adăugate înainte ca liniile să poarte
 * metadata — n-avem cum să știm ce acoperă, așa că în prezența lor nu mai
 * propunem nimic. Mai bine ratăm o ofertă decât să-i cerem unui client să
 * cumpere a doua oară ceva ce are deja.
 */
export function warrantyCoverage(cart?: HttpTypes.StoreCart | null): {
  coveredProductIds: Set<string>
  hasUnlinked: boolean
} {
  const coveredProductIds = new Set<string>()
  let hasUnlinked = false

  for (const line of cart?.items ?? []) {
    if (!isWarrantyLine(line)) continue

    const target = (line.metadata as Record<string, unknown> | undefined)?.[
      WARRANTY_FOR
    ]

    if (typeof target === "string" && target.length > 0) {
      coveredProductIds.add(target)
    } else {
      hasUnlinked = true
    }
  }

  return { coveredProductIds, hasUnlinked }
}

/** Propunem garanție doar pentru produsele bifate care n-au deja una. */
export function shouldOfferWarranty(
  item: Line,
  cart?: HttpTypes.StoreCart | null
): boolean {
  if (isWarrantyLine(item)) return false
  // Fără produs identificabil n-am putea lega garanția de nimic, iar o linie
  // nelegată ar ascunde apoi ofertele pentru tot coșul.
  if (!item.product_id) return false
  if (!isWarrantyEligible(item.product)) return false
  // În coș prețul plătit e pe linie, nu pe produs: `unit_price` ține cont de
  // varianta aleasă și de reduceri, deci e mai corect decât prețul de catalog.
  if ((item.unit_price ?? 0) < WARRANTY_MIN_PRICE) return false

  const { coveredProductIds, hasUnlinked } = warrantyCoverage(cart)
  if (hasUnlinked) return false

  return !coveredProductIds.has(item.product_id ?? "")
}
