import { Metadata } from "next"
import { notFound } from "next/navigation"

import OrderOverview from "@modules/account/components/order-overview"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { listOrdersPaginated } from "@lib/data/orders"
import { account as t } from "@lib/i18n/account.it"
import { clx } from "@medusajs/ui"

export const metadata: Metadata = {
  title: "Comenzile mele",
  description: "Prezentare generală a comenzilor tale pe onlybestdevice.",
}

const PAGE_SIZE = 12

type SearchParams = Promise<{ page?: string }>

export default async function Orders({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { page = "1" } = await searchParams
  const currentPage = Math.max(1, Number.parseInt(page, 10) || 1)
  const offset = (currentPage - 1) * PAGE_SIZE

  const result = await listOrdersPaginated(PAGE_SIZE, offset)
  if (!result) notFound()

  const { orders = [], count = 0 } = result
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-6" data-testid="orders-page-wrapper">
      <header className="px-1">
        <h1 className="font-serif text-3xl small:text-4xl text-brand-dark tracking-tight">
          {t.orders.title}
        </h1>
        <p className="text-sm text-brand-dark/70 mt-2">{t.orders.subtitle}</p>
      </header>

      <OrderOverview orders={orders} />

      {totalPages > 1 && (
        <nav
          className="flex items-center justify-center gap-1 mt-2"
          aria-label="Pagination"
        >
          <PageLink
            page={currentPage - 1}
            disabled={currentPage === 1}
            label="‹"
          />
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <PageLink key={p} page={p} active={p === currentPage} label={String(p)} />
          ))}
          <PageLink
            page={currentPage + 1}
            disabled={currentPage === totalPages}
            label="›"
          />
        </nav>
      )}
    </div>
  )
}

const PageLink = ({
  page,
  label,
  active,
  disabled,
}: {
  page: number
  label: string
  active?: boolean
  disabled?: boolean
}) => {
  const cls = clx(
    "inline-flex items-center justify-center min-w-9 h-9 px-3 rounded-full text-sm transition-colors",
    active
      ? "bg-brand-dark text-white"
      : "text-brand-dark/70 hover:bg-brand-dark/[0.05]",
    disabled && "pointer-events-none opacity-40",
  )
  if (disabled || active) {
    return (
      <span className={cls} aria-disabled={disabled}>
        {label}
      </span>
    )
  }
  return (
    <LocalizedClientLink
      href={page === 1 ? "/account/orders" : `/account/orders?page=${page}`}
      className={cls}
    >
      {label}
    </LocalizedClientLink>
  )
}
