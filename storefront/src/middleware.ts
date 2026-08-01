import { HttpTypes } from "@medusajs/types"
import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.MEDUSA_BACKEND_URL
const PUBLISHABLE_API_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
const DEFAULT_REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION || "us"

const regionMapCache = {
  regionMap: new Map<string, HttpTypes.StoreRegion>(),
  regionMapUpdated: Date.now(),
}

/**
 * Cere regiunile de la Medusa, fără să arunce niciodată.
 *
 * Middleware-ul rulează înaintea oricărei pagini, deci o excepție aici scoate
 * tot site-ul cu 500 (`MIDDLEWARE_INVOCATION_FAILED`), nu doar pagina cerută.
 * S-a văzut la un redeploy de backend: cât containerul repornea, ruta a întors
 * un corp care nu era JSON, iar `response.json()` a aruncat din middleware.
 *
 * De aceea corpul se citește ca text și se parsează manual — un backend care
 * pornește, un 502 de la reverse proxy sau un răspuns trunchiat sunt lucruri
 * normale într-o fereastră de deploy, nu motive de cădere.
 */
async function fetchRegions(
  cacheId: string
): Promise<HttpTypes.StoreRegion[] | null> {
  try {
    // Nu putem folosi clientul JS aici: middleware-ul rulează pe Edge, iar
    // clientul are nevoie de Node.
    const response = await fetch(`${BACKEND_URL}/store/regions`, {
      headers: {
        "x-publishable-api-key": PUBLISHABLE_API_KEY!,
      },
      next: {
        revalidate: 3600,
        tags: [`regions-${cacheId}`],
      },
      cache: "force-cache",
    })

    const body = await response.text()
    let json: any
    try {
      json = JSON.parse(body)
    } catch {
      console.error(
        `Middleware: /store/regions a răspuns ${response.status} cu un corp care nu e JSON: ${body.slice(0, 200)}`
      )
      return null
    }

    if (!response.ok) {
      console.error(
        `Middleware: /store/regions a răspuns ${response.status}: ${json?.message ?? ""}`
      )
      return null
    }

    const regions: HttpTypes.StoreRegion[] = json?.regions ?? []
    if (!regions.length) {
      console.error(
        "Middleware: nicio regiune configurată. Adaugă regiuni în Medusa Admin."
      )
      return null
    }

    return regions
  } catch (e) {
    console.error(
      `Middleware: /store/regions inaccesibil: ${(e as Error)?.message ?? e}`
    )
    return null
  }
}

/**
 * Harta cod-de-țară → regiune, sau `null` dacă nu avem de unde s-o construim.
 *
 * Cât timp există o hartă din cerințele anterioare, o servim mai departe chiar
 * dacă reîmprospătarea eșuează: o hartă veche de o oră e infinit mai bună decât
 * un site căzut. `regionMapUpdated` se mișcă doar la succes, ca următoarea
 * cerere să reîncerce.
 */
async function getRegionMap(cacheId: string) {
  const { regionMap, regionMapUpdated } = regionMapCache

  if (!BACKEND_URL) {
    console.error(
      "Middleware: MEDUSA_BACKEND_URL nu e setat, deci nu pot afla regiunile."
    )
    return null
  }

  const isStale = regionMapUpdated < Date.now() - 3600 * 1000
  if (regionMap.keys().next().value && !isStale) {
    return regionMap
  }

  const regions = await fetchRegions(cacheId)
  if (!regions) {
    // Harta veche, dacă există; altfel semnalăm apelantului că n-avem nimic.
    return regionMap.keys().next().value ? regionMap : null
  }

  regions.forEach((region) => {
    region.countries?.forEach((c) => {
      regionMapCache.regionMap.set(c.iso_2 ?? "", region)
    })
  })
  regionMapCache.regionMapUpdated = Date.now()

  return regionMapCache.regionMap
}

/**
 * Fetches regions from Medusa and sets the region cookie.
 * @param request
 * @param response
 */
async function getCountryCode(
  request: NextRequest,
  regionMap: Map<string, HttpTypes.StoreRegion | number>
) {
  try {
    let countryCode

    const vercelCountryCode = request.headers
      .get("x-vercel-ip-country")
      ?.toLowerCase()

    const urlCountryCode = request.nextUrl.pathname.split("/")[1]?.toLowerCase()

    if (urlCountryCode && regionMap.has(urlCountryCode)) {
      countryCode = urlCountryCode
    } else if (vercelCountryCode && regionMap.has(vercelCountryCode)) {
      countryCode = vercelCountryCode
    } else if (regionMap.has(DEFAULT_REGION)) {
      countryCode = DEFAULT_REGION
    } else if (regionMap.keys().next().value) {
      countryCode = regionMap.keys().next().value
    }

    return countryCode
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "Middleware.ts: Error getting the country code. Did you set up regions in your Medusa Admin and define a MEDUSA_BACKEND_URL environment variable? Note that the variable is no longer named NEXT_PUBLIC_MEDUSA_BACKEND_URL."
      )
    }
  }
}

