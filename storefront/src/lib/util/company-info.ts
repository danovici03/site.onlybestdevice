/**
 * Date societare onlybestdevice.
 *
 * NOTĂ: cheile păstrează denumirile originale (italiene) pentru compatibilitate
 * cu componentele care le importă; valorile sunt cele românești.
 *   piva          -> CUI
 *   codiceFiscale -> CUI / CIF
 *   rea           -> Nr. Reg. Comerțului (J..)
 *   amministratoreUnico -> Administrator
 *
 * TODO rămase: capital social real, administrator, strada + codul poștal al sediului.
 */

export const COMPANY = {
  // Identitate juridică
  ragioneSociale: "ONLY BEST DEVICE S.R.L.",
  marchio: "onlybestdevice",
  formaGiuridica: "Societate cu răspundere limitată",
  piva: "43546040",
  codiceFiscale: "43546040",
  rea: "J06/26/2021",
  capitaleSociale: "200 RON", // TODO: capital social real
  amministratoreUnico: "TODO", // TODO: nume administrator

  // Sediu social (TODO: stradă + cod poștal reale)
  sedeLegale: {
    via: "Str. Exemplu nr. 1",
    cap: "420000",
    citta: "Bistrița",
    provincia: "BN",
    paese: "România",
  },

  // Punct de lucru / contact clienți (TODO: stradă + cod poștal reale)
  sedeOperativa: {
    via: "Str. Exemplu nr. 1",
    cap: "420000",
    citta: "Bistrița",
    provincia: "BN",
    paese: "România",
  },

  // Contacte
  email: "contact@onlybestdevice.ro",
  emailPec: "",
  telefono: "+40 700 000 000",
  whatsapp: "+40 700 000 000",

  // Program serviciu clienți
  orari: "Luni–Vineri 9:00–18:00",
  slaRisposta: "Răspundem în 24–48 de ore lucrătoare.",

  // Social
  social: {
    facebook: "https://www.facebook.com/onlybestdevice",
    instagram: "https://www.instagram.com/onlybestdevice",
    tiktok: "https://www.tiktok.com/@onlybestdevice",
  },

  // Web
  dominio: "onlybestdevice.ro",
  baseUrl: "https://onlybestdevice.ro",
} as const

type Indirizzo = {
  readonly via: string
  readonly cap: string
  readonly citta: string
  readonly provincia: string
  readonly paese: string
}

function format(s: Indirizzo): string {
  return `${s.via}, ${s.cap} ${s.citta} (${s.provincia}), ${s.paese}`
}

export function indirizzoLegale(): string {
  return format(COMPANY.sedeLegale)
}

export function indirizzoOperativo(): string {
  return format(COMPANY.sedeOperativa)
}

/** @deprecated Folosește `indirizzoLegale()` sau `indirizzoOperativo()` — această funcție trimite la sediul social pentru retro-compatibilitate. */
export function indirizzoCompleto(): string {
  return indirizzoLegale()
}
