import { NextRequest, NextResponse } from "next/server"

import { findLocality } from "@lib/localities"
import { matchCounty } from "@lib/util/counties"

/**
 * Reverse geocoding pentru butonul „Detectează locația mea" din formularele de
 * adresă: coordonate GPS → localitate, județ, cod poștal.
 *
 * Coordonatele trec prin server, nu direct din browser către furnizor: așa
 * răspunsul se poate cacheui pe CDN, iar dacă înlocuim vreodată furnizorul cu
 * unul pe cheie (LocationIQ, Google), cheia nu ajunge în bundle-ul clientului.
 *
 * Furnizor: Nominatim (OpenStreetMap), gratuit și fără cheie. Politica lor cere
 * un User-Agent care identifică aplicația și maximum o cerere pe secundă. Pentru
 * un buton apăsat manual în checkout e în regulă; dacă volumul crește, se
 * schimbă doar `reverseGeocode` de mai jos.
 *
 * Rezultatul trece prin nomenclatorul SIRUTA, ca denumirea să fie cea oficială
 * (aceeași care pleacă pe AWB), nu forma OSM.
 */

const NOMINATIM = "https://nominatim.openstreetmap.org/reverse"

/** Nominatim cere un User-Agent care identifică aplicația, nu unul generic. */
const USER_AGENT =
  "onlybestdevice-storefront/1.0 (+https://www.onlybestdevice.ro)"

/** Peste atât renunțăm: clientul așteaptă cu butonul în „se detectează…". */
const TIMEOUT_MS = 6000

type NominatimAddress = Record<string, string | undefined>

/**
 * OSM scrie județul ca „Județul Cluj" sau „Municipiul București", iar
 * `matchCounty` compară nume canonice. Fără curățarea prefixului, București ar
 * rămâne mereu nerecunoscut.
 */
const stripCountyPrefix = (value: string) =>
  value.replace(/^\s*(jude[țt]ul|jud\.?|municipiul|mun\.?)\s+/i, "").trim()

/**
 * Localitatea, în ordinea în care OSM o raportează de la mare la mic. În
 * București `city` e „București", dar curierul vrea sectorul — iar sectorul
 * vine pe `city_district`, scris „Sector 3". Nomenclatorul îl are ca
 * „Sectorul 3", deci îl aducem la forma aia; altfel n-ar avea potrivire.
 */
function pickLocality(a: NominatimAddress): string {
  const sector = [a.city_district, a.suburb, a.borough]
    .map((v) => v?.match(/sector(?:ul)?\s*([1-6])\b/i)?.[1])
    .find(Boolean)
  if (sector) return `Sectorul ${sector}`

  return (
    a.city ??
    a.town ??
    a.village ??
    a.municipality ??
    a.hamlet ??
    a.suburb ??
    ""
  ).trim()
}

/**
 * Județul. `ISO3166-2-lvl4` („RO-CJ", „RO-B") e câmpul de încredere: e prezent
 * și acolo unde `county`/`state` lipsesc cu totul — cazul Bucureștiului, unde
 * adresa OSM n-are decât sectorul și orașul. Codul e chiar cel auto, pe care
 * `matchCounty` îl știe.
 */
function pickCounty(a: NominatimAddress): string | null {
  const iso = (a["ISO3166-2-lvl4"] ?? "").replace(/^RO-/i, "")
  return (
    matchCounty(iso) ??
    matchCounty(stripCountyPrefix(a.county ?? a.state ?? ""))
  )
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const lat = Number(params.get("lat"))
  const lon = Number(params.get("lon"))

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  ) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 })
  }

  // Patru zecimale ≈ 11 m: destul pentru adresă, dar rotunjirea face ca doi
  // vecini să nimerească aceeași intrare de cache în loc de două cereri.
  const q = new URLSearchParams({
    format: "jsonv2",
    lat: lat.toFixed(4),
    lon: lon.toFixed(4),
    zoom: "18",
    addressdetails: "1",
    "accept-language": "ro",
  })

  let json: any
  try {
    const res = await fetch(`${NOMINATIM}?${q}`, {
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: 60 * 60 * 24 * 30 },
    })
    if (!res.ok) {
      console.error(`[geo/reverse] Nominatim a răspuns ${res.status}`)
      return NextResponse.json({ error: "upstream" }, { status: 502 })
    }
    json = await res.json()
  } catch (e: any) {
    console.error(`[geo/reverse] Nominatim inaccesibil: ${e?.message ?? e}`)
    return NextResponse.json({ error: "upstream" }, { status: 502 })
  }

  const a: NominatimAddress = json?.address ?? {}

  if ((a.country_code ?? "").toLowerCase() !== "ro") {
    return NextResponse.json({ error: "outside_ro" }, { status: 200 })
  }

  const county = pickCounty(a)
  const raw = pickLocality(a)
  const locality = findLocality(raw, county)

  const name = locality?.name ?? raw
  if (!name) {
    return NextResponse.json({ error: "not_found" }, { status: 200 })
  }

  // Codul de la Nominatim bate regula noastră: acolo unde există, e al punctului
  // exact, nu al localității. Al nostru rămâne rezerva pentru sate.
  const postcode = (a.postcode ?? "").replace(/\s/g, "")
  const postalCode = /^\d{6}$/.test(postcode)
    ? postcode
    : (locality?.postalCode ?? "")

  return NextResponse.json(
    { name, county: county ?? locality?.county ?? "", postalCode },
    {
      // Aceleași coordonate dau același răspuns luni de zile; ce se schimbă e
      // doar nomenclatorul, care oricum vine cu un deploy nou.
      headers: { "cache-control": "public, max-age=3600, s-maxage=2592000" },
    }
  )
}
