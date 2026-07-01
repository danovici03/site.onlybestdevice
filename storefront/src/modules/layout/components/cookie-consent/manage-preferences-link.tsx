"use client"

import { useConsent } from "@lib/context/consent-context"

type Props = {
  className?: string
  children?: React.ReactNode
}

export default function ManagePreferencesLink({
  className,
  children = "Gestionează preferințele cookie",
}: Props) {
  const { openPreferences } = useConsent()
  return (
    <button
      type="button"
      onClick={openPreferences}
      className={className}
      data-testid="manage-cookie-preferences"
    >
      {children}
    </button>
  )
}
