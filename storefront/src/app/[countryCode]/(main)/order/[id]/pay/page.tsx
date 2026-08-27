import { retrieveOrderForPayment } from "@lib/data/orders"
import PaymentHandoff from "@modules/checkout/components/payment-handoff"
import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

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
 * proprie, care există mereu, deci nu mai are ce să pâlpâie.
 *
 * E și linkul de „reia plata" din emailul de plată eșuată, iar de acolo vine
 * regula importantă: sesiunea de plată se deschide DE FIECARE DATĂ, pentru că
 * linkul Netopia e de unică folosință. Dar se deschide din componenta client,
 * nu de aici: pagina e publică, iar o sesiune deschisă în timpul randării s-ar
 * redeschide la orice reîmprospătare sau navigare înapoi.
 *
 * Comanda se citește fără autentificare (`GET /store/orders/:id` e public în
 * Medusa), ca linkul să meargă și pentru clienții care au comandat fără cont.
 */
export default async function OrderPayPage(props: Props) {
  const params = await props.params
  const order = await retrieveOrderForPayment(params.id)

  if (!order) {
    return notFound()
  }

  const confirmedHref = `/${params.countryCode}/order/${order.id}/confirmed`

  // Plata a intrat deja: îl ducem direct la confirmare, în loc să-l punem pe
  // drumul spre bancă pentru o comandă achitată. Ne uităm la ambele semnale —
  // IPN-ul e asincron, deci metadata poate fi în urma plăților reale.
  const netopia = (order.metadata ?? {}) as { netopia?: { status?: string } }
  const paid =
    netopia.netopia?.status === "confirmed" ||
    ["captured", "partially_captured", "authorized"].includes(
      (order as any).payment_status ?? ""
    )
  if (paid) {
    redirect(confirmedHref)
  }

  return (
    <PaymentHandoff
      orderId={order.id}
      confirmedHref={confirmedHref}
      displayId={order.display_id}
    />
  )
}
