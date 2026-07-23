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
  PaymentSessionStatus,
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
 * Provider de plată „Rate prin TBI Bank" (eCommerce API).
 *
 * Ca la UniCredit, banii nu se mișcă prin provider: după plasarea comenzii,
 * storefront-ul cere `/store/tbi/session`, care creează cererea de credit
 * (Finalize) și redirecționează clientul la TBI. Statusul vine criptat pe
 * `/hooks/tbi`:
 *   - status_id 1 (aprobat)  → capturăm plata, comanda se livrează
 *   - status_id 0 (respins/anulat) → anulăm comanda
 *   - status_id 2 (pending)  → doar consemnăm; rămânem în așteptare
 */
export class TbiPayProviderService extends AbstractPaymentProvider {
  static identifier = 'tbi'

  // Constructorul AbstractPaymentProvider e protected; ModuleProvider cere
  // unul public.
  constructor(container: Record<string, unknown>, options?: Record<string, unknown>) {
    super(container, options)
  }

  async initiatePayment(
    input: InitiatePaymentInput
  ): Promise<InitiatePaymentOutput> {
    // Cererea reală se creează după plasarea comenzii (avem nevoie de order
    // id). Aici reținem doar alegerea clientului (numărul de rate).
    return {
      id: `tbi_${randomUUID()}`,
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
    return { data: { ...(input.data ?? {}), tbi_status: 'approved' } }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return { data: { ...(input.data ?? {}), tbi_status: 'cancelled' } }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: input.data }
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    const status = (input.data?.tbi_status as string) ?? undefined
    const map: Record<string, PaymentSessionStatus> = {
      approved: 'captured',
      rejected: 'error',
      cancelled: 'canceled',
    }
    return { status: (status && map[status]) || 'authorized' }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    // Rambursările la credite se reglează direct cu TBI (retur/retragere).
    return { data: { ...(input.data ?? {}), tbi_refund_requested: true } }
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
      'Statusurile TBI se procesează la /hooks/tbi'
    )
  }
}
