"use client"

import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react"
import { deleteLineItem, updateLineItem } from "@lib/data/cart"
import { useCartDrawer } from "@lib/context/cart-drawer-context"
import { convertToLocale } from "@lib/util/money"
import { warrantyTargetTitle } from "@lib/util/warranty"
import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "@modules/products/components/thumbnail"
import {
  ArrowRight,
  CheckCircle,
  Lock,
  Minus,
  Plus,
  ShoppingBag,
  Trash,
  X as XIcon,
} from "@phosphor-icons/react/dist/ssr"
import { usePathname } from "next/navigation"
import { Fragment, useEffect, useRef, useState } from "react"

/** Aceeași regulă ca în rezumatul coșului: sări direct la pasul relevant. */
function getCheckoutStep(cart: HttpTypes.StoreCart) {
  if (!cart?.shipping_address?.address_1 || !cart.email) return "address"
  if (cart?.shipping_methods?.length === 0) return "delivery"
  return "payment"
}

type CartDrawerProps = {
  cart?: HttpTypes.StoreCart | null
}

const CartDrawer = ({ cart }: CartDrawerProps) => {
  const { isOpen, open, close } = useCartDrawer()
  const pathname = usePathname()
  const [justAdded, setJustAdded] = useState(false)

  const items = cart?.items ?? []
  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0)

  // Pe /cart și /checkout coșul e deja pe ecran — un panou peste el ar fi zgomot.
  const onCartRoute =
    pathname.includes("/cart") || pathname.includes("/checkout")

  const prevTotal = useRef<number | null>(null)

  // Confirmarea adăugării: pe mobil nu exista niciun semnal că produsul a intrat
  // în coș, deci deschidem panoul de fiecare dată când crește numărul de bucăți.
  // Dacă panoul e deja deschis, creșterea vine de la „+” din interior — nu e o
  // adăugare nouă, deci nu arătăm confirmarea verde.
  useEffect(() => {
    const prev = prevTotal.current
    prevTotal.current = totalItems

    if (prev === null || totalItems <= prev || onCartRoute || isOpen) return

    setJustAdded(true)
    open()
  }, [totalItems, onCartRoute, isOpen, open])

  // Panoul nu supraviețuiește navigării — altfel rămâne deschis peste pagina nouă.
  useEffect(() => {
    close()
  }, [pathname, close])

  useEffect(() => {
    if (!isOpen) setJustAdded(false)
  }, [isOpen])

  const subtotal = cart?.item_subtotal ?? cart?.subtotal ?? 0
  const currencyCode = cart?.currency_code ?? "ron"
  const checkoutStep = cart ? getCheckoutStep(cart) : "address"

  return (
    <Transition appear show={isOpen} as={Fragment}>
      {/* z peste bara sticky de produs (75) și FAB-ul de sortare (80), sub
          modalul de cookie-uri (85), care trebuie să rămână deasupra a tot. */}
      <Dialog as="div" className="relative z-[82]" onClose={close}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-brand-dark/40 backdrop-blur-sm" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-end justify-center lg:items-stretch lg:justify-end">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 translate-y-full lg:translate-y-0 lg:translate-x-full"
            enterTo="opacity-100 translate-y-0 lg:translate-x-0"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 translate-y-0 lg:translate-x-0"
            leaveTo="opacity-0 translate-y-full lg:translate-y-0 lg:translate-x-full"
          >
            <DialogPanel
              className="flex max-h-[88svh] w-full flex-col overflow-hidden rounded-tl-[2rem] rounded-tr-[2rem] bg-white lg:h-full lg:max-h-none lg:w-[440px] lg:rounded-bl-[2rem] lg:rounded-tr-none"
              data-testid="cart-drawer"
            >
              <div className="flex items-center gap-3 px-5 pt-5 pb-4">
                <DialogTitle className="flex-1 min-w-0 font-serif text-2xl text-brand-dark">
                  {justAdded ? "Adăugat în coș" : "Coșul tău"}
                </DialogTitle>
                <span className="text-sm text-brand-dark/50">
                  {totalItems} {totalItems === 1 ? "produs" : "produse"}
                </span>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Închide coșul"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand-dark transition-colors hover:bg-brand-dark hover:text-white"
                  data-testid="cart-drawer-close"
                >
                  <XIcon size={18} weight="bold" />
                </button>
              </div>

              {justAdded && (
                <div className="mx-5 mb-3 flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
                  <CheckCircle
                    size={18}
                    weight="fill"
                    className="shrink-0 text-emerald-600"
                  />
                  <span className="font-bold">
                    Produsul a fost adăugat în coș
                  </span>
                </div>
              )}

              {items.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-light text-brand-dark">
                    <ShoppingBag size={24} weight="regular" />
                  </span>
                  <p className="text-brand-dark/60">Coșul tău e gol.</p>
                  <LocalizedClientLink
                    href="/store"
                    onClick={close}
                    className="rounded-full bg-brand-dark px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-accent"
                  >
                    Descoperă produsele
                  </LocalizedClientLink>
                </div>
              ) : (
                <>
                  <ul className="flex-1 overflow-y-auto px-5 pb-2">
                    {[...items]
                      .sort((a, b) =>
                        (a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1
                      )
                      .map((item) => (
                        <DrawerItem
                          key={item.id}
                          item={item}
                          currencyCode={currencyCode}
                          onNavigate={close}
                        />
                      ))}
                  </ul>

                  <div
                    className="flex flex-col gap-3 border-t border-brand-dark/10 bg-white px-5 pt-4"
                    style={{
                      paddingBottom:
                        "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)",
                    }}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="font-bold text-brand-dark">
                        Subtotal
                      </span>
                      <span
                        className="text-xl font-extrabold tracking-tight text-brand-dark"
                        data-testid="cart-drawer-subtotal"
                        data-value={subtotal}
                      >
                        {convertToLocale({
                          amount: subtotal,
                          currency_code: currencyCode,
                        })}
                      </span>
                    </div>
                    <p className="-mt-2 text-xs text-brand-dark/50">
                      Transportul și eventualele reduceri se calculează la
                      finalizare.
                    </p>

                    <LocalizedClientLink
                      href={"/checkout?step=" + checkoutStep}
                      onClick={close}
                      data-testid="cart-drawer-checkout-button"
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-dark px-6 py-4 text-sm font-bold text-white transition-colors hover:bg-brand-accent"
                    >
                      <Lock size={16} weight="bold" />
                      <span>Finalizează comanda</span>
                      <ArrowRight size={16} weight="bold" />
                    </LocalizedClientLink>

                    <div className="flex items-center justify-between text-sm">
                      <button
                        type="button"
                        onClick={close}
                        className="font-bold text-brand-dark/60 transition-colors hover:text-brand-dark"
                      >
                        Continuă cumpărăturile
                      </button>
                      <LocalizedClientLink
                        href="/cart"
                        onClick={close}
                        className="font-bold text-brand-dark underline decoration-dashed underline-offset-4 transition-colors hover:text-brand-accent"
                        data-testid="cart-drawer-view-cart"
                      >
                        Vezi coșul
                      </LocalizedClientLink>
                    </div>
                  </div>
                </>
              )}
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  )
}

