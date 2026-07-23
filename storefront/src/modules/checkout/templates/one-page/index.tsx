"use client"

/**
 * Checkout într-un singur pas, în designul site-ului: date de contact +
 * livrare + plată pe o coloană, rezumatul comenzii sticky pe cealaltă.
 * Fără pași ?step= — totul e vizibil și editabil simultan, iar butonul
 * „Finalizează comanda" face tot: salvează adresa, inițiază sesiunea de
 * plată și plasează comanda (sau redirecționează către Stripe/UniCredit).
 */

import { RadioGroup, Radio } from "@headlessui/react"
import { isStripeLike, isUnicredit, isManual, isCod, isTbi } from "@lib/constants"
import {
  initiatePaymentSession,
  placeFinancedOrder,
  placeOrder,
  saveCheckoutDetails,
  setShippingMethod,
  type CheckoutAddressPayload,
} from "@lib/data/cart"
import { calculatePriceForShippingOption } from "@lib/data/fulfillment"
import { convertToLocale } from "@lib/util/money"
import {
  UCFIN_GDPR_URL,
  availableTerms,
  supportsInstallments,
} from "@lib/util/installments"
import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"
import ItemsPreviewTemplate from "@modules/cart/templates/preview"
import DiscountCode from "@modules/checkout/components/discount-code"
import ErrorMessage from "@modules/checkout/components/error-message"
import {
  BankBadge,
  CashBadge,
  MastercardBadge,
  TbiBadge,
  UniCreditBadge,
  VisaBadge,
} from "@modules/checkout/components/payment-badges"
import { StripeContext } from "@modules/checkout/components/payment-wrapper/stripe-wrapper"
import CartTotals from "@modules/common/components/cart-totals"
import Input from "@modules/common/components/input"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Installments from "@modules/products/components/installments"
import SkeletonCardDetails from "@modules/skeletons/components/skeleton-card-details"
import {
  ArrowUUpLeft,
  Lock,
  ShieldCheck,
  Truck,
} from "@phosphor-icons/react/dist/ssr"
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import { useRouter, useSearchParams } from "next/navigation"
import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

/* ------------------------------------------------------------------ */
/* Metadatele metodelor de plată (ordinea, titluri RO, logo-uri)       */
/* ------------------------------------------------------------------ */

const METHOD_ORDER = [
  "pp_stripe_stripe",
  "pp_unicredit_unicredit",
  "pp_tbi_tbi",
  "pp_cod_cod",
  "pp_system_default",
]

