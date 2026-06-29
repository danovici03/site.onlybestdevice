"use client"

import { useState, useEffect } from "react"

export function useFooterInView(): boolean {
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const footer = document.querySelector("footer")
    if (!footer) return

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(footer)
    return () => observer.disconnect()
  }, [])

  return inView
}
