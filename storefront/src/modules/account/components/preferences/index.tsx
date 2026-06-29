"use client"

import { useActionState, useEffect, useState } from "react"
import { clx } from "@medusajs/ui"
import { HttpTypes } from "@medusajs/types"

import { updatePreferences } from "@lib/data/customer"
import AccountCard from "../account-card"
import { account as t } from "@lib/i18n/account.it"

type Preferences = {
  marketing?: boolean
  sms?: boolean
}

type ToggleRowProps = {
  name: string
  label: string
  hint: string
  defaultChecked: boolean
  locked?: boolean
  disabled?: boolean
}

const ToggleRow = ({
  name,
  label,
  hint,
  defaultChecked,
  locked,
  disabled,
}: ToggleRowProps) => {
  // Controlled state so the visual switch reflects user input without a roundtrip.
  const [checked, setChecked] = useState(defaultChecked)
  const isReadOnly = locked || disabled
  const effective = locked ? true : checked

  return (
    <div className="flex items-start justify-between gap-4 py-5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-brand-dark">{label}</p>
        <p className="text-xs text-brand-dark/60 mt-1 leading-relaxed">
          {hint}
        </p>
      </div>
      <label
        className={clx(
          "shrink-0 inline-flex items-center cursor-pointer",
          isReadOnly && "cursor-not-allowed",
        )}
      >
        <input
          type="checkbox"
          name={name}
          className="sr-only peer"
          checked={effective}
          disabled={isReadOnly}
          onChange={(e) => setChecked(e.target.checked)}
        />
        <span
          className={clx(
            "relative w-11 h-6 rounded-full transition-colors",
            effective ? "bg-brand-dark" : "bg-brand-dark/[0.12]",
            isReadOnly && "opacity-60",
            "after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform",
            effective && "after:translate-x-5",
          )}
        />
      </label>
    </div>
  )
}

type PreferencesProps = {
  customer: HttpTypes.StoreCustomer
}

const Preferences = ({ customer }: PreferencesProps) => {
  const metadata = (customer.metadata ?? {}) as Record<string, unknown>
  const prefs = (metadata.preferences as Preferences | undefined) ?? {}

  const [state, formAction] = useActionState(updatePreferences, null)
  const [showSaved, setShowSaved] = useState(false)

  useEffect(() => {
    if (state?.ok) {
      setShowSaved(true)
      const id = window.setTimeout(() => setShowSaved(false), 3000)
      return () => window.clearTimeout(id)
    }
  }, [state])

  return (
    <div className="flex flex-col gap-6" data-testid="preferences-page-wrapper">
      <header className="px-1">
        <h1 className="font-serif text-3xl small:text-4xl text-brand-dark tracking-tight">
          {t.preferences.title}
        </h1>
        <p className="text-sm text-brand-dark/70 mt-2">
          {t.preferences.subtitle}
        </p>
      </header>

      <form action={formAction}>
        <AccountCard padded={false}>
          <div className="px-6 small:px-8 py-2 divide-y divide-brand-dark/[0.06]">
            <ToggleRow
              name="marketing"
              label={t.preferences.marketingEmails}
              hint={t.preferences.marketingHint}
              defaultChecked={!!prefs.marketing}
            />
            <ToggleRow
              name="transactional"
              label={t.preferences.transactionalEmails}
              hint={t.preferences.transactionalHint}
              defaultChecked={true}
              locked
            />
            <ToggleRow
              name="sms"
              label={t.preferences.smsNotifications}
              hint={t.preferences.smsHint}
              defaultChecked={!!prefs.sms}
              disabled
            />
          </div>
          <div className="flex items-center justify-end gap-3 px-6 small:px-8 py-4 border-t border-brand-dark/[0.06] bg-brand-light/40 rounded-b-3xl">
            {showSaved && (
              <span className="text-xs text-emerald-700">
                {t.preferences.updated}
              </span>
            )}
            {state && !state.ok && (
              <span className="text-xs text-red-700">{t.common.error}</span>
            )}
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-brand-dark text-white px-5 py-2.5 text-sm font-semibold hover:bg-brand-accent transition-colors"
              data-testid="preferences-save"
            >
              {t.common.save}
            </button>
          </div>
        </AccountCard>
      </form>
    </div>
  )
}

export default Preferences
