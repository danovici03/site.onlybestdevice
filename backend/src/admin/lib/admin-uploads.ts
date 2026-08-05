import { isUsableUrl } from "../../lib/woo-description"

/**
 * Încărcarea fișierelor din Admin, prin ruta standard `POST /admin/uploads`.
 *
 * Ruta acceptă mai multe fișiere într-o singură cerere și nu are nicio limită
 * de mărime sau de tip — verificările stau aici, ca operatorul să afle că e
 * ceva în neregulă înainte de a aștepta un upload de 40 MB.
 *
 * Unde ajung fișierele ține de `medusa-config.ts`: pe producție în bucketul S3,
 * în dev sub `./static` (URL absolut, servit de backend).
 */

/** Peste atât, poza e oricum prea mare pentru o descriere de produs. */
const MAX_BYTES = 8 * 1024 * 1024

export const isSanitizerSafeUrl = isUsableUrl

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

/**
 * Urcă imaginile și întoarce URL-urile lor, în ordinea fișierelor.
 *
 * Aruncă dacă vreun URL n-ar supraviețui sanitizatorului: `isUsableUrl` cere
 * `http(s)://` și respinge numele care arată a placeholder (`loading.gif`,
 * `blank.png`, `1x1.png`…). Fără verificarea asta, poza s-ar insera frumos în
 * editor și ar dispărea tăcut la prima salvare.
 */
export async function uploadImages(files: File[]): Promise<string[]> {
  if (!files.length) return []

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      throw new Error(`„${file.name}" nu e o imagine`)
    }
    if (file.size > MAX_BYTES) {
      throw new Error(
        `„${file.name}" are ${mb(file.size)}, peste limita de ${mb(MAX_BYTES)}`
      )
    }
  }

  const form = new FormData()
  // Nu setăm Content-Type — browserul adaugă boundary-ul corect pentru FormData.
  for (const file of files) {
    form.append("files", file)
  }

  const res = await fetch("/admin/uploads", {
    method: "POST",
    credentials: "include",
    body: form,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message || `Încărcarea a eșuat (${res.status})`)
  }

  const data = await res.json()
  const urls: string[] = (data?.files ?? []).map((f: { url?: string }) => f?.url)
  if (urls.length !== files.length || urls.some((u) => !u)) {
    throw new Error("Răspuns invalid de la încărcare")
  }

  const rejected = urls.filter((u) => !isSanitizerSafeUrl(u))
  if (rejected.length) {
    throw new Error(
      `URL-ul rezultat nu e acceptat de sanitizator (${rejected[0]}). ` +
        "Redenumește fișierul (fără „placeholder”, „blank”, „1x1”…) și încearcă din nou."
    )
  }

  return urls
}
