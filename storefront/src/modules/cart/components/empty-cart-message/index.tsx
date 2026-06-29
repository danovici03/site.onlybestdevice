import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { ArrowRight, ShoppingBag } from "@phosphor-icons/react/dist/ssr"

const EmptyCartMessage = () => {
  return (
    <div
      className="bg-white rounded-3xl py-16 lg:py-24 px-6 flex flex-col items-center text-center shadow-sm"
      data-testid="empty-cart-message"
    >
      <span className="w-20 h-20 rounded-full bg-brand-light flex items-center justify-center mb-6">
        <ShoppingBag size={32} weight="light" className="text-brand-dark" />
      </span>
      <span className="text-xs uppercase tracking-[0.2em] font-bold text-brand-dark/50">
        Coș
      </span>
      <h1 className="font-serif text-3xl lg:text-4xl text-brand-dark mt-2">
        Coșul tău este gol
      </h1>
      <p className="text-brand-dark/60 mt-3 max-w-md">
        Non hai ancora aggiunto nessun produs. Lasciati ispirare dalle nostre
        collezioni e trova il pezzo perfetto per la tua casa.
      </p>
      <LocalizedClientLink href="/store" className="mt-8">
        <button
          type="button"
          className="bg-brand-dark text-white rounded-full px-7 py-3.5 font-bold text-sm flex items-center justify-center gap-2 hover:bg-brand-accent transition-colors"
        >
          <span>Explorează magazinul</span>
          <ArrowRight size={16} weight="bold" />
        </button>
      </LocalizedClientLink>
    </div>
  )
}

export default EmptyCartMessage