/**
 * Middleware to handle region selection and onboarding status.
 */
// Pagini de sistem WooCommerce (RO) → rute noi storefront.
const LEGACY_SYSTEM_PAGES: Record<string, string> = {
  "/cos": "/cart",
  "/cosul-meu": "/cart",
  "/cosul-de-cumparaturi": "/cart",
  "/finalizare-comanda": "/checkout",
  "/finalizeaza-comanda": "/checkout",
  "/contul-meu": "/account",
  "/magazin": "/store",
  "/oferte": "/categories/oferte",
}

/**
 * Handle-uri de categorie scoase din uz de `merge-duplicate-categories.ts` →
 * calea canonică de azi.
 *
 * Catalogul a avut categorii duplicate din cele două valuri de import (seed RO
 * + WooCommerce). După unire, rândurile retrase nu mai există în baza de date,
 * deci URL-urile lor n-ar mai putea fi rezolvate — de aici, 404 în loc de 308.
 * Restul mutărilor de URL (sufixul de dezambiguizare: `apple-tablete` →
 * `tablete/apple`) se redirectează dinamic în pagina de categorie, care poate
 * încă rezolva handle-ul; aici stau doar cele care au dispărut.
 *
 * Cheile sunt scrise decodat: unele conțineau virgule și diacritice, care în
 * URL ajung percent-encodate. Valorile sunt căi relative la regiune, nu doar
 * handle-uri — „Fără categorie" nu are echivalent, deci pleacă în catalog.
 */
const RETIRED_CATEGORY_HANDLES: Record<string, string> = {
  "console,-jocuri": "/categories/console-jocuri",
  "tv,-audio-video-și-foto": "/categories/tv-audio-video-si-foto",
  "folii-de-protecție": "/categories/folii-de-protectie",
  "desktop-pc-&-periferice": "/categories/desktop-pc-periferice",
  "încărcătoare-&-accesorii": "/categories/incarcatoare-accesorii",
  "smartwatch-&-wearables": "/categories/smartwatch-wearables",
  "honor-2": "/categories/telefoane-mobile/honor",
  // Redenumite, nu șterse — vechiul handle avea typo-ul din slug-ul WooCommerce.
  "incarcatoare-acccesorii": "/categories/incarcatoare-accesorii",
  "smartatch-si-wearables": "/categories/smartwatch-wearables",
  // Pubela WooCommerce pentru produse necategorizate: nu e o categorie de
  // navigat, iar produsele ei sunt oricum în catalog.
  "fara-categorie": "/store",
}

/**
 * Redirecturi 301/308 de pe vechiul site WordPress/WooCommerce, ca să nu
 * pierdem poziționarea SEO a celor ~600 de produse și a categoriilor.
 * handle Medusa == slug WooCommerce, deci redirectul e pe pattern.
 */
function legacyRedirect(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname.replace(/\/+$/, "") || "/"

  // Categorii retrase: prinde și forma cu prefix de regiune (`/ro/categories/…`)
  // și pe cea fără, pe care o localizează pasul următor din middleware.
  const retired = pathname.match(
    /^(?:\/([a-z]{2}))?\/categories\/(?:.*\/)?([^/]+)$/
  )
  if (retired) {
    let leaf = retired[2]
    try {
      leaf = decodeURIComponent(leaf)
    } catch {
      // Percent-encoding rupt — mergem pe forma brută.
    }
    const target = RETIRED_CATEGORY_HANDLES[leaf.toLowerCase()]
    if (target) {
      // `search` se duce mai departe: altfel un link către o categorie filtrată
      // ar ateriza pe catalogul nefiltrat.
      return NextResponse.redirect(
        new URL(
          `/${retired[1] ?? DEFAULT_REGION}${target}${request.nextUrl.search}`,
          request.url
        ),
        308
      )
    }
  }

  const product = pathname.match(/^\/produs\/([^/]+)$/)
  if (product) {
    return NextResponse.redirect(
      new URL(`/${DEFAULT_REGION}/products/${product[1]}`, request.url),
      308
    )
  }

  // Categorii (posibil imbricate în URL): folosim ultimul segment ca handle.
  const category = pathname.match(/^\/(?:categorie-produs|product-category)\/(.+)$/)
  if (category) {
    const segs = category[1].split("/").filter(Boolean)
    const leaf = segs[segs.length - 1]
    return NextResponse.redirect(
      new URL(`/${DEFAULT_REGION}/categories/${leaf}`, request.url),
      308
    )
  }

  const sys = LEGACY_SYSTEM_PAGES[pathname]
  if (sys) {
    return NextResponse.redirect(
      new URL(`/${DEFAULT_REGION}${sys}`, request.url),
      308
    )
  }

  return null
}

