import { NextResponse } from "next/server"

import { listRegions } from "@lib/data/regions"
import { failStaticParams } from "@lib/util/static-params"
import { resolveMegaMenuData } from "@modules/layout/components/mega-menu/resolve"

/**
 * Produsele din mega-meniu, ca JSON static pe CDN.
 *
 * Statică (ISR) intenționat: se regenerează pe tagurile fetch-urilor din
 * `resolveMegaMenuData` (`products`, `categories`) și pe TTL, o singură scriere
 * pentru tot site-ul. Browserul o cere doar la prima deschidere a meniului, iar
 * răspunsul vine din cache-ul CDN, fără funcție.
 *
 * `dynamicParams = false`: doar țările din regiuni. Altfel orice
 * `/api/mega-menu/<orice>` ar genera și cache-ui încă o intrare ISR.
 */
export const dynamic = "force-static"
export const dynamicParams = false
// Același TTL ca fetch-urile (`CACHE_TTL_SECONDS` din `lib/data/cookies.ts`);
// trebuie să fie literal, Next îl citește static.
export const revalidate = 43200

export async function generateStaticParams() {
  try {
    const regions = await listRegions()
    const countryCodes = (regions ?? [])
      .flatMap((r) => r.countries?.map((c) => c.iso_2) ?? [])
      .filter((c): c is string => !!c)

    return Array.from(new Set(countryCodes)).map((countryCode) => ({ countryCode }))
  } catch (error) {
    failStaticParams("mega-meniu", error)
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ countryCode: string }> }
) {
  const { countryCode } = await params
  return NextResponse.json(await resolveMegaMenuData(countryCode))
}
