import { retrieveCart } from "@lib/data/cart"
import CartIconButton from "./cart-icon-button"

export default async function CartButton() {
  const cart = await retrieveCart().catch(() => null)

  const totalItems =
    cart?.items?.reduce((acc, item) => acc + item.quantity, 0) || 0

  return <CartIconButton totalItems={totalItems} />
}
