"use client"

import { ReactNode, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"

import MegaMenuPanel from "@modules/layout/components/mega-menu/panel"
import MegaMenuTriggers from "@modules/layout/components/mega-menu/triggers"
import { ResolvedMegaRoot } from "@modules/layout/components/mega-menu/data"
import NavShell from "./nav-shell"

type Props = {
  left: ReactNode
  right: ReactNode
  megaMenu: ResolvedMegaRoot[]
}

export default function NavInteractive({ left, right, megaMenu }: Props) {
  const [active, setActive] = useState<string | null>(null)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pathname = usePathname()

  const cancelDismiss = () => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = null
    }
  }

  const activate = (key: string) => {
    cancelDismiss()
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

  // Close the panel on client-side navigation (link clicks inside the menu).
  useEffect(() => {
    cancelDismiss()
    setActive(null)
  }, [pathname])

  return (
    <>
      <NavShell
        left={left}
        center={
          <MegaMenuTriggers
            active={active}
            onActivate={activate}
            onDismiss={dismiss}
          />
        }
        right={right}
        menuOpen={active !== null}
      />
      <div
        onMouseEnter={cancelDismiss}
        onMouseLeave={dismiss}
      >
        <MegaMenuPanel
          roots={megaMenu}
          active={active}
          onActivate={activate}
          onDismiss={dismiss}
        />
      </div>
    </>
  )
}
