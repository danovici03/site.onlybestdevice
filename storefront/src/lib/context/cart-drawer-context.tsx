"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
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
