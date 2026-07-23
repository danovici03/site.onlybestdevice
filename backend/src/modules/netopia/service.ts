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
 * Provider de plată „Card prin Netopia mobilPay".
 *
 * Comanda se plasează cu plata autorizată (necapturată), apoi clientul e
 * trimis la mobilPay printr-un form POST cu {env_key, data} de la
 * `/store/netopia/session`. Confirmarea reală vine prin IPN pe
 * `/hooks/netopia`:
 *   - action=confirmed & error 0 → banii încasați → capturăm plata
 *   - action=canceled           → anulăm comanda
 *   - alte statusuri (paid_pending, confirmed_pending) → rămânem în așteptare
 */
export class NetopiaProviderService extends AbstractPaymentProvider {
  static identifier = 'netopia'

  // Constructorul AbstractPaymentProvider e protected; ModuleProvider cere
  // unul public.
  constructor(container: Record<string, unknown>, options?: Record<string, unknown>) {
    super(container, options)
  }

  async initiatePayment(
    input: InitiatePaymentInput
  ): Promise<InitiatePaymentOutput> {
    return {
      id: `ntp_${randomUUID()}`,
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
    // Apelată din IPN la action=confirmed — mobilPay a încasat deja banii.
    return { data: { ...(input.data ?? {}), netopia_status: 'confirmed' } }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return { data: { ...(input.data ?? {}), netopia_status: 'canceled' } }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: input.data }
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    const status = (input.data?.netopia_status as string) ?? undefined
    const map: Record<string, PaymentSessionStatus> = {
      confirmed: 'captured',
      canceled: 'canceled',
      credit: 'captured',
    }
    return { status: (status && map[status]) || 'authorized' }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    // Refund-urile se fac din admin-ul Netopia; aici doar consemnăm.
    return { data: { ...(input.data ?? {}), netopia_refund_requested: true } }
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
      'IPN-urile Netopia se procesează la /hooks/netopia'
    )
  }
}
