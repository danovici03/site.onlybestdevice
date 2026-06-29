"use client"

import React from "react"

import AccountInfo from "../account-info"
import { HttpTypes } from "@medusajs/types"
import { account as t } from "@lib/i18n/account.it"

type MyInformationProps = {
  customer: HttpTypes.StoreCustomer
}

// Email change is intentionally read-only: in Medusa it requires re-binding
// the auth identity, which the store endpoint doesn't expose. We surface a
// hint pointing customers to support.
const ProfileEmail: React.FC<MyInformationProps> = ({ customer }) => {
  return (
    <div className="w-full">
      <AccountInfo
        label={t.profile.emailLabel}
        currentInfo={
          <div className="flex flex-col gap-1">
            <span className="font-medium">{customer.email}</span>
            <span className="text-xs text-brand-dark/50">
              {t.profile.emailReadonlyHint}
            </span>
          </div>
        }
        clearState={() => undefined}
        readOnly
        data-testid="account-email-editor"
      />
    </div>
  )
}

export default ProfileEmail
