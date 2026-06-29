"use client"

import { useEffect, useState } from "react"

export function useScrolledPast(threshold = 120) {
  const [past, setPast] = useState(false)

  useEffect(() => {
    let ticking = false
    const update = () => {
      setPast(window.scrollY > threshold)
      ticking = false
    }
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(update)
        ticking = true
      }
    }
    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [threshold])

  return past
}
