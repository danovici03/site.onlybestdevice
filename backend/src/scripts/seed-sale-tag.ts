/**
 * Pune tagul `oferta` pe produsele aflate în categoria „Oferte".
 *
 * Migrare unică: ofertele erau curatoriate prin apartenența la categoria
 * `oferte`, iar pagina /oferte listează acum după bifa „La ofertă" de pe produs
 * (adică după tag). Scriptul transferă selecția existentă, ca pagina să nu
 * pornească goală. După el, curatorierea se face din bifa din admin.
 *
 * Nedistructiv și idempotent: păstrează celelalte taguri și sare peste
 * produsele care au deja tagul. NU scoate produse din categorie și nu scoate
 * tagul de pe produse care nu mai sunt în categorie.
 *
 * Rulare:  cd backend && yarn medusa exec ./src/scripts/seed-sale-tag.ts
 *   Opțional: DRY_RUN=1 (doar raport, fără scriere)
 *
 * La final revalidează storefront-ul manual — vezi nota din
 * `seed-warranty-tag.ts`: `medusa exec` n-o face singur.
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { applyTagToProducts } from "./lib/product-tag-migration"

const SALE_TAG = "oferta"
const SOURCE_CATEGORY_HANDLE = "oferte"
// „0"/„false"/„no" sunt string-uri nevide, deci truthy: cu `!!` un `DRY_RUN=0`
// scris ca opt-out ar sări scrierea și ar lăsa în log lista de produse, care
// arată exact ca o migrare reușită.
const DRY_RUN = /^(1|true|yes)$/i.test(process.env.DRY_RUN ?? "")

export default async function seedSaleTag({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["id", "name", "handle"],
    filters: { handle: SOURCE_CATEGORY_HANDLE },
  })
  const category = categories?.[0]
  if (!category) {
    logger.error(
      `Nu există categoria cu handle „${SOURCE_CATEGORY_HANDLE}". Nimic de migrat.`
    )
    return
  }

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title", "tags.id", "tags.value"],
    filters: { categories: { id: category.id } } as any,
  })

  if (!products.length) {
    logger.info(`Categoria „${category.name}" e goală. Nimic de făcut.`)
    return
  }

  const needsTag = products.filter(
    (p: any) =>
      !(p.tags ?? []).some(
        (t: any) => (t.value ?? "").toLowerCase() === SALE_TAG
      )
  )

  logger.info(
    `Categoria „${category.name}": ${products.length} produse, ${needsTag.length} fără tagul „${SALE_TAG}".`
  )

  if (!needsTag.length) {
    logger.info("Toate produsele au deja tagul. Nimic de scris.")
    return
  }

  if (DRY_RUN) {
    for (const p of needsTag) {
      logger.info(`  [dry-run] ${p.title}`)
    }
    return
  }

  // Crearea tagului dacă lipsește, recitirea tagurilor înainte de scriere și
  // loturile stau în helper — aceeași grijă e nevoie la orice migrare de taguri.
  const written = await applyTagToProducts(container, {
    productIds: needsTag.map((p: any) => p.id),
    tagValue: SALE_TAG,
    mode: "add",
    onProgress: (done, total) => logger.info(`  … ${done}/${total} tagate`),
  })

  logger.info(
    `Gata: ${written} produse marcate „La ofertă". Verifică /oferte în storefront.`
  )
}