const methodMeta = (
  id: string
): { title: string; description?: string; badges: React.ReactNode } | null => {
  if (isStripeLike(id)) {
    return {
      title: "Plată cu card – debit sau credit",
      description:
        "Plată securizată prin Stripe. Poți folosi și Klarna, Apple Pay sau Google Pay.",
      badges: (
        <>
          <VisaBadge />
          <MastercardBadge />
        </>
      ),
    }
  }
  if (isUnicredit(id)) {
    return {
      title: "Rate prin UniCredit Consumer Financing",
      description:
        "Credit online 100%, cu răspuns în maximum 15 minute. Vei fi redirecționat către UCFin pentru creditarea la distanță.",
      badges: <UniCreditBadge />,
    }
  }
  if (isTbi(id)) {
    return {
      title: "TBI Bank – plată în rate online",
      description:
        "Aplici online, fără card de credit. Vei fi redirecționat către TBI Bank, unde alegi numărul de rate și primești răspunsul pe loc.",
      badges: <TbiBadge />,
    }
  }
  if (isCod(id)) {
    return {
      title: "Numerar la livrare (ramburs)",
      description:
        "Plătești curierului, în numerar sau cu cardul, la primirea coletului.",
      badges: <CashBadge />,
    }
  }
  if (isManual(id)) {
    return {
      title: "Ordin de plată (transfer bancar)",
      description:
        "Îți trimitem pe email datele contului nostru. Comanda se procesează după confirmarea plății.",
      badges: <BankBadge />,
    }
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Formularul de adresă                                                */
/* ------------------------------------------------------------------ */

type AddressForm = {
  email: string
  phone: string
  first_name: string
  last_name: string
  address_1: string
  company: string
  city: string
  province: string
  postal_code: string
}

const emptyAddress = (): AddressForm => ({
  email: "",
  phone: "",
  first_name: "",
  last_name: "",
  address_1: "",
  company: "",
  city: "",
  province: "",
  postal_code: "",
})

const fromCart = (cart: any, customer: any): AddressForm => ({
  email: cart?.email || customer?.email || "",
  phone: cart?.shipping_address?.phone || customer?.phone || "",
  first_name: cart?.shipping_address?.first_name || customer?.first_name || "",
  last_name: cart?.shipping_address?.last_name || customer?.last_name || "",
  address_1: cart?.shipping_address?.address_1 || "",
  company: cart?.shipping_address?.company || "",
  city: cart?.shipping_address?.city || "",
  province: cart?.shipping_address?.province || "",
  postal_code: cart?.shipping_address?.postal_code || "",
})

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const missingFields = (f: AddressForm, billingSame: boolean, b: AddressForm) => {
  const missing: string[] = []
  if (!EMAIL_RE.test(f.email)) missing.push("email")
  if (!f.phone.trim()) missing.push("telefon")
  if (!f.first_name.trim()) missing.push("prenume")
  if (!f.last_name.trim()) missing.push("nume")
  if (!f.address_1.trim()) missing.push("adresă")
  if (!f.city.trim()) missing.push("oraș")
  if (!f.province.trim()) missing.push("județ")
  if (!f.postal_code.trim()) missing.push("cod poștal")
  if (!billingSame) {
    if (
      !b.first_name.trim() ||
      !b.last_name.trim() ||
      !b.address_1.trim() ||
      !b.city.trim() ||
      !b.postal_code.trim()
    ) {
      missing.push("adresă de facturare")
    }
  }
  return missing
}

const toPayload = (
  f: AddressForm,
  countryCode: string
): CheckoutAddressPayload => ({
  first_name: f.first_name,
  last_name: f.last_name,
  address_1: f.address_1,
  company: f.company,
  postal_code: f.postal_code,
  city: f.city,
  country_code: countryCode,
  province: f.province,
  phone: f.phone,
})

/* ------------------------------------------------------------------ */

type OnePageCheckoutProps = {
  cart: any
  customer: HttpTypes.StoreCustomer | null
  shippingMethods: HttpTypes.StoreCartShippingOption[]
  paymentMethods: { id: string }[]
}

const SectionCard = ({
  step,
  title,
  children,
}: {
  step: number
  title: string
  children: React.ReactNode
}) => (
  <section className="bg-white rounded-3xl p-5 lg:p-7 shadow-sm">
    <div className="flex items-center gap-3 mb-5">
      <span className="w-8 h-8 rounded-full bg-brand-dark text-white text-sm font-bold flex items-center justify-center shrink-0">
        {step}
      </span>
      <h2 className="font-serif text-2xl text-brand-dark leading-tight">
        {title}
      </h2>
    </div>
    {children}
  </section>
)

const OnePageCheckout = ({
  cart,
  customer,
  shippingMethods,
  paymentMethods,
}: OnePageCheckoutProps) => {
  const router = useRouter()
  const searchParams = useSearchParams()

  const countryCode =
    cart?.shipping_address?.country_code ||
    cart?.region?.countries?.[0]?.iso_2 ||
    "ro"

  /* ---------------- Adresă ---------------- */
  const [form, setForm] = useState<AddressForm>(() => fromCart(cart, customer))
  const [billing, setBilling] = useState<AddressForm>(() => emptyAddress())
  const [billingSame, setBillingSame] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setField = (name: keyof AddressForm, value: string) => {
    setForm((f) => ({ ...f, [name]: value }))
    setDirty(true)
  }
  const setBillingField = (name: keyof AddressForm, value: string) => {
    setBilling((f) => ({ ...f, [name]: value }))
    setDirty(true)
  }

  const persistAddress = async (current?: {
    form: AddressForm
    billing: AddressForm
    billingSame: boolean
  }) => {
    const f = current?.form ?? form
    const b = current?.billing ?? billing
    const same = current?.billingSame ?? billingSame
    if (!EMAIL_RE.test(f.email)) return // fără email valid, Medusa refuză
    setSaving(true)
    try {
      await saveCheckoutDetails({
        email: f.email,
        shipping_address: toPayload(f, countryCode),
        billing_address: same ? undefined : toPayload(b, countryCode),
      })
      setDirty(false)
    } catch {
      // Reîncercăm la finalizare; nu blocăm completarea formularului.
    } finally {
      setSaving(false)
    }
  }

  // Auto-salvare la 1,2s după ultima modificare — cart-ul de pe server rămâne
  // sincron (necesare pt. calculator rate + Stripe), fără buton „Continuă".
  useEffect(() => {
    if (!dirty) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void persistAddress()
    }, 1200)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, billing, billingSame])

  /* ---------------- Livrare ---------------- */
  const [shippingMethodId, setShippingMethodId] = useState<string | null>(
    cart.shipping_methods?.at(-1)?.shipping_option_id || null
  )
  const [shippingError, setShippingError] = useState<string | null>(null)
  const [calculatedPrices, setCalculatedPrices] = useState<
    Record<string, number>
  >({})

  useEffect(() => {
    const calculated = shippingMethods.filter(
      (sm) => sm.price_type === "calculated"
    )
    if (!calculated.length) return
    Promise.allSettled(
      calculated.map((sm) => calculatePriceForShippingOption(sm.id, cart.id))
    ).then((res) => {
      const map: Record<string, number> = {}
      res
        .filter(
          (r): r is PromiseFulfilledResult<any> => r.status === "fulfilled"
        )
        .forEach((r) => (map[r.value?.id || ""] = r.value?.amount))
      setCalculatedPrices(map)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const chooseShipping = async (id: string) => {
    setShippingError(null)
    const prev = shippingMethodId
    setShippingMethodId(id)
    try {
      await setShippingMethod({ cartId: cart.id, shippingMethodId: id })
    } catch (err: any) {
      setShippingMethodId(prev)
      setShippingError(err.message)
    }
  }

  // O singură opțiune de livrare → o selectăm automat.
  useEffect(() => {
    if (!shippingMethodId && shippingMethods.length === 1) {
      void chooseShipping(shippingMethods[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---------------- Plată ---------------- */
  const activeSession = cart.payment_collection?.payment_sessions?.find(
    (s: any) => s.status === "pending"
  )
  const [selectedPayment, setSelectedPayment] = useState<string>(
    activeSession?.provider_id ?? ""
  )
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [stripeComplete, setStripeComplete] = useState(false)
  const [gdprAccepted, setGdprAccepted] = useState(false)

  const cartTotal = cart?.total ?? 0
  const financingTerms = availableTerms(cartTotal)
  const financeable =
    supportsInstallments(cart?.currency_code) && financingTerms.length > 0
  const [creditMonths, setCreditMonths] = useState<number | null>(
    (activeSession?.data?.credit_period as number) ?? null
  )
  const selectedCreditMonths =
    creditMonths && financingTerms.includes(creditMonths)
      ? creditMonths
      : financingTerms[financingTerms.length - 1]

  const visibleMethods = useMemo(() => {
    const filtered = paymentMethods
      .filter((pm) => !pm.id.startsWith("pp_stripe-")) // sub-providerii Stripe
      .filter((pm) => !isUnicredit(pm.id) || financeable)
    return filtered.sort((a, b) => {
      const ia = METHOD_ORDER.indexOf(a.id)
      const ib = METHOD_ORDER.indexOf(b.id)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
  }, [paymentMethods, financeable])

  const hasTbi = paymentMethods.some((pm) => pm.id.startsWith("pp_tbi"))

  const choosePayment = async (id: string) => {
    setPaymentError(null)
    setSelectedPayment(id)
    try {
      if (isStripeLike(id)) {
        // Stripe are nevoie de sesiune imediat (PaymentElement cere client
        // secret); celelalte metode își creează sesiunea la finalizare.
        await initiatePaymentSession(cart, { provider_id: id })
      }
    } catch (err: any) {
      setPaymentError(err.message)
    }
  }

  /* ---------------- Finalizare ---------------- */
  const stripeReady = useContext(StripeContext)
  // useStripe/useElements pot trăi doar în interiorul <Elements>, care există
  // doar când sesiunea activă e Stripe — de aceea confirmarea vine printr-un
  // ref umplut de <StripeConfirmBridge/>, montat condiționat mai jos.
  const stripeConfirmRef = useRef<StripeConfirmFn | null>(null)

  const missing = missingFields(form, billingSame, billing)
  const canPlace =
    missing.length === 0 &&
    !!shippingMethodId &&
    !!selectedPayment &&
    (!isStripeLike(selectedPayment) || stripeComplete) &&
    (!isUnicredit(selectedPayment) || gdprAccepted)

  const disabledHint = !selectedPayment
    ? "Alege metoda de plată"
    : missing.length
      ? `Completează: ${missing.join(", ")}`
      : !shippingMethodId
        ? "Alege metoda de livrare"
        : isUnicredit(selectedPayment) && !gdprAccepted
          ? "Bifează acordul GDPR UCFin"
          : isStripeLike(selectedPayment) && !stripeComplete
            ? "Completează datele cardului"
            : null

  const [placing, setPlacing] = useState(false)
  const [placeError, setPlaceError] = useState<string | null>(null)

  const handlePlaceOrder = async () => {
    if (!canPlace || placing) return
    setPlacing(true)
    setPlaceError(null)
    try {
      if (dirty || !cart.email) {
        await persistAddress()
      }

      if (isStripeLike(selectedPayment)) {
        if (!stripeConfirmRef.current) {
          throw new Error("Plata cu cardul nu e încă pregătită. Reîncearcă.")
        }
        await stripeConfirmRef.current(form, countryCode)
        // confirmPayment fie redirecționează, fie rezolvă inline; ambele căi
        // sunt tratate în bridge — dacă ajungem aici fără eroare, comanda
        // e deja în curs de plasare.
      } else if (isUnicredit(selectedPayment)) {
        await initiatePaymentSession(cart, {
          provider_id: selectedPayment,
          data: { credit_period: selectedCreditMonths, gdpr: gdprAccepted },
        })
        await placeFinancedOrder("unicredit")
      } else if (isTbi(selectedPayment)) {
        await initiatePaymentSession(cart, {
          provider_id: selectedPayment,
        })
        await placeFinancedOrder("tbi")
      } else {
        const sessionOk =
          activeSession?.provider_id === selectedPayment
        if (!sessionOk) {
          await initiatePaymentSession(cart, { provider_id: selectedPayment })
        }
        await placeOrder()
      }
    } catch (err: any) {
      // redirect() aruncă NEXT_REDIRECT — nu e o eroare reală.
      if (err?.digest?.startsWith?.("NEXT_REDIRECT")) throw err
      setPlaceError(err.message)
      setPlacing(false)
    }
  }

  // Întoarcerea de la metodele Stripe cu redirect (Klarna, iDEAL…).
  useEffect(() => {
    const redirectStatus = searchParams.get("redirect_status")
    if (!redirectStatus) return
    if (redirectStatus === "succeeded") {
      setPlacing(true)
      placeOrder().catch((err) => {
        if (err?.digest?.startsWith?.("NEXT_REDIRECT")) throw err
        setPlaceError(err?.message || "Eroare la confirmarea comenzii.")
        setPlacing(false)
      })
    } else if (redirectStatus === "failed") {
      setPlaceError("Plata nu a reușit. Încearcă din nou sau alege altă metodă.")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  /* ---------------- Render ---------------- */
  return (
    <div className="content-container grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 lg:gap-8 py-6 lg:py-10">
      {/* Coloana stângă — formularele */}
      <div className="flex flex-col gap-5 min-w-0">
        {/* 1. Contact & livrare */}
        <SectionCard step={1} title="Datele tale">
          <div className="grid grid-cols-1 small:grid-cols-2 gap-3">
            <Input
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              required
              data-testid="shipping-email-input"
            />
            <Input
              label="Telefon"
              name="phone"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              required
              data-testid="shipping-phone-input"
            />
            <Input
              label="Prenume"
              name="first_name"
              autoComplete="given-name"
              value={form.first_name}
              onChange={(e) => setField("first_name", e.target.value)}
              required
              data-testid="shipping-first-name-input"
            />
            <Input
              label="Nume"
              name="last_name"
              autoComplete="family-name"
              value={form.last_name}
              onChange={(e) => setField("last_name", e.target.value)}
              required
              data-testid="shipping-last-name-input"
            />
            <div className="small:col-span-2">
              <Input
                label="Adresă (stradă, număr, bloc, apartament)"
                name="address_1"
                autoComplete="address-line1"
                value={form.address_1}
                onChange={(e) => setField("address_1", e.target.value)}
                required
                data-testid="shipping-address-input"
              />
            </div>
            <Input
              label="Oraș / localitate"
              name="city"
              autoComplete="address-level2"
              value={form.city}
              onChange={(e) => setField("city", e.target.value)}
              required
              data-testid="shipping-city-input"
            />
            <Input
              label="Județ"
              name="province"
              autoComplete="address-level1"
              value={form.province}
              onChange={(e) => setField("province", e.target.value)}
              required
              data-testid="shipping-province-input"
            />
            <Input
              label="Cod poștal"
              name="postal_code"
              autoComplete="postal-code"
              value={form.postal_code}
              onChange={(e) => setField("postal_code", e.target.value)}
              required
              data-testid="shipping-postal-code-input"
            />
            <Input
              label="Companie (opțional)"
              name="company"
              autoComplete="organization"
              value={form.company}
              onChange={(e) => setField("company", e.target.value)}
              data-testid="shipping-company-input"
            />
          </div>

          <label className="mt-4 flex items-center gap-2.5 text-sm text-brand-dark/80 cursor-pointer">
            <input
              type="checkbox"
              checked={billingSame}
              onChange={(e) => {
                setBillingSame(e.target.checked)
                setDirty(true)
              }}
              className="h-4 w-4 accent-brand-dark"
              data-testid="billing-address-checkbox"
            />
            Adresa de facturare este aceeași cu cea de livrare
          </label>

          {!billingSame && (
            <div className="mt-4 grid grid-cols-1 small:grid-cols-2 gap-3">
              <div className="small:col-span-2 text-xs font-bold uppercase tracking-[0.14em] text-brand-dark/50">
                Adresa de facturare
              </div>
              <Input
                label="Prenume"
                name="billing_first_name"
                value={billing.first_name}
                onChange={(e) => setBillingField("first_name", e.target.value)}
                required
              />
              <Input
                label="Nume"
                name="billing_last_name"
                value={billing.last_name}
                onChange={(e) => setBillingField("last_name", e.target.value)}
                required
              />
              <div className="small:col-span-2">
                <Input
                  label="Adresă"
                  name="billing_address_1"
                  value={billing.address_1}
                  onChange={(e) => setBillingField("address_1", e.target.value)}
                  required
                />
              </div>
              <Input
                label="Oraș / localitate"
                name="billing_city"
                value={billing.city}
                onChange={(e) => setBillingField("city", e.target.value)}
                required
              />
              <Input
                label="Județ"
                name="billing_province"
                value={billing.province}
                onChange={(e) => setBillingField("province", e.target.value)}
              />
              <Input
                label="Cod poștal"
                name="billing_postal_code"
                value={billing.postal_code}
                onChange={(e) =>
                  setBillingField("postal_code", e.target.value)
                }
                required
              />
              <Input
                label="Companie (opțional)"
                name="billing_company"
                value={billing.company}
                onChange={(e) => setBillingField("company", e.target.value)}
              />
            </div>
          )}

          <p
            className={clx(
              "mt-3 text-xs transition-opacity",
              saving ? "text-brand-dark/50 opacity-100" : "opacity-0"
            )}
            aria-live="polite"
          >
            Se salvează…
          </p>
        </SectionCard>

        {/* 2. Livrare */}
        <SectionCard step={2} title="Livrare">
          <RadioGroup
            value={shippingMethodId}
            onChange={(v: string | null) => v && chooseShipping(v)}
            className="flex flex-col gap-2"
          >
            {shippingMethods.map((option) => {
              const active = option.id === shippingMethodId
              const amount =
                option.price_type === "flat"
                  ? option.amount
                  : calculatedPrices[option.id]
              return (
                <Radio
                  key={option.id}
                  value={option.id}
                  data-testid="delivery-option-radio"
                  className={clx(
                    "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 cursor-pointer transition-colors",
                    active
                      ? "border-brand-dark bg-brand-light/60"
                      : "border-brand-dark/12 hover:border-brand-dark/40"
                  )}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span
                      className={clx(
                        "w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center",
                        active ? "border-brand-dark" : "border-brand-dark/30"
                      )}
                    >
                      {active && (
                        <span className="w-2 h-2 rounded-full bg-brand-dark" />
                      )}
                    </span>
                    <span className="text-sm font-bold text-brand-dark truncate">
                      {option.name}
                    </span>
                  </span>
                  <span className="text-sm font-bold text-brand-dark shrink-0">
                    {typeof amount === "number"
                      ? amount === 0
                        ? "Gratuit"
                        : convertToLocale({
                            amount,
                            currency_code: cart?.currency_code,
                          })
                      : "—"}
                  </span>
                </Radio>
              )
            })}
          </RadioGroup>
          <ErrorMessage
            error={shippingError}
            data-testid="delivery-option-error-message"
          />
        </SectionCard>

        {/* 3. Plată */}
        <SectionCard step={3} title="Plată">
          <p className="-mt-2 mb-4 text-xs text-brand-dark/55">
            Toate tranzacțiile sunt securizate și criptate.
          </p>
          <RadioGroup
            value={selectedPayment}
            onChange={(v: string) => v && choosePayment(v)}
            className="rounded-2xl border border-brand-dark/12 overflow-hidden divide-y divide-brand-dark/10"
          >
            {visibleMethods.map((pm) => {
              const meta = methodMeta(pm.id)
              if (!meta) return null
              const active = selectedPayment === pm.id
              return (
                <div key={pm.id}>
                  <Radio
                    value={pm.id}
                    data-testid={`payment-option-${pm.id}`}
                    className={clx(
                      "flex items-center justify-between gap-3 px-4 py-3.5 cursor-pointer transition-colors",
                      active ? "bg-brand-light/60" : "hover:bg-brand-light/30"
                    )}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <span
                        className={clx(
                          "w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center",
                          active ? "border-brand-dark" : "border-brand-dark/30"
                        )}
                      >
                        {active && (
                          <span className="w-2 h-2 rounded-full bg-brand-dark" />
                        )}
                      </span>
                      <span className="text-sm font-bold text-brand-dark">
                        {meta.title}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {meta.badges}
                    </span>
                  </Radio>

                  {active && (
                    <div className="border-t border-brand-dark/10 bg-brand-light/40 px-4 py-3 flex flex-col gap-3">
                      {meta.description && (
                        <p className="text-xs leading-relaxed text-brand-dark/70">
                          {meta.description}
                        </p>
                      )}

                      {isStripeLike(pm.id) &&
                        (stripeReady ? (
                          <StripeConfirmBridge confirmRef={stripeConfirmRef} />
                        ) : null)}
                      {isStripeLike(pm.id) &&
                        (stripeReady ? (
                          <PaymentElement
                            options={{
                              layout: {
                                type: "accordion",
                                defaultCollapsed: false,
                                radios: true,
                                spacedAccordionItems: true,
                              },
                              defaultValues: {
                                billingDetails: {
                                  address: { country: "RO" },
                                },
                              },
                            }}
                            onChange={(e) => {
                              setStripeComplete(e.complete)
                              setPaymentError(null)
                            }}
                          />
                        ) : (
                          <SkeletonCardDetails />
                        ))}

                      {isUnicredit(pm.id) && (
                        <>
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
                              de către UniCredit Consumer Financing IFN S.A.
                            </span>
                          </label>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* TBI Bank — vizibil, dar dezactivat până primim credențialele */}
            {!hasTbi && (
              <div
                className="flex items-center justify-between gap-3 px-4 py-3.5 opacity-55 cursor-not-allowed select-none"
                aria-disabled="true"
                title="Disponibil în curând"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className="w-4 h-4 rounded-full border-2 border-brand-dark/20 shrink-0" />
                  <span className="text-sm font-bold text-brand-dark">
                    TBI Bank – plată în rate online
                  </span>
                  <span className="rounded-full bg-brand-dark/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-dark/60">
                    în curând
                  </span>
                </span>
                <span className="shrink-0">
                  <TbiBadge />
                </span>
              </div>
            )}
          </RadioGroup>
          <ErrorMessage
            error={paymentError}
            data-testid="payment-method-error-message"
          />
        </SectionCard>
      </div>

      {/* Coloana dreaptă — rezumat + finalizare */}
      <div className="flex flex-col gap-5">
        <div className="bg-white rounded-3xl p-6 lg:p-7 shadow-sm flex flex-col gap-5 lg:sticky lg:top-6">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.2em] font-bold text-brand-dark/50">
              Rezumat
            </span>
            <h2 className="font-serif text-3xl text-brand-dark leading-tight">
              Comanda ta
            </h2>
          </div>

          <ItemsPreviewTemplate cart={cart} />

          <DiscountCode cart={cart} />

          <div className="border-t border-brand-dark/10" />

          <CartTotals totals={cart} />

          <button
            type="button"
            onClick={handlePlaceOrder}
            disabled={!canPlace || placing}
            data-testid="submit-order-button"
            className={clx(
              "w-full rounded-full px-6 py-4 font-bold text-sm flex items-center justify-center gap-2 transition-colors",
              canPlace && !placing
                ? "bg-brand-dark text-white hover:bg-brand-accent"
                : "bg-brand-dark/15 text-brand-dark/40 cursor-not-allowed"
            )}
          >
            <Lock size={16} weight="bold" />
            {placing
              ? "Se procesează…"
              : isUnicredit(selectedPayment) || isTbi(selectedPayment)
                ? "Trimite cererea de finanțare"
                : "Finalizează comanda"}
          </button>

          {disabledHint && !placing && (
            <p className="text-xs text-brand-dark/50 text-center -mt-2">
              {disabledHint}
            </p>
          )}
          <ErrorMessage error={placeError} data-testid="place-order-error" />

          <p className="text-xs leading-relaxed text-brand-dark/55 text-center">
            Prin plasarea comenzii confirmi că ai citit și ești de acord cu{" "}
            <LocalizedClientLink
              href="/termeni"
              className="underline underline-offset-2 hover:text-brand-accent"
            >
              termenii și condițiile
            </LocalizedClientLink>{" "}
            și cu{" "}
            <LocalizedClientLink
              href="/confidentialitate"
              className="underline underline-offset-2 hover:text-brand-accent"
            >
              politica de confidențialitate
            </LocalizedClientLink>
            .
          </p>
        </div>

        <ul className="bg-white rounded-3xl p-5 shadow-sm flex flex-col gap-2 text-sm">
          {[
            {
              Icon: Truck,
              title: "Livrare gratuită în România",
              note: "Pentru comenzi peste 1.000 lei",
            },
            {
              Icon: ArrowUUpLeft,
              title: "Retur în 14 zile",
              note: "Returnare gratuită, rambursare completă",
            },
            {
              Icon: ShieldCheck,
              title: "Garanție 2 ani",
              note: "Inclusă la fiecare comandă",
            },
          ].map(({ Icon, title, note }) => (
            <li key={title} className="flex items-center gap-3 px-2 py-2">
              <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center shrink-0">
                <Icon size={16} className="text-brand-dark" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-brand-dark leading-tight text-[13px]">
                  {title}
                </span>
                <span className="block text-xs text-brand-dark/55 leading-tight mt-0.5">
                  {note}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Stripe: useStripe/useElements pot fi apelate doar în interiorul     */
/* <Elements>. Bridge-ul se montează doar când contextul Stripe există */
/* și expune funcția de confirmare printr-un ref către checkout.       */
/* ------------------------------------------------------------------ */

type StripeConfirmFn = (form: AddressForm, countryCode: string) => Promise<void>

const StripeConfirmBridge = ({
  confirmRef,
}: {
  confirmRef: React.MutableRefObject<StripeConfirmFn | null>
}) => {
  const stripe = useStripe()
  const elements = useElements()

  useEffect(() => {
    confirmRef.current = async (form, countryCode) => {
      if (!stripe || !elements) {
        throw new Error("Plata cu cardul nu e încă pregătită. Reîncearcă.")
      }
      const returnUrl = `${window.location.origin}/${countryCode}/checkout`
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl,
          payment_method_data: {
            billing_details: {
              name: `${form.first_name} ${form.last_name}`.trim(),
              email: form.email,
              phone: form.phone || undefined,
              address: {
                city: form.city,
                country: countryCode.toUpperCase(),
                line1: form.address_1,
                postal_code: form.postal_code,
                state: form.province || undefined,
              },
            },
          },
        },
        redirect: "if_required",
      })
      if (error) {
        throw new Error(error.message || "Plata nu a reușit.")
      }
      if (
        paymentIntent &&
        (paymentIntent.status === "requires_capture" ||
          paymentIntent.status === "succeeded")
      ) {
        await placeOrder()
      }
      // Altfel: redirect off-site — browserul pleacă singur.
    }
    return () => {
      confirmRef.current = null
    }
  }, [stripe, elements, confirmRef])

  return null
}

export default OnePageCheckout
