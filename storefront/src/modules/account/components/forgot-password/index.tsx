"use client"

import { useActionState } from "react"

import { requestPasswordReset } from "@lib/data/customer"
import Input from "@modules/common/components/input"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { account as t } from "@lib/i18n/account.it"

const ForgotPasswordForm = () => {
  const [state, formAction] = useActionState(requestPasswordReset, null)

  return (
    <div className="w-full max-w-md mx-auto rounded-3xl bg-white border border-brand-dark/[0.06] p-6 small:p-10">
      <header className="mb-6">
        <h1 className="font-serif text-3xl text-brand-dark tracking-tight">
          {t.auth.forgotTitle}
        </h1>
        <p className="text-sm text-brand-dark/60 mt-1">
          {t.auth.forgotSubtitle}
        </p>
      </header>

      {state?.ok ? (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-800">
          {t.auth.forgotSent}
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-y-3">
          <Input
            label={t.auth.email}
            name="email"
            type="email"
            autoComplete="email"
            required
            data-testid="forgot-email-input"
          />
          <SubmitButton className="w-full mt-2" data-testid="forgot-submit">
            {t.auth.forgotSubmit}
          </SubmitButton>
        </form>
      )}

      <div className="mt-6 text-center">
        <LocalizedClientLink
          href="/account"
          className="text-sm text-brand-accent hover:underline"
        >
          ← {t.auth.signIn}
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default ForgotPasswordForm
