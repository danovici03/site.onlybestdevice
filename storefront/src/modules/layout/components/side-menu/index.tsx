"use client"

import { Drawer } from "vaul"
import { clx, useToggleState } from "@medusajs/ui"
import { ArrowRightMini } from "@medusajs/icons"
import {
  ArrowRight,
  CaretRight,
  List,
  Handbag,
  User,
  X,
} from "@phosphor-icons/react/dist/ssr"
import { ReactNode, useState } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CountrySelect from "../country-select"
import LanguageSelect from "../language-select"
import { HttpTypes } from "@medusajs/types"
import { Locale } from "@lib/data/locales"
import {
  MEGA_MENU,
  SECONDARY_LINKS,
} from "@modules/layout/components/mega-menu/data"
import { getCategoryIcon } from "@modules/layout/components/mega-menu/category-icons"

// Un singur set de titluri de secțiune în tot drawer-ul: categoriile și
// suportul trebuie să arate ca două secțiuni ale aceleiași liste, nu ca două
// componente diferite lipite una sub alta.
const EYEBROW =
  "text-[11px] uppercase tracking-[0.18em] font-bold text-brand-dark/40"

type SideMenuProps = {
  regions: HttpTypes.StoreRegion[] | null
  locales: Locale[] | null
  cartIndicator?: ReactNode
}

