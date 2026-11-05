"use client"

import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr"
import Image from "next/image"
import { useMemo, useState } from "react"

import type { BuybackBrand } from "@lib/data/buyback"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

import DeviceSilhouette from "./device-silhouette"

import { lei } from "../questions"

/**
 * Alegerea modelului: tab-uri pe brand + căutare. Căutarea trece peste toate
 * brandurile, ca „s23” să găsească telefonul fără să știi unde e.
 */
export default function DevicePicker({ brands }: { brands: BuybackBrand[] }) {
  const [brand, setBrand] = useState(brands[0]?.brand ?? "")
  const [q, setQ] = useState("")

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (term) {
      return brands
        .flatMap((b) => b.devices)
        .filter((d) => `${d.brand} ${d.model}`.toLowerCase().includes(term))
    }
    return brands.find((b) => b.brand === brand)?.devices ?? []
  }, [brands, brand, q])

  if (!brands.length) {
    return (
      <p className="rounded-2xl bg-brand-dark/5 p-6 text-brand-dark/70">
        Momentan nu preluăm telefoane online. Revino în curând sau scrie-ne.
      </p>
    )
  }

  return (
    <div>
      <div className="relative mb-5">
        <MagnifyingGlass
          size={20}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-dark/40"
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Caută modelul tău (ex. iPhone 13, Galaxy S23)"
          aria-label="Caută modelul"
          className="w-full rounded-full border border-brand-dark/15 bg-white py-3.5 pl-12 pr-4 focus:border-brand-dark focus:outline-none"
        />
      </div>

      {!q.trim() && (
        <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist">
          {brands.map((b) => (
            <button
              key={b.brand}
              role="tab"
              aria-selected={b.brand === brand}
              onClick={() => setBrand(b.brand)}
              className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
                b.brand === brand
                  ? "bg-brand-dark text-white"
                  : "bg-brand-dark/5 text-brand-dark hover:bg-brand-dark/10"
              }`}
            >
              {b.brand}
            </button>
          ))}
        </div>
      )}

      {list.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((d) => (
            <li key={d.handle}>
              <LocalizedClientLink
                href={`/vinde-telefonul/${d.handle}`}
                className="group flex h-full flex-col items-center rounded-2xl border border-brand-dark/10 bg-white p-4 text-center transition-all hover:-translate-y-0.5 hover:border-brand-dark/30 hover:shadow-md"
              >
                <div className="relative mb-3 flex h-28 w-full items-center justify-center">
                  {d.image_url ? (
                    <Image
                      src={d.image_url}
                      alt={`${d.brand} ${d.model}`}
                      fill
                      sizes="(min-width: 1024px) 200px, 45vw"
                      className="object-contain"
                    />
                  ) : (
                    <DeviceSilhouette brand={d.brand} className="h-full w-auto opacity-90" />
                  )}
                </div>
                <span className="font-semibold leading-snug text-brand-dark">
                  {d.brand === "Apple" || d.model.startsWith(d.brand) ? d.model : `${d.brand} ${d.model}`}
                </span>
                {d.max_price != null && (
                  <span className="mt-1 text-xs font-semibold uppercase tracking-wide text-emerald-600">
                    până la {lei(d.max_price)}
                  </span>
                )}
              </LocalizedClientLink>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-brand-dark/5 p-6 text-brand-dark/70">
          Nu am găsit „{q}”. Încearcă doar numele modelului, fără memorie sau culoare.
        </p>
      )}
    </div>
  )
}
