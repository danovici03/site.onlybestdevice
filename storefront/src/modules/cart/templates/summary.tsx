"use client"

import CartTotals from "@modules/common/components/cart-totals"
import DiscountCode from "@modules/checkout/components/discount-code"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"
import {
  ArrowRight,
  ArrowUUpLeft,
  Lock,
  ShieldCheck,
  Truck,
} from "@phosphor-icons/react/dist/ssr"

type SummaryProps = {
  cart: HttpTypes.StoreCart & {
    promotions: HttpTypes.StorePromotion[]
  }
}

function getCheckoutStep(cart: HttpTypes.StoreCart) {
  if (!cart?.shipping_address?.address_1 || !cart.email) {
    return "address"
  } else if (cart?.shipping_methods?.length === 0) {
    return "delivery"
  } else {
    return "payment"
  }
}

const Summary = ({ cart }: SummaryProps) => {
  const step = getCheckoutStep(cart)

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white rounded-3xl p-6 lg:p-7 shadow-sm flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.2em] font-bold text-brand-dark/50">
            Rezumat
          </span>
          <h2 className="font-serif text-3xl text-brand-dark leading-tight">
            Comanda ta
          </h2>
        </div>

        <DiscountCode cart={cart} />

        <div className="border-t border-brand-dark/10" />

        <CartTotals totals={cart} />

        <LocalizedClientLink
          href={"/checkout?step=" + step}
          data-testid="checkout-button"
        >
          <button
            type="button"
            className="w-full bg-brand-dark text-white rounded-full px-6 py-4 font-bold text-sm flex items-center justify-center gap-2 hover:bg-brand-accent transition-colors"
          >
            <Lock size={16} weight="bold" />
            <span>Mergi la finalizare</span>
            <ArrowRight size={16} weight="bold" />
          </button>
        </LocalizedClientLink>

        <p className="text-xs text-brand-dark/50 text-center">
          Plată sigură · Livrare cu tracking · TVA inclus
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
            title: "Reso entro 14 giorni",
            note: "Restituzione gratuita, rimborso completo",
          },
          {
            Icon: ShieldCheck,
            title: "Garanzia 2 anni",
            note: "Inclusa con ogni acquisto",
          },
        ].map(({ Icon, title, note }) => (
          <li
            key={title}
            className="flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-brand-light/60 transition-colors"
          >
            <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center shrink-0">
              <Icon size={16} weight="regular" className="text-brand-dark" />
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
  )
}

export default Summary
