import { ExecArgs } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { updateRegionsWorkflow } from '@medusajs/core-flows'

/**
 * Activează providerul de plată „Rate prin UniCredit" (pp_unicredit_unicredit)
 * pe regiunea RON. Rulează după ce providerul e configurat în medusa-config
 * (UNICREDIT_EPOS_EMAIL/PASSWORD în .env) și backend-ul a fost repornit măcar
 * o dată (ca providerul să fie înregistrat în DB):
 *
 *   npx medusa exec ./src/scripts/enable-unicredit.ts
 */
export default async function enableUnicredit({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: providers } = await query.graph({
    entity: 'payment_provider',
    fields: ['id', 'is_enabled'],
  })
  const unicredit = providers.find((p: any) => p.id === 'pp_unicredit_unicredit')
  if (!unicredit) {
    throw new Error(
      'pp_unicredit_unicredit nu e înregistrat — pornește backend-ul cu UNICREDIT_EPOS_EMAIL/PASSWORD setate, apoi rulează din nou.'
    )
  }

  const { data: regions } = await query.graph({
    entity: 'region',
    fields: ['id', 'name', 'currency_code', 'payment_providers.id'],
  })
  const region =
    regions.find((r: any) => r.currency_code?.toLowerCase() === 'ron') ??
    regions[0]
  if (!region) {
    throw new Error('Nu există nicio regiune')
  }

  const existing = (region.payment_providers ?? []).map((p: any) => p.id)
  if (existing.includes('pp_unicredit_unicredit')) {
    console.log(`Regiunea „${region.name}" are deja providerul UniCredit.`)
    return
  }

  await updateRegionsWorkflow(container).run({
    input: {
      selector: { id: region.id },
      update: {
        payment_providers: [...existing, 'pp_unicredit_unicredit'],
      },
    },
  })

  console.log(
    `Providerul „Rate prin UniCredit" a fost activat pe regiunea „${region.name}" (${region.currency_code}).`
  )
}
