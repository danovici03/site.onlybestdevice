import type { ReactNode } from "react"

type Props = {
  icon: ReactNode
  title: string
  children: ReactNode
  /** Ton de avertisment, pentru regulile a căror încălcare costă clientul. */
  tone?: "neutral" | "warning"
}

/** Cutie de accent în interiorul textului (se folosește în `prose`). */
export default function Callout({
  icon,
  title,
  children,
  tone = "neutral",
}: Props) {
  const toneClass =
    tone === "warning"
      ? "bg-brand-accent/[0.06] border-brand-accent/25"
      : "bg-brand-dark/[0.03] border-brand-dark/10"

  return (
    <div
      className={`not-prose flex gap-4 rounded-3xl border p-6 my-8 ${toneClass}`}
    >
      <div
        className={`shrink-0 w-10 h-10 rounded-2xl bg-white flex items-center justify-center border ${
          tone === "warning"
            ? "text-brand-accent border-brand-accent/25"
            : "text-brand-dark border-brand-dark/10"
        }`}
      >
        {icon}
      </div>
      <div>
        <h3 className="font-bold text-brand-dark mb-1">{title}</h3>
        <div className="text-sm text-brand-dark/70 leading-relaxed space-y-2">
          {children}
        </div>
      </div>
    </div>
  )
}
