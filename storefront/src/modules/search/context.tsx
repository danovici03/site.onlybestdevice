"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useParams, usePathname, useRouter } from "next/navigation"

/**
 * Starea căutării, ridicată deasupra nav-ului.
 *
 * NavShell randează aceleași sloturi de DOUĂ ori — bara de sus și pastila care
 * apare la scroll — deci există două `<input>`-uri de căutare simultan. Dacă
 * fiecare și-ar ține textul în state propriu, ce scrii sus ar dispărea când
 * pagina se derulează și pastila ia locul barei. Textul, rezultatele și
 * elementul evidențiat stau aici, iar input-urile sunt doar vederi peste ele.
 */

export type SearchSuggestion = {
  id: string
  title: string
  handle: string
  thumbnail: string | null
  price: string | null
}

/** Sub două caractere sugestiile ar fi jumătate din catalog. */
export const MIN_QUERY_LENGTH = 2

/** Cât așteptăm după ultima tastă. Sub ~200ms se trimit cereri pe fiecare literă. */
const DEBOUNCE_MS = 220

type SearchContextValue = {
  query: string
  setQuery: (value: string) => void
  /** Panoul de sugestii de pe desktop. */
  open: boolean
  setOpen: (value: boolean) => void
  /** Ecranul plin de căutare de pe mobil. */
  sheetOpen: boolean
  openSheet: () => void
  closeSheet: () => void
  results: SearchSuggestion[]
  /** Câte rezultate există în total, nu doar în sugestii. */
  count: number
  loading: boolean
  /** Sugestia evidențiată cu săgețile; -1 = niciuna. */
  activeIndex: number
  moveActive: (delta: number) => void
  resetActive: () => void
  submit: (value?: string) => void
  clear: () => void
  /** Interogarea are destule caractere cât să căutăm ceva. */
  isSearchable: boolean
}

const SearchContext = createContext<SearchContextValue | null>(null)

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { countryCode } = useParams<{ countryCode: string }>()

  const [query, setQueryState] = useState("")
  const [open, setOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [results, setResults] = useState<SearchSuggestion[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const trimmed = query.trim()
  const isSearchable = trimmed.length >= MIN_QUERY_LENGTH

  const setQuery = useCallback((value: string) => {
    setQueryState(value)
    setActiveIndex(-1)
    if (value.trim().length >= MIN_QUERY_LENGTH) setOpen(true)
  }, [])

  // Sugestiile. Fiecare rulare anulează cererea precedentă: la scris rapid
  // răspunsurile se pot întoarce în altă ordine decât au plecat, iar fără abort
  // ultimul afișat ar fi cel mai lent, nu cel mai nou.
  //
  // Nu cerem nimic cu panoul închis: pe /search bara are deja text (citit din
  // URL mai jos), iar altfel fiecare aterizare pe pagina de rezultate ar trage
  // un rând de sugestii pe care nu le vede nimeni.
  const panelShown = open || sheetOpen

  useEffect(() => {
    if (!isSearchable || !countryCode) {
      setResults([])
      setCount(0)
      setLoading(false)
      return
    }

    // Panou închis: păstrăm ce am adus. Golirea aici ar însemna că oricine
    // închide și redeschide sugestiile pentru același text vede întâi
    // scheletul, deși răspunsul era deja în memorie.
    if (!panelShown) return

    const controller = new AbortController()
    setLoading(true)

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}&countryCode=${countryCode}`,
          { signal: controller.signal }
        )
        const data = await res.json()
        setResults(Array.isArray(data.products) ? data.products : [])
        setCount(typeof data.count === "number" ? data.count : 0)
      } catch {
        // Abort la fiecare tastă e normal, nu o eroare de raportat.
        if (!controller.signal.aborted) {
          setResults([])
          setCount(0)
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [trimmed, isSearchable, countryCode, panelShown])

  // Orice navigare (inclusiv click pe o sugestie) închide căutarea.
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    setOpen(false)
    setSheetOpen(false)
  }, [pathname])

  // Pe /search interogarea trăiește în URL. La un link deschis din altă parte,
  // la refresh sau la Back/Forward, bara din nav trebuie să arate ce s-a
  // căutat — altfel stă goală lângă titlul „Rezultate pentru …".
  //
  // Citim din `window.location`, nu cu `useSearchParams`: hook-ul ar cere un
  // Suspense în layout-ul care ține nav-ul și ar scoate din prerender toate
  // paginile de catalog de sub el.
  useEffect(() => {
    const isSearchPage = () =>
      window.location.pathname.split("/").filter(Boolean).pop() === "search"

    const syncFromUrl = () => {
      if (!isSearchPage()) return
      // `setQueryState`, nu `setQuery`: aterizarea pe pagina de rezultate nu
      // trebuie să deschidă și panoul de sugestii peste ele.
      setQueryState(new URLSearchParams(window.location.search).get("q") ?? "")
    }

    syncFromUrl()
    window.addEventListener("popstate", syncFromUrl)
    return () => window.removeEventListener("popstate", syncFromUrl)
  }, [pathname])

  // Cât ecranul plin de pe mobil e deschis, pagina de dedesubt nu trebuie să
  // se miște sub deget.
  useEffect(() => {
    if (!sheetOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [sheetOpen])

  // `useCallback`, nu arrow inline în `value`: sunt dependențe de efect în
  // `SearchSheet`, iar cu identitate nouă la fiecare tastă efectele acelea s-ar
  // dezabona și resubscrie pe fiecare literă scrisă.
  const openSheet = useCallback(() => setSheetOpen(true), [])
  const closeSheet = useCallback(() => setSheetOpen(false), [])

  const clear = useCallback(() => {
    setQueryState("")
    setResults([])
    setCount(0)
    setActiveIndex(-1)
  }, [])

  const submit = useCallback(
    (value?: string) => {
      const term = (value ?? query).trim()
      if (!term) return
      setOpen(false)
      setSheetOpen(false)
      setActiveIndex(-1)
      router.push(`/${countryCode}/search?q=${encodeURIComponent(term)}`)
    },
    [countryCode, query, router]
  )

  const moveActive = useCallback(
    (delta: number) => {
      setActiveIndex((current) => {
        if (!results.length) return -1
        const next = current + delta
        // Peste capete se iese din listă, înapoi în input.
        if (next < 0) return -1
        if (next >= results.length) return -1
        return next
      })
    },
    [results.length]
  )

  const value = useMemo<SearchContextValue>(
    () => ({
      query,
      setQuery,
      open,
      setOpen,
      sheetOpen,
      openSheet,
      closeSheet,
      results,
      count,
      loading,
      activeIndex,
      moveActive,
      resetActive: () => setActiveIndex(-1),
      submit,
      clear,
      isSearchable,
    }),
    [
      query,
      setQuery,
      open,
      sheetOpen,
      openSheet,
      closeSheet,
      results,
      count,
      loading,
      activeIndex,
      moveActive,
      submit,
      clear,
      isSearchable,
    ]
  )

  return (
    <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
  )
}

export function useSearch() {
  const ctx = useContext(SearchContext)
  if (!ctx) {
    throw new Error("useSearch trebuie folosit în interiorul <SearchProvider>")
  }
  return ctx
}
