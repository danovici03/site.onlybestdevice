/**
 * Contul bancar pe care se încasează comenzile lăsate pe ordin de plată.
 *
 * Citit din env la fiecare apel, nu la import: providerul Resend se încarcă
 * odată cu modulele Medusa, iar o citire la import ar putea prinde env-ul
 * neîncărcat complet. E același motiv ca la `locale()` din templates.
 *
 * Nu are valori implicite. Un IBAN vechi rămas în cod e mai rău decât unul
 * lipsă: banii ar pleca într-un cont închis, iar clientul ar afla abia când
 * sună să întrebe de colet. Fără `BANK_IBAN`, emailul de virament nu se
 * trimite deloc — vezi verificarea din `POST /admin/orders/:id/status`.
 */
export type BankAccount = {
  iban: string
  name: string
  holder: string
}

/** Denumirea societății, oglindește LEGAL din modules/resend/templates. */
const LEGAL = "ONLY BEST DEVICE S.R.L."

const clean = (value?: string) => (value ?? "").trim()

/**
 * Contul configurat, sau `null` dacă lipsește IBAN-ul.
 *
 * Doar IBAN-ul e obligatoriu: banca și beneficiarul sunt informative pentru
 * client (transferul se face pe IBAN), deci au valori de rezervă.
 */
export const bankAccount = (): BankAccount | null => {
  const iban = clean(process.env.BANK_IBAN).replace(/\s+/g, "").toUpperCase()
  if (!iban) return null

  return {
    iban,
    name: clean(process.env.BANK_NAME),
    holder: clean(process.env.BANK_HOLDER) || LEGAL,
  }
}

export const hasBankAccount = () => bankAccount() !== null
