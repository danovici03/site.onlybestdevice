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
import { EposClientOptions } from './client'

/**
 * Provider de plată „Rate prin UniCredit Consumer Financing" (ePOS).
 *
 * Banii nu se mișcă prin acest provider: după plasarea comenzii, storefront-ul
 * cere `/store/unicredit/session`, care creează cererea de credit în ePOS și
 * redirecționează clientul acolo. Statusul final vine prin callback-ul
 * `/hooks/unicredit`:
 *   - Disbursed → coșul a fost finanțat → capturăm plata, comanda se livrează
 *   - Rejected / Cancelled → anulăm comanda
 *
 * Până la callback, plata rămâne „authorized" (autorizată, necapturată) —
 * echivalentul „în așteptare finanțare".
 */
export class UnicreditEposProviderService extends AbstractPaymentProvider<EposClientOptions> {
  static identifier = 'unicredit'

  // Constructorul AbstractPaymentProvider e protected; ModuleProvider cere
  // unul public.
  constructor(container: Record<string, unknown>, options: EposClientOptions) {
    super(container, options)
  }

  async initiatePayment(
    input: InitiatePaymentInput
  ): Promise<InitiatePaymentOutput> {
    // Sesiunea ePOS reală se creează abia după plasarea comenzii (avem nevoie
    // de order id ca external_id). Aici doar reținem alegerea clientului
    // (numărul de rate + acordul GDPR) venită din checkout.
    return {
      id: `ucfin_${randomUUID()}`,
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
    // Autorizăm ca să se poată plasa comanda; captura vine doar la Disbursed.
    return { status: 'authorized', data: input.data }
  }

  async capturePayment(
    input: CapturePaymentInput
  ): Promise<CapturePaymentOutput> {
    // Apelată din callback la Disbursed — banii vin de la UCFin, nu avem
    // nimic de cerut în plus către ePOS.
    return { data: { ...(input.data ?? {}), ucfin_status: 'disbursed' } }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return { data: { ...(input.data ?? {}), ucfin_status: 'cancelled' } }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: input.data }
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    const status = (input.data?.ucfin_status as string) ?? undefined
    const map: Record<string, PaymentSessionStatus> = {
      disbursed: 'captured',
      rejected: 'error',
      cancelled: 'canceled',
    }
    return { status: (status && map[status]) || 'authorized' }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    // Rambursările la credite se reglează direct cu UCFin (retur/retragere),
    // nu printr-un API — marcăm doar în datele plății.
    return { data: { ...(input.data ?? {}), ucfin_refund_requested: true } }
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
    // Statusurile UCFin intră prin ruta noastră dedicată /hooks/unicredit,
    // nu prin mecanismul generic de webhook-uri al modulului de plăți.
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Callback-urile UniCredit se procesează la /hooks/unicredit'
    )
  }
}
