import { listCartShippingMethods } from "@lib/data/fulfillment"
import { listCartPaymentMethods } from "@lib/data/payment"
import { getWarrantyProduct } from "@lib/data/warranty"
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

  const shippingMethods = await listCartShippingMethods(cart.id)
  const paymentMethods = await listCartPaymentMethods(cart.region?.id ?? "")
  const warranty = await getWarrantyProduct({
    regionId: cart.region_id ?? undefined,
  })

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
