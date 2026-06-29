"use client"

import { useActionState, useState, useEffect } from "react"
import { Star } from "@phosphor-icons/react/dist/ssr"
import { submitProductReview } from "@lib/data/reviews"
import { SubmitButton } from "@modules/checkout/components/submit-button"

type Props = {
  productId: string
  variantId?: string | null
}

const ReviewForm = ({ productId, variantId }: Props) => {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [state, formAction] = useActionState(submitProductReview, null)
  const [body, setBody] = useState("")
  const [title, setTitle] = useState("")

  // Reset the form after a successful submission so the customer sees the
  // feedback state and not the now-stale draft
  useEffect(() => {
    if (state?.ok) {
      setRating(0)
      setHover(0)
      setTitle("")
      setBody("")
    }
  }, [state?.ok])

  if (state?.ok) {
    return (
      <div className="bg-brand-light rounded-3xl lg:rounded-[2rem] p-6 lg:p-10 text-center flex flex-col gap-3 items-center">
        <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-brand-accent/15 flex items-center justify-center text-brand-accent">
          <Star size={22} weight="fill" />
        </div>
        <h3 className="font-serif text-xl lg:text-2xl text-brand-dark">
          Mulțumim pentru recenzie
        </h3>
        <p className="text-sm text-brand-dark/60 max-w-md">{state.message}</p>
      </div>
    )
  }

  const display = hover || rating

  return (
    <form
      action={formAction}
      className="bg-brand-light rounded-3xl lg:rounded-[2rem] p-6 lg:p-10 flex flex-col gap-4 lg:gap-5"
    >
      <div>
        <h3 className="font-serif text-xl lg:text-3xl text-brand-dark">
          Lasă o recenzie
        </h3>
        <p className="text-sm text-brand-dark/60 mt-1">
          Ajută-i pe ceilalți clienți povestind experiența ta cu produsul.
        </p>
      </div>

      <input type="hidden" name="product_id" value={productId} />
      {variantId && (
        <input type="hidden" name="variant_id" value={variantId} />
      )}
      <input type="hidden" name="rating" value={rating} />

      <div className="flex flex-col gap-2">
        <label className="text-xs uppercase tracking-[0.2em] font-bold text-brand-dark/60">
          Evaluarea ta
        </label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              aria-label={`${n} stelle`}
              className="p-1 hover:scale-110 transition-transform"
            >
              <Star
                weight={n <= display ? "fill" : "regular"}
                className={`w-7 h-7 lg:w-8 lg:h-8 ${
                  n <= display ? "text-brand-accent" : "text-brand-dark/25"
                }`}
              />
            </button>
          ))}
          {display > 0 && (
            <span className="ml-2 text-sm font-bold text-brand-dark">
              {display}/5
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="review-title"
          className="text-xs uppercase tracking-[0.2em] font-bold text-brand-dark/60"
        >
          Titolo <span className="normal-case opacity-60">(opzionale)</span>
        </label>
        <input
          id="review-title"
          name="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Rezumă într-o frază experiența ta"
          className="bg-white rounded-2xl px-4 py-3 text-brand-dark border border-transparent focus:outline-none focus:border-brand-accent transition-colors"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="review-body"
          className="text-xs uppercase tracking-[0.2em] font-bold text-brand-dark/60"
        >
          Recenzia ta
        </label>
        <textarea
          id="review-body"
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          minLength={10}
          maxLength={4000}
          rows={5}
          required
          placeholder="Ce ți-a plăcut? Cum e calitatea, livrarea, dimensiunile?"
          className="bg-white rounded-2xl px-4 py-3 text-brand-dark border border-transparent focus:outline-none focus:border-brand-accent transition-colors resize-y min-h-[120px]"
        />
        <span className="text-xs text-brand-dark/50 self-end">
          {body.length}/4000
        </span>
      </div>

      {state?.ok === false && state.message && (
        <p className="text-sm text-red-700 bg-red-50 px-4 py-3 rounded-xl">
          {state.message}
        </p>
      )}

      <p className="text-xs text-brand-dark/50 leading-relaxed">
        Pubblicando, accetti che il tuo nome (es. &quot;Matteo R.&quot;) e la
        recensione siano visibili sulla pagina del prodotto. Le recensioni da
        acquisti verificati vengono pubblicate immediatamente; le altre dopo
        moderazione.
      </p>

      <SubmitButton
        className="self-start"
        data-testid="submit-review-button"
      >
        Publică recenzia
      </SubmitButton>
    </form>
  )
}

export default ReviewForm
