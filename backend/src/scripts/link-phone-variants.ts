/**
 * Migrarea completă a grupurilor de telefoane — scanează tot catalogul.
 *
 * De la introducerea subscriberului `phone-group-link.ts`, legarea se face
 * automat la fiecare salvare de produs, deci scriptul ăsta nu mai e parte din
 * fluxul normal. Rămâne pentru:
 *
 *   - backfill după modificări în parser sau în tabelul de culori
 *   - reparație după ștergeri de produse (subscriberul ascultă doar
 *     `product.created` / `product.updated`)
 *   - audit: `DRY_RUN=1` arată exact ce ar schimba, fără să scrie
 *
 * Rulare:  cd backend && yarn medusa exec ./src/scripts/link-phone-variants.ts
 *   Opțional: DRY_RUN=1 (doar raport), DEBUG=1 (diff pe fiecare cheie)
 *
 * Atenție: `medusa exec` nu apucă să trimită evenimentele către subscriberul de
 * revalidare, deci după o rulare cu scrieri cheamă manual `/api/revalidate` pe
 * storefront.
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { syncAllPhoneGroups } from "../lib/phone-group"

const DRY_RUN = !!process.env.DRY_RUN
const DEBUG = !!process.env.DEBUG

export default async function linkPhoneVariants({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  // Scrierile de mai jos emit `product.updated`, iar subscriberul de legare
  // rulează în același proces: ar recalcula fiecare grup de câte ori are membri,
  // pentru un rezultat pe care sweep-ul complet îl are deja. Îl oprim pe durata
  // rulării.
  process.env.PHONE_GROUP_AUTOLINK = "0"

  const report = await syncAllPhoneGroups(container, {
    dryRun: DRY_RUN,
    collectChanges: DEBUG,
  })

  logger.info(
    `Găsite ${report.phones} produse de tip telefon (din ${report.scanned}).`
  )
  logger.info(
    `${report.groups.length} modele distincte; ${report.linkedGroups} cu mai multe ` +
      `variante publicate (se leagă).`
  )

  for (const c of report.changes) {
    logger.info(`  ~ ${c.handle} [${c.key}]: ${c.from} → ${c.to}`)
  }

  logger.info(
    `${DRY_RUN ? "[DRY_RUN] " : ""}Actualizate: ${report.updated}, neschimbate: ${report.unchanged}.`
  )

  if (report.colorless.length) {
    logger.warn(
      `Culori fără hex (fără pastilă, nume neclar): ${report.colorless.join(", ")}`
    )
  }

  for (const g of report.summary) {
    logger.info(
      `  • ${g.group}: ${g.count} variante — stocări [${g.storages.join(", ")}] · ` +
        `culori [${g.colors.join(", ")}]`
    )
  }
}
