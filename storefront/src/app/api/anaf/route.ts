import { NextRequest, NextResponse } from "next/server"

import { AnafError, lookupCompany } from "@lib/anaf"

/**
 * Completarea automată a datelor de facturare pe firmă, din registrul public
 * ANAF (`/api/anaf?cui=14399840`).
 *
 * Trece prin serverul nostru pentru că ANAF nu trimite CORS, dar și pentru
 * cache: serviciul acceptă o cerere pe secundă, iar câmpul din checkout ar
 * putea fi apăsat de mai mulți clienți deodată.
 */
export async function GET(req: NextRequest) {
  const cui = (req.nextUrl.searchParams.get("cui") ?? "").trim()

  try {
    const company = await lookupCompany(cui)

    if (!company) {
      return NextResponse.json(
        { company: null, error: "Nu am găsit nicio firmă cu acest CUI." },
        {
          status: 404,
          // Și „nu există" merită cache: altfel fiecare tastă în plus peste un
          // CUI greșit ajunge la ANAF.
          headers: { "cache-control": "public, s-maxage=3600" },
        }
      )
    }

    return NextResponse.json(
      { company },
      {
        // Datele din registru se schimbă de câteva ori pe an, nu pe minut.
        headers: { "cache-control": "public, max-age=0, s-maxage=86400" },
      }
    )
  } catch (err) {
    const status = err instanceof AnafError ? err.status : 500
    const message =
      err instanceof AnafError
        ? err.message
        : "Verificarea CUI-ului a eșuat. Poți completa datele manual."

    return NextResponse.json({ company: null, error: message }, { status })
  }
}
