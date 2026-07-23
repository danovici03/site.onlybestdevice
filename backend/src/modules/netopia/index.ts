import { ModuleProvider, Modules } from '@medusajs/framework/utils'
import { NetopiaProviderService } from './service'

export default ModuleProvider(Modules.PAYMENT, {
  services: [NetopiaProviderService],
})
