"use client"

import { convertToLocale } from "@lib/util/money"
import React from "react"

type CartTotalsProps = {
  totals: {
    total?: number | null
    subtotal?: number | null
    tax_total?: number | null
    currency_code: string
    item_subtotal?: number | null
    shipping_subtotal?: number | null
    discount_subtotal?: number | null
  }
}

const CartTotals: React.FC<CartTotalsProps> = ({ totals }) => {
  const {
    currency_code,
    total,
    tax_total,
    item_subtotal,
    shipping_subtotal,
    discount_subtotal,
  } = totals

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-y-2 text-sm text-brand-dark/70">
        <div className="flex items-center justify-between">
          <span>Subtotal</span>
          <span
            className="text-brand-dark tabular-nums"
            data-testid="cart-subtotal"
            data-value={item_subtotal || 0}
          >
            {convertToLocale({ amount: item_subtotal ?? 0, currency_code })}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Livrare</span>
          <span
            className="text-brand-dark tabular-nums"
            data-testid="cart-shipping"
            data-value={shipping_subtotal || 0}
          >
            {shipping_subtotal
              ? convertToLocale({
                  amount: shipping_subtotal,
                  currency_code,
                })
              : "Da calcolare"}
          </span>
        </div>
        {!!discount_subtotal && (
          <div className="flex items-center justify-between">
            <span>Reducere</span>
            <span
              className="text-brand-accent font-bold tabular-nums"
              data-testid="cart-discount"
              data-value={discount_subtotal || 0}
            >
              −{" "}
              {convertToLocale({
                amount: discount_subtotal ?? 0,
                currency_code,
              })}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span>IVA</span>
          <span
            className="text-brand-dark tabular-nums"
            data-testid="cart-taxes"
            data-value={tax_total || 0}
          >
            {convertToLocale({ amount: tax_total ?? 0, currency_code })}
          </span>
        </div>
      </div>
      <div className="border-t border-brand-dark/10" />
      <div className="flex items-baseline justify-between">
        <span className="font-serif text-lg text-brand-dark">Total</span>
        <span
          className="font-serif text-2xl text-brand-dark tabular-nums"
          data-testid="cart-total"
          data-value={total || 0}
        >
          {convertToLocale({ amount: total ?? 0, currency_code })}
        </span>
      </div>
    </div>
  )
}

export default CartTotals
