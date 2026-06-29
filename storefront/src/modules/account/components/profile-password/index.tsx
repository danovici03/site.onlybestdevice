"use client"

import React, { useActionState, useEffect } from "react"
import Input from "@modules/common/components/input"
import AccountInfo from "../account-info"
import { HttpTypes } from "@medusajs/types"
import { updatePassword } from "@lib/data/customer"
import { account as t } from "@lib/i18n/account.it"

type MyInformationProps = {
  customer: HttpTypes.StoreCustomer
}

const ERROR_TO_LABEL: Record<string, string> = {
  password_required: t.common.requiredField,
  password_too_short: t.auth.passwordTooShort,
  password_mismatch: t.auth.passwordsMismatch,
  password_old_invalid:
    "Parola actuală nu este corectă.",
  password_unauthenticated:
    "Sessione scaduta. Effettua di nuovo l'accesso.",
  password_update_failed: t.common.error,
}

const ProfilePassword: React.FC<MyInformationProps> = ({ customer }) => {
  const [state, formAction] = useActionState(updatePassword, null)
  const [successState, setSuccessState] = React.useState(false)

  useEffect(() => {
    if (state?.ok) setSuccessState(true)
  }, [state])

  const clearState = () => setSuccessState(false)

  const error =
    state && !state.ok && state.message
      ? ERROR_TO_LABEL[state.message] ?? t.common.error
      : undefined

  return (
    <form action={formAction} onReset={clearState} className="w-full">
      <AccountInfo
        label={t.profile.passwordLabel}
        currentInfo={<span>{t.profile.passwordPlaceholder}</span>}
        isSuccess={successState}
        isError={!!error}
        errorMessage={error}
        clearState={clearState}
        data-testid="account-password-editor"
      >
        <div className="grid grid-cols-1 small:grid-cols-2 gap-4">
          <Input
            label={t.profile.oldPassword}
            name="old_password"
            required
            type="password"
            autoComplete="current-password"
            data-testid="old-password-input"
          />
          <Input
            label={t.profile.newPassword}
            type="password"
            name="new_password"
            required
            minLength={8}
            autoComplete="new-password"
            data-testid="new-password-input"
          />
          <Input
            label={t.profile.confirmPassword}
            type="password"
            name="confirm_password"
            required
            minLength={8}
            autoComplete="new-password"
            data-testid="confirm-password-input"
          />
        </div>
      </AccountInfo>
    </form>
  )
}

export default ProfilePassword
