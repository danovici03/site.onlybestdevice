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
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createProductTagsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"

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

  // Tagul poate să nu existe încă: bifa din admin îl creează la prima folosire,
  // iar dacă nimeni n-a bifat nimic, nu-l găsim.
  const { data: tags } = await query.graph({
    entity: "product_tag",
    fields: ["id", "value"],
    filters: { value: SALE_TAG },
  })
  let tagId: string | undefined = tags?.[0]?.id
  if (!tagId) {
    const { result } = await createProductTagsWorkflow(container).run({
      input: { product_tags: [{ value: SALE_TAG }] },
    })
    tagId = (result as any)[0].id
    logger.info(`Am creat tagul „${SALE_TAG}" (${tagId}).`)
  }

  // `update` înlocuiește lista de taguri în întregime — trimitem mereu setul
  // complet, altfel migrarea ar șterge tagurile existente ale produsului.
  await updateProductsWorkflow(container).run({
    input: {
      products: needsTag.map((p: any) => ({
        id: p.id,
        tags: [
          ...(p.tags ?? []).map((t: any) => ({ id: t.id })),
          { id: tagId! },
        ],
      })),
    } as any,
  })

  logger.info(
    `Gata: ${needsTag.length} produse marcate „La ofertă". Verifică /oferte în storefront.`
  )
}
