const KEY = "obd_chunk_reload"

/**
 * Eroarea vine dintr-un fișier JS care nu se mai poate încărca?
 *
 * Se întâmplă după un deploy: pagina (sau Googlebot, care randează cu
 * întârziere) are HTML-ul vechi și cere chunk-uri care nu mai există.
 */
export const isChunkLoadError = (error: Error) =>
  error?.name === "ChunkLoadError" ||
  /Loading (CSS )?chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
    error?.message ?? ""
  )

/**
 * Reîncarcă pagina o singură dată pe sesiune, ca să ia HTML-ul deployului nou.
 * Întoarce `false` dacă s-a încercat deja (sau storage-ul e blocat), ca
 * apelantul să afișeze mesajul de eroare în loc de o buclă de reîncărcări.
 */
export const reloadOnceForChunkError = () => {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0)
    if (Date.now() - last < 60_000) return false
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    return false
  }
  window.location.reload()
  return true
}
