"use client"

import { useCartDrawer } from "@lib/context/cart-drawer-context"
import { ShoppingBag } from "@phosphor-icons/react/dist/ssr"

/**
 * Iconița de coș din header. Deschide panoul de coș în loc să navigheze la
 * /cart — clientul vede ce a adăugat și butonul de finalizare fără să piardă
 * pagina pe care e. Pagina /cart rămâne accesibilă din panou.
 */
const CartIconButton = ({ totalItems }: { totalItems: number }) => {
  const { open } = useCartDrawer()

  return (
    <button
      type="button"
      onClick={open}
      className="relative inline-flex items-center transition-colors hover:text-brand-accent"
      data-testid="nav-cart-link"
      aria-haspopup="dialog"
      aria-label={`Coș (${totalItems})`}
    >
      <ShoppingBag size={26} weight="light" />
      <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-dark px-1 text-[10px] font-bold text-white">
        {totalItems > 99 ? "99+" : totalItems}
      </span>
    </button>
  )
}

export default CartIconButton
