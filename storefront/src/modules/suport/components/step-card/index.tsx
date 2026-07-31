import type { ReactNode } from "react"

/** Clasa butonului din card — exportată ca paginile să folosească același CTA. */
export const stepCtaClass =
  "inline-flex items-center gap-2 rounded-full bg-brand-dark text-white px-6 py-3 text-sm font-semibold hover:bg-brand-accent transition-colors"

type Props = {
  step: string
  title: string
  children: ReactNode
  cta: ReactNode
}

/** Cardul mare de la începutul paginilor de retur și service („Pasul 1/2"). */
export default function StepCard({ step, title, children, cta }: Props) {
  return (
    <div className="flex flex-col rounded-3xl border border-brand-dark/10 bg-white p-8">
      <span className="text-xs uppercase tracking-[0.3em] text-brand-accent mb-4">
        {step}
      </span>
      <h2 className="text-xl md:text-2xl font-bold text-brand-dark leading-snug mb-3">
        {title}
      </h2>
      <p className="text-brand-dark/60 text-sm leading-relaxed mb-8">
        {children}
      </p>
      <div className="mt-auto">{cta}</div>
    </div>
  )
}
