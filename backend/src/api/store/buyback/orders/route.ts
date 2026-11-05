import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"

import { isValidCnp, normalizeCnp } from "../../../../lib/buyback/cnp"
import { isValidIban, normalizeIban } from "../../../../lib/buyback/iban"
import {
  buybackService,
  emitBuybackEvent,
  newAccessToken,
  publicOrder,
  quoteHash,
} from "../../../../lib/buyback/orders"
import { verifyQuote } from "../../../../lib/buyback/quote-token"
import { allowSubmit } from "../../../../lib/buyback/rate-limit"

const text = (max: number) => z.string().trim().min(1).max(max)

const OrderSchema = z
  .object({
    quote_token: z.string().min(10).max(6000),
    payout_method: z.enum(["bank", "voucher"]),
    first_name: text(80),
    last_name: text(80),
    email: z.string().trim().email().max(200),
    phone: z
      .string()
      .trim()
      .regex(/^[+\d][\d\s().-]{8,19}$/, "Telefon invalid"),
    delivery_method: z.enum(["courier", "store"]),
    address: z
      .object({
        county: text(80),
        city: text(120),
        street: text(250),
        postal_code: z.string().trim().max(10).optional(),
      })
      .nullable()
      .optional(),
    iban: z.string().max(50).nullable().optional(),
    iban_holder: z.string().trim().max(160).nullable().optional(),
    customer_note: z.string().trim().max(1000).nullable().optional(),
    // Pentru borderoul de achiziție.
    cnp: z.string().refine(isValidCnp, "CNP invalid"),
    id_document: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase().replace(/\s+/g, " "))
      .pipe(z.string().regex(/^[A-Z]{1,3} ?\d{6,9}$/, "Seria și numărul actului sunt invalide")),
    home_address: text(250),
    confirm: z.literal(true),
  })
  .superRefine((b, ctx) => {
    if (b.payout_method === "bank" && !isValidIban(b.iban ?? "")) {
      ctx.addIssue({ code: "custom", path: ["iban"], message: "IBAN invalid" })
    }
    if (b.delivery_method === "courier" && !b.address) {
      ctx.addIssue({
        code: "custom",
        path: ["address"],
        message: "Adresa de ridicare lipsește",
      })
    }
  })

/**
 * Clientul acceptă oferta și trimite preluarea. Suma vine din tokenul semnat,
 * nu din corpul cererii. Același token trimis de două ori (dublu-click,
 * refresh) întoarce preluarea deja creată, nu una nouă.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!allowSubmit(req)) {
    return res.status(429).json({
      message: "Prea multe cereri. Încearcă din nou în câteva minute.",
    })
  }
  const parsed = OrderSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "Date invalide", error: parsed.error.flatten() })
  }
  const b = parsed.data
  const quote = verifyQuote(b.quote_token)
  if (!quote) {
    return res.status(410).json({
      message: "Oferta a expirat. Refă evaluarea ca să primești o ofertă nouă.",
    })
  }

  const service = buybackService(req.scope)
  const hash = quoteHash(b.quote_token)
  const [existing] = await service.listBuybackOrders({ quote_hash: hash }, { take: 1 })
  if (existing) {
    if (existing.email.toLowerCase() !== b.email.toLowerCase()) {
      return res.status(409).json({ message: "Oferta a fost deja folosită." })
    }
    return res.json({
      order: publicOrder(existing),
      access_token: existing.access_token,
    })
  }

  const device = (await service.retrieveBuybackDevice(quote.device_id).catch(() => null)) as any
  if (!device) return res.status(404).json({ message: "Modelul nu mai este disponibil" })

  // Verificarea de mai sus nu ajunge când două cereri cu același token sosesc
  // simultan (dublu-click, două taburi): amândouă trec de ea, iar a doua se
  // lovește de indexul unic pe `quote_hash`. Atunci întoarcem preluarea creată
  // de prima, ca la o retrimitere obișnuită, în loc de un 500.
  const existingOrConflict = async (err: unknown) => {
    const [winner] = await service.listBuybackOrders({ quote_hash: hash }, { take: 1 })
    if (!winner) throw err
    if (winner.email.toLowerCase() !== b.email.toLowerCase()) {
      return res.status(409).json({ message: "Oferta a fost deja folosită." })
    }
    return res.json({
      order: publicOrder(winner),
      access_token: winner.access_token,
    })
  }

  const now = new Date()
  let order: any
  try {
    order = await service.createBuybackOrders({
      status: "submitted",
      access_token: newAccessToken(),
      quote_hash: hash,
      device_id: device.id,
      device_name: `${device.brand} ${device.model}`.replace(/^(\w+) \1 /, "$1 "),
      brand: device.brand,
      storage: quote.storage,
      color: quote.color,
      answers: quote.answers as any,
      base_price: quote.base_price,
      quoted_price: quote.price,
      quoted_voucher_price: quote.voucher_price,
      voucher_bonus_percent: quote.voucher_bonus_percent,
      quote_expires_at: new Date(quote.exp),
      payout_method: b.payout_method,
      first_name: b.first_name,
      last_name: b.last_name,
      email: b.email.toLowerCase(),
      phone: b.phone,
      delivery_method: b.delivery_method,
      address: b.delivery_method === "courier" ? (b.address as any) : null,
      iban: b.payout_method === "bank" ? normalizeIban(b.iban!) : null,
      iban_holder: b.payout_method === "bank" ? b.iban_holder || `${b.first_name} ${b.last_name}` : null,
      customer_note: b.customer_note || null,
      cnp: normalizeCnp(b.cnp),
      id_document: b.id_document,
      home_address: b.home_address,
      submitted_at: now,
      status_changed_at: now,
    })
  } catch (err) {
    return existingOrConflict(err)
  }

  await emitBuybackEvent(req.scope, "buyback.submitted", { id: order.id })
  res.status(201).json({ order: publicOrder(order), access_token: order.access_token })
}
