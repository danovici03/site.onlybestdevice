"use client"

import { useEffect } from "react"

import {
  isChunkLoadError,
  reloadOnceForChunkError,
} from "@lib/util/chunk-reload"

/**
 * Ultima plasă: erori chiar în layout-ul rădăcină, unde `error.tsx` nu ajunge.
 * Înlocuiește tot documentul, deci își pune singură titlul — altfel Google ar
 * vedea iar o pagină „Fără titlu".
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
    if (isChunkLoadError(error)) reloadOnceForChunkError()
  }, [error])

  return (
    <html lang="ro">
      <head>
        <title>Onlybestdevice – Telefoane, laptopuri și tablete, în rate</title>
      </head>
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          gap: 16,
          textAlign: "center",
          padding: 16,
          margin: 0,
        }}
      >
        <h2 style={{ fontSize: 24, margin: 0 }}>Ceva n-a mers cum trebuia</h2>
        <p style={{ margin: 0, color: "#555" }}>
          Pagina nu s-a putut afișa. Încearcă din nou.
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <button type="button" onClick={() => reset()}>
            Încearcă din nou
          </button>
          <a href="/">Prima pagină</a>
        </div>
      </body>
    </html>
  )
}
