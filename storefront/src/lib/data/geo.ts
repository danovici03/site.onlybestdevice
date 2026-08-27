import { headers } from "next/headers"

import { findLocality } from "@lib/localities"
import { matchCounty } from "@lib/util/counties"

/**
 * Adresa presupusă din IP-ul vizitatorului, folosită doar ca precompletare.
 *
 * Vercel pune pe fiecare cerere anteturile `x-vercel-ip-*` (oraș, cod de
 * regiune ISO 3166-2, cod poștal). Codul de regiune e practic exact — e
 * chiar codul auto al județului, pe care `matchCounty` îl știe deja. Orașul e
 * mai slab: pe mobil IP-ul e adesea al gateway-ului operatorului, deci poate
 * ieși București pentru un client din Bacău. De aceea rezultatul e o sugestie
 * vizibilă, pe care clientul o poate schimba, nu o completare tăcută.
 *
 * Codul poștal din antet îl ignorăm intenționat: pentru orașe e cel al zonei
 * centrale, nu al adresei, iar o factură cu cod greșit e mai rea decât un câmp
 * gol. Cel corect vine la alegerea localității din listă, unde e neambiguu.
 *
 * ATENȚIE: `headers()` face pagina dinamică. Nu o chema din componente care
 * trebuie să rămână statice și nu o îmbrăca în try/catch — ar înghiți tăcut
 * semnalul de bailout și pagina s-ar prerandarea cu datele primului vizitator.
 */

export type GeoHint = {
  /** Numele canonic al localității, sau "" dacă nu l-am putut recunoaște. */
  city: string
  /** Județul canonic, sau "" dacă lipsește. */
  province: string
}

/**
 * Anteturile dau denumirile în engleză pentru orașele cunoscute. Restul se
 * potrivesc singure: căutarea în nomenclator ignoră diacriticele, deci
 * „Cluj-Napoca" sau „Iasi" nimeresc fără ajutor.
 */
const CITY_ALIASES: Record<string, string> = {
  bucharest: "București",
  jassy: "Iași",
}

export async function readGeoHint(): Promise<GeoHint | null> {
  const h = await headers()

  // În dezvoltare nu există anteturi Vercel; fără o portiță, precompletarea
  // n-ar putea fi probată decât în producție.
  const rawCity =
    h.get("x-vercel-ip-city") ?? process.env.GEO_DEBUG_CITY ?? null
  const rawRegion =
    h.get("x-vercel-ip-country-region") ?? process.env.GEO_DEBUG_REGION ?? null
  const country = (
    h.get("x-vercel-ip-country") ??
    process.env.GEO_DEBUG_COUNTRY ??
    "RO"
  ).toUpperCase()

  // Nomenclatorul e românesc; pentru un vizitator din afară o sugestie ar fi
  // doar zgomot.
  if (country !== "RO") return null

  let city = ""
  if (rawCity) {
    try {
      city = decodeURIComponent(rawCity)
    } catch {
      // Percent-encoding rupt — mergem pe forma brută.
      city = rawCity
    }
    city = CITY_ALIASES[city.trim().toLowerCase()] ?? city.trim()
  }

  const province = matchCounty(rawRegion) ?? ""

  // Trecerea prin nomenclator face două lucruri: aduce numele la forma
  // oficială cu diacritice și, dacă antetul de regiune lipsea, ne dă județul.
  const locality = findLocality(city, province || undefined)

  const hint: GeoHint = {
    city: locality?.name ?? "",
    province: province || locality?.county || "",
  }

  return hint.city || hint.province ? hint : null
}
