"use client"

import { Dialog, Transition } from "@headlessui/react"
import { clx } from "@medusajs/ui"
import { ArrowsDownUp, Check } from "@phosphor-icons/react/dist/ssr"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Fragment, useCallback, useState } from "react"

import { useConsent } from "@lib/context/consent-context"
import { useScrolledPast } from "@lib/hooks/use-scrolled-past"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

const SORT_OPTIONS: { value: SortOptions; label: string }[] = [
  { value: "created_at", label: "Cele mai recente" },
  { value: "price_asc", label: "Preț: crescător" },
  { value: "price_desc", label: "Preț: descrescător" },
]

type Props = {
  sortBy: SortOptions
}

export default function MobileSortFab({ sortBy }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const scrolled = useScrolledPast(160)
  const { decided } = useConsent()
  const visible = scrolled && decided

  const activeLabel =
    SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "Ordina"

  const setSort = useCallback(
    (value: SortOptions) => {
      const params = new URLSearchParams(searchParams)
      params.set("sortBy", value)
      params.delete("page")
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
      setOpen(false)
    },
    [pathname, router, searchParams]
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Ordina prodotti, attuale: ${activeLabel}`}
        aria-hidden={!visible}
        tabIndex={visible ? 0 : -1}
        className={clx(
          "lg:hidden fixed right-4 z-[55] inline-flex items-center gap-2 rounded-full bg-brand-dark text-white pl-4 pr-5 py-3 shadow-[0_10px_28px_-8px_rgba(0,0,0,0.5)] hover:bg-brand-accent transition-all duration-300 ease-out",
          visible
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-4 pointer-events-none"
        )}
        style={{
          bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)",
        }}
      >
        <ArrowsDownUp size={18} weight="bold" />
        <span className="text-xs font-bold uppercase tracking-wider">
          Ordina
        </span>
      </button>

      <Transition show={open} as={Fragment}>
        <Dialog as="div" className="relative z-[80]" onClose={() => setOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 flex items-end justify-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="translate-y-full"
              enterTo="translate-y-0"
              leave="ease-in duration-200"
              leaveFrom="translate-y-0"
              leaveTo="translate-y-full"
            >
              <Dialog.Panel
                className="w-full max-w-md bg-white rounded-t-[2rem] shadow-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]"
              >
                <div className="flex justify-center pt-3 pb-2">
                  <span className="block w-10 h-1 rounded-full bg-brand-dark/15" />
                </div>
                <Dialog.Title className="font-serif text-2xl text-brand-dark px-6 pb-4">
                  Ordina
                </Dialog.Title>
                <ul className="px-2 pb-2">
                  {SORT_OPTIONS.map((opt) => {
                    const isActive = opt.value === sortBy
                    return (
                      <li key={opt.value}>
                        <button
                          type="button"
                          onClick={() => setSort(opt.value)}
                          className={clx(
                            "w-full flex items-center justify-between px-4 py-4 rounded-2xl text-left transition-colors",
                            isActive
                              ? "bg-brand-light text-brand-dark"
                              : "text-brand-dark hover:bg-brand-light/60"
                          )}
                        >
                          <span
                            className={clx(
                              "text-base",
                              isActive ? "font-bold" : "font-medium"
                            )}
                          >
                            {opt.label}
                          </span>
                          {isActive && (
                            <Check
                              size={20}
                              weight="bold"
                              className="text-brand-accent"
                            />
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </>
  )
}
