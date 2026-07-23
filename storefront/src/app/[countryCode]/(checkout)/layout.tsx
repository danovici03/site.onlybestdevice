import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ChevronDown from "@modules/common/icons/chevron-down"
import { Lock } from "@phosphor-icons/react/dist/ssr"

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="w-full bg-brand-light relative small:min-h-screen">
      <div className="h-16 bg-white border-b border-brand-dark/10">
        <nav className="flex h-full items-center content-container justify-between">
          <LocalizedClientLink
            href="/cart"
            className="text-small-semi text-brand-dark flex items-center gap-x-2 uppercase flex-1 basis-0"
            data-testid="back-to-cart-link"
          >
            <ChevronDown className="rotate-90" size={16} />
            <span className="mt-px hidden small:block txt-compact-plus text-brand-dark/60 hover:text-brand-dark">
              Înapoi la coș
            </span>
            <span className="mt-px block small:hidden txt-compact-plus text-brand-dark/60 hover:text-brand-dark">
              Înapoi
            </span>
          </LocalizedClientLink>
          <LocalizedClientLink
            href="/"
            className="flex items-center shrink-0"
            data-testid="store-link"
            aria-label="onlybestdevice — Acasă"
          >
            <span className="font-serif text-lg lg:text-xl font-bold tracking-tight text-brand-dark select-none">
              onlybest<span className="text-brand-accent">device</span>
            </span>
          </LocalizedClientLink>
          <div className="flex-1 basis-0 flex justify-end">
            <span className="hidden small:inline-flex items-center gap-1.5 text-xs font-bold text-brand-dark/50">
              <Lock size={13} weight="bold" />
              Plată securizată
            </span>
          </div>
        </nav>
      </div>
      <div className="relative" data-testid="checkout-container">{children}</div>
      <div className="py-5 w-full flex items-center justify-center">
        <p className="text-xs text-brand-dark/45">
          © onlybestdevice · Plată securizată · TVA inclus
        </p>
      </div>
    </div>
  )
}
