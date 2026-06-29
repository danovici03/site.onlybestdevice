import { retrieveCart } from "@lib/data/cart"

export default async function SideMenuCartCount() {
  const cart = await retrieveCart().catch(() => null)
  const total =
    cart?.items?.reduce((acc, item) => acc + item.quantity, 0) || 0

  if (!total) return null

  return (
    <span
      data-testid="side-menu-cart-count"
      className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-accent text-brand-light text-[10px] font-bold flex items-center justify-center"
    >
      {total > 99 ? "99+" : total}
    </span>
  )
}
