"use client"

import { clx } from "@medusajs/ui"
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

export function Pagination({
  page,
  totalPages,
  "data-testid": dataTestid,
}: {
  page: number
  totalPages: number
  "data-testid"?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const arrayRange = (start: number, stop: number) =>
    Array.from({ length: stop - start + 1 }, (_, index) => start + index)

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return
    const params = new URLSearchParams(searchParams)
    params.set("page", newPage.toString())
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const pageButton = (p: number, isCurrent: boolean) => (
    <button
      key={p}
      type="button"
      onClick={() => handlePageChange(p)}
      disabled={isCurrent}
      aria-current={isCurrent ? "page" : undefined}
      aria-label={`Vai alla pagina ${p}`}
      className={clx(
        "h-11 min-w-11 px-4 inline-flex items-center justify-center rounded-full text-sm font-bold transition-colors",
        isCurrent
          ? "bg-brand-dark text-white cursor-default"
          : "bg-white text-brand-dark border border-brand-dark/15 hover:border-brand-dark hover:bg-brand-dark hover:text-white"
      )}
    >
      {p}
    </button>
  )

  const ellipsis = (key: string) => (
    <span
      key={key}
      aria-hidden
      className="h-11 min-w-11 inline-flex items-center justify-center text-brand-dark/40 text-sm font-bold"
    >
      …
    </span>
  )

  const renderPageButtons = () => {
    const buttons: React.ReactNode[] = []

    if (totalPages <= 7) {
      buttons.push(
        ...arrayRange(1, totalPages).map((p) => pageButton(p, p === page))
      )
    } else if (page <= 4) {
      buttons.push(...arrayRange(1, 5).map((p) => pageButton(p, p === page)))
      buttons.push(ellipsis("e1"))
      buttons.push(pageButton(totalPages, totalPages === page))
    } else if (page >= totalPages - 3) {
      buttons.push(pageButton(1, 1 === page))
      buttons.push(ellipsis("e2"))
      buttons.push(
        ...arrayRange(totalPages - 4, totalPages).map((p) =>
          pageButton(p, p === page)
        )
      )
    } else {
      buttons.push(pageButton(1, 1 === page))
      buttons.push(ellipsis("e3"))
      buttons.push(
        ...arrayRange(page - 1, page + 1).map((p) => pageButton(p, p === page))
      )
      buttons.push(ellipsis("e4"))
      buttons.push(pageButton(totalPages, totalPages === page))
    }

    return buttons
  }

  const isFirst = page <= 1
  const isLast = page >= totalPages

  return (
    <nav
      aria-label="Paginare"
      className="flex justify-center w-full mt-16"
      data-testid={dataTestid}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => handlePageChange(page - 1)}
          disabled={isFirst}
          aria-label="Pagina precedente"
          className={clx(
            "h-11 w-11 inline-flex items-center justify-center rounded-full border transition-colors",
            isFirst
              ? "border-brand-dark/10 text-brand-dark/30 cursor-not-allowed"
              : "border-brand-dark/15 text-brand-dark hover:border-brand-dark hover:bg-brand-dark hover:text-white"
          )}
        >
          <ArrowLeft size={16} weight="bold" />
        </button>
        {renderPageButtons()}
        <button
          type="button"
          onClick={() => handlePageChange(page + 1)}
          disabled={isLast}
          aria-label="Pagina successiva"
          className={clx(
            "h-11 w-11 inline-flex items-center justify-center rounded-full border transition-colors",
            isLast
              ? "border-brand-dark/10 text-brand-dark/30 cursor-not-allowed"
              : "border-brand-dark/15 text-brand-dark hover:border-brand-dark hover:bg-brand-dark hover:text-white"
          )}
        >
          <ArrowRight size={16} weight="bold" />
        </button>
      </div>
    </nav>
  )
}
