"use client"

import { resetOnboardingState } from "@lib/data/onboarding"
import { account as t } from "@lib/i18n/account.it"

const OnboardingCta = ({ orderId }: { orderId: string }) => {
  return (
    <div className="rounded-3xl bg-brand-accent/[0.08] border border-brand-accent/20 p-6 small:p-8 flex flex-col gap-y-3 items-start small:items-center small:text-center">
      <p className="font-serif text-2xl text-brand-dark tracking-tight">
        {t.orderConfirmed.onboardingTitle}
      </p>
      <p className="text-sm text-brand-dark/70 max-w-prose">
        {t.orderConfirmed.onboardingBody}
      </p>
      <button
        type="button"
        onClick={() => resetOnboardingState(orderId)}
        className="mt-1 inline-flex items-center justify-center rounded-full bg-brand-dark text-white px-6 py-3 text-sm font-semibold hover:bg-brand-accent transition-colors"
      >
        {t.orderConfirmed.onboardingCta}
      </button>
    </div>
  )
}

export default OnboardingCta
