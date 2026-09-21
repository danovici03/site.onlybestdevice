/**
 * Aduce livrarea la starea curentă: transportul se încasează prin site.
 *  - pune tariful real pe opțiunile de curier (38 lei / 43,99 lei), ca el să
 *    intre în `shipping_total` și în totalul comenzii — de acolo ajunge singur
 *    în suma cerută la card, la rate și la ordin de plată;
 *  - le redenumește pe Fan Curier și le pune descrierea corectă;
 *  - aliniază și „Ridicare personală" la denumirea/descrierea curente (rămâne 0);
 *  - dezactivează promoția „transport gratuit peste 1000 lei", care ar face
 *    gratuit exact ce tocmai am pus la plată.
 *
 * La ramburs tariful apare la fel în total, dar banii îi ia curierul direct;
 * diferența o explică textul din checkout, nu configurația de aici.
 *
 * Cifrele stau în `src/lib/shipping/tariffs.ts`, dublate în storefront pentru
 * textele informative de pe paginile statice.
 *
 * Idempotent: îl poți rula de câte ori vrei (local și pe producție).
 *
 * Rulare: cd backend && yarn medusa exec ./src/scripts/shipping-fan-curier.ts
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"

import { PRIORITY_TARIFF, STANDARD_TARIFF } from "../lib/shipping/tariffs"

const STANDARD_NAME = "Livrare prin Fan Curier"
const STANDARD_LABEL = "Standard"
const STANDARD_DESCRIPTION = "Livrare în 1–3 zile lucrătoare."

const PRIORITY_NAME = "Livrare prioritară prin Fan Curier"
const PRIORITY_LABEL = "Prioritară"
const PRIORITY_DESCRIPTION =
  "Comanda ta e procesată și expediată cu prioritate, înaintea celorlalte."

const PICKUP_NAME = "Ridicare personală de la locația magazinului"
const PICKUP_LABEL = "Ridicare din magazin"
const PICKUP_DESCRIPTION =
  "Termen de procesare 1–2 zile lucrătoare. Te anunțăm pe email când comanda " +
  "este disponibilă în magazin."

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
  const pickup = byCode("pickup")

  if (!standard) throw new Error("Nu găsesc opțiunea de livrare standard.")
  if (!priority) throw new Error("Nu găsesc opțiunea de livrare prioritară.")
  if (!pickup) throw new Error("Nu găsesc opțiunea de ridicare personală.")

  // Rescriem toate prețurile existente pe tarif, păstrând structura (preț pe
  // monedă + preț pe regiune), ca să nu pierdem regula de regiune.
  const pricesAt = (option: any, amount: number) =>
    (option.prices || []).map((p: any) => {
      const regionRule = (p.price_rules || []).find(
        (r: any) => r.attribute === "region_id"
      )
      return regionRule
        ? { region_id: regionRule.value, amount }
        : { currency_code: p.currency_code, amount }
    })

  await updateShippingOptionsWorkflow(container).run({
    input: [
      {
        id: standard.id,
        name: STANDARD_NAME,
        prices: pricesAt(standard, STANDARD_TARIFF),
      },
      {
        id: priority.id,
        name: PRIORITY_NAME,
        prices: pricesAt(priority, PRIORITY_TARIFF),
      },
      { id: pickup.id, name: PICKUP_NAME, prices: pricesAt(pickup, 0) },
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

  if (pickup.type?.id) {
    await fulfillment.updateShippingOptionTypes(pickup.type.id, {
      label: PICKUP_LABEL,
      description: PICKUP_DESCRIPTION,
      code: "pickup",
    })
  }

  logger.info(`✓ „${STANDARD_NAME}" — ${STANDARD_TARIFF} lei în coș.`)
  logger.info(`✓ „${PRIORITY_NAME}" — ${PRIORITY_TARIFF} lei în coș.`)
  logger.info(`✓ „${PICKUP_NAME}" — gratuită.`)

  // Transportul se încasează din nou → promoția l-ar face gratuit pe tăcute.
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

  await clearStaleShippingMethods(container, logger, {
    [standard.id]: STANDARD_TARIFF,
    [priority.id]: PRIORITY_TARIFF,
    [pickup.id]: 0,
  })

  logger.info("✓ Livrare Fan Curier, transport inclus în coș — configurare completă.")
}

/**
 * Medusa îngheață suma în metoda de livrare salvată pe coș, deci coșurile
 * deschise dinainte de schimbare ar rămâne cu taxa veche (0, de pe vremea când
 * transportul se plătea curierului). Le scoatem metoda: clientul o realege în
 * checkout, deja pe tariful nou.
 *
 * „Veche" înseamnă sumă diferită de prețul curent al opțiunii ei — comparăm
 * per opțiune, nu cu o valoare fixă, ca ridicarea din magazin (0) să nu fie
 * ștearsă la fiecare rulare.
 */
async function clearStaleShippingMethods(
  container: any,
  logger: any,
  priceByOption: Record<string, number>
) {
  const cart = container.resolve(Modules.CART)

  const PAGE = 500
  const stale: { id: string; cart_id: string }[] = []
  for (let skip = 0; ; skip += PAGE) {
    const page = await cart.listShippingMethods(
      {},
      { select: ["id", "cart_id", "amount", "shipping_option_id"], skip, take: PAGE }
    )
    stale.push(
      ...page.filter((m: any) => {
        if (!m.cart_id) return false
        const expected = priceByOption[m.shipping_option_id]
        // Opțiune necunoscută (ștearsă între timp): nu ne atingem de ea.
        if (expected === undefined) return false
        return Number(m.amount) !== expected
      })
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
