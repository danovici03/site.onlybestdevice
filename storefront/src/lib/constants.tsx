import React from "react"
import { CreditCard } from "@medusajs/icons"

import Ideal from "@modules/common/icons/ideal"
import Bancontact from "@modules/common/icons/bancontact"
import PayPal from "@modules/common/icons/paypal"

/* Map of payment provider_id to their title and icon. Add in any payment providers you want to use. */
export const paymentInfoMap: Record<
  string,
  { title: string; icon: React.JSX.Element }
> = {
  pp_stripe_stripe: {
    title: "Card, Klarna sau altele",
    icon: <CreditCard />,
  },
  pp_unicredit_unicredit: {
    title: "Rate prin UniCredit Consumer Financing",
    icon: <CreditCard />,
  },
  "pp_medusa-payments_default": {
    title: "Credit card",
    icon: <CreditCard />,
  },
  "pp_stripe-ideal_stripe": {
    title: "iDeal",
    icon: <Ideal />,
  },
  "pp_stripe-bancontact_stripe": {
    title: "Bancontact",
    icon: <Bancontact />,
  },
  pp_paypal_paypal: {
    title: "PayPal",
    icon: <PayPal />,
  },
  pp_system_default: {
    title: "Bonifico bancario",
    icon: <CreditCard />,
  },
  // Add more payment providers here
}

// This only checks if it is native stripe or medusa payments for card payments, it ignores the other stripe-based providers
export const isStripeLike = (providerId?: string) => {
  return (
    providerId?.startsWith("pp_stripe_") || providerId?.startsWith("pp_medusa-")
  )
}

export const isPaypal = (providerId?: string) => {
  return providerId?.startsWith("pp_paypal")
}
export const isManual = (providerId?: string) => {
  return providerId?.startsWith("pp_system_default")
}

/** Rate prin UniCredit Consumer Financing (ePOS) — flux redirect + callback. */
export const isUnicredit = (providerId?: string) => {
  return providerId?.startsWith("pp_unicredit")
}

/** Plată la livrare (ramburs) — provider manual propriu. */
export const isCod = (providerId?: string) => {
  return providerId?.startsWith("pp_cod")
}

/**
 * Plafonul legal pentru încasările în numerar de la persoane fizice
 * (Legea 70/2015): 5.000 lei/persoană/zi. Curierul încasează exclusiv cash,
 * deci peste prag ramburs-ul nu e o opțiune.
 *
 * ATENȚIE: dublat în backend (`src/modules/manual-payments/service.ts`), unde
 * respinge sesiunea chiar dacă cineva ocolește interfața. Se schimbă în ambele.
 */
export const COD_MAX_AMOUNT = 5000

/** Moneda pe care e activ ramburs-ul; plafonul e o normă fiscală românească. */
const COD_CURRENCY = "ron"

/** Ramburs-ul e disponibil doar sub plafonul de numerar, și doar în lei. */
export const codAvailable = (total: number, currencyCode?: string) => {
  return currencyCode?.toLowerCase() === COD_CURRENCY && total <= COD_MAX_AMOUNT
}

/** Rate prin TBI Bank (eCommerce API) — flux redirect + callback criptat. */
export const isTbi = (providerId?: string) => {
  return providerId?.startsWith("pp_tbi")
}

/** Card prin Netopia mobilPay — form POST criptat + IPN. */
export const isNetopia = (providerId?: string) => {
  return providerId?.startsWith("pp_netopia")
}

// Add currencies that don't need to be divided by 100
export const noDivisionCurrencies = [
  "krw",
  "jpy",
  "vnd",
  "clp",
  "pyg",
  "xaf",
  "xof",
  "bif",
  "djf",
  "gnf",
  "kmf",
  "mga",
  "rwf",
  "xpf",
  "htg",
  "vuv",
  "xag",
  "xdr",
  "xau",
]
