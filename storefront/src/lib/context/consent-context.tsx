"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

export type ConsentCategory = "necessary" | "analytics" | "marketing"

export type ConsentChoices = {
  necessary: true
  analytics: boolean
  marketing: boolean
}

type StoredConsent = {
  v: 1
  ts: number
  choices: ConsentChoices
}

const COOKIE_NAME = "av_consent_v1"
const STORAGE_KEY = "av_consent_v1"
const TTL_MS = 1000 * 60 * 60 * 24 * 180 // 6 months — required by Garante 10/06/2021

const DEFAULT_CHOICES: ConsentChoices = {
  necessary: true,
  analytics: false,
  marketing: false,
}

function readStored(): StoredConsent | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredConsent
    if (parsed.v !== 1) return null
    if (Date.now() - parsed.ts > TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

function writeStored(choices: ConsentChoices) {
  if (typeof window === "undefined") return
  const payload: StoredConsent = { v: 1, ts: Date.now(), choices }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {}
  const maxAgeSec = Math.floor(TTL_MS / 1000)
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(
    JSON.stringify(payload)
  )}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax`
}

type ConsentContextValue = {
  /** Whether the user has made an explicit choice. False on first visit or after TTL expires. */
  decided: boolean
  /** Current choices (defaults to necessary-only before a decision is made). */
  choices: ConsentChoices
  /** True if a preference modal is being requested (e.g. user clicked "Gestisci preferenze"). */
  preferencesOpen: boolean
  /** Open the preferences modal manually (footer link, in-policy CTA). */
  openPreferences: () => void
  closePreferences: () => void
  /** Persist choices and dismiss the banner. */
  accept: (choices: ConsentChoices) => void
  acceptAll: () => void
  rejectAll: () => void
}

const ConsentContext = createContext<ConsentContextValue | null>(null)

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [decided, setDecided] = useState(false)
  const [choices, setChoices] = useState<ConsentChoices>(DEFAULT_CHOICES)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const stored = readStored()
    if (stored) {
      setChoices(stored.choices)
      setDecided(true)
    }
    setHydrated(true)
  }, [])

  const accept = useCallback((next: ConsentChoices) => {
    writeStored(next)
    setChoices(next)
    setDecided(true)
    setPreferencesOpen(false)
  }, [])

  const acceptAll = useCallback(() => {
    accept({ necessary: true, analytics: true, marketing: true })
  }, [accept])

  const rejectAll = useCallback(() => {
    accept({ necessary: true, analytics: false, marketing: false })
  }, [accept])

  const openPreferences = useCallback(() => setPreferencesOpen(true), [])
  const closePreferences = useCallback(() => setPreferencesOpen(false), [])

  const value = useMemo<ConsentContextValue>(
    () => ({
      decided: hydrated && decided,
      choices,
      preferencesOpen,
      openPreferences,
      closePreferences,
      accept,
      acceptAll,
      rejectAll,
    }),
    [
      hydrated,
      decided,
      choices,
      preferencesOpen,
      openPreferences,
      closePreferences,
      accept,
      acceptAll,
      rejectAll,
    ]
  )

  return (
    <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
  )
}

export function useConsent() {
  const ctx = useContext(ConsentContext)
  if (!ctx) {
    throw new Error("useConsent must be used inside <ConsentProvider>")
  }
  return ctx
}

/**
 * Render children only when the user has granted consent for the given category.
 * Use to gate analytics/marketing scripts.
 */
export function ConsentGate({
  category,
  children,
}: {
  category: ConsentCategory
  children: React.ReactNode
}) {
  const { choices, decided } = useConsent()
  if (!decided) return null
  if (!choices[category]) return null
  return <>{children}</>
}
