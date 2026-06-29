import { Metadata } from "next"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { listOrders } from "@lib/data/orders"
import AccountCard from "@modules/account/components/account-card"
import StatusBadge, { StatusTone } from "@modules/account/components/status-badge"
import { account as t } from "@lib/i18n/account.it"

export const metadata: Metadata = {
  title: "Resi",
  description: "Le tue richieste di reso su Arredovita.",
}

type ReturnRequest = {
  id: string
  requested_at: string
  status: "requested" | "received" | "refunded" | "denied"
  items: { item_id: string; quantity: number; reason?: string; note?: string }[]
  note?: string
}

const STATUS_TONE: Record<ReturnRequest["status"], StatusTone> = {
  requested: "info",
  received: "warning",
  refunded: "success",
  denied: "danger",
}

const STATUS_LABEL: Record<ReturnRequest["status"], string> = {
  requested: "In attesa",
  received: "Ricevuto",
  refunded: "Rimborsato",
  denied: "Rifiutato",
}

const DATE_FMT: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "long",
  year: "numeric",
}

export default async function ReturnsPage() {
  // Pull every order and flatten its metadata.return_requests so we have a single
  // chronological feed for the customer (the requests live on each order, not on
  // a separate table).
  const orders = (await listOrders(100, 0).catch(() => null)) ?? []

  const flattened = orders
    .flatMap((order) => {
      const requests =
        ((order.metadata as Record<string, unknown> | undefined)
          ?.return_requests as ReturnRequest[] | undefined) ?? []
      return requests.map((r) => ({ order, request: r }))
    })
    .sort(
      (a, b) =>
        new Date(b.request.requested_at).getTime() -
        new Date(a.request.requested_at).getTime(),
    )

  return (
    <div className="flex flex-col gap-6">
      <header className="px-1">
        <h1 className="font-serif text-3xl small:text-4xl text-brand-dark tracking-tight">
          {t.returns.title}
        </h1>
        <p className="text-sm text-brand-dark/70 mt-2">{t.returns.subtitle}</p>
      </header>

      {flattened.length === 0 ? (
        <AccountCard>
          <div className="text-center py-6">
            <p className="text-sm text-brand-dark/60 mb-4">{t.returns.empty}</p>
            <LocalizedClientLink
              href="/account/orders"
              className="inline-flex items-center justify-center rounded-full bg-brand-dark text-white px-5 py-2.5 text-sm font-semibold hover:bg-brand-accent transition-colors"
            >
              {t.orders.title}
            </LocalizedClientLink>
          </div>
        </AccountCard>
      ) : (
        <ul className="flex flex-col gap-3 small:gap-4">
          {flattened.map(({ order, request }) => (
            <li key={request.id}>
              <LocalizedClientLink
                href={`/account/orders/details/${order.id}`}
                className="block rounded-3xl bg-white border border-brand-dark/[0.06] p-5 hover:border-brand-dark/[0.15] transition-colors"
              >
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className="text-sm font-semibold text-brand-dark">
                    {t.orders.orderNumber} #{order.display_id}
                  </span>
                  <StatusBadge tone={STATUS_TONE[request.status]}>
                    {STATUS_LABEL[request.status]}
                  </StatusBadge>
                </div>
                <p className="text-xs text-brand-dark/60">
                  Richiesto il{" "}
                  {new Date(request.requested_at).toLocaleDateString(
                    "it-IT",
                    DATE_FMT,
                  )}{" "}
                  · {request.items.length}{" "}
                  {request.items.length === 1 ? "articolo" : "articoli"}
                </p>
                {request.note && (
                  <p className="text-xs text-brand-dark/60 mt-2 italic line-clamp-2">
                    "{request.note}"
                  </p>
                )}
              </LocalizedClientLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
