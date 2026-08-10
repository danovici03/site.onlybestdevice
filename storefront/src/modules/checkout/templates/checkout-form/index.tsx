import { listCartShippingMethods } from "@lib/data/fulfillment"
import { listCartPaymentMethods } from "@lib/data/payment"
import { getWarrantyProduct } from "@lib/data/warranty"
import { shouldOfferWarranty } from "@lib/util/warranty"
import { HttpTypes } from "@medusajs/types"
import OnePageCheckout from "@modules/checkout/templates/one-page"

export default async function CheckoutForm({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) {
  if (!cart) {
    return null
  }

  // Cele trei cereri sunt independente — serializate, checkout-ul aștepta suma
  // latențelor în loc de cea mai mare dintre ele.
  const [shippingMethods, paymentMethods, warranty] = await Promise.all([
    listCartShippingMethods(cart.id),
    listCartPaymentMethods(cart.region?.id ?? ""),
    // Doar dacă mai are cui fi propusă: `ItemsPreviewTemplate` filtrează oricum
    // linie cu linie, iar pe un coș fără produse bifate cererea ar fi degeaba.
    (cart.items ?? []).some((i) => shouldOfferWarranty(i, cart))
      ? getWarrantyProduct({ regionId: cart.region_id ?? undefined })
      : Promise.resolve(undefined),
  ])

  if (!shippingMethods || !paymentMethods) {
    return null
  }

  return (
    <OnePageCheckout
      cart={cart}
      customer={customer}
      shippingMethods={shippingMethods}
      paymentMethods={paymentMethods}
      warranty={warranty}
    />
  )
}
