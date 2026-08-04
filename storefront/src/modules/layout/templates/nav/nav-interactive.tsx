"use client"

import { ReactNode, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"

import MegaMenuPanel from "@modules/layout/components/mega-menu/panel"
import MegaMenuTriggers from "@modules/layout/components/mega-menu/triggers"
import { ResolvedMegaRoot } from "@modules/layout/components/mega-menu/data"
import SearchInput from "@modules/search/components/search-input"
import SearchPanel from "@modules/search/components/search-panel"
import SearchSheet from "@modules/search/components/search-sheet"
import { SearchProvider, useSearch } from "@modules/search/context"
import NavShell from "./nav-shell"

type Props = {
  left: ReactNode
  right: ReactNode
  megaMenu: ResolvedMegaRoot[]
}

export default function NavInteractive(props: Props) {
  return (
    <SearchProvider>
      <NavBody {...props} />
    </SearchProvider>
  )
}

function NavBody({ left, right, megaMenu }: Props) {
  const [active, setActive] = useState<string | null>(null)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pathname = usePathname()
  const { open: searchOpen, setOpen: setSearchOpen, isSearchable } = useSearch()

  const cancelDismiss = () => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = null
    }
  }

  const activate = (key: string) => {
    cancelDismiss()
    // Meniul și sugestiile ocupă același loc sub header — nu pot fi deschise
    // în același timp.
    setSearchOpen(false)
    setActive(key)
  }

  // Slight delay before closing so cursor can move from trigger → panel
  // without the menu collapsing.
  const dismiss = () => {
    cancelDismiss()
    dismissTimerRef.current = setTimeout(() => setActive(null), 120)
  }

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Deschiderea sugestiilor închide mega-meniul, în ambele sensuri.
  useEffect(() => {
    if (searchOpen) {
      cancelDismiss()
      setActive(null)
    }
  }, [searchOpen])

  // Close the panel on client-side navigation (link clicks inside the menu).
  useEffect(() => {
    cancelDismiss()
    setActive(null)
  }, [pathname])

  // Peste hero, nav-ul e transparent cu text alb. Sub el nu poate sta un panou
  // alb, deci orice panou deschis readuce bara la fundal opac.
  const panelOpen = active !== null || (searchOpen && isSearchable)

  return (
    <>
      <NavShell
        // Butonul stă lângă logo, nu lângă căutare: altfel bara de căutare ar
        // porni de după el și n-ar mai cădea pe centrul barei.
        left={({ overlay, compact }) => (
          <>
            {left}
            <div className="hidden lg:flex items-center font-bold text-sm">
              <MegaMenuTriggers
                active={active}
                onActivate={activate}
                onDismiss={dismiss}
                overlay={overlay}
                compact={compact}
              />
            </div>
          </>
        )}
        center={({ overlay }) => (
          <div className="w-full" onMouseEnter={dismiss}>
            <SearchInput overlay={overlay} bindSlashShortcut />
          </div>
        )}
        right={right}
        menuOpen={panelOpen}
      />

      <div onMouseEnter={cancelDismiss} onMouseLeave={dismiss}>
        <MegaMenuPanel
          roots={megaMenu}
          active={active}
          onActivate={activate}
          onDismiss={dismiss}
        />
      </div>

      <SearchPanel />
      <SearchSheet />
    </>
  )
}
