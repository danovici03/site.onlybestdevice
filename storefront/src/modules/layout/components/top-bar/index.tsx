"use client"

import {
  ArrowLeft,
  ArrowRight,
  CaretDown,
  Coins,
  CreditCard,
  FacebookLogo,
  GlobeHemisphereWest,
  Headset,
  InstagramLogo,
  Tag,
  TiktokLogo,
} from "@phosphor-icons/react/dist/ssr"
import { useEffect, useState } from "react"

import { COMPANY } from "@lib/util/company-info"

const messages = [
  {
    Icon: Tag,
    text: "Produse noi cu garanție 24 de luni",
  },
  {
    Icon: CreditCard,
    text: "Plata cu cardul sau în rate",
  },
  {
    Icon: Headset,
    text: "Verificare colet la livrare · Retur gratuit 14 zile",
  },
]

const ROTATION_MS = 5000

const TopBar = () => {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % messages.length)
    }, ROTATION_MS)
    return () => clearInterval(id)
  }, [])

  const prev = () =>
    setIndex((i) => (i - 1 + messages.length) % messages.length)
  const next = () => setIndex((i) => (i + 1) % messages.length)

  const { Icon, text } = messages[index]

  return (
    <div className="bg-brand-dark text-white/90 text-[11px] sm:text-xs py-2.5 px-4 sm:px-8 flex items-center justify-between font-medium">
      <div className="hidden md:flex items-center gap-5">
        <a
          href={COMPANY.social.facebook}
          target="_blank"
          rel="noreferrer"
          aria-label="Facebook"
          className="hover:text-white transition-colors"
        >
          <FacebookLogo size={18} />
        </a>
        <a
          href={COMPANY.social.instagram}
          target="_blank"
          rel="noreferrer"
          aria-label="Instagram"
          className="hover:text-white transition-colors"
        >
          <InstagramLogo size={18} />
        </a>
        <a
          href={COMPANY.social.tiktok}
          target="_blank"
          rel="noreferrer"
          aria-label="TikTok"
          className="hover:text-white transition-colors"
        >
          <TiktokLogo size={18} />
        </a>
      </div>

      <div className="flex-1 flex items-center justify-center gap-4">
        <button
          onClick={prev}
          aria-label="Mesaj anterior"
          className="hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
        </button>
        <span
          key={index}
          className="tracking-widest uppercase flex items-center gap-2 text-center transition-opacity duration-300"
        >
          <Icon size={16} className="hidden sm:inline-block" />
          {text}
        </span>
        <button
          onClick={next}
          aria-label="Mesaj următor"
          className="hover:text-white transition-colors"
        >
          <ArrowRight size={14} />
        </button>
      </div>

      <div className="hidden md:flex items-center gap-6">
        <button className="flex items-center gap-1.5 hover:text-white transition-colors">
          <GlobeHemisphereWest size={16} /> Română <CaretDown size={12} />
        </button>
        <button className="flex items-center gap-1.5 hover:text-white transition-colors">
          <Coins size={16} /> RON (lei) <CaretDown size={12} />
        </button>
      </div>
    </div>
  )
}

export default TopBar
