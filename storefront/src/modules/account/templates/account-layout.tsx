import React from "react"

import AccountNav from "../components/account-nav"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { account as t } from "@lib/i18n/account.it"

interface AccountLayoutProps {
  customer: HttpTypes.StoreCustomer | null
  children: React.ReactNode
}

const AccountLayout: React.FC<AccountLayoutProps> = ({
  customer,
  children,
}) => {
  return (
    <div className="bg-brand-light min-h-screen" data-testid="account-page">
      <div className="content-container mx-auto py-8 small:py-16">
        {customer ? (
          <div className="grid grid-cols-1 small:grid-cols-[280px_1fr] gap-8 small:gap-12">
            <aside className="small:sticky small:top-24 small:self-start">
              <AccountNav customer={customer} />
            </aside>
            <main className="min-w-0">{children}</main>
          </div>
        ) : (
          <main className="max-w-xl mx-auto">{children}</main>
        )}

        {customer && (
          <footer className="mt-16 small:mt-24 rounded-3xl bg-brand-dark/[0.03] p-8 small:p-10 flex flex-col small:flex-row items-start small:items-center justify-between gap-6">
            <div className="max-w-md">
              <h3 className="font-serif text-2xl text-brand-dark tracking-tight mb-2">
                {t.layout.helpTitle}
              </h3>
              <p className="text-sm text-brand-dark/70">
                {t.layout.helpSubtitle}
              </p>
            </div>
            <LocalizedClientLink
              href="/contact"
              className="inline-flex items-center justify-center rounded-full bg-brand-dark text-white px-6 py-3 text-sm font-semibold hover:bg-brand-accent transition-colors"
            >
              {t.layout.helpCta}
            </LocalizedClientLink>
          </footer>
        )}
      </div>
    </div>
  )
}

export default AccountLayout
