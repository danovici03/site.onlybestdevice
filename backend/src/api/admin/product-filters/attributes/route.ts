import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"

import { badRequest, deps, revalidateCatalog, usageCounts } from "../../../../lib/product-filters/admin"
import { loadFilterConfig } from "../../../../lib/product-filters/config"
import { EXTRACTORS } from "../../../../lib/product-filters/extractors"
import { isValidKey } from "../../../../lib/product-filters/normalize"

/**
 * Filtrele magazinului.
 *
 * GET  /admin/product-filters/attributes  — toate, cu valori, categorii și câte produse au fiecare
 * POST /admin/product-filters/attributes  — filtru nou
 */

export const AttributeSchema = z.object({
  key: z
    .string()
    .trim()
    .toLowerCase()
    .refine(isValidKey, "cheia trebuie să fie un slug scurt (a-z, 0-9, -) și să nu fie un parametru rezervat"),
  label: z.string().trim().min(1),
  type: z.enum(["select", "number"]).default("select"),
  display: z.enum(["chips", "swatch"]).default("chips"),
  unit: z.string().trim().max(12).nullable().optional(),
  is_global: z.boolean().default(false),
  is_multi: z.boolean().default(false),
  closed_values: z.boolean().default(false),
  sources: z.array(z.string().trim().min(1)).default([]),
  extractor: z
    .string()
    .nullable()
    .optional()
    .refine((v) => v == null || v === "" || v in EXTRACTORS, "extractor necunoscut")
    .transform((v) => (v ? v : null)),
  rank: z.number().int().default(0),
  /** Lista completă de categorii; poziția filtrului în fiecare vine din ordinea lor. */
  category_ids: z.array(z.string()).optional(),
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { knex } = deps(req)
  const [config, usage] = await Promise.all([loadFilterConfig(knex), usageCounts(knex)])

  const attributes = config.attributes.map((a) => ({
    id: a.id,
    key: a.key,
    label: a.label,
    type: a.type,
    display: a.display,
    unit: a.unit,
    is_global: a.is_global,
    is_multi: a.is_multi,
    closed_values: a.closed_values,
    sources: a.sources,
    extractor: a.extractor,
    rank: a.rank,
    category_ids: [...a.categoryRanks.keys()],
    product_count: usage.byAttr.get(a.id) ?? 0,
    values: a.values.map((v) => ({
      id: v.id,
      value: v.value,
      slug: v.slug,
      hex: v.hex,
      aliases: v.aliases,
      rank: v.rank,
      product_count: usage.byValue.get(v.id) ?? 0,
    })),
  }))
  res.json({ attributes })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = AttributeSchema.safeParse(req.body)
  if (!parsed.success) return badRequest(res, parsed.error)
  const { service, knex } = deps(req)
  const { category_ids, ...data } = parsed.data

  const clash = await knex("filter_attribute").where({ key: data.key }).whereNull("deleted_at").first()
  if (clash) return res.status(400).json({ message: `Există deja un filtru cu cheia „${data.key}".` })

  const attribute = await service.createFilterAttributes(data as any)
  if (category_ids?.length) {
    await service.createFilterAttributeCategories(
      category_ids.map((category_id, i) => ({ attribute_id: attribute.id, category_id, rank: i * 10 })) as any
    )
  }
  await revalidateCatalog(req, "attribute.created")
  res.status(201).json({ attribute })
}
