/**
 * Trece livrarea pe modelul „taxa se achită curierului":
 *  - opțiunile de curier rămân în checkout, dar cu preț 0 în Medusa — banii de
 *    transport nu trec prin site, clientul îi dă curierului la primirea coletului;
 *  - le redenumește pe Fan Curier și le pune descrierea corectă;
 *  - dezactivează promoția „transport gratuit peste 1000 lei" (nu mai are ce să
 *    facă gratuit, iar afișată ar fi o promisiune falsă).
 *
 * Cifrele afișate clientului (38 lei / 43,99 lei) NU stau aici: transportul nu e
 * un preț Medusa, ci text informativ. Sursa unică e
 * storefront/src/lib/util/shipping-tariff.ts.
 *
 * Idempotent: îl poți rula de câte ori vrei (local și pe producție).
 *
 * Rulare: cd backend && yarn medusa exec ./src/scripts/shipping-fan-curier.ts
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"

const STANDARD_NAME = "Livrare prin Fan Curier"
const STANDARD_LABEL = "Standard"
const STANDARD_DESCRIPTION =
  "Livrare în 1–3 zile lucrătoare. Taxa de transport se achită direct " +
  "curierului, la primirea coletului."

const PRIORITY_NAME = "Livrare prioritară prin Fan Curier"
const PRIORITY_LABEL = "Prioritară"
const PRIORITY_DESCRIPTION =
  "Comanda ta e procesată și expediată cu prioritate, înaintea celorlalte. " +
  "Taxa de transport se achită direct curierului, la primirea coletului."

const FREE_SHIPPING_CODE = "TRANSPORT-GRATUIT"

export default async function shippingFanCurier({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillment = container.resolve(Modules.FULFILLMENT)
  const promotion = container.resolve(Modules.PROMOTION)

  const { data: options } = await query.graph({
    entity: "shipping_option",
    fields: [
      "id",
      "name",
      "type.id",
      "type.code",
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
  const priority = byCode("priority", "express")

  if (!standard) throw new Error("Nu găsesc opțiunea de livrare standard.")
  if (!priority) throw new Error("Nu găsesc opțiunea de livrare prioritară.")

  // Rescriem toate prețurile existente pe 0, păstrând structura (preț pe monedă
  // + preț pe regiune), ca să nu pierdem regula de regiune.
  const zeroPrices = (option: any) =>
    (option.prices || []).map((p: any) => {
      const regionRule = (p.price_rules || []).find(
        (r: any) => r.attribute === "region_id"
      )
      return regionRule
        ? { region_id: regionRule.value, amount: 0 }
        : { currency_code: p.currency_code, amount: 0 }
    })

  await updateShippingOptionsWorkflow(container).run({
    input: [
      { id: standard.id, name: STANDARD_NAME, prices: zeroPrices(standard) },
      { id: priority.id, name: PRIORITY_NAME, prices: zeroPrices(priority) },
    ] as any,
  })

  // Workflow-ul de update nu atinge tipul opțiunii — îl setăm direct.
  if (standard.type?.id) {
    await fulfillment.updateShippingOptionTypes(standard.type.id, {
      label: STANDARD_LABEL,
      description: STANDARD_DESCRIPTION,
      code: "standard",
    })
  }
  if (priority.type?.id) {
    await fulfillment.updateShippingOptionTypes(priority.type.id, {
      label: PRIORITY_LABEL,
      description: PRIORITY_DESCRIPTION,
      code: "priority",
    })
  }

  logger.info(`✓ „${STANDARD_NAME}" — 0 lei în coș, taxa se achită curierului.`)
  logger.info(`✓ „${PRIORITY_NAME}" — 0 lei în coș, taxa se achită curierului.`)

  // Transportul nu mai e încasat de noi → promoția de transport gratuit iese.
  const { data: promos } = await query.graph({
    entity: "promotion",
    fields: ["id", "code", "status"],
    filters: { code: FREE_SHIPPING_CODE },
  })
  const promo = promos[0] as any
  if (!promo) {
    logger.info(`Promoția „${FREE_SHIPPING_CODE}" nu există — nimic de făcut.`)
  } else if (promo.status === "inactive") {
    logger.info(`Promoția „${FREE_SHIPPING_CODE}" e deja inactivă.`)
  } else {
    await promotion.updatePromotions({
      id: promo.id,
      status: "inactive",
      is_automatic: false,
    } as any)
    logger.info(`✓ Promoția „${FREE_SHIPPING_CODE}" dezactivată.`)
  }

  await clearStaleShippingMethods(container, logger)

  logger.info("✓ Livrare Fan Curier cu plata la curier — configurare completă.")
}

/**
 * Medusa îngheață suma în metoda de livrare salvată pe coș, deci coșurile
 * deschise dinainte de schimbare ar mai încasa vechea taxă. Le scoatem metoda:
 * clientul o realege în checkout, deja pe 0.
 *
 * Acum că toate opțiunile sunt pe 0, „metodă cu sumă > 0 pe un coș neîncheiat"
 * înseamnă exact „rest din configurația veche".
 */
async function clearStaleShippingMethods(container: any, logger: any) {
  const cart = container.resolve(Modules.CART)

  const PAGE = 500
  const stale: { id: string; cart_id: string }[] = []
  for (let skip = 0; ; skip += PAGE) {
    const page = await cart.listShippingMethods(
      {},
      { select: ["id", "cart_id", "amount"], skip, take: PAGE }
    )
    stale.push(
      ...page.filter((m: any) => Number(m.amount) > 0 && m.cart_id)
    )
    if (page.length < PAGE) break
  }

  if (!stale.length) {
    logger.info("Niciun coș cu taxă de transport veche — nimic de curățat.")
    return
  }

  // Coșurile finalizate au devenit comenzi; acolo suma trebuie să rămână cum a
  // fost la plasare, deci le sărim.
  const carts = await cart.listCarts(
    { id: [...new Set(stale.map((m) => m.cart_id))] },
    { select: ["id", "completed_at"] }
  )
  const openCartIds = new Set(
    carts.filter((c: any) => !c.completed_at).map((c: any) => c.id)
  )

  const toDelete = stale
    .filter((m) => openCartIds.has(m.cart_id))
    .map((m) => m.id)

  if (!toDelete.length) {
    logger.info("Taxele vechi rămase sunt doar pe comenzi finalizate — le las.")
    return
  }

  await cart.deleteShippingMethods(toDelete)
  logger.info(
    `✓ Șterse ${toDelete.length} metode de livrare vechi de pe coșuri deschise.`
  )
}
