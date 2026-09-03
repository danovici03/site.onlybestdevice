/**
 * Aducerea paginii sursă.
 *
 * Antetele imită un browser pentru că altfel jumătate din magazine întorc 403.
 * Nu e o metodă de a ocoli o interdicție — importul îl pornește un operator
 * autentificat, pentru un produs pe care îl vinde; e doar diferența dintre a
 * primi pagina și a primi un zid, la aceeași cerere publică.
 *
 * Când tot iese 403 (CDN-urile refuză des IP-urile de datacenter — vezi nota
 * din `import-woo-descriptions.ts`, unde `www.sony.ro` a refuzat 162 de poze
 * cerute din containerul de pe Hetzner), aruncăm o eroare care spune explicit
 * ce are de făcut operatorul: să lipească sursa paginii din browserul lui.
 */

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

const TIMEOUT_MS = 20_000

/** Peste atât nu mai e o pagină de produs, ci altceva. */
const MAX_BYTES = 6 * 1024 * 1024

export class PageFetchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** `true` dacă lipirea sursei din browser ar rezolva. */
    readonly canPasteHtml = true
  ) {
    super(message)
    this.name = "PageFetchError"
  }
}

/**
 * Blochează adresele din rețeaua internă.
 *
 * Ruta e de admin, deci nu apărăm de un atacator anonim, ci de un URL greșit
 * care ar transforma backendul într-un proxy către serviciile lui interne
 * (Postgres, Redis, metadata de cloud). Verificăm pe nume de gazdă și pe IP
 * literal — nu rezolvăm DNS, ar fi oricum o cursă între verificare și cerere.
 */
const PRIVATE_HOST =
  /^(localhost|127\.|10\.|192\.168\.|169\.254\.|::1$|\[::1\]|0\.0\.0\.0|172\.(1[6-9]|2\d|3[01])\.)/i

export function assertPublicUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new PageFetchError("Linkul nu e un URL valid.", undefined, false)
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new PageFetchError("Doar linkuri http(s).", undefined, false)
  }
  if (PRIVATE_HOST.test(url.hostname) || !url.hostname.includes(".")) {
    throw new PageFetchError("Adresă din rețeaua internă — refuzată.", undefined, false)
  }
  return url
}

export type FetchedPage = {
  html: string
  /** URL-ul FINAL, după redirecturi — baza pentru URL-urile relative. */
  url: string
}

export async function fetchPage(raw: string): Promise<FetchedPage> {
  const url = assertPublicUrl(raw)

  let res: Response
  try {
    res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ro-RO,ro;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
      },
    })
  } catch (err) {
    const reason = err instanceof Error && err.name === "TimeoutError" ? "n-a răspuns în 20s" : "nu a putut fi contactat"
    throw new PageFetchError(`Site-ul ${reason}.`)
  }

  if (!res.ok) {
    const hint =
      res.status === 403 || res.status === 429
        ? " Magazinul refuză cererile din server. Deschide pagina în browser, salvează sursa (Cmd+U) și lipește-o în câmpul de mai jos."
        : ""
    throw new PageFetchError(`Pagina a răspuns ${res.status}.${hint}`, res.status)
  }

  const type = res.headers.get("content-type") || ""
  if (type && !/text\/html|application\/xhtml/i.test(type)) {
    throw new PageFetchError(`Linkul nu duce la o pagină HTML (${type.split(";")[0]}).`, undefined, false)
  }

  const buffer = await res.arrayBuffer()
  if (buffer.byteLength > MAX_BYTES) {
    throw new PageFetchError("Pagina e prea mare (peste 6 MB).", undefined, false)
  }

  // Charset-ul din antet bate `<meta charset>`; fără el, site-urile românești
  // pe ISO-8859-2 ar veni cu diacriticele stricate.
  const charset = /charset=([\w-]+)/i.exec(type)?.[1] || "utf-8"
  let html: string
  try {
    html = new TextDecoder(charset).decode(buffer)
  } catch {
    html = new TextDecoder("utf-8").decode(buffer)
  }

  return { html, url: res.url || url.toString() }
}
