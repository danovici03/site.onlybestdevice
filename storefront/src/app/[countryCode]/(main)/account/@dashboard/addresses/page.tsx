import { Metadata } from "next"
import { notFound } from "next/navigation"

import AddressBook from "@modules/account/components/address-book"
import { getRegion } from "@lib/data/regions"
import { retrieveCustomer } from "@lib/data/customer"
import { account as t } from "@lib/i18n/account.it"

export const metadata: Metadata = {
  title: "Adrese",
  description: "Gestionează adresele tale de livrare pe onlybestdevice.",
}

export default async function Addresses(props: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await props.params
  const customer = await retrieveCustomer()
  const region = await getRegion(countryCode)

  if (!customer || !region) notFound()

  return (
    <div className="flex flex-col gap-6" data-testid="addresses-page-wrapper">
      <header className="px-1">
        <h1 className="font-serif text-3xl small:text-4xl text-brand-dark tracking-tight">
          {t.addresses.title}
        </h1>
        <p className="text-sm text-brand-dark/70 mt-2">
          {t.addresses.subtitle}
        </p>
      </header>

      <AddressBook customer={customer} region={region} />
    </div>
  )
}
