import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createProductCategoriesWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Seeds the Arredo Vita category tree and assigns existing products to
 * categories based on their tag values. Idempotent.
 *
 *   Soggiorno
 *   ├── Divani
 *   └── Poltrone
 *   Sala da pranzo
 *   └── Sedie
 *   Camera da letto
 *   ├── Set matrimoniali
 *   ├── Set singoli
 *   ├── Materassi
 *   ├── Topper
 *   ├── Reti e accessori letto
 *   ├── Comodini e panche
 *   ├── Biancheria e cuscini
 *   └── Armadi
 *   Altro
 *   └── Mobili
 *
 * Run: yarn medusa exec ./src/scripts/seed-categories.ts
 */

type CategoryDef = {
  name: string
  handle: string
  description?: string
  rank: number
  parent_handle?: string
}

const CATEGORIES: CategoryDef[] = [
  {
    name: "Soggiorno",
    handle: "soggiorno",
    description:
      "Divani, poltrone e complementi per il cuore della tua casa.",
    rank: 0,
  },
  {
    name: "Sala da pranzo",
    handle: "sala-da-pranzo",
    description: "Sedie e arredi per accogliere e condividere.",
    rank: 1,
  },
  {
    name: "Camera da letto",
    handle: "camera-da-letto",
    description:
      "Set letto, materassi, topper e tutto per la zona notte.",
    rank: 2,
  },
  {
    name: "Altro",
    handle: "altro",
    description: "Mobili decorativi e complementi d'arredo.",
    rank: 3,
  },
  {
    name: "Divani",
    handle: "divani",
    parent_handle: "soggiorno",
    description: "Divani lineari, angolari e chesterfield.",
    rank: 0,
  },
  {
    name: "Poltrone",
    handle: "poltrone",
    parent_handle: "soggiorno",
    description: "Poltrone e poltroncine, comfort e design.",
    rank: 1,
  },
  {
    name: "Sedie",
    handle: "sedie",
    parent_handle: "sala-da-pranzo",
    description: "Sedie e set per la sala da pranzo.",
    rank: 0,
  },
  {
    name: "Mobili",
    handle: "mobili",
    parent_handle: "altro",
    description: "Mobili decorativi.",
    rank: 0,
  },
  {
    name: "Set matrimoniali",
    handle: "set-matrimoniali",
    parent_handle: "camera-da-letto",
    description: "Set letto matrimoniali: testiera, rete e materasso.",
    rank: 0,
  },
  {
    name: "Set singoli",
    handle: "set-singoli",
    parent_handle: "camera-da-letto",
    description: "Set letto singoli per camerette e ospiti.",
    rank: 1,
  },
  {
    name: "Materassi",
    handle: "materassi",
    parent_handle: "camera-da-letto",
    description: "Materassi a molle, memory, lattice e ortopedici.",
    rank: 2,
  },
  {
    name: "Topper",
    handle: "topper",
    parent_handle: "camera-da-letto",
    description: "Topper in memory, lattice, piumino e fresh.",
    rank: 3,
  },
  {
    name: "Reti e accessori letto",
    handle: "reti-accessori-letto",
    parent_handle: "camera-da-letto",
    description: "Reti, letti a castello e accessori per il letto.",
    rank: 4,
  },
  {
    name: "Comodini e panche",
    handle: "comodini-panche",
    parent_handle: "camera-da-letto",
    description: "Comodini, panche da letto e pouf.",
    rank: 5,
  },
  {
    name: "Biancheria e cuscini",
    handle: "biancheria-cuscini",
    parent_handle: "camera-da-letto",
    description: "Cuscini, coprimaterassi e piumoni.",
    rank: 6,
  },
  {
    name: "Armadi",
    handle: "armadi",
    parent_handle: "camera-da-letto",
    description: "Armadi ad ante battenti e scorrevoli per la zona notte.",
    rank: 7,
  },
]

// Tag value → list of category handles a product with that tag should belong to.
const TAG_TO_CATEGORY_HANDLES: Record<string, string[]> = {
  Divani: ["divani", "soggiorno"],
  Poltrone: ["poltrone", "soggiorno"],
  Sedie: ["sedie", "sala-da-pranzo"],
  Soggiorno: ["soggiorno"],
  "Sala da pranzo": ["sala-da-pranzo"],
  Altro: ["mobili", "altro"],
  Armadio: ["armadi", "camera-da-letto"],
}

const MANAGED_HANDLES = new Set(CATEGORIES.map((c) => c.handle))

