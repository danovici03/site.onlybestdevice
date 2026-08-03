import { retrieveOrder } from "@lib/data/orders"
import PaymentHandoff from "@modules/checkout/components/payment-handoff"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ id: string; countryCode: string }>
}

export const metadata: Metadata = {
  title: "Se deschide plata securizată",
  description: "Te redirecționăm către pagina de plată.",
  robots: { index: false, follow: false },
}

/**
 * Pas intermediar între finalizarea comenzii și pagina băncii.
 *
 * Fără el, redirectul pleca direct din checkout spre Netopia, iar Next apuca
 * să reîmprospăteze ruta curentă — /checkout rămas fără coș înseamnă 404, pe
 * care clientul îl vedea fix cât se încărca pagina de plată. Aici avem o rută
 * proprie, care există mereu, deci nu mai are ce să pâlpâie. În plus, URL-ul
 * de plată stă în metadata comenzii, așa că pagina e și linkul de „reia plata".
 */
export default async function OrderPayPage(props: Props) {
  const params = await props.params
  const order = await retrieveOrder(params.id).catch(() => null)

  if (!order) {
    return notFound()
  }

  const netopia = (order.metadata ?? {}) as {
    netopia?: { payment_url?: string; status?: string }
  }
  const paymentUrl = netopia.netopia?.payment_url
  const confirmedHref = `/${params.countryCode}/order/${order.id}/confirmed`

  return (
    <PaymentHandoff
      paymentUrl={paymentUrl}
      confirmedHref={confirmedHref}
      displayId={order.display_id}
    />
  )
}
