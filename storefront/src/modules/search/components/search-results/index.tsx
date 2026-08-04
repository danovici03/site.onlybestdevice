"use client"

import { ArrowRight, MagnifyingGlass, Package } from "@phosphor-icons/react/dist/ssr"
import { clx } from "@medusajs/ui"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { countWithNoun } from "@lib/util/plural-ro"
import { SearchSuggestion, useSearch } from "@modules/search/context"

/**
 * Lista de sugestii. Aceeași în panoul de pe desktop și în ecranul plin de pe
 * mobil — se schimbă doar chenarul din jur.
 */
const SearchResults = () => {
  const { query, results, count, loading, activeIndex, submit, isSearchable } =
    useSearch()

  if (!isSearchable) {
    return null
  }

  if (loading && !results.length) {
    return (
      <ul className="flex flex-col gap-1" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="flex items-center gap-4 px-3 py-2.5">
            <div className="w-14 h-14 rounded-xl bg-brand-light animate-pulse shrink-0" />
            <div className="flex-1 flex flex-col gap-2">
              <div className="h-3.5 w-2/3 rounded-full bg-brand-light animate-pulse" />
              <div className="h-3 w-20 rounded-full bg-brand-light animate-pulse" />
            </div>
          </li>
        ))}
      </ul>
    )
  }

  if (!results.length) {
    return (
      <div className="px-3 py-10 text-center">
        <MagnifyingGlass
          size={28}
          weight="light"
          aria-hidden
          className="mx-auto text-brand-dark/25"
        />
        <p className="mt-3 font-serif text-lg text-brand-dark">
          Niciun rezultat pentru „{query.trim()}”
        </p>
        <p className="mt-1 text-sm text-brand-dark/50">
          Încearcă un termen mai scurt — de exemplu doar marca sau modelul.
        </p>
        <LocalizedClientLink
          href="/store"
          className="inline-flex items-center gap-2 mt-5 text-sm font-bold text-brand-dark hover:text-brand-accent transition-colors"
        >
          Vezi tot catalogul
          <ArrowRight size={14} weight="bold" />
        </LocalizedClientLink>
      </div>
    )
  }

  return (
    <>
      <ul id="nav-search-results" role="listbox" className="flex flex-col">
        {results.map((product, index) => (
          <li key={product.id} role="presentation">
            <SuggestionRow
              product={product}
              index={index}
              active={index === activeIndex}
            />
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => submit()}
        className="group/all mt-2 w-full flex items-center justify-between gap-3 rounded-xl px-3 py-3 border-t border-brand-dark/5 text-left hover:bg-brand-light transition-colors"
      >
        <span className="text-sm font-bold text-brand-dark">
          Vezi{" "}
          {count > results.length
            ? `toate cele ${countWithNoun(count, "rezultate")}`
            : "toate rezultatele"}{" "}
          pentru „{query.trim()}”
        </span>
        <ArrowRight
          size={16}
          weight="bold"
          className="shrink-0 text-brand-dark/50 group-hover/all:translate-x-1 group-hover/all:text-brand-dark transition-all"
        />
      </button>
    </>
  )
}

function SuggestionRow({
  product,
  index,
  active,
}: {
  product: SearchSuggestion
  index: number
  active: boolean
}) {
  return (
    <LocalizedClientLink
      href={`/products/${product.handle}`}
      id={`search-suggestion-${index}`}
      role="option"
      aria-selected={active}
      className={clx(
        "group/row flex items-center gap-4 rounded-xl px-3 py-2.5 transition-colors",
        active ? "bg-brand-light" : "hover:bg-brand-light"
      )}
    >
      <span className="w-14 h-14 shrink-0 rounded-xl bg-brand-light overflow-hidden flex items-center justify-center">
        {product.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.thumbnail}
            alt=""
            loading="lazy"
            className="w-full h-full object-contain p-1.5"
          />
        ) : (
          <Package size={20} aria-hidden className="text-brand-dark/20" />
        )}
      </span>

      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-brand-dark truncate group-hover/row:text-brand-accent transition-colors">
          {product.title}
        </span>
        {product.price && (
          <span className="block text-sm text-brand-dark/55 mt-0.5">
            {product.price}
          </span>
        )}
      </span>

      <ArrowRight
        size={14}
        weight="bold"
        aria-hidden
        className={clx(
          "shrink-0 transition-all",
          active
            ? "opacity-100 text-brand-dark"
            : "opacity-0 -translate-x-1 text-brand-dark/30 group-hover/row:opacity-100 group-hover/row:translate-x-0"
        )}
      />
    </LocalizedClientLink>
  )
}

export default SearchResults
