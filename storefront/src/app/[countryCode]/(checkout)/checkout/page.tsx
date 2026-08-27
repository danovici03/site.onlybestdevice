import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import PaymentWrapper from "@modules/checkout/components/payment-wrapper"
import CheckoutForm from "@modules/checkout/templates/checkout-form"
import { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Finalizare comandă | onlybestdevice",
  description: "Finalizează comanda într-un singur pas.",
}

export default async function Checkout({
  params,
}: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await params
  const cart = await retrieveCart()

  // Fără coș (expirat, golit, sau un link de checkout deschis a doua zi) nu e
  // o pagină inexistentă, e un coș gol. Până acum ieșea un 404 în engleză, pe
  // care îl vedea oricine revenea la un link de checkout mai vechi. Pagina de
  // coș spune același lucru în română și are un drum înainte, către magazin.
  if (!cart || !cart.items?.length) {
    redirect(`/${countryCode}/cart`)
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
