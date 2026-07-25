/**
 * Aduce opțiunile de livrare RO la denumirile/prețurile curente:
 *  - „Livrare express" → „Livrare prioritară", preț = livrare standard + 5.99 lei
 *  - „Ridicare personală" → „Ridicare personală de la locația magazinului",
 *    cu termen de procesare 1–2 zile în descriere
 *
 * Idempotent: îl poți rula de câte ori vrei (local și pe producție).
 *
 * Rulare: cd backend && yarn medusa exec ./src/scripts/update-shipping-ro.ts
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"

const PRIORITY_SURCHARGE = 5.99 // lei peste prețul livrării standard
const PRIORITY_NAME = "Livrare prioritară"
const PRIORITY_LABEL = "Prioritară"
const PRIORITY_DESCRIPTION =
  "Comanda ta e procesată și expediată cu prioritate, înaintea celorlalte."

const PICKUP_NAME = "Ridicare personală de la locația magazinului"
const PICKUP_LABEL = "Ridicare din magazin"
const PICKUP_DESCRIPTION =
  "Termen de procesare 1–2 zile lucrătoare. Te anunțăm pe email când comanda " +
  "este disponibilă în magazin."

export default async function updateShippingRo({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillment = container.resolve(Modules.FULFILLMENT)

  const { data: options } = await query.graph({
    entity: "shipping_option",
    fields: [
      "id",
      "name",
      "type.id",
      "type.code",
      "type.label",
      "type.description",
      "prices.id",
      "prices.amount",
      "prices.currency_code",
      "prices.price_rules.attribute",
      "prices.price_rules.value",
    ],
  })

  const byCode = (...codes: string[]) =>
    options.find((o: any) => codes.includes(o.type?.code)) as any

  const standard = byCode("standard")
  const priority = byCode("express", "priority")
  const pickup = byCode("pickup")

  if (!standard) throw new Error("Nu găsesc opțiunea de livrare standard.")
  if (!priority)
    throw new Error("Nu găsesc opțiunea de livrare express/prioritară.")
  if (!pickup) throw new Error("Nu găsesc opțiunea de ridicare personală.")

  const basePrice = standard.prices?.[0]?.amount
  if (typeof basePrice !== "number")
    throw new Error("Livrarea standard nu are preț setat.")

  const newAmount = Number((basePrice + PRIORITY_SURCHARGE).toFixed(2))

  // Rescriem toate prețurile existente (currency-only + cel pe regiune), ca să
  // nu pierdem regula de regiune creată la configurarea inițială.
  const prices = (priority.prices || []).map((p: any) => {
    const regionRule = (p.price_rules || []).find(
      (r: any) => r.attribute === "region_id"
    )
    return regionRule
      ? { region_id: regionRule.value, amount: newAmount }
      : { currency_code: p.currency_code, amount: newAmount }
  })

  await updateShippingOptionsWorkflow(container).run({
    input: [
      { id: priority.id, name: PRIORITY_NAME, prices },
      { id: pickup.id, name: PICKUP_NAME },
    ] as any,
  })

  // Workflow-ul de update nu atinge tipul opțiunii — îl setăm direct.
  if (priority.type?.id) {
    await fulfillment.updateShippingOptionTypes(priority.type.id, {
      label: PRIORITY_LABEL,
      description: PRIORITY_DESCRIPTION,
      code: "priority",
    })
  }
  if (pickup.type?.id) {
    await fulfillment.updateShippingOptionTypes(pickup.type.id, {
      label: PICKUP_LABEL,
      description: PICKUP_DESCRIPTION,
      code: "pickup",
    })
  }

  logger.info(
    `✓ „${PRIORITY_NAME}" — preț ${basePrice} + ${PRIORITY_SURCHARGE} = ${newAmount} lei.`
  )
  logger.info(`✓ „${PICKUP_NAME}" — ${PICKUP_DESCRIPTION}`)
}
