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

  const pageButton = (p: number, isCurrent: boolean, compact: boolean) => (
    <button
      key={p}
      type="button"
      onClick={() => handlePageChange(p)}
      disabled={isCurrent}
      aria-current={isCurrent ? "page" : undefined}
      aria-label={`Mergi la pagina ${p}`}
      className={clx(
        "inline-flex items-center justify-center rounded-full font-bold transition-colors",
        compact ? "h-9 min-w-9 px-2 text-xs" : "h-11 min-w-11 px-4 text-sm",
        isCurrent
          ? "bg-brand-dark text-white cursor-default"
          : "bg-white text-brand-dark border border-brand-dark/15 hover:border-brand-dark hover:bg-brand-dark hover:text-white"
      )}
    >
      {p}
    </button>
  )

  const ellipsis = (key: string, compact: boolean) => (
    <span
      key={key}
      aria-hidden
      className={clx(
        "inline-flex items-center justify-center text-brand-dark/40 font-bold",
        compact ? "h-9 min-w-6 text-xs" : "h-11 min-w-11 text-sm"
      )}
    >
      …
    </span>
  )

  // `siblings` = câte pagini se arată de o parte și de alta a celei curente.
  // 1 pe desktop (fereastra clasică), 0 pe mobil — altfel cele 9 elemente ale
  // variantei desktop (~460px) ies din container pe telefoanele mici.
  const renderPageButtons = (siblings: number, compact: boolean) => {
    const buttons: React.ReactNode[] = []
    // Câte pagini se afișează în blocul de la margine (început/sfârșit).
    const edge = 3 + siblings * 2

    if (totalPages <= edge + 2) {
      buttons.push(
        ...arrayRange(1, totalPages).map((p) =>
          pageButton(p, p === page, compact)
        )
      )
    } else if (page <= edge - 1) {
      buttons.push(
        ...arrayRange(1, edge).map((p) => pageButton(p, p === page, compact))
      )
      buttons.push(ellipsis("e1", compact))
      buttons.push(pageButton(totalPages, totalPages === page, compact))
    } else if (page >= totalPages - (edge - 2)) {
      buttons.push(pageButton(1, 1 === page, compact))
      buttons.push(ellipsis("e2", compact))
      buttons.push(
        ...arrayRange(totalPages - edge + 1, totalPages).map((p) =>
          pageButton(p, p === page, compact)
        )
      )
    } else {
      buttons.push(pageButton(1, 1 === page, compact))
      buttons.push(ellipsis("e3", compact))
      buttons.push(
        ...arrayRange(page - siblings, page + siblings).map((p) =>
          pageButton(p, p === page, compact)
        )
      )
      buttons.push(ellipsis("e4", compact))
      buttons.push(pageButton(totalPages, totalPages === page, compact))
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
      {[
        { compact: true, siblings: 0, wrapper: "sm:hidden gap-1" },
        { compact: false, siblings: 1, wrapper: "hidden sm:flex gap-2" },
      ].map(({ compact, siblings, wrapper }) => (
        <div
          key={wrapper}
          className={clx("flex items-center max-w-full", wrapper)}
        >
          <button
            type="button"
            onClick={() => handlePageChange(page - 1)}
            disabled={isFirst}
            aria-label="Pagina precedentă"
            className={clx(
              "inline-flex shrink-0 items-center justify-center rounded-full border transition-colors",
              compact ? "h-9 w-9" : "h-11 w-11",
              isFirst
                ? "border-brand-dark/10 text-brand-dark/30 cursor-not-allowed"
                : "border-brand-dark/15 text-brand-dark hover:border-brand-dark hover:bg-brand-dark hover:text-white"
            )}
          >
            <ArrowLeft size={compact ? 14 : 16} weight="bold" />
          </button>
          {renderPageButtons(siblings, compact)}
          <button
            type="button"
            onClick={() => handlePageChange(page + 1)}
            disabled={isLast}
            aria-label="Pagina următoare"
            className={clx(
              "inline-flex shrink-0 items-center justify-center rounded-full border transition-colors",
              compact ? "h-9 w-9" : "h-11 w-11",
              isLast
                ? "border-brand-dark/10 text-brand-dark/30 cursor-not-allowed"
                : "border-brand-dark/15 text-brand-dark hover:border-brand-dark hover:bg-brand-dark hover:text-white"
            )}
          >
            <ArrowRight size={compact ? 14 : 16} weight="bold" />
          </button>
        </div>
      ))}
    </nav>
  )
}
