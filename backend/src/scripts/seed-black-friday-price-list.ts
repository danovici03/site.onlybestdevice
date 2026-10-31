/**
 * Creează price list-ul gol „Black Friday”, programat pe perioada campaniei.
 *
 * După rulare, operatorul adaugă doar produsele și prețurile, din Admin >
 * Price Lists > Black Friday. Prețurile intră și ies singure la datele de mai
 * jos, iar produsele din listă apar singure pe /black-friday cât timp lista e
 * în desfășurare.
 *
 * Lista rămâne `active` de la creare: `active` plus `starts_at` în viitor
 * înseamnă „programată”. Pe `draft` prețurile nu s-ar aplica la start, iar jobul
 * `price-list-revalidate` ar ignora lista.
 *
 * Datele și titlul trebuie să rămână aliniate cu `BLACK_FRIDAY` din
 * `storefront/src/lib/util/black-friday.ts`. Offsetul e explicit, +02:00 e ora
 * României iarna.
 *
 * Idempotent: dacă lista există deja, nu scrie nimic, doar spune dacă datele ei
 * diferă de cele de aici. O rulare repetată nu poate atinge prețurile adăugate
 * între timp de operator.
 *
 * Rulare locală:  cd backend && yarn medusa exec ./src/scripts/seed-black-friday-price-list.ts
 * Rulare pe prod: docker exec <container-backend> npx medusa exec ./src/scripts/seed-black-friday-price-list.js
 *   Opțional: DRY_RUN=1 (doar raport, fără scriere)
 *
 * Lista e goală, deci nu schimbă niciun preț și nu cere revalidarea storefront-ului.
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createPriceListsWorkflow } from "@medusajs/medusa/core-flows"

const TITLE = "Black Friday"
const DESCRIPTION = "Reducerile de Black Friday, 27–30 noiembrie 2026."
const STARTS_AT = "2026-11-27T00:00:00+02:00"
const ENDS_AT = "2026-11-30T23:59:59+02:00"

const DRY_RUN = /^(1|true|yes)$/i.test(process.env.DRY_RUN ?? "")

const sameMoment = (a: string | Date | null | undefined, b: string) =>
  !!a && new Date(a).getTime() === new Date(b).getTime()

export default async function seedBlackFridayPriceList({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: lists } = await query.graph({
    entity: "price_list",
    fields: ["id", "title", "status", "starts_at", "ends_at"],
    filters: { title: TITLE },
  })

  const existing = lists?.[0] as any
  if (existing) {
    const scheduled =
      sameMoment(existing.starts_at, STARTS_AT) &&
      sameMoment(existing.ends_at, ENDS_AT)
    logger.info(`Lista „${TITLE}” există deja (${existing.id}). Nu scriu nimic.`)
    if (!scheduled || existing.status !== "active") {
      logger.warn(
        `Lista e „${existing.status}”, ${existing.starts_at} – ${existing.ends_at}. ` +
          `Așteptat: „active”, ${STARTS_AT} – ${ENDS_AT}. Corecteaz-o din Admin.`
      )
    }
    return
  }

  if (DRY_RUN) {
    logger.info(`[dry-run] Aș crea lista „${TITLE}”, ${STARTS_AT} – ${ENDS_AT}.`)
    return
  }

  const { result } = await createPriceListsWorkflow(container).run({
    input: {
      price_lists_data: [
        {
          title: TITLE,
          description: DESCRIPTION,
          type: "sale",
          status: "active",
          starts_at: STARTS_AT,
          ends_at: ENDS_AT,
          prices: [],
        },
      ] as any,
    },
  })

  logger.info(
    `Gata: lista „${TITLE}” (${(result as any[])[0].id}), ${STARTS_AT} – ${ENDS_AT}.`
  )
}
