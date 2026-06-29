"use client"

import { useActionState } from "react"

import { resetPassword } from "@lib/data/customer"
import Input from "@modules/common/components/input"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { account as t } from "@lib/i18n/account.it"

const ERROR_TO_LABEL: Record<string, string> = {
  reset_invalid_token: t.auth.resetInvalidToken,
  reset_password_short: t.auth.passwordTooShort,
  reset_password_mismatch: t.auth.passwordsMismatch,
}

type Props = {
  token: string
  email: string
}

const ResetPasswordForm = ({ token, email }: Props) => {
  const [state, formAction] = useActionState(resetPassword, null)

  if (!token) {
    return (
      <div className="w-full max-w-md mx-auto rounded-3xl bg-white border border-brand-dark/[0.06] p-6 small:p-10">
        <div className="rounded-2xl bg-red-50 border border-red-100 p-4 text-sm text-red-800">
          {t.auth.resetInvalidToken}
        </div>
        <div className="mt-6 text-center">
          <LocalizedClientLink
            href="/account/forgot-password"
            className="text-sm text-brand-accent hover:underline"
          >
            {t.auth.forgotSubmit}
          </LocalizedClientLink>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto rounded-3xl bg-white border border-brand-dark/[0.06] p-6 small:p-10">
      <header className="mb-6">
        <h1 className="font-serif text-3xl text-brand-dark tracking-tight">
          {t.auth.resetTitle}
        </h1>
        <p className="text-sm text-brand-dark/60 mt-1">{t.auth.resetSubtitle}</p>
        {email && (
          <p className="text-xs text-brand-dark/50 mt-2">
            {t.auth.email}: <span className="font-medium">{email}</span>
          </p>
        )}
      </header>

      {state?.ok ? (
        <div className="space-y-4">
          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-800">
            {t.auth.resetSuccess}
          </div>
          <LocalizedClientLink
            href="/account"
            className="block w-full text-center rounded-full bg-brand-dark text-white px-5 py-3 text-sm font-semibold hover:bg-brand-accent transition-colors"
          >
            {t.auth.signIn}
          </LocalizedClientLink>
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-y-3">
          <input type="hidden" name="token" value={token} />
          <Input
            label={t.auth.newPassword}
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            data-testid="reset-password-input"
          />
          <Input
            label={t.auth.confirmPassword}
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            data-testid="reset-confirm-input"
          />
          {state?.message && !state.ok && (
            <p className="text-sm text-red-700">
              {ERROR_TO_LABEL[state.message] ?? t.common.error}
            </p>
          )}
          <SubmitButton className="w-full mt-2" data-testid="reset-submit">
            {t.auth.resetSubmit}
          </SubmitButton>
        </form>
      )}
    </div>
  )
}

export default ResetPasswordForm
