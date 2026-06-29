"use client"

import { useActionState } from "react"

import Input from "@modules/common/components/input"
import { LOGIN_VIEW } from "@modules/account/templates/login-template"
import ErrorMessage from "@modules/checkout/components/error-message"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { signup } from "@lib/data/customer"
import { account as t } from "@lib/i18n/account.it"

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
}

const Register = (_: Props) => {
  const [message, formAction] = useActionState(signup, null)

  // Replace placeholders {terms} / {privacy} in the consent string with links.
  const consentParts = t.auth.termsConsent.split(/\{(terms|privacy)\}/)

  return (
    <div data-testid="register-page">
      <header className="mb-6">
        <h1 className="font-serif text-3xl text-brand-dark tracking-tight">
          {t.auth.createAccount}
        </h1>
        <p className="text-sm text-brand-dark/60 mt-1">
          {t.auth.createAccountSubtitle}
        </p>
      </header>

      <form className="flex flex-col gap-y-3" action={formAction}>
        <div className="grid grid-cols-1 small:grid-cols-2 gap-3">
          <Input
            label={t.auth.firstName}
            name="first_name"
            required
            autoComplete="given-name"
            data-testid="first-name-input"
          />
          <Input
            label={t.auth.lastName}
            name="last_name"
            required
            autoComplete="family-name"
            data-testid="last-name-input"
          />
        </div>
        <Input
          label={t.auth.email}
          name="email"
          required
          type="email"
          autoComplete="email"
          data-testid="email-input"
        />
        <Input
          label={`${t.auth.phone} ${t.common.optional}`}
          name="phone"
          type="tel"
          autoComplete="tel"
          data-testid="phone-input"
        />
        <Input
          label={t.auth.password}
          name="password"
          required
          type="password"
          autoComplete="new-password"
          minLength={8}
          title="Almeno 8 caratteri."
          data-testid="password-input"
        />

        <label className="flex items-start gap-x-3 mt-2 cursor-pointer">
          <input
            type="checkbox"
            name="marketing_opt_in"
            className="mt-0.5 w-4 h-4 rounded border-brand-dark/30 text-brand-dark focus:ring-brand-accent"
            data-testid="marketing-consent"
          />
          <span className="text-xs text-brand-dark/70 leading-relaxed">
            {t.auth.marketingConsent}
          </span>
        </label>

        <p className="text-xs text-brand-dark/60 mt-2 leading-relaxed">
          {consentParts.map((part, i) => {
            if (part === "terms") {
              return (
                <LocalizedClientLink
                  key={i}
                  href="/termeni"
                  className="text-brand-accent underline hover:no-underline"
                >
                  {t.auth.termsLink}
                </LocalizedClientLink>
              )
            }
            if (part === "privacy") {
              return (
                <LocalizedClientLink
                  key={i}
                  href="/confidentialitate"
                  className="text-brand-accent underline hover:no-underline"
                >
                  {t.auth.privacyLink}
                </LocalizedClientLink>
              )
            }
            return <span key={i}>{part}</span>
          })}
        </p>

        {message && <ErrorMessage error={message} data-testid="register-error" />}

        <SubmitButton className="w-full mt-3" data-testid="register-button">
          {t.auth.signUp}
        </SubmitButton>
      </form>
    </div>
  )
}

export default Register
