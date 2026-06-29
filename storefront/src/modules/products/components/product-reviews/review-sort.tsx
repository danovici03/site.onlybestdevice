"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import type { ReviewSort } from "@lib/data/reviews"

const OPTIONS: { value: ReviewSort; label: string }[] = [
  { value: "recent", label: "Cele mai recente" },
  { value: "highest", label: "Rating cel mai mare" },
  { value: "lowest", label: "Rating cel mai mic" },
]

const ReviewSortControl = ({ current }: { current: ReviewSort }) => {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const handleChange = (value: ReviewSort) => {
    const next = new URLSearchParams(params.toString())
    if (value === "recent") {
      next.delete("review_sort")
    } else {
      next.set("review_sort", value)
    }
    next.delete("review_page")
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}#reviews` : `${pathname}#reviews`, {
      scroll: false,
    })
  }

  return (
    <div className="flex items-center gap-3">
      <label
        htmlFor="review-sort"
        className="text-xs uppercase tracking-[0.2em] font-bold text-brand-dark/60"
      >
        Ordina
      </label>
      <select
        id="review-sort"
        value={current}
        onChange={(e) => handleChange(e.target.value as ReviewSort)}
        className="bg-white rounded-full px-4 py-2 text-sm text-brand-dark border border-brand-dark/10 focus:outline-none focus:border-brand-accent transition-colors"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export default ReviewSortControl
