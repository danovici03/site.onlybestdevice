"use client"

import { retrieveOwnReview } from "@lib/data/reviews"
import { useSession } from "@lib/context/session-context"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Lock, Clock, CheckCircle, XCircle } from "@phosphor-icons/react/dist/ssr"
import { useEffect, useState } from "react"

import ReviewForm from "./review-form"

type OwnReview = NonNullable<Awaited<ReturnType<typeof retrieveOwnReview>>>

/**
 * Panoul „scrie o recenzie". A stat în componenta server `ProductReviews`, cu
 * `retrieveCustomer()` + `retrieveOwnReview()` pe server — două probleme:
 * apelurile ating cookie-uri, deci paginile de produs nu se mai prerandau, iar
 * pe o pagină ISR datele per-utilizator ar fi fost coapte în cache-ul comun
 * (recenzia unui client servită tuturor). Clientul vine din `SessionProvider`,
 * recenzia proprie se cere din browser prin server action, doar pentru
 * utilizatorii autentificați.
 */
const ReviewPanel = ({ productId }: { productId: string }) => {
  const { customer, ready } = useSession()
  const [ownReview, setOwnReview] = useState<OwnReview | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!customer) {
      setOwnReview(null)
      setChecked(false)
      return
    }
    let cancelled = false
    retrieveOwnReview(productId)
      .then((r) => {
        if (!cancelled) setOwnReview(r ?? null)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChecked(true)
      })
    return () => {
      cancelled = true
    }
  }, [customer, productId])

  // Până știm cine e vizitatorul, nu clipim între stări: prompt-ul de login e
  // și starea prerandată din HTML-ul static, deci majoritatea (nelogați) nu
  // văd nicio schimbare la hidratare.
  if (!ready || !customer) {
    return <LoginPrompt />
  }
  if (!checked) {
    return <div className="h-48 rounded-3xl bg-brand-light animate-pulse" />
  }
  if (ownReview) {
    return <OwnReviewBanner review={ownReview} />
  }
  return <ReviewForm productId={productId} />
}

const LoginPrompt = () => (
  <div className="bg-brand-light rounded-3xl lg:rounded-[2rem] p-6 lg:p-10 flex flex-col gap-3 lg:gap-4">
    <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-brand-accent/15 flex items-center justify-center text-brand-accent">
      <Lock size={20} weight="duotone" />
    </div>
    <h3 className="font-serif text-xl lg:text-2xl text-brand-dark">
      Doar pentru clienții înregistrați
    </h3>
    <p className="text-sm text-brand-dark/60 leading-relaxed">
      Pentru a garanta autenticitatea recenziilor, doar clienții cu cont pot
      publica părerea lor. Autentifică-te sau creează-ți un cont în câteva
      secunde.
    </p>
    <LocalizedClientLink
      href="/account"
      className="self-start inline-flex items-center justify-center rounded-full bg-brand-dark text-white px-6 py-3 text-sm font-bold hover:bg-brand-accent transition-colors"
    >
      Autentifică-te ca să scrii o recenzie
    </LocalizedClientLink>
  </div>
)

const OwnReviewBanner = ({ review }: { review: OwnReview }) => {
  const icon =
    review.status === "approved" ? (
      <CheckCircle size={22} weight="duotone" />
    ) : review.status === "rejected" ? (
      <XCircle size={22} weight="duotone" />
    ) : (
      <Clock size={22} weight="duotone" />
    )
  const title =
    review.status === "approved"
      ? "Recenzia ta este publicată"
      : review.status === "rejected"
        ? "Recenzie nepublicată"
        : "Recenzie în moderare"
  const body =
    review.status === "approved"
      ? "Mulțumim că ți-ai împărtășit experiența. Părerea ta îi ajută pe ceilalți clienți să aleagă."
      : review.status === "rejected"
        ? "Recenzia ta nu respectă regulile noastre și nu a fost publicată. Contactează-ne dacă ai nevoie de clarificări."
        : "Verificăm recenzia ta. Va fi publicată în scurt timp."

  return (
    <div className="bg-brand-light rounded-3xl lg:rounded-[2rem] p-6 lg:p-10 flex flex-col gap-3 lg:gap-4">
      <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-brand-accent/15 flex items-center justify-center text-brand-accent">
        {icon}
      </div>
      <h3 className="font-serif text-xl lg:text-2xl text-brand-dark">{title}</h3>
      <p className="text-sm text-brand-dark/60 leading-relaxed">{body}</p>
    </div>
  )
}

export default ReviewPanel
