import {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from '@medusajs/framework/types'
import { AbstractPaymentProvider, MedusaError } from '@medusajs/framework/utils'
import { randomUUID } from 'crypto'

/**
 * Plată la livrare (ramburs/numerar la curier). Nu mișcă bani online:
 * comanda se autorizează imediat, iar captura o face adminul când curierul
 * confirmă încasarea. Există separat de `pp_system_default` (folosit pentru
 * ordin de plată / transfer bancar) ca cele două metode să apară distinct
 * în checkout.
 */
export class CodProviderService extends AbstractPaymentProvider {
  static identifier = 'cod'

  // Constructorul AbstractPaymentProvider e protected; ModuleProvider cere
  // unul public.
  constructor(container: Record<string, unknown>, options?: Record<string, unknown>) {
    super(container, options)
  }

  async initiatePayment(
    input: InitiatePaymentInput
  ): Promise<InitiatePaymentOutput> {
    return {
      id: `cod_${randomUUID()}`,
      data: {
        ...(input.data ?? {}),
        amount: input.amount,
        currency_code: input.currency_code,
      },
    }
  }

  async authorizePayment(
    input: AuthorizePaymentInput
  ): Promise<AuthorizePaymentOutput> {
    return { status: 'authorized', data: input.data }
  }

  async capturePayment(
    input: CapturePaymentInput
  ): Promise<CapturePaymentOutput> {
    return { data: input.data }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return { data: input.data }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: input.data }
  }

  async getPaymentStatus(
    _input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    return { status: 'authorized' }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    return { data: input.data }
  }

  async retrievePayment(
    input: RetrievePaymentInput
  ): Promise<RetrievePaymentOutput> {
    return { data: input.data }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    return {
      data: {
        ...(input.data ?? {}),
        amount: input.amount,
        currency_code: input.currency_code,
      },
    }
  }

  async getWebhookActionAndData(
    _payload: ProviderWebhookPayload['payload']
  ): Promise<WebhookActionResult> {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Plata la livrare nu primește webhook-uri'
    )
  }
}
