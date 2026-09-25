/**
 * Metoda de plată a unei comenzi, pe înțelesul celui care o pregătește.
 *
 * Medusa ține doar id-ul providerului (`pp_tbi_tbi`, `pp_cod_cod`), pe care
 * adminul îl afișează ca atare — și doar pe desktop. Din el nu se înțelege că
 * „tbi” înseamnă că banii vin de la bancă după aprobarea creditului, nu de la
 * client. Aici sunt trei familii (ramburs, card, partener) plus numele exact
 * al partenerului, folosite la fel în emailul intern și în admin.
 *
 * Fișierul nu importă nimic: îl folosește și bundle-ul de admin.
 */

export type PaymentMethodGroup =
  | "cod"
  | "card"
  | "partner"
  | "bank_transfer"
  | "unknown"

export type PaymentMethod = {
  providerId: string
  group: PaymentMethodGroup
  /** „Plată ramburs”, „Plată cu cardul”, „Plată prin partener”, „Ordin de plată”. */
  label: string
  /** Cine procesează efectiv: „TBI Bank, credit în rate”, „Netopia”… */
  detail: string
  /** Pentru subiectul emailului: „Ramburs”, „Card”, „Rate TBI”. */
  short: string
}

const GROUP_LABEL: Record<PaymentMethodGroup, string> = {
  cod: "Plată ramburs",
  card: "Plată cu cardul",
  partner: "Plată prin partener",
  bank_transfer: "Ordin de plată",
  unknown: "Metodă necunoscută",
}

// Cheia e partea din mijloc a id-ului: `pp_<cheie>_<identifier>`.
const PROVIDERS: Record<
  string,
  { group: PaymentMethodGroup; detail: string; short: string }
> = {
  cod: {
    group: "cod",
    detail: "numerar la curier",
    short: "Ramburs",
  },
  netopia: { group: "card", detail: "Netopia", short: "Card" },
  stripe: { group: "card", detail: "Stripe", short: "Card" },
  tbi: {
    group: "partner",
    detail: "TBI Bank, credit în rate",
    short: "Rate TBI",
  },
  unicredit: {
    group: "partner",
    detail: "UniCredit Consumer Financing, credit în rate",
    short: "Rate UniCredit",
  },
  system: {
    group: "bank_transfer",
    detail: "transfer bancar în contul firmei",
    short: "Ordin de plată",
  },
}

/**
 * Providerul comenzii: întâi de pe sesiune, apoi de pe plata efectivă.
 *
 * Invers față de `resolvePaymentProvider` din ERP, cu intenție: linkul de
 * plată mută o comandă cu ordin de plată pe card înlocuind doar sesiunea, iar
 * IPN-ul Netopia capturează plata existentă — care rămâne pe
 * `pp_system_default`. Sesiunea e cea care spune cum a plătit clientul.
 */
export const resolvePaymentProviderId = (order: any): string | null => {
  const collections = order?.payment_collections ?? []
  const fromSession = collections
    .flatMap((pc: any) => pc?.payment_sessions ?? [])
    .find((s: any) => s?.provider_id)?.provider_id
  if (fromSession) return fromSession
  return (
    collections
      .flatMap((pc: any) => pc?.payments ?? [])
      .find((p: any) => p?.provider_id)?.provider_id ?? null
  )
}

export const describePaymentProvider = (
  providerId: string | null | undefined
): PaymentMethod | null => {
  if (!providerId) return null
  const key = providerId.split("_")[1] ?? providerId
  const known = PROVIDERS[key]
  if (!known) {
    // Provider nou, încă nemapat: măcar id-ul, nu un rând gol.
    return {
      providerId,
      group: "unknown",
      label: GROUP_LABEL.unknown,
      detail: providerId,
      short: providerId,
    }
  }
  return {
    providerId,
    group: known.group,
    label: GROUP_LABEL[known.group],
    detail: known.detail,
    short: known.short,
  }
}

export const describeOrderPayment = (order: any): PaymentMethod | null =>
  describePaymentProvider(resolvePaymentProviderId(order))

/** „Plată prin partener — TBI Bank, credit în rate”. */
export const paymentMethodText = (method: PaymentMethod): string =>
  `${method.label} — ${method.detail}`
