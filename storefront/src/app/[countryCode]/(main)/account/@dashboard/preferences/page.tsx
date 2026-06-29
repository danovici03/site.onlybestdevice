import { Metadata } from "next"
import { notFound } from "next/navigation"

import Preferences from "@modules/account/components/preferences"
import { retrieveCustomer } from "@lib/data/customer"

export const metadata: Metadata = {
  title: "Preferenze",
  description:
    "Scegli come e quando ricevere comunicazioni da Arredovita.",
}

export default async function PreferencesPage() {
  const customer = await retrieveCustomer()
  if (!customer) notFound()
  return <Preferences customer={customer} />
}
