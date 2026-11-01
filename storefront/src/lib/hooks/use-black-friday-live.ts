"use client"

import { useSyncExternalStore } from "react"

import { BLACK_FRIDAY, getBlackFridayPhase } from "@lib/util/black-friday"

/** Plafonul lui `setTimeout`: peste el, timer-ul pornește imediat. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1

const listeners = new Set<() => void>()
let timer: number | undefined

const isLive = () => getBlackFridayPhase(Date.now()) === "live"
const isLiveOnServer = () => false

const notify = () => {
  listeners.forEach((listener) => listener())
  schedule()
}

// Toate linkurile împart un singur timer, până la următoarea limită a campaniei.
const schedule = () => {
  window.clearTimeout(timer)
  const now = Date.now()
  const next = [BLACK_FRIDAY.start, BLACK_FRIDAY.end + 1].find((t) => t > now)
  if (next !== undefined) {
    timer = window.setTimeout(notify, Math.min(next - now, MAX_TIMEOUT_MS))
  }
}

// Un timer lung nu supraviețuiește sigur somnului telefonului sau înghețării
// tab-ului, deci starea se recalculează și la revenirea în pagină.
const subscribe = (listener: () => void) => {
  listeners.add(listener)

  if (listeners.size === 1) {
    schedule()
    document.addEventListener("visibilitychange", notify)
    window.addEventListener("pageshow", notify)
  }

  return () => {
    listeners.delete(listener)

    if (listeners.size === 0) {
      window.clearTimeout(timer)
      document.removeEventListener("visibilitychange", notify)
      window.removeEventListener("pageshow", notify)
    }
  }
}

/**
 * Spune dacă linkurile de campanie din meniu trebuie afișate.
 *
 * Se decide doar în browser: nav-ul stă în layout-ul prerandat, deci o verificare
 * pe server ar rămâne înghețată până la următorul build și ar lăsa linkurile pe
 * site după încheierea campaniei.
 */
export function useBlackFridayLive() {
  return useSyncExternalStore(subscribe, isLive, isLiveOnServer)
}