/**
 * Ține cookie-ul martor `_medusa_session` sincron cu sesiunea reală. Coșul și
 * JWT-ul sunt httpOnly, deci `SessionProvider` (client) nu le poate vedea și
 * se bazează pe martor ca să știe dacă merită să ceară `/api/session`.
 * Martorul e pus la crearea coșului/login, dar vizitatorii cu coșuri de
 * dinaintea introducerii lui nu-l au — fără corecția de aici, coșul lor ar
 * exista dar n-ar mai apărea în header.
 */
const syncSessionMarker = (request: NextRequest, response: NextResponse) => {
  const hasSession =
    request.cookies.has("_medusa_cart_id") || request.cookies.has("_medusa_jwt")
  const hasMarker = request.cookies.has("_medusa_session")

  if (hasSession && !hasMarker) {
    response.cookies.set("_medusa_session", "1", {
      maxAge: 60 * 60 * 24 * 7,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    })
  } else if (!hasSession && hasMarker) {
    response.cookies.set("_medusa_session", "", { maxAge: -1 })
  }
  return response
}

export async function middleware(request: NextRequest) {
  const legacy = legacyRedirect(request)
  if (legacy) return legacy

  let redirectUrl = request.nextUrl.href

  let response = NextResponse.redirect(redirectUrl, 307)

  let cacheIdCookie = request.cookies.get("_medusa_cache_id")

  let cacheId = cacheIdCookie?.value || crypto.randomUUID()

  const regionMap = await getRegionMap(cacheId)

  // Fără regiuni (backend în plin redeploy, de pildă) NU blocăm tot site-ul.
  // Dacă url-ul are deja prefix de țară îl lăsăm să treacă — paginile au
  // fiecare fallback-ul lor — altfel trimitem pe regiunea implicită.
  //
  // Redirectul e 307, nu 308: e o stare temporară de degradare, iar un permanent
  // s-ar lipi în cache-ul browserelor și al CDN-ului mult după ce backend-ul
  // și-a revenit.
  if (!regionMap) {
    const seg = request.nextUrl.pathname.split("/")[1]?.toLowerCase()
    if ((seg && /^[a-z]{2}$/.test(seg)) || request.nextUrl.pathname.includes(".")) {
      return NextResponse.next()
    }
    const path =
      request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname
    return NextResponse.redirect(
      `${request.nextUrl.origin}/${DEFAULT_REGION}${path}${request.nextUrl.search}`,
      307
    )
  }

  const countryCode = await getCountryCode(request, regionMap)

  const urlHasCountryCode =
    countryCode && request.nextUrl.pathname.split("/")[1] === countryCode

  // if one of the country codes is in the url and the cache id is set, return next
  if (urlHasCountryCode && cacheIdCookie) {
    return syncSessionMarker(request, NextResponse.next())
  }

  // Url-ul are country code, dar lipsește cookie-ul: îl setăm și lăsăm cererea
  // să meargă mai departe.
  //
  // Varianta din starter făcea aici redirect 307 către exact același url. Pentru
  // orice client care nu păstrează cookie-uri — crawlere, boți de preview link,
  // curl — asta însemna buclă infinită de redirect, iar pentru un vizitator
  // normal un round-trip în plus la prima vizită. Cookie-ul îl punem și pe
  // request (ca `getCacheTag` din lib/data/cookies să-l vadă la randare) și
  // pe răspuns (ca browserul să-l rețină).
  if (urlHasCountryCode && !cacheIdCookie) {
    request.cookies.set("_medusa_cache_id", cacheId)

    const nextResponse = NextResponse.next({ request })

    nextResponse.cookies.set("_medusa_cache_id", cacheId, {
      maxAge: 60 * 60 * 24,
    })

    return syncSessionMarker(request, nextResponse)
  }

  // check if the url is a static asset
  if (request.nextUrl.pathname.includes(".")) {
    return NextResponse.next()
  }

  const redirectPath =
    request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname

  const queryString = request.nextUrl.search ? request.nextUrl.search : ""

  // If no country code is set, we redirect to the relevant region.
  if (!urlHasCountryCode && countryCode) {
    redirectUrl = `${request.nextUrl.origin}/${countryCode}${redirectPath}${queryString}`
    response = NextResponse.redirect(`${redirectUrl}`, 307)
  } else if (!urlHasCountryCode && !countryCode) {
    // Handle case where no valid country code exists (empty regions)
    return new NextResponse(
      "No valid regions configured. Please set up regions with countries in your Medusa Admin.",
      { status: 500 }
    )
  }

  return response
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|images|assets|png|svg|jpg|jpeg|gif|webp).*)",
  ],
}
