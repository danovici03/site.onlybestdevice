import { ExecArgs } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { updateRegionsWorkflow } from '@medusajs/core-flows'

/**
 * Activează providerul „Card prin Netopia" (pp_netopia_netopia) pe regiunea
 * RON. Rulează după repornirea backend-ului cu NETOPIA_* setate în .env:
 *
 *   npx medusa exec ./src/scripts/enable-netopia.ts
 */
export default async function enableNetopia({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: providers } = await query.graph({
    entity: 'payment_provider',
    fields: ['id', 'is_enabled'],
  })
  if (!providers.some((p: any) => p.id === 'pp_netopia_netopia')) {
    throw new Error(
      'pp_netopia_netopia nu e înregistrat — verifică NETOPIA_* în .env, repornește backend-ul, apoi rulează din nou.'
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
  if (existing.includes('pp_netopia_netopia')) {
    console.log(`Regiunea „${region.name}" are deja providerul Netopia.`)
    return
  }

  await updateRegionsWorkflow(container).run({
    input: {
      selector: { id: region.id },
      update: {
        payment_providers: [...existing, 'pp_netopia_netopia'],
      },
    },
  })

  console.log(
    `„Card prin Netopia" activat pe regiunea „${region.name}" (${region.currency_code}).`
  )
}
