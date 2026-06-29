"use client"

import { useActionState } from "react"

import { login } from "@lib/data/customer"
import { LOGIN_VIEW } from "@modules/account/templates/login-template"
import ErrorMessage from "@modules/checkout/components/error-message"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import Input from "@modules/common/components/input"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { account as t } from "@lib/i18n/account.it"

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
}

const Login = (_: Props) => {
  const [message, formAction] = useActionState(login, null)

  return (
    <div data-testid="login-page">
      <header className="mb-6">
        <h1 className="font-serif text-3xl text-brand-dark tracking-tight">
          {t.auth.welcomeBack}
        </h1>
        <p className="text-sm text-brand-dark/60 mt-1">
          {t.auth.welcomeBackSubtitle}
        </p>
      </header>

      <form className="flex flex-col gap-y-3" action={formAction}>
        <Input
          label={t.auth.email}
          name="email"
          type="email"
          title="Introdu o adresă de email validă."
          autoComplete="email"
          required
          data-testid="email-input"
        />
        <Input
          label={t.auth.password}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          data-testid="password-input"
        />

        <div className="flex justify-end -mt-1">
          <LocalizedClientLink
            href="/account/forgot-password"
            className="text-sm text-brand-accent hover:underline"
          >
            {t.auth.forgotPassword}
          </LocalizedClientLink>
        </div>

        {message && (
          <ErrorMessage
            error={t.auth.invalidCredentials}
            data-testid="login-error-message"
          />
        )}

        <SubmitButton data-testid="sign-in-button" className="w-full mt-2">
          {t.auth.signIn}
        </SubmitButton>
      </form>
    </div>
  )
}

export default Login
