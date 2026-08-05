import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import {
  hasVisibleContent,
  htmlToText,
  sanitizeWooHtml,
} from "../lib/woo-description"

/**
 * Curăță descrierea unui produs de fiecare dată când e salvată.
 *
 * Câmpul „Descriere" din Admin e un textarea simplu, deci un copy-paste dintr-o
 * pagină web lasă doar text — dar HTML-ul lipit ca atare (din „view source")
 * ajunge direct în storefront, care îl randează cu `dangerouslySetInnerHTML`.
 * Lipit brut, markup-ul altor magazine e nefolositor și riscant: pozele sunt
 * lazy-load (`src` e un `loading.gif`, poza reală stă în `data-src`), vin
 * tabelele lor de specificații peste panoul „Specificații", linkuri către
 * magazinul-sursă și eventuale `onerror=` care chiar se execută.
 *
 * Aici trece prin exact același sanitizator ca importul, deci se poate lipi
 * HTML brut de oriunde: pozele lazy se rezolvă, fișele de specificații și
 * `script`/`iframe`-urile dispar, iar tabelele de layout se desfac.
 *
 * Fără buclă: `sanitizeWooHtml` e stabil pe propriul rezultat (verificat pe tot
 * catalogul), așa că `product.updated`-ul provocat de scrierea noastră iese pe
 * `next === current` la a doua trecere. Descrierile fără niciun tag (text
 * tastat de mână în Admin) nu se ating deloc.
 */

/** Are descrierea vreun tag? Altfel e text simplu și nu-l atingem. */
const HAS_TAGS = /<[a-zA-Z][^>]*>/

const idsOf = (data: unknown): string[] => {
  const list = Array.isArray(data) ? data : [data]
  return list
    .map((d) => (d as { id?: string })?.id)
    .filter((id): id is string => typeof id === "string")
}

export default async function sanitizeProductDescription({
  event,
  container,
}: SubscriberArgs<{ id: string } | { id: string }[]>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productModule = container.resolve(Modules.PRODUCT)

  for (const id of idsOf(event.data)) {
    let current: string
    try {
      const product = await productModule.retrieveProduct(id, {
        select: ["id", "description"],
      })
      current = product?.description || ""
    } catch (e) {
      // Produsul poate fi șters între emiterea evenimentului și procesarea lui.
      logger.debug(
        `Sanitizare descriere: nu am putut citi produsul ${id}: ${(e as Error).message}`
      )
      continue
    }

    if (!current || !HAS_TAGS.test(current)) continue

    const res = sanitizeWooHtml(current)
    // Dacă nu rămâne nimic vizibil (s-a lipit doar o fișă de specificații),
    // păstrăm măcar textul — nu lăsăm markup brut în baza de date.
    const next = hasVisibleContent(res.html) ? res.html : htmlToText(current)

    if (next === current) continue

    await updateProductsWorkflow(container).run({
      input: { selector: { id }, update: { description: next } as any },
    })

    logger.info(
      `Descriere curățată pentru ${id}: ${current.length} → ${next.length} caractere` +
        `${res.images.length ? `, ${res.images.length} imagini păstrate` : ""}` +
        `${res.droppedSpecTables ? `, ${res.droppedSpecTables} fișe de specificații scoase` : ""}`
    )
  }
}

export const config: SubscriberConfig = {
  event: ["product.created", "product.updated"],
}
