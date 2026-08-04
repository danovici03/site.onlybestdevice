"use client"

import { CaretDown, SquaresFour } from "@phosphor-icons/react/dist/ssr"
import { clx } from "@medusajs/ui"

import { MEGA_MENU } from "./data"

type Props = {
  active: string | null
  onActivate: (key: string) => void
  onDismiss: () => void
  /** Nav-ul stă peste hero-ul întunecat: conținutul devine alb. */
  overlay?: boolean
  /** În pastila de la scroll rămâne doar iconița, ca să încapă căutarea. */
  compact?: boolean
}

/**
 * Singurul buton rămas în bara de sus. Iconița de grilă plus „Toate produsele"
 * spun ce se întâmplă la click înainte de click — un simplu „Produse" nu lăsa
 * să se vadă că în spate e catalogul întreg, pe categorii.
 *
 * Fără chenar, intenționat: cu bara de căutare alături, două pastile una lângă
 * alta se citeau ca două câmpuri și se băteau cap în cap. Aici greutatea o dau
 * iconița și textul.
 */
export default function MegaMenuTriggers({
  active,
  onActivate,
  onDismiss,
  overlay = false,
  compact = false,
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
            onClick={() => (isActive ? onDismiss() : onActivate(root.key))}
            aria-expanded={isActive}
            aria-haspopup="true"
            // Redus la iconiță, butonul are nevoie de un tooltip: `sr-only` îl
            // acoperă pe cel cu cititor de ecran, nu și pe cel cu mouse.
            title={compact ? "Toate produsele" : undefined}
            data-testid="nav-products-trigger"
            className={clx(
              "group/trigger shrink-0 h-11 flex items-center gap-2 transition-colors",
              // Pe overlay culoarea de bază e albă și vine prin currentColor;
              // accentul ar dispărea peste hero, deci acolo marcăm starea activă
              // prin opacitate, nu prin culoare.
              overlay
                ? isActive
                  ? "text-white"
                  : "text-white/90 hover:text-white"
                : isActive
                  ? "text-brand-accent"
                  : "text-brand-dark hover:text-brand-accent"
            )}
          >
            <SquaresFour
              size={compact ? 22 : 20}
              weight={isActive ? "fill" : "bold"}
              aria-hidden
              className="shrink-0"
            />
            {/* În pastilă eticheta rămâne doar pentru cititoarele de ecran:
                butonul trebuie să-și păstreze numele accesibil chiar dacă
                vizual s-a redus la iconiță. */}
            <span className={compact ? "sr-only" : "whitespace-nowrap"}>
              Toate produsele
            </span>
            {!compact && (
              <CaretDown
                size={11}
                weight="bold"
                aria-hidden
                className={clx(
                  "shrink-0 transition-transform duration-200",
                  isActive ? "rotate-180" : ""
                )}
              />
            )}
          </button>
        )
      })}
    </>
  )
}
