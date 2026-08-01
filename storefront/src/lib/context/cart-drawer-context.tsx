"use client"

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

type CartDrawerContextValue = {
  isOpen: boolean
  open: () => void
  close: () => void
}

const CartDrawerContext = createContext<CartDrawerContextValue | null>(null)

/**
 * Coșul e un panou (bottom sheet pe mobil, drawer lateral pe desktop) care se
 * deschide din mai multe locuri: automat după „Adaugă în coș”, din iconița din
 * header și din tab-ul „Coș” al barei de jos. Contextul ține starea într-un
 * singur loc, ca toate să comande același panou.
 */
export function CartDrawerProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  // Panoul nu supraviețuiește navigării. Închiderea stă AICI, nu în CartDrawer:
  // componenta se remontează la refresh-urile RSC de după acțiunile de coș și
  // orice logică bazată pe ref-uri de acolo se reinițializează. Providerul
  // rămâne montat între navigări; dacă totuși se remontează, isOpen pornește
  // oricum pe false.
  const pathname = usePathname()
  const prevPathname = useRef(pathname)
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname
      setIsOpen(false)
    }
  }, [pathname])

  const value = useMemo(() => ({ isOpen, open, close }), [isOpen, open, close])

  return (
    <CartDrawerContext.Provider value={value}>
      {children}
    </CartDrawerContext.Provider>
  )
}

export function useCartDrawer() {
  const ctx = useContext(CartDrawerContext)
  if (!ctx) {
    throw new Error("useCartDrawer trebuie folosit în CartDrawerProvider")
  }
  return ctx
}
