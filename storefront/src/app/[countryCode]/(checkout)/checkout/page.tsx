import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import PaymentWrapper from "@modules/checkout/components/payment-wrapper"
import CheckoutForm from "@modules/checkout/templates/checkout-form"
import { Metadata } from "next"
import { notFound } from "next/navigation"

export const metadata: Metadata = {
  title: "Finalizare comandă | onlybestdevice",
  description: "Finalizează comanda într-un singur pas.",
}

export default async function Checkout() {
  const cart = await retrieveCart()

  if (!cart) {
    return notFound()
  }

  const customer = await retrieveCustomer()

  // PaymentWrapper îmbracă tot checkout-ul (formular + buton de finalizare)
  // în <Elements> atunci când sesiunea activă e Stripe.
  return (
    <PaymentWrapper cart={cart}>
      <CheckoutForm cart={cart} customer={customer} />
    </PaymentWrapper>
  )
}
