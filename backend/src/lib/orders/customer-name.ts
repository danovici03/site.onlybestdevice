type PersonName = {
  first_name?: string | null
  last_name?: string | null
}

type OrderCustomer = PersonName & {
  email?: string | null
  has_account?: boolean | null
}

export type OrderNameSource = {
  email?: string | null
  customer?: OrderCustomer | null
  billing_address?: PersonName | null
  shipping_address?: PersonName | null
}

const clean = (value?: string | null) => value?.trim() ?? ""

export const fullName = (person?: PersonName | null): string =>
  [clean(person?.first_name), clean(person?.last_name)]
    .filter(Boolean)
    .join(" ")

/**
 * Numele de pe comandă: facturarea e a cumpărătorului, livrarea poate fi la
 * altcineva, deci facturarea are prioritate.
 */
const addressWithName = (order: OrderNameSource): PersonName | null =>
  [order.billing_address, order.shipping_address].find(
    (address) => !!fullName(address)
  ) ?? null

/**
 * Ce scrie în coloana „Client” din lista de comenzi.
 *
 * Coloana nativă afișează numele din fișa clientului sau, dacă lipsește,
 * emailul. Un client fără cont (comandă ca vizitator) primește de la Medusa o
 * fișă care are doar emailul, iar numele din checkout ajunge doar în adresele
 * comenzii. De aceea în listă apărea emailul în loc de nume.
 *
 * - client cu cont: numele din fișa lui, ca în coloana nativă;
 * - client fără cont: numele din adresa acestei comenzi. Fișa lui e una singură
 *   pe email și poate avea numele de pe altă comandă.
 */
export const orderCustomerName = (order: OrderNameSource): string | null => {
  const customer = order.customer
  const own = fullName(customer)
  if (customer?.has_account && own) return own

  return (
    fullName(addressWithName(order)) ||
    own ||
    clean(customer?.email) ||
    clean(order.email) ||
    null
  )
}

/**
 * Numele de pus în fișa unui client fără cont, luat din adresele comenzii.
 *
 * Fișa e una singură pe email, deci regula e „ultima comandă câștigă”, atât în
 * subscriber, cât și în scriptul de completare: o greșeală de tastare dintr-o
 * comandă veche se corectează la următoarea.
 *
 * Întoarce `null` când nu e nimic de scris: clientul are cont (numele lui e
 * treaba lui, din contul de pe site), fișa are deja exact numele ăsta, sau
 * comanda nu are nume în adrese.
 */
export const guestCustomerName = (
  order: OrderNameSource
): { first_name: string; last_name: string } | null => {
  const customer = order.customer
  if (!customer || customer.has_account) return null

  const address = addressWithName(order)
  if (!address) return null

  const name = {
    first_name: clean(address.first_name),
    last_name: clean(address.last_name),
  }
  const same =
    name.first_name === clean(customer.first_name) &&
    name.last_name === clean(customer.last_name)
  return same ? null : name
}

/** Câmpurile `query.graph` de care au nevoie funcțiile de mai sus. */
export const ORDER_NAME_FIELDS = [
  "email",
  "customer.id",
  "customer.email",
  "customer.first_name",
  "customer.last_name",
  "customer.has_account",
  "billing_address.first_name",
  "billing_address.last_name",
  "shipping_address.first_name",
  "shipping_address.last_name",
]
