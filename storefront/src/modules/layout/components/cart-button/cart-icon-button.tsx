"use client"

import { useCartDrawer } from "@lib/context/cart-drawer-context"
import { Handbag } from "@phosphor-icons/react/dist/ssr"

/**
 * Iconița de coș din header. Deschide panoul de coș în loc să navigheze la
 * /cart — clientul vede ce a adăugat și butonul de finalizare fără să piardă
 * pagina pe care e. Pagina /cart rămâne accesibilă din panou.
 */
const CartIconButton = ({
  totalItems,
  ready = true,
}: {
  totalItems: number
  /** Coșul se citește după hidratare; până atunci nu știm câte produse sunt. */
  ready?: boolean
}) => {
  const { open } = useCartDrawer()

  // Bulina apare doar când chiar există produse. Cât coșul se încarcă am afișa
  // „0”, apoi ar sări la numărul real — un pâlpâit pe care îl vede exact
  // clientul care are deja coș.
  const showCount = ready && totalItems > 0

  return (
    <button
      type="button"
      onClick={open}
      className="relative inline-flex items-center transition-colors hover:text-brand-accent"
      data-testid="nav-cart-link"
      aria-haspopup="dialog"
      aria-label={`Coș (${totalItems})`}
    >
      <Handbag size={26} weight="light" />
      {showCount && (
        <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-dark px-1 text-[10px] font-bold text-white">
          {totalItems > 99 ? "99+" : totalItems}
        </span>
      )}
    </button>
  )
}

export default CartIconButton
