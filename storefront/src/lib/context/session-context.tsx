"use client"

import { HttpTypes } from "@medusajs/types"
import { usePathname } from "next/navigation"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

export const SESSION_MARKER_COOKIE = "_medusa_session"

type SessionContextValue = {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
  /**
   * `false` până se termină prima citire. Componentele care compară starea
   * veche cu cea nouă (ex. panoul de coș, care se deschide când crește numărul
   * de produse) trebuie să aștepte: altfel saltul de la „coș gol” la coșul
   * real, de la încărcare, arată ca o adăugare și deschide panoul degeaba.
   */
  ready: boolean
  refresh: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

/**
 * Cookie-ul martor. `_medusa_cart_id` și `_medusa_jwt` sunt httpOnly, deci
 * JS-ul din pagină nu poate ști dacă vizitatorul are coș sau cont — fără
 * martor, fiecare vizitator ar cere `/api/session` degeaba, inclusiv cei
 * veniți prima dată și crawlerele. Martorul nu conține nimic secret, doar „1”.
 */
function hasSession() {
  if (typeof document === "undefined") return false
  return document.cookie
    .split("; ")
    .some((c) => c.startsWith(`${SESSION_MARKER_COOKIE}=`))
}

/**
 * Ține coșul și clientul logat în starea din browser, în locul layout-ului de
 * server. Vezi `app/api/session/route.ts` pentru de ce.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<HttpTypes.StoreCart | null>(null)
  const [customer, setCustomer] = useState<HttpTypes.StoreCustomer | null>(null)
  const [ready, setReady] = useState(false)
  const pathname = usePathname()

  // Două cereri pornite simultan pot ateriza în altă ordine decât au plecat;
  // păstrăm doar răspunsul ultimei, altfel un răspuns vechi suprascrie coșul
  // proaspăt de după o adăugare.
  const requestId = useRef(0)

  const refresh = useCallback(async () => {
    const id = ++requestId.current
    try {
      const res = await fetch("/api/session", { cache: "no-store" })
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      if (id !== requestId.current) return
      setCart(data.cart ?? null)
      setCustomer(data.customer ?? null)
    } catch {
      // Păstrăm ce aveam. Un coș afișat vechi de câteva secunde e mai bun decât
      // un coș care se golește vizual pentru că a picat o cerere.
    } finally {
      if (id === requestId.current) setReady(true)
    }
  }, [])

  // Prima citire, plus o reîmprospătare la fiecare navigare: coșul se poate
  // schimba și fără ca browserul să ceară (comandă finalizată, coș preluat la
  // autentificare). Doar pentru cine are sesiune — restul nu cer nimic.
  useEffect(() => {
    if (!hasSession()) {
      setReady(true)
      return
    }
    refresh()
  }, [pathname, refresh])

  const value = useMemo(
    () => ({ cart, customer, ready, refresh }),
    [cart, customer, ready, refresh]
  )

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  )
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) {
    throw new Error("useSession trebuie folosit în SessionProvider")
  }
  return ctx
}

const NOOP = async () => {}

/**
 * `refresh` care merge și în afara providerului. Componentele de coș (linia de
 * produs, oferta de garanție, butonul de ștergere) sunt refolosite în rezumatul
 * din checkout, iar layout-ul `(checkout)` n-are `SessionProvider` — acolo
 * pagina se re-randează pe server la fiecare acțiune, deci nu e nimic de
 * reîmprospătat în browser și un no-op e răspunsul corect.
 */
export function useSessionRefresh(): () => Promise<void> {
  const ctx = useContext(SessionContext)
  return ctx?.refresh ?? NOOP
}
