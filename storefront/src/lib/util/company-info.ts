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
 * TODO: completați datele legale reale (CUI, Reg. Com., capital social, sediu).
 */

export const COMPANY = {
  // Identitate juridică (TODO: date reale)
  ragioneSociale: "onlybestdevice S.R.L.",
  marchio: "onlybestdevice",
  formaGiuridica: "Societate cu răspundere limitată",
  piva: "RO00000000",
  codiceFiscale: "RO00000000",
  rea: "J00/0000/2026",
  capitaleSociale: "200 RON",
  amministratoreUnico: "TODO",

  // Sediu social (TODO: adresă reală)
  sedeLegale: {
    via: "Str. Exemplu nr. 1",
    cap: "010101",
    citta: "București",
    provincia: "B",
    paese: "România",
  },

  // Punct de lucru / contact clienți
  sedeOperativa: {
    via: "Str. Exemplu nr. 1",
    cap: "010101",
    citta: "București",
    provincia: "B",
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

/** @deprecated Usa `indirizzoLegale()` o `indirizzoOperativo()` — questa funzione punta alla sede legale per retro-compatibilità. */
export function indirizzoCompleto(): string {
  return indirizzoLegale()
}
