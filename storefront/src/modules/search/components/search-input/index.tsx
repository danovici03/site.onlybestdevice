"use client"

import { useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { MagnifyingGlass, X } from "@phosphor-icons/react/dist/ssr"
import { clx } from "@medusajs/ui"

import { useSearch } from "@modules/search/context"

type Props = {
  /** Nav-ul stă peste hero-ul întunecat: câmpul devine translucid pe alb. */
  overlay?: boolean
  /** Focus automat — folosit de panoul de căutare de pe mobil. */
  autoFocus?: boolean
  /** Scurtătura „/” se leagă doar de câmpul din nav, nu și de cel din panou. */
  bindSlashShortcut?: boolean
  className?: string
}

const PLACEHOLDER = "Caută un iPhone, un laptop, o husă…"

const SearchInput = ({
  overlay = false,
  autoFocus = false,
  bindSlashShortcut = false,
  className,
}: Props) => {
  const router = useRouter()
  const { countryCode } = useParams<{ countryCode: string }>()
  const inputRef = useRef<HTMLInputElement>(null)
  const {
    query,
    setQuery,
    open,
    setOpen,
    results,
    activeIndex,
    moveActive,
    resetActive,
    submit,
    clear,
    isSearchable,
  } = useSearch()

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  // „/" duce focusul în căutare, ca pe orice catalog mare. Câmpul există în DOM
  // de două ori (bara de sus și pastila de la scroll), deci fiecare instanță
  // verifică dacă ea e cea vizibilă — altfel focusul ar sări în bara ascunsă.
  useEffect(() => {
    if (!bindSlashShortcut) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")
      ) {
        return
      }
      const el = inputRef.current
      if (!el || el.closest("nav")?.getAttribute("aria-hidden") === "true") {
        return
      }
      e.preventDefault()
      el.focus()
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [bindSlashShortcut])

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setOpen(true)
      moveActive(1)
      return
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      moveActive(-1)
      return
    }
    if (e.key === "Escape") {
      if (open) {
        setOpen(false)
        resetActive()
      } else {
        clear()
      }
      return
    }
    if (e.key === "Enter") {
      e.preventDefault()
      const picked = results[activeIndex]
      if (picked) {
        setOpen(false)
        router.push(`/${countryCode}/products/${picked.handle}`)
      } else {
        submit()
      }
    }
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className={clx("relative w-full", className)}
    >
      <MagnifyingGlass
        size={18}
        weight="bold"
        aria-hidden
        className={clx(
          "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 transition-colors",
          overlay ? "text-white/85" : "text-brand-dark/40"
        )}
      />

      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          if (isSearchable) setOpen(true)
        }}
        onKeyDown={onKeyDown}
        placeholder={PLACEHOLDER}
        aria-label="Caută produse"
        role="combobox"
        aria-expanded={open}
        // Lista există în DOM doar cât e deschis panoul; `aria-controls` către
        // un id inexistent e o referință ruptă pentru cititoarele de ecran.
        aria-controls={open ? "nav-search-results" : undefined}
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 ? `search-suggestion-${activeIndex}` : undefined
        }
        data-testid="nav-search-input"
        // `type="search"` dă tastaturii de pe mobil tasta „Caută"; X-ul nativ
        // din WebKit se ascunde, avem butonul nostru.
        className={clx(
          "w-full h-11 rounded-full pl-11 pr-11 text-sm font-medium outline-none transition-colors",
          "[&::-webkit-search-cancel-button]:appearance-none",
          // Peste hero, textul alb trebuie să reziste și pe slide-urile
          // deschise: o tentă închisă cu blur ține contrastul indiferent ce e
          // sub bară, iar pe hero-urile întunecate abia se observă.
          overlay
            ? "bg-black/25 backdrop-blur-md border border-white/30 text-white placeholder:text-white/75 focus:bg-black/35 focus:border-white/60"
            : "bg-brand-light border border-transparent text-brand-dark placeholder:text-brand-dark/40 focus:bg-white focus:border-brand-dark/20"
        )}
      />

      {query ? (
        <button
          type="button"
          onClick={() => {
            clear()
            inputRef.current?.focus()
          }}
          aria-label="Golește căutarea"
          className={clx(
            "absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center transition-colors",
            overlay
              ? "text-white/70 hover:bg-white/20 hover:text-white"
              : "text-brand-dark/40 hover:bg-brand-dark/10 hover:text-brand-dark"
          )}
        >
          <X size={13} weight="bold" />
        </button>
      ) : (
        <kbd
          aria-hidden
          className={clx(
            "hidden xl:flex absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 items-center justify-center rounded-md border text-[11px] font-bold",
            overlay
              ? "border-white/25 text-white/60"
              : "border-brand-dark/10 text-brand-dark/35"
          )}
        >
          /
        </kbd>
      )}
    </form>
  )
}

export default SearchInput