export default async function seedCategories({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  // 1. Existing categories — keyed by handle
  const { data: existing } = await query.graph({
    entity: "product_category",
    fields: ["id", "name", "handle", "parent_category_id"],
  })
  const byHandle = new Map<string, { id: string; handle: string }>()
  for (const c of existing as Array<{ id: string; handle: string }>) {
    byHandle.set(c.handle, { id: c.id, handle: c.handle })
  }
  logger.info(
    `Found ${existing.length} existing categories: ${
      existing.map((c: any) => c.handle).join(", ") || "(none)"
    }`
  )

  // 2. Create top-level categories that don't yet exist.
  const missingTop = CATEGORIES.filter(
    (c) => !c.parent_handle && !byHandle.has(c.handle)
  )
  if (missingTop.length > 0) {
    logger.info(
      `Creating ${missingTop.length} top-level categories: ${missingTop
        .map((c) => c.handle)
        .join(", ")}`
    )
    const { result } = await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: missingTop.map((c) => ({
          name: c.name,
          handle: c.handle,
          description: c.description,
          rank: c.rank,
          is_active: true,
        })),
      },
    })
    for (const created of result as Array<{ id: string; handle: string }>) {
      byHandle.set(created.handle, { id: created.id, handle: created.handle })
    }
  }

  // 3. Create sub-categories.
  const missingSub = CATEGORIES.filter(
    (c) => c.parent_handle && !byHandle.has(c.handle)
  )
  if (missingSub.length > 0) {
    logger.info(
      `Creating ${missingSub.length} sub-categories: ${missingSub
        .map((c) => c.handle)
        .join(", ")}`
    )
    const { result } = await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: missingSub.map((c) => {
          const parent = byHandle.get(c.parent_handle!)
          if (!parent) {
            throw new Error(
              `Parent category ${c.parent_handle} not found while creating ${c.handle}`
            )
          }
          return {
            name: c.name,
            handle: c.handle,
            description: c.description,
            rank: c.rank,
            is_active: true,
            parent_category_id: parent.id,
          }
        }),
      },
    })
    for (const created of result as Array<{ id: string; handle: string }>) {
      byHandle.set(created.handle, { id: created.id, handle: created.handle })
    }
  }

  if (missingTop.length === 0 && missingSub.length === 0) {
    logger.info("All categories already exist — skipping creation.")
  }

  // 4. Compute desired category set for each product based on its tags.
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title", "tags.value", "categories.id", "categories.handle"],
  })

  type Update = { id: string; category_ids: string[]; title: string }
  const updates: Update[] = []
  let untagged = 0

  for (const p of products as Array<{
    id: string
    title: string
    tags?: Array<{ value: string }>
    categories?: Array<{ id: string; handle: string }>
  }>) {
    const tags = (p.tags || []).map((t) => t.value)
    const targetHandles = new Set<string>()
    for (const tag of tags) {
      const handles = TAG_TO_CATEGORY_HANDLES[tag]
      if (handles) handles.forEach((h) => targetHandles.add(h))
    }

    if (targetHandles.size === 0) {
      untagged++
      continue
    }

    const targetIds = new Set<string>()
    for (const h of targetHandles) {
      const cat = byHandle.get(h)
      if (cat) targetIds.add(cat.id)
    }

    // Preserve existing non-managed categories (anything we didn't create).
    const preservedIds = (p.categories || [])
      .filter((c) => !MANAGED_HANDLES.has(c.handle))
      .map((c) => c.id)

    const finalIds = Array.from(new Set([...preservedIds, ...targetIds]))

    // Skip if final set equals current set.
    const currentIds = new Set((p.categories || []).map((c) => c.id))
    const same =
      finalIds.length === currentIds.size &&
      finalIds.every((id) => currentIds.has(id))
    if (!same) {
      updates.push({ id: p.id, category_ids: finalIds, title: p.title })
    }
  }

  if (untagged > 0) {
    logger.warn(
      `${untagged} product(s) had no recognised stanza/tipologia tag — leaving untouched.`
    )
  }

  if (updates.length === 0) {
    logger.info("All products already have correct categories — nothing to update.")
    return
  }

  logger.info(`Updating ${updates.length} product → category assignments…`)
  await updateProductsWorkflow(container).run({
    input: {
      products: updates.map((u) => ({
        id: u.id,
        category_ids: u.category_ids,
      })),
    },
  })

  logger.info(
    `Done. Categories: ${CATEGORIES.length} (created ${
      missingTop.length + missingSub.length
    }), products updated: ${updates.length}.`
  )
}
