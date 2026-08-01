"use client"

import { useSession } from "@lib/context/session-context"
import CartIconButton from "./cart-icon-button"

/**
 * Numărul de produse vine din `SessionProvider`, nu de pe server: citit pe
 * server ar fi însemnat un cookie citit în nav — adică în layout — și tot
 * catalogul ar fi rămas dinamic.
 */
export default function CartButton() {
  const { cart, ready } = useSession()

  const totalItems =
    cart?.items?.reduce((acc, item) => acc + item.quantity, 0) || 0

  return <CartIconButton totalItems={totalItems} ready={ready} />
}
