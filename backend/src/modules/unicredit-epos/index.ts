import { ModuleProvider, Modules } from '@medusajs/framework/utils'
import { UnicreditEposProviderService } from './service'

export default ModuleProvider(Modules.PAYMENT, {
  services: [UnicreditEposProviderService],
})
