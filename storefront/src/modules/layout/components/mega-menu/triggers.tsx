"use client"

import { CaretDown } from "@phosphor-icons/react/dist/ssr"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { FLAT_LINKS, MEGA_MENU } from "./data"

type Props = {
  active: string | null
  onActivate: (key: string) => void
  onDismiss: () => void
}

export default function MegaMenuTriggers({
  active,
  onActivate,
  onDismiss,
}: Props) {
  return (
    <>
      {MEGA_MENU.map((root) => {
        const isActive = active === root.key
        return (
          <button
            key={root.key}
            type="button"
            onMouseEnter={() => onActivate(root.key)}
            onFocus={() => onActivate(root.key)}
            onClick={() =>
              isActive ? onDismiss() : onActivate(root.key)
            }
            aria-expanded={isActive}
            aria-haspopup="true"
            className={`flex items-center gap-1 transition-colors ${
              isActive ? "text-brand-accent" : "hover:text-brand-accent"
            }`}
          >
            <span>{root.label}</span>
            <CaretDown
              size={12}
              weight="bold"
              className={`transition-transform duration-200 ${
                isActive ? "rotate-180" : ""
              }`}
            />
          </button>
        )
      })}

      {FLAT_LINKS.map((l) => (
        <LocalizedClientLink
          key={l.key}
          href={l.href}
          onMouseEnter={() => onDismiss()}
          className="hover:text-brand-accent transition-colors"
        >
          {l.label}
        </LocalizedClientLink>
      ))}
    </>
  )
}