const SideMenu = ({ regions, locales, cartIndicator }: SideMenuProps) => {
  const [open, setOpen] = useState(false)
  const countryToggleState = useToggleState()
  const languageToggleState = useToggleState()

  const close = () => setOpen(false)

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <button
          type="button"
          data-testid="nav-menu-button"
          aria-label="Deschide meniul"
          className="flex items-center hover:text-brand-accent transition-colors"
        >
          <List size={24} weight="regular" />
        </button>
      </Drawer.Trigger>

      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[60] bg-brand-dark/40 backdrop-blur-sm" />
        <Drawer.Content
          data-testid="nav-menu-popup"
          className="fixed inset-x-0 bottom-0 z-[61] flex h-[93dvh] flex-col rounded-t-[1.75rem] bg-brand-light text-brand-dark shadow-[0_-24px_60px_rgba(0,0,0,0.18)] outline-none"
        >
          <Drawer.Title className="sr-only">Meniu</Drawer.Title>

          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="h-1.5 w-12 rounded-full bg-brand-dark/15" />
          </div>

          <div className="flex items-center justify-between px-7 pt-2 shrink-0">
            <LocalizedClientLink
              href="/"
              onClick={close}
              className="flex items-center"
              aria-label="onlybestdevice — Acasă"
            >
              <span className="font-serif text-xl font-bold tracking-tight text-brand-dark select-none">
                onlybest<span className="text-brand-accent">device</span>
              </span>
            </LocalizedClientLink>
            <button
              type="button"
              data-testid="close-menu-button"
              onClick={close}
              aria-label="Închide meniul"
              className="w-10 h-10 rounded-full border border-brand-dark/15 flex items-center justify-center hover:bg-brand-dark hover:text-brand-light transition-colors"
            >
              <X size={16} weight="regular" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto overscroll-contain px-7 pt-6 pb-6">
            {/* Categoriile sunt singurul motiv pentru care se deschide meniul,
                deci se văd direct: acordeonul cu un singur grup punea un titlu
                uriaș și un click în plus peste exact aceeași listă. */}
            {MEGA_MENU.map((root) => (
              <section key={root.key} className="first:mt-0 mt-8">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className={EYEBROW}>{root.label}</h2>
                  <LocalizedClientLink
                    href={root.href}
                    onClick={close}
                    className="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-bold text-brand-dark/70 active:text-brand-accent hover:text-brand-accent transition-colors"
                  >
                    Vezi toate
                    <ArrowRight size={13} weight="bold" />
                  </LocalizedClientLink>
                </div>

                <ul className="mt-2 divide-y divide-brand-dark/[0.07]">
                  {root.items.map((item) => {
                    const Icon = getCategoryIcon(item.href)
                    // „Oferte" nu e o categorie de produs, ci un motiv de
                    // cumpărare — la fel ca pe desktop, primește accentul.
                    const highlight = !!item.highlight
                    return (
                      <li key={item.href}>
                        <LocalizedClientLink
                          href={item.href}
                          onClick={close}
                          className="group flex items-center gap-3.5 py-3 -mx-2 px-2 rounded-xl active:bg-brand-dark/[0.04] transition-colors"
                        >
                          <span
                            className={clx(
                              "w-9 h-9 shrink-0 rounded-xl flex items-center justify-center transition-colors",
                              highlight
                                ? "bg-brand-accent text-white"
                                : "bg-brand-dark/[0.05] text-brand-dark/70 group-hover:bg-brand-dark group-hover:text-white"
                            )}
                          >
                            <Icon
                              size={18}
                              weight={highlight ? "fill" : "regular"}
                            />
                          </span>
                          <span
                            className={clx(
                              "flex-1 text-base tracking-[-0.01em] transition-colors",
                              highlight
                                ? "font-bold text-brand-accent"
                                : "font-medium text-brand-dark group-hover:text-brand-accent"
                            )}
                          >
                            {item.label}
                          </span>
                          {item.count !== undefined && (
                            <span className="text-xs tabular-nums text-brand-dark/35">
                              {item.count}
                            </span>
                          )}
                          {/* Săgeata rămâne vizibilă: pe touch nu există hover,
                              iar fără ea rândurile nu par apăsabile. */}
                          <CaretRight
                            size={14}
                            weight="bold"
                            className="shrink-0 text-brand-dark/25 group-hover:text-brand-dark/60 transition-colors"
                          />
                        </LocalizedClientLink>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}

            <div className="mt-8 pt-6 border-t border-brand-dark/10 flex flex-col gap-2.5">
              <LocalizedClientLink
                href="/cart"
                onClick={close}
                data-testid="cart-link"
                className="group flex items-center justify-between bg-brand-dark text-brand-light rounded-full pl-5 pr-4 py-3.5 hover:bg-brand-accent transition-colors"
              >
                <span className="flex items-center gap-3">
                  <span className="relative">
                    <Handbag size={22} weight="light" />
                    {cartIndicator}
                  </span>
                  <span className="text-base font-medium">
                    Mergi la coș
                  </span>
                </span>
                <span className="w-9 h-9 rounded-full bg-brand-light/15 flex items-center justify-center group-hover:bg-brand-light/25 transition-colors">
                  <ArrowRight
                    size={16}
                    className="group-hover:translate-x-0.5 transition-transform"
                  />
                </span>
              </LocalizedClientLink>

              <LocalizedClientLink
                href="/account"
                onClick={close}
                data-testid="account-link"
                className="group flex items-center justify-between border border-brand-dark/15 rounded-full pl-5 pr-4 py-3 hover:border-brand-dark transition-colors"
              >
                <span className="flex items-center gap-3 text-brand-dark">
                  <User size={20} weight="light" />
                  <span className="text-base font-medium">Contul meu</span>
                </span>
                <ArrowRight
                  size={16}
                  className="text-brand-dark/60 group-hover:translate-x-0.5 group-hover:text-brand-dark transition-all"
                />
              </LocalizedClientLink>
            </div>
            {/* Suportul nu concurează cu catalogul: aceleași subiecte sunt în
                footer și în întrebările frecvente, aici rămân doar pentru că
                footer-ul nu se vede cât drawer-ul e deschis. De aceea sunt și
                mai slabe vizual decât categoriile — erau bold, adică trăgeau
                ochiul înaintea catalogului. */}
            <div className="mt-8 pt-6 border-t border-brand-dark/10">
              <h2 className={EYEBROW}>Ai nevoie de ajutor</h2>
              <ul className="mt-1 flex flex-col">
                {SECONDARY_LINKS.map((link) => (
                  <li key={link.key}>
                    <LocalizedClientLink
                      href={link.href}
                      onClick={close}
                      data-testid={`${link.key}-link`}
                      className="group flex items-center justify-between gap-4 py-2.5 -mx-2 px-2 rounded-xl text-[15px] text-brand-dark/70 hover:text-brand-dark active:bg-brand-dark/[0.04] transition-colors"
                    >
                      <span>{link.label}</span>
                      <CaretRight
                        size={13}
                        weight="bold"
                        className="shrink-0 text-brand-dark/20 group-hover:text-brand-dark/50 transition-colors"
                      />
                    </LocalizedClientLink>
                  </li>
                ))}
              </ul>
            </div>

          </nav>

          <div className="px-7 pt-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] border-t border-brand-dark/10 bg-brand-light shrink-0">
            <div className="flex flex-col gap-3 text-sm text-brand-dark/70">
              {!!locales?.length && (
                <div
                  className="flex items-center justify-between"
                  onMouseEnter={languageToggleState.open}
                  onMouseLeave={languageToggleState.close}
                >
                  <LanguageSelect
                    toggleState={languageToggleState}
                    locales={locales}
                  />
                  <ArrowRightMini
                    className={clx(
                      "transition-transform duration-150",
                      languageToggleState.state ? "-rotate-90" : ""
                    )}
                  />
                </div>
              )}
              {regions && (
                <div
                  className="flex items-center justify-between"
                  onMouseEnter={countryToggleState.open}
                  onMouseLeave={countryToggleState.close}
                >
                  <CountrySelect
                    toggleState={countryToggleState}
                    regions={regions}
                  />
                  <ArrowRightMini
                    className={clx(
                      "transition-transform duration-150",
                      countryToggleState.state ? "-rotate-90" : ""
                    )}
                  />
                </div>
              )}
              <p className="text-xs text-brand-dark/50 mt-2">
                © {new Date().getFullYear()} onlybestdevice. Toate drepturile
                rezervate.
              </p>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

export default SideMenu
