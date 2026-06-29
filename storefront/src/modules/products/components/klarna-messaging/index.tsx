"use client"

import {
  Stripe,
  StripeElements,
  StripePaymentMethodMessagingElement,
  StripePaymentMethodMessagingElementOptions,
  loadStripe,
} from "@stripe/stripe-js"
import { useEffect, useRef, useState } from "react"

const stripeKey =
  process.env.NEXT_PUBLIC_STRIPE_KEY ||
  process.env.NEXT_PUBLIC_MEDUSA_PAYMENTS_PUBLISHABLE_KEY

let stripePromise: Promise<Stripe | null> | null = null
const getStripe = () => {
  if (!stripeKey) return null
  if (!stripePromise) stripePromise = loadStripe(stripeKey)
  return stripePromise
}

type SupportedCurrency = StripePaymentMethodMessagingElementOptions["currency"]
type SupportedCountry = NonNullable<
  StripePaymentMethodMessagingElementOptions["countryCode"]
>

type KlarnaMessagingProps = {
  /** Price in major currency units (e.g. 159.97 EUR). */
  amount: number
  /** ISO 4217 currency code; case-insensitive. Defaults to EUR. */
  currency?: string
  /** ISO 3166-1 alpha-2 country code; case-insensitive. Defaults to IT. */
  countryCode?: string
  /** Locale forwarded to Stripe Elements. Defaults to "it". */
  locale?: string
}

const MIN_AMOUNT = 1
const MAX_AMOUNT = 10_000_000

const KlarnaMessaging = ({
  amount,
  currency = "EUR",
  countryCode = "IT",
  locale = "it",
}: KlarnaMessagingProps) => {
  const ref = useRef<HTMLDivElement | null>(null)
  const elementsRef = useRef<StripeElements | null>(null)
  const messagingRef = useRef<StripePaymentMethodMessagingElement | null>(null)
  const [hasError, setHasError] = useState(false)

  const amountInCents =
    Number.isFinite(amount) && amount >= MIN_AMOUNT && amount <= MAX_AMOUNT
      ? Math.round(amount * 100)
      : null

  const upperCurrency = currency.toUpperCase() as SupportedCurrency
  const upperCountry = countryCode.toUpperCase() as SupportedCountry

  useEffect(() => {
    if (!amountInCents || !ref.current) return
    const stripePromise = getStripe()
    if (!stripePromise) return

    let cancelled = false

    stripePromise
      .then((stripe) => {
        if (!stripe || cancelled || !ref.current) return
        if (!elementsRef.current) {
          elementsRef.current = stripe.elements({
            locale: locale as never,
          })
        }
        const options: StripePaymentMethodMessagingElementOptions = {
          amount: amountInCents,
          currency: upperCurrency,
          paymentMethodTypes: ["klarna"],
          countryCode: upperCountry,
        }
        if (!messagingRef.current) {
          const element = elementsRef.current.create(
            "paymentMethodMessaging",
            options
          )
          element.mount(ref.current)
          messagingRef.current = element
        } else {
          messagingRef.current.update(options)
        }
      })
      .catch(() => {
        if (!cancelled) setHasError(true)
      })

    return () => {
      cancelled = true
    }
  }, [amountInCents, upperCurrency, upperCountry, locale])

  useEffect(() => {
    return () => {
      if (messagingRef.current) {
        messagingRef.current.unmount()
        messagingRef.current = null
      }
      elementsRef.current = null
    }
  }, [])

  if (!stripeKey || hasError || !amountInCents) return null

  return <div ref={ref} className="min-h-[24px]" />
}

export default KlarnaMessaging
