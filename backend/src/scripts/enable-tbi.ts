import { ExecArgs } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { updateRegionsWorkflow } from '@medusajs/core-flows'

/**
 * Activează providerul „Rate prin TBI Bank" (pp_tbi_tbi) pe regiunea RON.
 * Rulează după ce config-ul TBI_* din .env e complet și backend-ul a fost
 * repornit (providerul trebuie să fie înregistrat în DB):
 *
 *   npx medusa exec ./src/scripts/enable-tbi.ts
 */
export default async function enableTbi({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: providers } = await query.graph({
    entity: 'payment_provider',
    fields: ['id', 'is_enabled'],
  })
  if (!providers.some((p: any) => p.id === 'pp_tbi_tbi')) {
    throw new Error(
      'pp_tbi_tbi nu e înregistrat — completează TBI_* în .env, repornește backend-ul, apoi rulează din nou.'
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
  if (existing.includes('pp_tbi_tbi')) {
    console.log(`Regiunea „${region.name}" are deja providerul TBI.`)
    return
  }

  await updateRegionsWorkflow(container).run({
    input: {
      selector: { id: region.id },
      update: {
        payment_providers: [...existing, 'pp_tbi_tbi'],
      },
    },
  })

  console.log(
    `„Rate prin TBI Bank" activat pe regiunea „${region.name}" (${region.currency_code}).`
  )
}
