import { Dialog, Transition } from "@headlessui/react"
import { clx } from "@medusajs/ui"
import { CaretDown, ShoppingBag, X as XIcon } from "@phosphor-icons/react/dist/ssr"
import React, { Fragment, useMemo } from "react"

import useToggleState from "@lib/hooks/use-toggle-state"

import { getProductPrice } from "@lib/util/get-product-price"
import OptionSelect from "./option-select"
import { HttpTypes } from "@medusajs/types"
import { isSimpleProduct } from "@lib/util/product"

type MobileActionsProps = {
  product: HttpTypes.StoreProduct
  variant?: HttpTypes.StoreProductVariant
  options: Record<string, string | undefined>
  updateOptions: (title: string, value: string) => void
  inStock?: boolean
  handleAddToCart: () => void
  isAdding?: boolean
  show: boolean
  optionsDisabled: boolean
}

const MobileActions: React.FC<MobileActionsProps> = ({
  product,
  variant,
  options,
  updateOptions,
  inStock,
  handleAddToCart,
  isAdding,
  show,
  optionsDisabled,
}) => {
  const { state, open, close } = useToggleState()

  const price = getProductPrice({
    product: product,
    variantId: variant?.id,
  })

  const selectedPrice = useMemo(() => {
    if (!price) return null
    const { variantPrice, cheapestPrice } = price
    return variantPrice || cheapestPrice || null
  }, [price])

  const isSimple = isSimpleProduct(product)

  return (
    <>
      <div
        className={clx("lg:hidden inset-x-0 bottom-0 fixed z-50", {
          "pointer-events-none": !show,
        })}
      >
        <Transition
          as={Fragment}
          show={show}
          enter="ease-out duration-300"
          enterFrom="opacity-0 translate-y-6"
          enterTo="opacity-100 translate-y-0"
          leave="ease-in duration-200"
          leaveFrom="opacity-100 translate-y-0"
          leaveTo="opacity-0 translate-y-6"
        >
          <div
            className="bg-white/90 backdrop-blur-md border-t border-brand-dark/10 px-4 py-3 flex items-center gap-3 shadow-[0_-8px_30px_rgb(0,0,0,0.04)]"
            data-testid="mobile-actions"
          >
            <div className="flex flex-col min-w-0 flex-1">
              <span
                className="font-bold text-sm text-brand-dark truncate"
                data-testid="mobile-title"
              >
                {product.title}
              </span>
              {selectedPrice && (
                <div className="flex items-center gap-2 text-sm">
                  {selectedPrice.price_type === "sale" && (
                    <span className="line-through text-brand-dark/40 text-xs">
                      {selectedPrice.original_price}
                    </span>
                  )}
                  <span
                    className={clx(
                      "font-serif text-base",
                      selectedPrice.price_type === "sale"
                        ? "text-brand-accent"
                        : "text-brand-dark"
                    )}
                  >
                    {selectedPrice.calculated_price}
                  </span>
                </div>
              )}
            </div>

            {!isSimple && (
              <button
                type="button"
                onClick={open}
                data-testid="mobile-actions-button"
                className="px-4 h-12 rounded-full border border-brand-dark/15 text-brand-dark text-sm font-bold flex items-center gap-1.5 max-w-[40vw] min-w-0"
              >
                <span className="truncate">
                  {variant
                    ? Object.values(options).join(" / ")
                    : "Opțiuni"}
                </span>
                <CaretDown size={14} weight="bold" className="shrink-0" />
              </button>
            )}

            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!inStock || !variant || isAdding}
              data-testid="mobile-cart-button"
              className="h-12 px-5 rounded-full bg-brand-dark text-white text-sm font-bold flex items-center gap-2 hover:bg-brand-accent transition-colors disabled:opacity-50 disabled:hover:bg-brand-dark shrink-0"
            >
              {isAdding ? (
                <span
                  className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"
                  aria-label="Se încarcă"
                />
              ) : (
                <ShoppingBag size={16} weight="bold" />
              )}
              <span className="hidden xsmall:inline">
                {!variant
                  ? "Selectează"
                  : !inStock
                  ? "Stoc epuizat"
                  : "Adaugă"}
              </span>
            </button>
          </div>
        </Transition>
      </div>

      <Transition appear show={state} as={Fragment}>
        <Dialog as="div" className="relative z-[75]" onClose={close}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-brand-dark/40 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed bottom-0 inset-x-0">
            <div className="flex min-h-full h-full items-end justify-center text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-8"
                enterTo="opacity-100 translate-y-0"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0"
                leaveTo="opacity-0 translate-y-8"
              >
                <Dialog.Panel
                  className="w-full bg-white rounded-t-[2rem] p-6 pb-10 flex flex-col gap-y-6"
                  data-testid="mobile-actions-modal"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-2xl text-brand-dark">
                      Selectează opțiunile
                    </span>
                    <button
                      onClick={close}
                      className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center text-brand-dark"
                      data-testid="close-modal-button"
                      aria-label="Închide"
                    >
                      <XIcon size={18} weight="bold" />
                    </button>
                  </div>
                  {(product.variants?.length ?? 0) > 1 && (
                    <div className="flex flex-col gap-y-5 text-left">
                      {(product.options || []).map((option) => (
                        <OptionSelect
                          key={option.id}
                          option={option}
                          current={options[option.id]}
                          updateOption={updateOptions}
                          title={option.title ?? ""}
                          disabled={optionsDisabled}
                        />
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={close}
                    className="w-full py-4 rounded-full bg-brand-dark text-white font-bold text-sm hover:bg-brand-accent transition-colors"
                  >
                    Confirmă
                  </button>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  )
}

export default MobileActions
