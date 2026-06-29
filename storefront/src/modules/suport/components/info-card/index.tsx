import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr"
import type { ReactNode } from "react"

type Props = {
  href: string
  icon: ReactNode
  title: string
  description: string
}

export default function InfoCard({ href, icon, title, description }: Props) {
  return (
    <LocalizedClientLink
      href={href}
      className="group relative flex flex-col rounded-3xl border border-brand-dark/10 bg-white p-8 hover:border-brand-dark hover:shadow-xl transition-all"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="w-12 h-12 rounded-2xl bg-brand-dark/5 group-hover:bg-brand-accent/10 text-brand-dark flex items-center justify-center transition-colors">
          {icon}
        </div>
        <ArrowUpRight
          size={20}
          className="text-brand-dark/30 group-hover:text-brand-dark transition-colors"
        />
      </div>
      <h3 className="text-xl font-bold text-brand-dark mb-2">{title}</h3>
      <p className="text-brand-dark/60 text-sm leading-relaxed">{description}</p>
    </LocalizedClientLink>
  )
}
