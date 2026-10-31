"use client"

import { useEffect, useState } from "react"

import {
  isChunkLoadError,
  reloadOnceForChunkError,
} from "@lib/util/chunk-reload"

/**
 * Plasa de siguranță pentru erorile din browser.
 *
 * Fără ea, orice excepție — într-un widget mărunt sau un chunk lipsă după
 * deploy — înlocuia TOATĂ pagina cu „Application error: a client-side
 * exception has occurred", fără titlu. Exact asta a indexat Google pe home.
 * Aici eroarea rămâne în conținut: meniul, footerul și <title>-ul stau pe loc.
 */
export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [reloading, setReloading] = useState(false)

  useEffect(() => {
    console.error(error)
    if (isChunkLoadError(error) && reloadOnceForChunkError()) {
      setReloading(true)
    }
  }, [error])

  if (reloading) return null

  return (
    <div className="flex flex-col gap-4 items-center justify-center text-center px-4 min-h-[50vh]">
      <h2 className="text-2xl font-semibold">Ceva n-a mers cum trebuia</h2>
      <p className="text-sm text-brand-dark/70 max-w-md">
        Pagina nu s-a putut afișa complet. Încearcă din nou — de cele mai multe
        ori merge din a doua.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-brand-dark text-white px-5 py-2 text-sm font-medium"
        >
          Încearcă din nou
        </button>
        <a
          href="/"
          className="rounded-full border border-brand-dark/20 px-5 py-2 text-sm font-medium"
        >
          Prima pagină
        </a>
      </div>
    </div>
  )
}
