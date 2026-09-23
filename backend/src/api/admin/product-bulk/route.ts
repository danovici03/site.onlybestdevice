import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  deleteProductsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { z } from "zod"

import { snapshotBeforeDelete } from "../../../lib/products/restore"
import { WARRANTY_HANDLE } from "../../../lib/warranty-prices"

/**
 * POST /admin/product-bulk
 *
 * Acțiunile în masă din lista de produse a adminului (pagina „Produse"):
 * stare, vizibilitate, categorie, ștergere — pe produsele bifate sau pe toate
 * cele filtrate (lista trimite id-urile, luate din `/explore?ids_only=true`).
 *
 * Totul trece prin workflow-urile Medusa, nu prin SQL direct: așa se emit
 * `product.updated` / `product.deleted`, iar abonații obișnuiți fac restul —
 * completarea filtrelor la schimbarea categoriei, golirea cache-ului din
 * magazin. Exact ce s-ar întâmpla la salvarea fiecărui produs din fișa lui.
 *
 * Produsul „Garanție extinsă" e sărit mereu: e un produs de serviciu, ascuns
 * intenționat, iar coșul îl caută după handle — o ștergere sau o publicare
 * „odată cu restul filtrate" ar strica garanția din tot magazinul.
 */

const ACTIONS = [
  "publish",
  "draft",
  "hide",
  "show",
  "category_add",
  "category_remove",
  "category_set",
  "delete",
] as const

const BodySchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1).max(5000),
    action: z.enum(ACTIONS),
    category_id: z.string().min(1).optional(),
  })
  .refine((b) => !b.action.startsWith("category_") || !!b.category_id, {
    message: "Alege categoria.",
    path: ["category_id"],
  })

/** Workflow-uri mai mici: o eroare la un lot nu le anulează pe cele reușite. */
const CHUNK = 100

const chunks = <T>(list: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const knex: any = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  const parsed = BodySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Cerere invalidă" })
  }
  const { action, category_id } = parsed.data

  // Doar produsele care există încă, fără cel de serviciu.
  const rows: { id: string; handle: string }[] = await knex("product")
    .select("id", "handle")
    .whereIn("id", [...new Set(parsed.data.ids)])
    .whereNull("deleted_at")
  const ids = rows.filter((r) => r.handle !== WARRANTY_HANDLE).map((r) => r.id)
  const skipped = parsed.data.ids.length - ids.length

  if (category_id) {
    const cat = await knex("product_category")
      .first("id")
      .where({ id: category_id })
      .whereNull("deleted_at")
    if (!cat) return res.status(400).json({ message: "Categoria nu există." })
  }

  let done = 0
  try {
    for (const batch of chunks(ids, CHUNK)) {
      switch (action) {
        case "publish":
        case "draft":
          await updateProductsWorkflow(req.scope).run({
            input: {
              selector: { id: batch },
              update: { status: action === "publish" ? "published" : "draft" },
            },
          })
          done += batch.length
          break

        // `metadata` se unește cu cea existentă; cheia se scoade cu "" —
        // restul metadatelor (specs, grupul de telefoane…) rămân neatinse.
        case "hide":
        case "show":
          await updateProductsWorkflow(req.scope).run({
            input: {
              selector: { id: batch },
              update: { metadata: { hidden: action === "hide" ? "true" : "" } },
            },
          })
          done += batch.length
          break

        // `category_ids` înlocuiește lista, deci pentru adăugare/scoatere
        // calculăm lista nouă a fiecărui produs și atingem doar ce se schimbă.
        case "category_add":
        case "category_remove":
        case "category_set": {
          const links: { product_id: string; product_category_id: string }[] = await knex(
            "product_category_product"
          )
            .select("product_id", "product_category_id")
            .whereIn("product_id", batch)
          const current = new Map<string, Set<string>>(batch.map((id) => [id, new Set()]))
          for (const l of links) current.get(l.product_id)?.add(l.product_category_id)

          const products = batch.flatMap((id) => {
            const before = current.get(id)!
            let after: Set<string>
            if (action === "category_set") after = new Set([category_id!])
            else if (action === "category_add") after = new Set([...before, category_id!])
            else after = new Set([...before].filter((c) => c !== category_id))
            const same = after.size === before.size && [...after].every((c) => before.has(c))
            return same ? [] : [{ id, category_ids: [...after] }]
          })
          if (products.length) {
            await updateProductsWorkflow(req.scope).run({ input: { products } })
          }
          done += products.length
          break
        }

        case "delete":
          await snapshotBeforeDelete(req.scope, batch)
          await deleteProductsWorkflow(req.scope).run({ input: { ids: batch } })
          done += batch.length
          break
      }
    }
  } catch (e: any) {
    logger.error(`/admin/product-bulk ${action}: ${e?.message}`)
    return res.status(500).json({
      message: `Acțiunea s-a oprit după ${done} produse: ${e?.message ?? "eroare necunoscută"}`,
      done,
    })
  }

  logger.info(`[product-bulk] ${action}: ${done} produse${skipped ? `, ${skipped} sărite` : ""}`)
  res.json({ done, skipped })
}
