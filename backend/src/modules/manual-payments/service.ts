import {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  BigNumberInput,
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
import {
  AbstractPaymentProvider,
  MathBN,
  MedusaError,
} from '@medusajs/framework/utils'
import { randomUUID } from 'crypto'

/**
 * Plafonul legal pentru încasările în numerar de la persoane fizice
 * (Legea 70/2015): 5.000 lei/persoană/zi. Curierul încasează exclusiv cash,
 * deci comenzile peste prag nu pot merge la ramburs — clientul plătește
 * online, cu cardul sau în rate.
 *
 * ATENȚIE: dublat în storefront (`src/lib/constants.tsx` → COD_MAX_AMOUNT),
 * unde ascunde metoda din checkout. Se schimbă în ambele locuri.
 */
export const COD_MAX_AMOUNT = 5000

/** Ramburs-ul e activ doar pe RON; plafonul e o normă fiscală românească. */
const COD_CURRENCY = 'ron'

/**
 * Plată la livrare (ramburs/numerar la curier). Nu mișcă bani online:
 * comanda se autorizează imediat, iar captura o face adminul când curierul
 * confirmă încasarea. Există separat de `pp_system_default` (folosit pentru
 * ordin de plată / transfer bancar) ca cele două metode să apară distinct
 * în checkout.
 */
export class CodProviderService extends AbstractPaymentProvider {
  static identifier = 'cod'

  /**
   * Filtrul din checkout ascunde metoda peste plafon, dar un POST direct pe
   * `/store/payment-collections/:id/payment-sessions` l-ar ocoli — de aceea
   * pragul se verifică aici, pe fiecare intrare care poartă o sumă.
   */
  private assertWithinCashLimit(
    amount: BigNumberInput | null | undefined,
    currencyCode?: string
  ): void {
    if (currencyCode && currencyCode.toLowerCase() !== COD_CURRENCY) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        'Plata la livrare este disponibilă doar pentru comenzile în lei'
      )
    }
    if (amount == null) {
      return
    }
    if (MathBN.gt(amount, COD_MAX_AMOUNT)) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Plata la livrare este disponibilă doar pentru comenzi de până la ${COD_MAX_AMOUNT} lei. ` +
          'Pentru sume mai mari, alege plata online cu cardul sau în rate.'
      )
    }
  }

  // Constructorul AbstractPaymentProvider e protected; ModuleProvider cere
  // unul public.
  constructor(container: Record<string, unknown>, options?: Record<string, unknown>) {
    super(container, options)
  }

  async initiatePayment(
    input: InitiatePaymentInput
  ): Promise<InitiatePaymentOutput> {
    this.assertWithinCashLimit(input.amount, input.currency_code)
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
    // Ultima verificare înainte de plasarea comenzii: coșul se poate fi mărit
    // după alegerea metodei, iar `complete-cart` nu compară suma autorizată
    // cu totalul.
    const data = input.data as Record<string, unknown> | undefined
    this.assertWithinCashLimit(
      data?.amount as BigNumberInput | undefined,
      data?.currency_code as string | undefined
    )
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
    this.assertWithinCashLimit(input.amount, input.currency_code)
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
