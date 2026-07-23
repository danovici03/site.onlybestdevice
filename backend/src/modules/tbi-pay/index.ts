import { ModuleProvider, Modules } from '@medusajs/framework/utils'
import { TbiPayProviderService } from './service'

export default ModuleProvider(Modules.PAYMENT, {
  services: [TbiPayProviderService],
})
