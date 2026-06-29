import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { CaretRight } from "@phosphor-icons/react/dist/ssr"
import type { ReactNode } from "react"

type Crumb = { label: string; href?: string }

type Props = {
  title: string
  eyebrow?: string
  description?: string
  breadcrumbs?: Crumb[]
  children: ReactNode
  asideTop?: ReactNode
  wide?: boolean
}

export default function InfoPageLayout({
  title,
  eyebrow,
  description,
  breadcrumbs,
  children,
  asideTop,
  wide = false,
}: Props) {
  const contentMaxWidth = wide ? "max-w-[1100px]" : "max-w-[900px]"
  return (
    <div className="bg-white pb-24">
      <section className="bg-brand-dark text-white pt-12 pb-20 rounded-b-[3rem] mb-16">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-8">
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav
              aria-label="Breadcrumb"
              className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-widest text-white/50 mb-8"
            >
              {breadcrumbs.map((c, i) => (
                <span key={`${c.label}-${i}`} className="flex items-center gap-2">
                  {c.href ? (
                    <LocalizedClientLink
                      href={c.href}
                      className="hover:text-white transition-colors"
                    >
                      {c.label}
                    </LocalizedClientLink>
                  ) : (
                    <span>{c.label}</span>
                  )}
                  {i < breadcrumbs.length - 1 && <CaretRight size={10} weight="bold" />}
                </span>
              ))}
            </nav>
          )}

          {eyebrow && (
            <p className="text-xs uppercase tracking-[0.3em] text-brand-accent mb-4">
              {eyebrow}
            </p>
          )}

          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
            {title}
          </h1>

          {description && (
            <p className="text-white/70 text-lg md:text-xl max-w-2xl">
              {description}
            </p>
          )}
        </div>
      </section>

      <div className={`${contentMaxWidth} mx-auto px-4 sm:px-8`}>
        {asideTop}
        <div className="prose prose-neutral max-w-none prose-headings:font-bold prose-headings:text-brand-dark prose-h2:mt-12 prose-h2:mb-4 prose-h2:text-2xl prose-h3:text-xl prose-a:text-brand-accent prose-a:no-underline hover:prose-a:underline prose-strong:text-brand-dark prose-li:my-1">
          {children}
        </div>
      </div>
    </div>
  )
}
