import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import { listCartPaymentMethods } from "@lib/data/payment"
import CartTemplate from "@modules/cart/templates"
import { Metadata } from "next"
import { notFound } from "next/navigation"

export const metadata: Metadata = {
  title: "Coș",
  description: "Vezi coșul tău",
}

export default async function Cart() {
  const cart = await retrieveCart().catch((error) => {
    console.error(error)
    return notFound()
  })

  const customer = await retrieveCustomer()

  // Aceeași sursă ca în checkout: dacă providerul nu e activ pe regiune, coșul
  // nu trebuie să anunțe TBI ca disponibil (și invers).
  const paymentMethods = cart?.region_id
    ? await listCartPaymentMethods(cart.region_id)
    : null
  const tbiAvailable = (paymentMethods ?? []).some((pm) =>
    pm.id.startsWith("pp_tbi")
  )

  return (
    <CartTemplate cart={cart} customer={customer} tbiAvailable={tbiAvailable} />
  )
}
