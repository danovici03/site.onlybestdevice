"use client"

import { RadioGroup } from "@headlessui/react"
import { isStripeLike, isUnicredit, paymentInfoMap } from "@lib/constants"
import { initiatePaymentSession, placeOrder } from "@lib/data/cart"
import {
  UCFIN_GDPR_URL,
  availableTerms,
  supportsInstallments,
} from "@lib/util/installments"
import Installments from "@modules/products/components/installments"
import { CheckCircleSolid, CreditCard } from "@medusajs/icons"
import { Button, Container, Heading, Text, clx } from "@medusajs/ui"
import ErrorMessage from "@modules/checkout/components/error-message"
import PaymentContainer, {
  StripePaymentContainer,
} from "@modules/checkout/components/payment-container"
import Divider from "@modules/common/components/divider"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

// Hide the per-method Stripe sub-providers (stripe-bancontact, stripe-blik, …).
// The unified `pp_stripe_stripe` provider drives Stripe's PaymentElement, which
// surfaces every method enabled in the Stripe Dashboard (cards, Klarna, etc.).
const isHiddenStripeSubprovider = (id?: string) =>
  !!id && id.startsWith("pp_stripe-")

const Payment = ({
  cart,
  availablePaymentMethods,
}: {
  cart: any
  availablePaymentMethods: any[]
}) => {
  const activeSession = cart.payment_collection?.payment_sessions?.find(
    (paymentSession: any) => paymentSession.status === "pending"
  )

  // Ratele UniCredit apar doar când totalul coșului e finanțabil (RON,
  // 1.000–50.000 lei) — în afara pragurilor UCFin metoda dispare.
  const cartTotal = cart?.total ?? 0
  const financeable =
    supportsInstallments(cart?.currency_code) &&
    availableTerms(cartTotal).length > 0

  const visiblePaymentMethods = availablePaymentMethods.filter(
    (pm) =>
      !isHiddenStripeSubprovider(pm.id) && (!isUnicredit(pm.id) || financeable)
  )

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentMethodLabel, setPaymentMethodLabel] = useState<string | null>(
    null
  )
  const [stripeReady, setStripeReady] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(
    activeSession?.provider_id ?? ""
  )

  // Rate UniCredit: numărul de rate ales + acordul GDPR UCFin (obligatoriu).
  const financingTerms = availableTerms(cartTotal)
  const [creditMonths, setCreditMonths] = useState<number | null>(
    (activeSession?.data?.credit_period as number) ?? null
  )
  const [gdprAccepted, setGdprAccepted] = useState(false)
  const selectedCreditMonths =
    creditMonths && financingTerms.includes(creditMonths)
      ? creditMonths
      : financingTerms[financingTerms.length - 1]

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const isOpen = searchParams.get("step") === "payment"

  const setPaymentMethod = async (method: string) => {
    setError(null)
    setSelectedPaymentMethod(method)
    if (isStripeLike(method)) {
      await initiatePaymentSession(cart, {
        provider_id: method,
      })
    }
  }

  const paidByGiftcard =
    cart?.gift_cards && cart?.gift_cards?.length > 0 && cart?.total === 0

  const paymentReady =
    (activeSession && cart?.shipping_methods.length !== 0) || paidByGiftcard

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams)
      params.set(name, value)

      return params.toString()
    },
    [searchParams]
  )

  const handleEdit = () => {
    router.push(pathname + "?" + createQueryString("step", "payment"), {
      scroll: false,
    })
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    try {
      const shouldInputCard =
        isStripeLike(selectedPaymentMethod) && !activeSession

      const checkActiveSession =
        activeSession?.provider_id === selectedPaymentMethod

      if (isUnicredit(selectedPaymentMethod)) {
        // Re-inițiem mereu sesiunea ca numărul de rate ales să fie cel curent;
        // backend-ul îl folosește la crearea cererii de credit în ePOS.
        await initiatePaymentSession(cart, {
          provider_id: selectedPaymentMethod,
          data: {
            credit_period: selectedCreditMonths,
            gdpr: gdprAccepted,
          },
        })
      } else if (!checkActiveSession) {
        await initiatePaymentSession(cart, {
          provider_id: selectedPaymentMethod,
        })
      }

      if (!shouldInputCard) {
        return router.push(
          pathname + "?" + createQueryString("step", "review"),
          {
            scroll: false,
          }
        )
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  // When Stripe redirects back from an off-site method (Klarna, iDEAL, …) the
  // URL contains ?redirect_status=succeeded. Complete the order automatically.
  useEffect(() => {
    const redirectStatus = searchParams.get("redirect_status")
    if (!redirectStatus) return

    if (redirectStatus === "succeeded") {
      setIsLoading(true)
      placeOrder().catch((err) => {
        setError(err?.message || "Eroare la confirmarea comenzii.")
        setIsLoading(false)
      })
    } else if (redirectStatus === "failed") {
      setError(
        "Plata nu a reușit. Încearcă din nou sau alege altă metodă."
      )
    }
  }, [searchParams])

  useEffect(() => {
    setError(null)
  }, [isOpen])

  return (
    <div className="bg-white">
      <div className="flex flex-row items-center justify-between mb-6">
        <Heading
          level="h2"
          className={clx(
            "flex flex-row text-3xl-regular gap-x-2 items-baseline",
            {
              "opacity-50 pointer-events-none select-none":
                !isOpen && !paymentReady,
            }
          )}
        >
          Payment
          {!isOpen && paymentReady && <CheckCircleSolid />}
        </Heading>
        {!isOpen && paymentReady && (
          <Text>
            <button
              onClick={handleEdit}
              className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
              data-testid="edit-payment-button"
            >
              Edit
            </button>
          </Text>
        )}
      </div>
      <div>
        <div className={isOpen ? "block" : "hidden"}>
          {!paidByGiftcard && visiblePaymentMethods?.length && (
            <>
              <RadioGroup
                value={selectedPaymentMethod}
                onChange={(value: string) => setPaymentMethod(value)}
              >
                {visiblePaymentMethods.map((paymentMethod) => (
                  <div key={paymentMethod.id}>
                    {isStripeLike(paymentMethod.id) ? (
                      <StripePaymentContainer
                        paymentProviderId={paymentMethod.id}
                        selectedPaymentOptionId={selectedPaymentMethod}
                        paymentInfoMap={paymentInfoMap}
                        setPaymentMethodLabel={setPaymentMethodLabel}
                        setError={setError}
                        setStripeReady={setStripeReady}
                      />
                    ) : (
                      <>
                        <PaymentContainer
                          paymentInfoMap={paymentInfoMap}
                          paymentProviderId={paymentMethod.id}
                          selectedPaymentOptionId={selectedPaymentMethod}
                        />
                        {isUnicredit(paymentMethod.id) &&
                          selectedPaymentMethod === paymentMethod.id && (
                            <div className="mt-3 mb-4 flex flex-col gap-3">
                              <Installments
                                amount={cartTotal}
                                currency={cart?.currency_code}
                                compact
                                initialMonths={selectedCreditMonths}
                                onSelectMonths={setCreditMonths}
                              />
                              <label className="flex items-start gap-2.5 rounded-2xl border border-brand-dark/10 bg-white px-4 py-3 text-xs leading-relaxed text-brand-dark/70 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={gdprAccepted}
                                  onChange={(e) =>
                                    setGdprAccepted(e.target.checked)
                                  }
                                  className="mt-0.5 h-4 w-4 shrink-0 accent-brand-dark"
                                  data-testid="ucfin-gdpr-checkbox"
                                />
                                <span>
                                  Am luat la cunoștință și sunt de acord cu{" "}
                                  <a
                                    href={UCFIN_GDPR_URL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-bold underline underline-offset-2 hover:text-brand-accent"
                                  >
                                    nota de informare cu privire la prelucrarea
                                    datelor cu caracter personal
                                  </a>{" "}
                                  de către UniCredit Consumer Financing IFN
                                  S.A.
                                </span>
                              </label>
                            </div>
                          )}
                      </>
                    )}
                  </div>
                ))}
              </RadioGroup>
            </>
          )}

          {paidByGiftcard && (
            <div className="flex flex-col w-1/3">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">
                Payment method
              </Text>
              <Text
                className="txt-medium text-ui-fg-subtle"
                data-testid="payment-method-summary"
              >
                Gift card
              </Text>
            </div>
          )}

          <ErrorMessage
            error={error}
            data-testid="payment-method-error-message"
          />

          <Button
            size="large"
            className="mt-6"
            onClick={handleSubmit}
            isLoading={isLoading}
            disabled={
              (isStripeLike(selectedPaymentMethod) && !stripeReady) ||
              (isUnicredit(selectedPaymentMethod) && !gdprAccepted) ||
              (!selectedPaymentMethod && !paidByGiftcard)
            }
            data-testid="submit-payment-button"
          >
            {!activeSession && isStripeLike(selectedPaymentMethod)
              ? "Introdu datele de plată"
              : "Continuă spre verificare"}
          </Button>
        </div>

        <div className={isOpen ? "hidden" : "block"}>
          {cart && paymentReady && activeSession ? (
            <div className="flex items-start gap-x-1 w-full">
              <div className="flex flex-col w-1/3">
                <Text className="txt-medium-plus text-ui-fg-base mb-1">
                  Payment method
                </Text>
                <Text
                  className="txt-medium text-ui-fg-subtle"
                  data-testid="payment-method-summary"
                >
                  {paymentInfoMap[activeSession?.provider_id]?.title ||
                    activeSession?.provider_id}
                </Text>
              </div>
              <div className="flex flex-col w-1/3">
                <Text className="txt-medium-plus text-ui-fg-base mb-1">
                  Payment details
                </Text>
                <div
                  className="flex gap-2 txt-medium text-ui-fg-subtle items-center"
                  data-testid="payment-details-summary"
                >
                  <Container className="flex items-center h-7 w-fit p-2 bg-ui-button-neutral-hover">
                    {paymentInfoMap[selectedPaymentMethod]?.icon || (
                      <CreditCard />
                    )}
                  </Container>
                  <Text>
                    {isStripeLike(selectedPaymentMethod) && paymentMethodLabel
                      ? paymentMethodLabel
                      : "Se va deschide un pas următor"}
                  </Text>
                </div>
              </div>
            </div>
          ) : paidByGiftcard ? (
            <div className="flex flex-col w-1/3">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">
                Payment method
              </Text>
              <Text
                className="txt-medium text-ui-fg-subtle"
                data-testid="payment-method-summary"
              >
                Gift card
              </Text>
            </div>
          ) : null}
        </div>
      </div>
      <Divider className="mt-8" />
    </div>
  )
}

export default Payment
