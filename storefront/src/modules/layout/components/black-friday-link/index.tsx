"use client"

import { Lightning } from "@phosphor-icons/react/dist/ssr"
import { clx } from "@medusajs/ui"

import { useBlackFridayLive } from "@lib/hooks/use-black-friday-live"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Butonul de campanie din bara de sus, doar pe desktop: pe mobil nu încape cu tot
 * cu text, așa că acolo linkul stă în bara de jos, în drawer și în top-bar.
 *
 * Peste fundaluri închise (hero, pagina campaniei) pastila neagră s-ar pierde,
 * deci primește chenar.
 */
export default function BlackFridayLink({ overlay }: { overlay: boolean }) {
  const live = useBlackFridayLive()
  if (!live) return null

  return (
    <LocalizedClientLink
      href="/black-friday"
      prefetch={false}
      data-testid="nav-black-friday-link"
      className={clx(
        "hidden lg:inline-flex shrink-0 h-9 items-center gap-1.5 rounded-full bg-black px-3.5 text-sm font-bold text-white whitespace-nowrap transition-colors hover:text-[#f6921e]",
        overlay && "border border-white/40"
      )}
    >
      <Lightning size={15} weight="fill" aria-hidden className="text-[#f6921e]" />
      Black Friday
    </LocalizedClientLink>
  )
}
