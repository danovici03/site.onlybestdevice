"use client"

import { Table, Text } from "@medusajs/ui"
import { deleteLineItem, updateLineItem } from "@lib/data/cart"
import { useSessionRefresh } from "@lib/context/session-context"
import { HttpTypes } from "@medusajs/types"
import ErrorMessage from "@modules/checkout/components/error-message"
import LineItemOptions from "@modules/common/components/line-item-options"
import LineItemPrice from "@modules/common/components/line-item-price"
import LineItemUnitPrice from "@modules/common/components/line-item-unit-price"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Spinner from "@modules/common/icons/spinner"
import Thumbnail from "@modules/products/components/thumbnail"
import WarrantyOffer from "@modules/cart/components/warranty-offer"
import { warrantyTargetTitle } from "@lib/util/warranty"
import { Minus, Plus, Trash } from "@phosphor-icons/react/dist/ssr"
import { useState } from "react"

type ItemProps = {
  item: HttpTypes.StoreCartLineItem
  type?: "full" | "preview"
  currencyCode: string
  /** Produsul de serviciu „Garanție extinsă", pentru propunerea din coș. */
  warranty?: HttpTypes.StoreProduct
  /** Calculat de template: produsul ăsta n-are încă garanție în coș. */
  offerWarranty?: boolean
  /** În rezumatul de finalizare, doar liniile adăugabile de acolo se pot scoate. */
  removable?: boolean
}

