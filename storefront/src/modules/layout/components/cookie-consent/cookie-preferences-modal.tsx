"use client"

import { Dialog, Transition } from "@headlessui/react"
import { clx } from "@medusajs/ui"
import { Check, X } from "@phosphor-icons/react/dist/ssr"
import { Fragment, useEffect, useState } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { ConsentChoices, useConsent } from "@lib/context/consent-context"

type Category = {
  key: keyof ConsentChoices
  title: string
  description: string
  alwaysOn?: boolean
}

const CATEGORIES: Category[] = [
  {
    key: "necessary",
    title: "Cookie necessari",
    description:
      "Esențiale pentru funcționarea site-ului: coș, autentificare, preferințe de regiune și securitate. Nu pot fi dezactivate.",
    alwaysOn: true,
  },
  {
    key: "analytics",
    title: "Cookie analitici",
    description:
      "Colectează informații agregate despre utilizarea site-ului ca să îmbunătățim experiența. Nicio informație nu te identifică.",
  },
  {
    key: "marketing",
    title: "Cookie di marketing",
    description:
      "Permit afișarea de reclame relevante pe alte site-uri în funcție de interesele tale. Se instalează doar după consimțământul tău explicit.",
  },
]

export default function CookiePreferencesModal() {
  const { preferencesOpen, closePreferences, choices, accept } = useConsent()
  const [draft, setDraft] = useState<ConsentChoices>(choices)

  useEffect(() => {
    if (preferencesOpen) setDraft(choices)
  }, [preferencesOpen, choices])

  const toggle = (key: keyof ConsentChoices) => {
    if (key === "necessary") return
    setDraft((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <Transition show={preferencesOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-[85]"
        onClose={closePreferences}
      >
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-6">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="translate-y-full sm:translate-y-4 opacity-0"
            enterTo="translate-y-0 opacity-100"
            leave="ease-in duration-200"
            leaveFrom="translate-y-0 opacity-100"
            leaveTo="translate-y-full sm:translate-y-4 opacity-0"
          >
            <Dialog.Panel
              className="w-full max-w-lg bg-white rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh]"
              style={{
                paddingBottom: "env(safe-area-inset-bottom)",
              }}
            >
              <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4">
                <div>
                  <Dialog.Title className="font-serif text-2xl sm:text-3xl text-brand-dark leading-tight">
                    Preferenze cookie
                  </Dialog.Title>
                  <p className="text-sm text-brand-dark/60 mt-2">
                    Scegli quali categorie attivare. Maggiori dettagli nella{" "}
                    <LocalizedClientLink
                      href="/cookie"
                      className="underline font-bold hover:text-brand-accent"
                    >
                      Cookie Policy
                    </LocalizedClientLink>
                    .
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closePreferences}
                  aria-label="Închide"
                  className="-mt-1 -mr-1 p-1 rounded-full text-brand-dark/60 hover:text-brand-dark hover:bg-brand-light transition-colors shrink-0"
                >
                  <X size={20} weight="bold" />
                </button>
              </div>

              <ul className="px-3 pb-2 overflow-y-auto">
                {CATEGORIES.map((cat) => {
                  const isOn = draft[cat.key]
                  return (
                    <li key={cat.key} className="px-3 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-bold text-brand-dark">
                            {cat.title}
                          </h3>
                          <p className="text-sm text-brand-dark/60 mt-1 leading-relaxed">
                            {cat.description}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggle(cat.key)}
                          disabled={cat.alwaysOn}
                          role="switch"
                          aria-checked={isOn}
                          aria-label={`${cat.title} ${
                            isOn ? "attivati" : "disattivati"
                          }`}
                          className={clx(
                            "shrink-0 relative inline-flex h-7 w-12 items-center rounded-full transition-colors",
                            isOn ? "bg-brand-dark" : "bg-brand-dark/15",
                            cat.alwaysOn && "opacity-60 cursor-not-allowed"
                          )}
                        >
                          <span
                            className={clx(
                              "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                              isOn ? "translate-x-6" : "translate-x-1"
                            )}
                          />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>

              <div className="border-t border-brand-dark/10 px-6 py-4 flex flex-col sm:flex-row gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={() => accept(draft)}
                  className="px-5 py-3 rounded-full text-sm font-bold border border-brand-dark/20 text-brand-dark hover:border-brand-dark hover:bg-brand-light transition-colors order-2 sm:order-1"
                >
                  Salvează preferințele
                </button>
                <button
                  type="button"
                  onClick={() =>
                    accept({
                      necessary: true,
                      analytics: true,
                      marketing: true,
                    })
                  }
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-bold bg-brand-dark text-white hover:bg-brand-accent transition-colors order-1 sm:order-2"
                >
                  <Check size={16} weight="bold" />
                  Accetta tutti
                </button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  )
}
