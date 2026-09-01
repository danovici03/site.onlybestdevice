/**
 * Codul de identificare fiscală al unei firme din România: normalizare,
 * validare și forma în care îl ținem pe coș/comandă.
 *
 * Fișierul e importat și de client (câmpul din checkout), și de server (ruta
 * `/api/anaf`, factura PDF), deci n-are voie să atingă nomenclatoare grele sau
 * `fetch` — doar șiruri. Interogarea ANAF stă în `@lib/anaf`, care rulează
 * exclusiv pe server.
 */

/** Datele fiscale ale cumpărătorului-firmă, așa cum le salvăm în metadata. */
export type CompanyFiscal = {
  /** Doar cifre, fără prefixul „RO" — forma cerută de ANAF și de e-Factura. */
  cui: string
  /** Denumirea din registrul ANAF, nu ce a tastat clientul. */
  name: string
  /** Nr. de ordine în registrul comerțului, ex. „J06/26/2021". */
  regCom: string
  /** Plătitoare de TVA la data comenzii — de asta depinde prefixul „RO". */
  vatPayer: boolean
}

/**
 * Cheile din `cart.metadata` / `order.metadata`. Plate, nu un obiect imbricat:
 * Medusa face merge doar pe primul nivel, deci un obiect `company` s-ar
 * suprascrie întreg la fiecare salvare parțială.
 */
export const COMPANY_META_KEYS = {
  cui: "company_cui",
  name: "company_name",
  regCom: "company_reg_com",
  vatPayer: "company_vat_payer",
} as const

/**
 * Scoate din input doar cifrele CUI-ului: „RO 14399840", „ro-14399840",
 * „14.399.840" duc toate la „14399840". Întoarce `null` dacă nu rămâne un
 * număr plauzibil (ANAF alocă între 2 și 10 cifre).
 */
export function normalizeCui(input?: string | null): string | null {
  if (!input) return null

  const digits = input
    .trim()
    .replace(/^ro/i, "")
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "")

  if (digits.length < 2 || digits.length > 10) return null

  return digits
}

/**
 * Cifra de control a CUI-ului (cheia 753217532). O verificăm înainte de a
 * pleca la ANAF: la o cifră greșită de client, răspunsul ar fi oricum „nu
 * există", iar serviciul acceptă o singură cerere pe secundă pentru tot site-ul.
 */
export function isValidCui(cui: string): boolean {
  if (!/^\d{2,10}$/.test(cui)) return false

  const control = Number(cui[cui.length - 1])
  const body = cui.slice(0, -1).padStart(9, "0")
  const key = "753217532"

  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += Number(body[i]) * Number(key[i])
  }

  const computed = (sum * 10) % 11
  return (computed === 10 ? 0 : computed) === control
}

/** Cum se scrie pe factură: cu „RO" doar dacă firma e plătitoare de TVA. */
export function formatCui(cui: string, vatPayer: boolean): string {
  return vatPayer ? `RO${cui}` : cui
}

/** Datele de firmă dintr-un `metadata` de coș sau de comandă, dacă există. */
export function readCompanyFiscal(
  metadata?: Record<string, unknown> | null
): CompanyFiscal | null {
  const cui = metadata?.[COMPANY_META_KEYS.cui]
  if (typeof cui !== "string" || !cui) return null

  const str = (key: string) => {
    const value = metadata?.[key]
    return typeof value === "string" ? value : ""
  }

  return {
    cui,
    name: str(COMPANY_META_KEYS.name),
    regCom: str(COMPANY_META_KEYS.regCom),
    vatPayer: metadata?.[COMPANY_META_KEYS.vatPayer] === true,
  }
}
