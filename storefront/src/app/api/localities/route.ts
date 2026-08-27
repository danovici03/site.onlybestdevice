import { NextRequest, NextResponse } from "next/server"

import { searchLocalities } from "@lib/localities"

/**
 * Autocomplete pentru câmpul „Oraș / localitate" din checkout și din cont.
 *
 * Nomenclatorul are ~360 KB, deci nu poate pleca în bundle-ul clientului; stă
 * pe server și se interoghează de aici. Ca la sugestiile de căutare, e un GET
 * (nu server action) ca să poată fi anulat cu AbortController și cacheuit.
 */

/** Sub două litere lista e inutilă: „a" prinde jumătate din nomenclator. */
const MIN_QUERY = 2

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const q = (params.get("q") ?? "").trim()
  const county = (params.get("county") ?? "").trim()

  if (q.length < MIN_QUERY) {
    return NextResponse.json({ localities: [] })
  }

  return NextResponse.json(
    { localities: searchLocalities(q, { county: county || undefined }) },
    {
      // Nomenclatorul se schimbă o dată la câțiva ani și e generat în repo, deci
      // răspunsul e valabil până la următorul deploy. Îl ținem și în browser:
      // cine se răzgândește și rescrie orașul nu mai atinge rețeaua.
      headers: {
        "cache-control": "public, max-age=3600, s-maxage=31536000",
      },
    }
  )
}