const Item = ({
  item,
  type = "full",
  currencyCode,
  warranty,
  offerWarranty,
  removable,
}: ItemProps) => {
  const refresh = useSessionRefresh()
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pe liniile de garanție arătăm ce produs acoperă — cu două telefoane în coș,
  // altfel n-ai cum să știi la care se referă.
  const warrantyFor = warrantyTargetTitle(item)

  const maxQuantity = 10

  const changeQuantity = async (quantity: number) => {
    setError(null)
    setUpdating(true)

    await updateLineItem({ lineId: item.id, quantity })
      .catch((err) => setError(err.message))
      .finally(() => setUpdating(false))
    // Ține bulina din header sincronizată: pagina de coș se re-randează singură
    // pe server, dar header-ul își ia acum coșul din browser.
    await refresh()
  }

  const handleDelete = async () => {
    setDeleting(true)
    await deleteLineItem(item.id).catch(() => setDeleting(false))
    await refresh()
  }

  if (type === "preview") {
    return (
      <Table.Row className="w-full" data-testid="product-row">
        <Table.Cell className="!pl-0 p-4 w-24">
          <LocalizedClientLink
            href={`/products/${item.product_handle}`}
            className="flex w-16"
          >
            <Thumbnail
              thumbnail={item.thumbnail}
              images={item.variant?.product?.images}
              size="square"
            />
          </LocalizedClientLink>
        </Table.Cell>

        <Table.Cell className="text-left">
          <Text
            className="txt-medium-plus text-ui-fg-base"
            data-testid="product-title"
          >
            {item.product_title}
          </Text>
          <LineItemOptions
            variant={item.variant}
            productTitle={item.product_title}
            data-testid="product-variant"
          />
          {warrantyFor && (
            <Text className="text-xs text-brand-dark/50">
              pentru {warrantyFor}
            </Text>
          )}
          {/* Dacă garanția se poate adăuga din rezumat, trebuie să se poată și
              scoate tot de aici — altfel clientul e obligat să se întoarcă în
              coș ca să anuleze o bifă pusă cu o secundă înainte. */}
          {removable && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="mt-0.5 text-xs font-bold text-brand-dark/45 underline decoration-dashed underline-offset-4 transition-colors hover:text-brand-accent disabled:opacity-50"
              data-testid="preview-remove-button"
            >
              {deleting ? "Se elimină…" : "Elimină"}
            </button>
          )}
        </Table.Cell>

        <Table.Cell className="!pr-0">
          <span className="flex flex-col items-end h-full justify-center">
            <span className="flex gap-x-1">
              <Text className="text-ui-fg-muted">{item.quantity}x </Text>
              <LineItemUnitPrice
                item={item}
                style="tight"
                currencyCode={currencyCode}
              />
            </span>
            <LineItemPrice
              item={item}
              style="tight"
              currencyCode={currencyCode}
            />
          </span>
        </Table.Cell>
      </Table.Row>
    )
  }

  return (
    <li
      className="grid grid-cols-[88px_1fr] sm:grid-cols-[112px_1fr_180px_140px] gap-4 sm:gap-6 items-center py-5"
      data-testid="product-row"
    >
      <LocalizedClientLink
        href={`/products/${item.product_handle}`}
        className="block w-full overflow-hidden rounded-2xl bg-brand-light/60"
      >
        <Thumbnail
          thumbnail={item.thumbnail}
          images={item.variant?.product?.images}
          size="square"
        />
      </LocalizedClientLink>

      <div className="flex flex-col gap-1 min-w-0">
        <LocalizedClientLink
          href={`/products/${item.product_handle}`}
          className="font-serif text-lg sm:text-xl text-brand-dark leading-tight hover:text-brand-accent transition-colors line-clamp-2"
          data-testid="product-title"
        >
          {item.product_title}
        </LocalizedClientLink>
        {item.variant?.title && item.variant.title !== item.product_title && (
          <span
            className="text-sm text-brand-dark/55"
            data-testid="product-variant"
          >
            {item.variant.title}
          </span>
        )}
        {warrantyFor && (
          <span className="text-sm text-brand-dark/55">
            pentru {warrantyFor}
          </span>
        )}
        <div className="mt-1 sm:hidden">
          <LineItemUnitPrice
            item={item}
            style="tight"
            currencyCode={currencyCode}
          />
        </div>

        <div className="flex sm:hidden items-center justify-between gap-3 mt-3">
          <QuantityStepper
            value={item.quantity}
            max={maxQuantity}
            onChange={changeQuantity}
            updating={updating}
            disabled={deleting}
          />
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            aria-label="Elimină din coș"
            className="w-10 h-10 rounded-full border border-brand-dark/15 text-brand-dark/70 hover:text-brand-accent hover:border-brand-accent flex items-center justify-center transition-colors disabled:opacity-50"
            data-testid="product-delete-button"
          >
            {deleting ? <Spinner /> : <Trash size={16} weight="regular" />}
          </button>
        </div>

        {error && (
          <ErrorMessage error={error} data-testid="product-error-message" />
        )}
      </div>

      <div className="hidden sm:flex items-center justify-center">
        <QuantityStepper
          value={item.quantity}
          max={maxQuantity}
          onChange={changeQuantity}
          updating={updating}
          disabled={deleting}
        />
      </div>

      <div className="hidden sm:flex items-center justify-end gap-3">
        <div className="text-right">
          <LineItemPrice
            item={item}
            style="tight"
            currencyCode={currencyCode}
          />
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          aria-label="Elimină din coș"
          className="w-9 h-9 rounded-full border border-brand-dark/15 text-brand-dark/60 hover:text-brand-accent hover:border-brand-accent flex items-center justify-center transition-colors disabled:opacity-50"
          data-testid="product-delete-button"
        >
          {deleting ? <Spinner /> : <Trash size={14} weight="regular" />}
        </button>
      </div>

      <div className="col-span-2 flex sm:hidden items-center justify-between text-sm">
        <span className="text-brand-dark/55">Total</span>
        <LineItemPrice item={item} style="tight" currencyCode={currencyCode} />
      </div>

      {offerWarranty && warranty && (
        <div className="col-span-2 sm:col-span-4">
          <WarrantyOffer warranty={warranty} item={item} />
        </div>
      )}
    </li>
  )
}

type StepperProps = {
  value: number
  max: number
  onChange: (q: number) => void
  updating: boolean
  disabled?: boolean
}

const QuantityStepper = ({
  value,
  max,
  onChange,
  updating,
  disabled,
}: StepperProps) => {
  return (
    <div className="flex items-center gap-1 bg-brand-light rounded-full px-1 py-1 w-32">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={disabled || updating || value <= 1}
        aria-label="Scade cantitatea"
        className="w-8 h-8 rounded-full flex items-center justify-center text-brand-dark hover:bg-white transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <Minus size={14} weight="bold" />
      </button>
      <span
        className="flex-1 text-center font-bold text-brand-dark text-sm tabular-nums"
        data-testid="product-quantity"
      >
        {updating ? (
          <span className="inline-block w-3.5 h-3.5 border-2 border-brand-dark/20 border-t-brand-dark rounded-full animate-spin align-middle" />
        ) : (
          value
        )}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || updating || value >= max}
        aria-label="Crește cantitatea"
        className="w-8 h-8 rounded-full flex items-center justify-center text-brand-dark hover:bg-white transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <Plus size={14} weight="bold" />
      </button>
    </div>
  )
}

export default Item
