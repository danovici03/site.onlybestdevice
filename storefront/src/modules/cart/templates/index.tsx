import ItemsTemplate from "./items"
import Summary from "./summary"
import EmptyCartMessage from "../components/empty-cart-message"
import FinancingOptions from "../components/financing-options"
import SignInPrompt from "../components/sign-in-prompt"
import { HttpTypes } from "@medusajs/types"

const CartTemplate = ({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) => {
  const itemCount =
    cart?.items?.reduce((acc, item) => acc + item.quantity, 0) ?? 0

  return (
    <div className="bg-brand-light/40 min-h-[calc(100vh-200px)]">
      <div
        className="content-container py-10 lg:py-16"
        data-testid="cart-container"
      >
        {cart?.items?.length ? (
          <>
            <div className="flex flex-col gap-3 mb-8 lg:mb-12">
              <span className="text-xs uppercase tracking-[0.2em] font-bold text-brand-dark/50">
                Coș
              </span>
              <h1 className="font-serif text-4xl lg:text-5xl text-brand-dark leading-tight">
                Coșul tău
              </h1>
              <p className="text-brand-dark/60">
                {itemCount} {itemCount === 1 ? "produs" : "produse"} gata de
                livrare.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 lg:gap-12 items-start">
              <div className="flex flex-col gap-6">
                {!customer && <SignInPrompt />}
                <ItemsTemplate cart={cart} />

                <FinancingOptions
                  amount={cart.total ?? 0}
                  currency={cart.currency_code}
                />
              </div>

              <div className="lg:sticky lg:top-28">
                {cart && cart.region && <Summary cart={cart as any} />}
              </div>
            </div>
          </>
        ) : (
          <EmptyCartMessage />
        )}
      </div>
    </div>
  )
}

export default CartTemplate
