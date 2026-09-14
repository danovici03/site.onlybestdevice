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
 * Câmpurile pe care nu le avem confirmate rămân string gol, nu „TODO": paginile
 * care le afișează sar peste ele, în loc să publice un marcaj de lucru.
 */

export const COMPANY = {
  // Identitate juridică
  ragioneSociale: "ONLY BEST DEVICE S.R.L.",
  marchio: "onlybestdevice",
  formaGiuridica: "Societate cu răspundere limitată",
  piva: "43546040",
  codiceFiscale: "43546040",
  rea: "J06/26/2021",
  capitaleSociale: "", // necunoscut încă
  amministratoreUnico: "", // necunoscut încă

  // Sediul social e la aceeași adresă cu punctul de lucru.
  sedeLegale: {
    via: "Bulevardul Independenței nr. 19, Spațiu Comercial 2",
    cap: "420170",
    citta: "Bistrița",
    provincia: "BN",
    judet: "Bistrița-Năsăud",
    paese: "România",
  },

  // Punct de lucru / magazin: aceeași locație ca adresa de retur și de
  // ridicare personală (vezi STORE_PICKUP_ADDRESS din backend/.env).
  sedeOperativa: {
    via: "Bulevardul Independenței nr. 19, Spațiu Comercial 2",
    cap: "420170",
    citta: "Bistrița",
    provincia: "BN",
    judet: "Bistrița-Năsăud",
    paese: "România",
  },

  // Adresa la care se expediază retururile și produsele pentru service.
  adresaRetur: {
    via: "Bulevardul Independenței nr. 19",
    spatiu: "Spațiu Comercial 2",
    cap: "420170",
    citta: "Bistrița",
    provincia: "BN",
    judet: "Bistrița-Năsăud",
    paese: "România",
  },

  // Contacte
  email: "office@onlybestdevice.ro",
  emailPec: "",
  telefono: "0785 866 866",
  // Format internațional: linkurile wa.me se construiesc din cifrele acestui
  // câmp, iar wa.me nu acceptă prefixul național „0".
  whatsapp: "+40 785 866 866",

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
  readonly judet?: string
  readonly paese: string
}

/** Ordinea în care se scrie o adresă în România: stradă, oraș, cod, județ. */
function format(s: Indirizzo): string {
  const judet = s.judet ? `jud. ${s.judet}` : `jud. ${s.provincia}`
  return `${s.via}, ${s.citta}, ${s.cap}, ${judet}`
}


export function indirizzoLegale(): string {
  return format(COMPANY.sedeLegale)
}

export function indirizzoOperativo(): string {
  return format(COMPANY.sedeOperativa)
}

export function indirizzoRetur(): string {
  return format(COMPANY.adresaRetur)
}

/** @deprecated Folosește `indirizzoLegale()` sau `indirizzoOperativo()` — această funcție trimite la sediul social pentru retro-compatibilitate. */
export function indirizzoCompleto(): string {
  return indirizzoLegale()
}

/**
 * Sediul social și punctul de lucru sunt la aceeași adresă — paginile care le
 * listează pe amândouă n-au de ce s-o scrie de două ori.
 */
export function sediulCoincideCuPunctulDeLucru(): boolean {
  return indirizzoLegale() === indirizzoOperativo()
}
