import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"

import { BUYBACK_ORDER_STATUSES } from "../../../../../modules/buyback/models/buyback-order"
import {
  ADMIN_TRANSITIONS,
  buybackService,
  currentAmount,
  emitBuybackEvent,
  issueVoucher,
  reviseFromInspection,
  revokeVoucher,
  voucherCalculator,
  withOrderLock,
  type BuybackOrderStatus,
} from "../../../../../lib/buyback/orders"
import { AnswersSchema } from "../../../../../lib/buyback/schema"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const order = await buybackService(req.scope).retrieveBuybackOrder(req.params.id)
  res.json({ order, transitions: ADMIN_TRANSITIONS[(order as any).status as BuybackOrderStatus] })
}

const UpdateSchema = z.object({
  status: z.enum(BUYBACK_ORDER_STATUSES).optional(),
  inspection: AnswersSchema.nullable().optional(),
  /** Suma prin transfer din oferta revizuită, dacă vrei alta decât cea calculată. */
  // Minimum 1 leu: o ofertă de 0 ar ajunge la client pe email, iar la plata
  // prin voucher `issueVoucher` ar arunca („nu are sumă finală").
  revised_price: z.number().int().min(1).max(100000).optional(),
  admin_note: z.string().max(4000).nullable().optional(),
  customer_message: z.string().max(2000).nullable().optional(),
  awb: z.string().trim().max(60).nullable().optional(),
  /** Email către client la schimbarea statusului (implicit da). */
  notify: z.boolean().optional(),
})

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const parsed = UpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "Date invalide", error: parsed.error.flatten() })
  }
  const b = parsed.data
  const service = buybackService(req.scope)

  // Totul sub lock și cu preluarea recitită înăuntru: un dublu-click pe
  // „Plătită” găsește a doua oară statusul deja schimbat și primește 409,
  // în loc să mai emită un voucher.
  const result = await withOrderLock(req.scope, req.params.id, async () => {
    const order = (await service.retrieveBuybackOrder(req.params.id)) as any
    const from = order.status as BuybackOrderStatus
    const to = b.status && b.status !== from ? b.status : b.status === "revised" ? "revised" : null

    if (to && !ADMIN_TRANSITIONS[from].includes(to)) {
      return { status: 409, body: { message: `Nu se poate trece din „${from}” în „${to}”` } }
    }

    const patch: Record<string, unknown> = { id: order.id }
    for (const k of ["admin_note", "customer_message", "awb"] as const) {
      if (b[k] !== undefined) patch[k] = b[k]
    }
    // Mesajul pentru client ține de pasul la care a fost scris (de ex. motivul
    // ofertei revizuite). La un status nou dispare, dacă nu scrii altul acum.
    if (to && b.customer_message === undefined) patch.customer_message = null
    if (b.inspection !== undefined) patch.inspection = b.inspection

    if (to === "revised") {
      const inspection = b.inspection ?? order.inspection
      if (!inspection && b.revised_price === undefined) {
        return { status: 400, body: { message: "Completează verificarea sau suma revizuită" } }
      }
      const r = inspection ? await reviseFromInspection(req.scope, order, inspection) : null
      const price = b.revised_price ?? r?.revised_price
      if (price == null) {
        return {
          status: 400,
          body: {
            message:
              "La verificare telefonul iese fără ofertă (refuz sau sub minim). Alege „Refuzată” sau scrie o sumă manual.",
          },
        }
      }
      const voucherOf = r?.voucherOf ?? (await voucherCalculator(req.scope, order))
      patch.revised_price = price
      patch.revised_voucher_price = voucherOf(price)
    }

    if (to === "accepted") {
      patch.final_amount = currentAmount({ ...order, ...patch })
    }

    let issuedPromotion: string | null = null
    if (to === "paid" && !order.cnp) {
      return {
        status: 400,
        body: {
          message:
            "Clientul n-a completat încă CNP-ul și actul pentru borderou. Le cere pe pagina preluării; primești email când le trimite.",
        },
      }
    }

    if (to === "paid") {
      const amount = order.final_amount ?? currentAmount(order)
      patch.final_amount = amount
      patch.paid_at = new Date()
      if (order.payout_method === "voucher" && !order.voucher_code) {
        try {
          const v = await issueVoucher(req.scope, { ...order, final_amount: amount })
          patch.voucher_code = v.code
          patch.voucher_promotion_id = v.promotion_id
          issuedPromotion = v.promotion_id
        } catch (e: any) {
          return { status: 500, body: { message: `Voucherul nu s-a putut crea: ${e.message}` } }
        }
      }
    }

    if (to) {
      patch.status = to
      patch.status_changed_at = new Date()
    }

    let updated: any
    try {
      updated = await service.updateBuybackOrders(patch as any)
    } catch (e) {
      // Voucherul nu rămâne activ fără o preluare care să-l arate.
      if (issuedPromotion) await revokeVoucher(req.scope, issuedPromotion)
      throw e
    }
    return { status: 200, updated, to }
  })

  if (result.status !== 200) return res.status(result.status).json((result as any).body)
  const { updated, to } = result as { updated: any; to: BuybackOrderStatus | null }
  if (to && b.notify !== false) {
    await emitBuybackEvent(req.scope, "buyback.status_changed", { id: updated.id })
  }
  res.json({ order: updated, transitions: ADMIN_TRANSITIONS[(updated as any).status as BuybackOrderStatus] })
}