type DrawerItemProps = {
  item: HttpTypes.StoreCartLineItem
  currencyCode: string
  onNavigate: () => void
}

const DrawerItem = ({ item, currencyCode, onNavigate }: DrawerItemProps) => {
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const warrantyFor = warrantyTargetTitle(item)

  const changeQuantity = async (quantity: number) => {
    setUpdating(true)
    await updateLineItem({ lineId: item.id, quantity })
      .catch(() => {})
      .finally(() => setUpdating(false))
  }

  const handleDelete = async () => {
    setDeleting(true)
    await deleteLineItem(item.id).catch(() => setDeleting(false))
  }

  const busy = updating || deleting

  return (
    <li
      className="grid grid-cols-[72px_1fr] items-start gap-4 border-b border-brand-dark/5 py-4 last:border-b-0"
      data-testid="cart-drawer-item"
    >
      <LocalizedClientLink
        href={`/products/${item.product_handle}`}
        onClick={onNavigate}
        className="block overflow-hidden rounded-xl bg-brand-light/60"
      >
        <Thumbnail
          thumbnail={item.thumbnail}
          images={item.variant?.product?.images}
          size="square"
        />
      </LocalizedClientLink>

      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-start gap-2">
          <LocalizedClientLink
            href={`/products/${item.product_handle}`}
            onClick={onNavigate}
            className="line-clamp-2 flex-1 text-sm font-bold leading-snug text-brand-dark transition-colors hover:text-brand-accent"
            data-testid="cart-drawer-item-title"
          >
            {item.product_title}
          </LocalizedClientLink>
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            aria-label="Elimină din coș"
            className="shrink-0 rounded-full p-1.5 text-brand-dark/40 transition-colors hover:text-brand-accent disabled:opacity-40"
            data-testid="cart-drawer-item-remove"
          >
            <Trash size={16} weight="regular" />
          </button>
        </div>

        {/* La produsele cu o singură variantă, titlul variantei repetă titlul
            produsului — atunci nu-l mai arătăm. */}
        {item.variant?.title && item.variant.title !== item.product_title && (
          <span className="text-xs text-brand-dark/50">
            {item.variant.title}
          </span>
        )}
        {/* Cu mai multe garanții în coș, fără asta nu știi care ce acoperă. */}
        {warrantyFor && (
          <span className="text-xs text-brand-dark/50">
            pentru {warrantyFor}
          </span>
        )}

        <div className="mt-1.5 flex items-center justify-between gap-3">
          <div className="flex items-center rounded-full bg-brand-light px-1 py-1">
            <button
              type="button"
              onClick={() => changeQuantity(Math.max(1, item.quantity - 1))}
              disabled={busy || item.quantity <= 1}
              aria-label="Scade cantitatea"
              className="flex h-7 w-7 items-center justify-center rounded-full text-brand-dark transition-colors hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Minus size={12} weight="bold" />
            </button>
            <span className="min-w-[1.75rem] text-center text-sm font-bold tabular-nums text-brand-dark">
              {updating ? (
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-brand-dark/20 border-t-brand-dark align-middle" />
              ) : (
                item.quantity
              )}
            </span>
            <button
              type="button"
              onClick={() => changeQuantity(item.quantity + 1)}
              disabled={busy}
              aria-label="Crește cantitatea"
              className="flex h-7 w-7 items-center justify-center rounded-full text-brand-dark transition-colors hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Plus size={12} weight="bold" />
            </button>
          </div>

          <span
            className={clx(
              "text-sm font-extrabold text-brand-dark",
              deleting && "opacity-40"
            )}
          >
            {convertToLocale({
              amount: item.total ?? 0,
              currency_code: currencyCode,
            })}
          </span>
        </div>
      </div>
    </li>
  )
}

export default CartDrawer
