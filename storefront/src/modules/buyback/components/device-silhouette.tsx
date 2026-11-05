/**
 * Silueta generică a unui telefon, pentru modelele fără poză. Desen propriu,
 * fără logo-uri: diferă doar decupajul camerei din față, ca un iPhone să nu
 * arate identic cu un Galaxy. Poza reală se pune din admin („Preluare
 * telefoane” › Prețuri) și o înlocuiește.
 */
type Cutout = "island" | "center" | "left" | "none"

const CUTOUT: Record<string, Cutout> = {
  apple: "island",
  samsung: "center",
  xiaomi: "center",
  huawei: "left",
}

export default function DeviceSilhouette({
  brand,
  className = "",
}: {
  brand: string
  className?: string
}) {
  const cutout = CUTOUT[brand.trim().toLowerCase()] ?? "none"
  const radius = cutout === "island" ? 22 : 16
  const id = `bb-sil-${cutout}`
  return (
    <svg viewBox="0 0 120 240" className={className} role="img" aria-label={`Telefon ${brand}`}>
      <defs>
        <linearGradient id={`${id}-screen`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3a3836" />
          <stop offset="55%" stopColor="#1C1B1A" />
          <stop offset="100%" stopColor="#2b2a28" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* butoane laterale */}
      <rect x="0.5" y="62" width="3" height="22" rx="1.5" fill="#B9B5B0" />
      <rect x="0.5" y="92" width="3" height="34" rx="1.5" fill="#B9B5B0" />
      <rect x="116.5" y="78" width="3" height="40" rx="1.5" fill="#B9B5B0" />
      {/* corp */}
      <rect x="3" y="2" width="114" height="236" rx={radius} fill="#D9D6D1" />
      <rect x="6" y="5" width="108" height="230" rx={radius - 3} fill={`url(#${id}-screen)`} />
      <path d={`M${6 + radius - 3} 5 H60 L30 235 H${6 + radius - 3} Q6 235 6 ${235 - radius + 3} V${5 + radius - 3} Q6 5 ${6 + radius - 3} 5Z`} fill={`url(#${id}-shine)`} />
      {/* camera frontală */}
      {cutout === "island" && <rect x="44" y="13" width="32" height="10" rx="5" fill="#0b0b0b" />}
      {cutout === "center" && <circle cx="60" cy="16" r="4" fill="#0b0b0b" />}
      {cutout === "left" && <circle cx="22" cy="17" r="4.5" fill="#0b0b0b" />}
      {/* bara de jos */}
      <rect x="44" y="225" width="32" height="2.5" rx="1.25" fill="#fff" fillOpacity="0.35" />
    </svg>
  )
}
