"use client"

import { useEffect } from "react"

/**
 * Ancorele (#reviews din steluțele PDP, redirect după login, paginarea
 * recenziilor) țintesc un <details> din acordeonul „Detalii produs".
 * Browserul sare la el, dar nu-l deschide singur — o facem noi, după
 * hidratare (un script inline ar produce hydration mismatch).
 */
const OpenOnHash = () => {
  useEffect(() => {
    const open = () => {
      const id = window.location.hash.slice(1)
      const el = id ? document.getElementById(id) : null
      if (el instanceof HTMLDetailsElement) {
        if (!el.open) {
          el.open = true
        }
        // scroll-mt-* de pe <details> e respectat de scrollIntoView
        el.scrollIntoView({ block: "start" })
      }
    }

    open()
    window.addEventListener("hashchange", open)
    return () => window.removeEventListener("hashchange", open)
  }, [])

  return null
}

export default OpenOnHash
