import { ExecArgs } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { updateRegionsWorkflow } from '@medusajs/core-flows'

/**
 * Activează providerul „Plată la livrare" (pp_cod_cod) pe regiunea RON.
 * Rulează după repornirea backend-ului (providerul trebuie să fie
 * înregistrat în DB):
 *
 *   npx medusa exec ./src/scripts/enable-cod.ts
 */
export default async function enableCod({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: providers } = await query.graph({
    entity: 'payment_provider',
    fields: ['id', 'is_enabled'],
  })
  if (!providers.some((p: any) => p.id === 'pp_cod_cod')) {
    throw new Error(
      'pp_cod_cod nu e înregistrat — repornește backend-ul, apoi rulează din nou.'
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
  if (existing.includes('pp_cod_cod')) {
    console.log(`Regiunea „${region.name}" are deja plata la livrare.`)
    return
  }

  await updateRegionsWorkflow(container).run({
    input: {
      selector: { id: region.id },
      update: {
        payment_providers: [...existing, 'pp_cod_cod'],
      },
    },
  })

  console.log(
    `„Plată la livrare" activată pe regiunea „${region.name}" (${region.currency_code}).`
  )
}
