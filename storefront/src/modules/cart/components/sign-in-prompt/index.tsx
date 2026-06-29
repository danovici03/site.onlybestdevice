import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { UserCircle } from "@phosphor-icons/react/dist/ssr"

const SignInPrompt = () => {
  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <span className="w-11 h-11 rounded-full bg-brand-light flex items-center justify-center shrink-0">
          <UserCircle size={22} weight="regular" className="text-brand-dark" />
        </span>
        <div>
          <p className="font-serif text-lg text-brand-dark leading-tight">
            Ai deja cont?
          </p>
          <p className="text-sm text-brand-dark/60 mt-0.5">
            Accedi per un&apos;esperienza più rapida e per accedere ai tuoi
            ordini.
          </p>
        </div>
      </div>
      <LocalizedClientLink href="/account" className="self-stretch sm:self-auto">
        <button
          type="button"
          data-testid="sign-in-button"
          className="w-full sm:w-auto px-6 py-3 rounded-full border border-brand-dark text-brand-dark font-bold text-sm hover:bg-brand-dark hover:text-white transition-colors"
        >
          Accedi
        </button>
      </LocalizedClientLink>
    </div>
  )
}

export default SignInPrompt
