"use client"

import { useEffect, useState } from "react"

import { MegaMenuData } from "./data"

// O singură cerere pe sesiune de navigare: promisiunea rămâne în modul și
// supraviețuiește navigărilor client-side. La eroare se șterge, ca următoarea
// deschidere a meniului să reîncerce.
const requests = new Map<string, Promise<MegaMenuData>>()

const load = (countryCode: string) => {
  let request = requests.get(countryCode)
  if (!request) {
    request = fetch(`/api/mega-menu/${countryCode}`).then((res) => {
      if (!res.ok) throw new Error(`mega-menu ${res.status}`)
      return res.json() as Promise<MegaMenuData>
    })
    request.catch(() => requests.delete(countryCode))
    requests.set(countryCode, request)
  }
  return request
}

/**
 * Produsele din mega-meniu, aduse abia când `enabled` devine true (la prima
 * deschidere). `undefined` cât se încarcă, `null` dacă cererea a eșuat.
 */
export function useMegaMenuData(
  countryCode: string | undefined,
  enabled: boolean
): MegaMenuData | null | undefined {
  const [data, setData] = useState<MegaMenuData | null | undefined>(undefined)

  useEffect(() => {
    // La redeschidere `load` întoarce promisiunea deja rezolvată — fără
    // cerere nouă; după o eroare, reîncearcă.
    if (!enabled || !countryCode) return
    let cancelled = false
    // După o eroare, reîncercarea arată iar scheletul, nu starea goală.
    setData((prev) => (prev === null ? undefined : prev))
    load(countryCode).then(
      (result) => !cancelled && setData(result),
      () => !cancelled && setData(null)
    )
    return () => {
      cancelled = true
    }
  }, [enabled, countryCode])

  return data
}
