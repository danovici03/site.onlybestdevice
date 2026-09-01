/**
 * Datele fiscale ale cumpărătorului-firmă, salvate pe coș la checkout și
 * moștenite de comandă.
 *
 * Cheile oglindesc storefront/src/lib/util/cui.ts — dacă se schimbă acolo, se
 * schimbă și aici, altfel emailurile și adminul rămân fără CUI fără să se
 * plângă nimeni.
 */

export type BuyerFiscal = {
  /** Doar cifre, fără „RO". */
  cui: string
  name: string
  regCom: string
  vatPayer: boolean
}

/** Cum se scrie pe factură: cu „RO" doar la firmele plătitoare de TVA. */
export const formatCui = (cui: string, vatPayer: boolean): string =>
  vatPayer ? `RO${cui}` : cui

export const readBuyerFiscal = (
  metadata?: Record<string, unknown> | null
): BuyerFiscal | null => {
  const cui = metadata?.company_cui
  if (typeof cui !== "string" || !cui) return null

  const str = (key: string) => {
    const value = metadata?.[key]
    return typeof value === "string" ? value : ""
  }

  return {
    cui,
    name: str("company_name"),
    regCom: str("company_reg_com"),
    vatPayer: metadata?.company_vat_payer === true,
  }
}
