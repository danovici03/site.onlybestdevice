/**
 * Aducerea pozelor de la sursă în stocarea noastră.
 *
 * De ce nu le lăsăm hotlinkate, ca la importul din WooCommerce: acolo decizia
 * a fost asumată pentru ~5.900 de poze deja existente, iar prețul ei se vede
 * în `import-woo-descriptions.ts` — un script întreg care umblă după pozele
 * moarte, cu avertisment să nu-l rulezi din datacenter. Pentru pozele care
 * intră de acum înainte plătim o dată câțiva MB în S3 și scăpăm de clasa asta
 * de probleme: linkul nu mai depinde de CDN-ul altui magazin.
 *
 * Erorile nu opresc importul. O poză care nu se descarcă se raportează și
 * dispare din rezultat — mai bine un produs cu 9 poze din 10 decât un import
 * eșuat la ultima.
 */
import { Modules } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"

import { assertPublicUrl } from "./fetch-page"

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

const TIMEOUT_MS = 25_000

/** Cât acceptăm per poză. Peste, e o eroare de sursă, nu o poză de produs. */
const MAX_BYTES = 12 * 1024 * 1024

/**
 * Câte poze aducem într-un import, cu tot cu cele din descriere.
 *
 * O pagină de produs cu galerie și descriere bogată ajunge la ~25. Plafonul e
 * pentru cazul în care extragerea prinde din greșeală o pagină de listare, sau
 * pentru HTML-ul lipit de operator: fără el, un singur import ar putea porni
 * sute de descărcări.
 */
const MAX_IMAGES = 60

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
}

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
}

export type RehostResult = {
  /** URL sursă → URL-ul nostru. Doar pozele urcate cu succes. */
  map: Map<string, string>
  /** Mesaje pentru operator, câte unul per poză ratată. */
  failures: { url: string; reason: string }[]
}

const basename = (url: string): string => {
  try {
    const name = new URL(url).pathname.split("/").filter(Boolean).pop() || "imagine"
    // Fără extensie aici: o punem din mime, ca fișierul să fie servit corect
    // chiar dacă sursa avea `.jpg` peste un webp.
    return name.replace(/\.[a-z0-9]+$/i, "").slice(0, 60) || "imagine"
  } catch {
    return "imagine"
  }
}

/**
 * Descarcă o poză.
 *
 * `Referer` e pus intenționat pe pagina produsului: unele CDN-uri (Akamai la
 * eMAG, printre altele) servesc pozele doar cererilor care par să vină din
 * pagina lor. Fără el primim 403 exact pe pozele care se văd în browser.
 */
async function download(
  url: string,
  referer?: string
): Promise<{ content: Buffer; mimeType: string }> {
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      ...(referer ? { Referer: referer } : {}),
    },
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const buffer = Buffer.from(await res.arrayBuffer())
  if (!buffer.length) throw new Error("fișier gol")
  if (buffer.length > MAX_BYTES) {
    throw new Error(`${(buffer.length / 1024 / 1024).toFixed(1)} MB, peste limită`)
  }

  const headerMime = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase()
  const extMime = MIME_BY_EXT[(url.split("?")[0].split(".").pop() || "").toLowerCase()]
  const mimeType = EXT_BY_MIME[headerMime] ? headerMime : extMime

  if (!mimeType) throw new Error(`tip necunoscut (${headerMime || "fără content-type"})`)

  return { content: buffer, mimeType }
}

/**
 * Urcă în stocarea noastră pozele date și întoarce corespondența URL-urilor.
 *
 * Pozele care sunt DEJA pe stocarea noastră se sar (import repetat pe același
 * produs, sau o descriere editată în admin cu poze urcate de acolo).
 */
export async function rehostImages(
  container: MedusaContainer,
  urls: string[],
  opts: { referer?: string; ourFileUrl?: string; concurrency?: number } = {}
): Promise<RehostResult> {
  const fileModule = container.resolve(Modules.FILE)
  const ourHost = opts.ourFileUrl ? safeHost(opts.ourFileUrl) : undefined

  const unique = [...new Set(urls.filter(Boolean))]
  const map = new Map<string, string>()
  const failures: { url: string; reason: string }[] = []

  if (unique.length > MAX_IMAGES) {
    for (const url of unique.slice(MAX_IMAGES)) {
      failures.push({ url, reason: `peste limita de ${MAX_IMAGES} poze per import` })
    }
  }

  const pending = unique.slice(0, MAX_IMAGES).filter((url) => {
    if (ourHost && safeHost(url) === ourHost) {
      map.set(url, url)
      return false
    }
    // Aceeași apărare ca la aducerea paginii: pe calea cu HTML lipit de
    // operator, URL-urile pozelor n-au trecut prin nicio verificare, iar un
    // `src="http://10.0.0.5/..."` ar transforma descărcarea în cerere către
    // rețeaua internă.
    try {
      assertPublicUrl(url)
      return true
    } catch (err) {
      failures.push({ url, reason: err instanceof Error ? err.message : "URL respins" })
      return false
    }
  })

  const limit = Math.max(1, Math.min(opts.concurrency ?? 4, 8))
  const queue = [...pending]

  const worker = async () => {
    for (;;) {
      const url = queue.shift()
      if (!url) return
      try {
        const { content, mimeType } = await download(url, opts.referer)
        const ext = EXT_BY_MIME[mimeType] ?? "jpg"
        const [file] = await fileModule.createFiles([
          {
            filename: `${basename(url)}.${ext}`,
            mimeType,
            content: content.toString("base64"),
            access: "public",
          },
        ])
        if (!file?.url) throw new Error("stocarea n-a întors un URL")
        map.set(url, file.url)
      } catch (err) {
        failures.push({ url, reason: err instanceof Error ? err.message : "eroare necunoscută" })
      }
    }
  }

  await Promise.all(Array.from({ length: limit }, worker))

  return { map, failures }
}

const safeHost = (url: string): string | undefined => {
  try {
    return new URL(url).host
  } catch {
    return undefined
  }
}

/**
 * Rescrie `src`-urile din descriere cu URL-urile noastre.
 *
 * Pozele rămase nemapate (descărcare eșuată) sunt scoase cu tot cu `<figure>`
 * gol în care stăteau: o poză care n-a putut fi adusă acum nu se va încărca
 * nici în magazin — sursa e aceeași.
 */
export function rewriteDescriptionImages(html: string, map: Map<string, string>): string {
  return html
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const src = /\ssrc="([^"]*)"/i.exec(tag)?.[1]
      if (!src) return ""
      const replacement = map.get(src)
      if (!replacement) return ""
      return tag.replace(/(\ssrc=")[^"]*(")/i, `$1${replacement.replace(/"/g, "&quot;")}$2`)
    })
    // `<figure>` rămas fără poză (`<figure></figure>`) n-are ce căuta în pagină.
    .replace(/<figure>\s*<\/figure>/gi, "")
}
