import { UCFIN_METHOD_LABEL } from "@lib/util/installments"

/**
 * Numele metodei de plată, așa cum l-a ales clientul în checkout.
 *
 * `pp_system_default` e ordinul de plată (transfer bancar), NU ramburs-ul —
 * ramburs-ul are providerul lui, `pp_cod_cod`.
 */
export const paymentLabelFor = (providerId?: string | null): string => {
  if (!providerId) return "Plată"
  if (providerId.startsWith("pp_cod")) return "Numerar la livrare (ramburs)"
  if (providerId.startsWith("pp_system_default"))
    return "Ordin de plată (transfer bancar)"
  if (providerId.startsWith("pp_netopia")) return "Card bancar"
  if (providerId.startsWith("pp_tbi")) return "Rate prin TBI Bank"
  if (providerId.startsWith("pp_unicredit"))
    return UCFIN_METHOD_LABEL
  return "Plată"
}

/**
 * Momentul încasării, doar dacă banii chiar au intrat.
 *
 * `payment.created_at` e momentul autorizării — la ramburs sau transfer asta
 * se întâmplă la plasarea comenzii, deci „Plătită la …" ar minți clientul.
 */
export const paymentCapturedAt = (
  payment?: { captured_at?: string | Date | null } | null
): string | null => {
  const at = payment?.captured_at
  return at
    ? new Date(at).toLocaleString("ro-RO", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null
}
