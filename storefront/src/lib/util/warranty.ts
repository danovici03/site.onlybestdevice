import { HttpTypes } from "@medusajs/types"

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
 * Garanția costă 99 lei (+1 an) / 169 lei (+2 ani), deci pe un produs de 50 lei
 * oferta e absurdă chiar dacă bifa e pusă corect. 400 de lei ține garanția de
 * un an la cel mult un sfert din preț. Verificarea stă aici, la afișare, nu doar
 * în migrare: prețurile se schimbă din Admin fără să retagheze nimeni nimic.
 *
 * Aliniat cu `WARRANTY_MIN_PRICE` din `backend/src/scripts/seed-warranty-tag.ts`.
 */
export const WARRANTY_MIN_PRICE = 400

/** Cheia din metadata liniei de garanție care spune ce produs acoperă. */
export const WARRANTY_FOR = "warranty_for"
export const WARRANTY_FOR_TITLE = "warranty_for_title"

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
