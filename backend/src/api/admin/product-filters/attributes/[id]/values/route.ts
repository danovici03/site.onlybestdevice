import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"

import { badRequest, deps, revalidateCatalog } from "../../../../../../lib/product-filters/admin"
import { colorHex } from "../../../../../../lib/product-filters/extractors"
import { matchKey, slugify } from "../../../../../../lib/product-filters/normalize"

/** POST /admin/product-filters/attributes/:id/values — valoare canonică nouă. */
export const ValueSchema = z.object({
  value: z.string().trim().min(1).max(60),
  hex: z
    .string()
    .trim()
    .regex(/^#[0-9a-f]{6}$/i, "culoarea trebuie să fie #rrggbb")
    .nullable()
    .optional(),
  aliases: z.array(z.string().trim().min(1)).default([]),
  rank: z.number().int().default(0),
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = ValueSchema.safeParse(req.body)
  if (!parsed.success) return badRequest(res, parsed.error)
  const { service, knex } = deps(req)
  const attribute = await service.retrieveFilterAttribute(req.params.id)

  const slug = slugify(parsed.data.value)
  if (!slug) return res.status(400).json({ message: "Valoarea trebuie să conțină litere sau cifre." })
  const clash = await knex("filter_value")
    .where({ attribute_id: attribute.id, slug })
    .whereNull("deleted_at")
    .first()
  if (clash) return res.status(400).json({ message: `Valoarea „${clash.value}" există deja.` })

  const value = await service.createFilterValues({
    ...parsed.data,
    slug,
    hex: parsed.data.hex ?? (attribute.display === "swatch" ? colorHex(parsed.data.value) : null),
    attribute_id: attribute.id,
  } as any)
  // Adăugată explicit de operator: nu mai e o valoare exclusă.
  const keys = new Set([parsed.data.value, slug, ...parsed.data.aliases].map(matchKey))
  const excluded = ((attribute as any).excluded_values ?? []).filter((k: string) => !keys.has(k))
  if (excluded.length !== ((attribute as any).excluded_values ?? []).length) {
    await service.updateFilterAttributes({ id: attribute.id, excluded_values: excluded } as any)
  }
  await revalidateCatalog(req, "value.created")
  res.status(201).json({ value })
}
