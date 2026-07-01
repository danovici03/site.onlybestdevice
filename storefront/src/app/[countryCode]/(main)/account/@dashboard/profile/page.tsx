import { Metadata } from "next"
import { notFound } from "next/navigation"

import ProfilePhone from "@modules/account/components/profile-phone"
import ProfileBillingAddress from "@modules/account/components/profile-billing-address"
import ProfileEmail from "@modules/account/components/profile-email"
import ProfileName from "@modules/account/components/profile-name"
import ProfilePassword from "@modules/account/components/profile-password"
import AccountCard from "@modules/account/components/account-card"
import { listRegions } from "@lib/data/regions"
import { retrieveCustomer } from "@lib/data/customer"
import { account as t } from "@lib/i18n/account.it"

export const metadata: Metadata = {
  title: "Profil",
  description: "Vezi și modifică datele tale personale pe onlybestdevice.",
}

export default async function Profile() {
  const customer = await retrieveCustomer()
  const regions = await listRegions()

  if (!customer || !regions) notFound()

  return (
    <div className="flex flex-col gap-6" data-testid="profile-page-wrapper">
      <header className="px-1">
        <h1 className="font-serif text-3xl small:text-4xl text-brand-dark tracking-tight">
          {t.profile.title}
        </h1>
        <p className="text-sm text-brand-dark/70 mt-2">{t.profile.subtitle}</p>
      </header>

      <AccountCard padded={false}>
        <div className="divide-y divide-brand-dark/[0.06]">
          <div className="p-6 small:p-8">
            <ProfileName customer={customer} />
          </div>
          <div className="p-6 small:p-8">
            <ProfileEmail customer={customer} />
          </div>
          <div className="p-6 small:p-8">
            <ProfilePhone customer={customer} />
          </div>
          <div className="p-6 small:p-8">
            <ProfilePassword customer={customer} />
          </div>
          <div className="p-6 small:p-8">
            <ProfileBillingAddress customer={customer} regions={regions} />
          </div>
        </div>
      </AccountCard>
    </div>
  )
}
