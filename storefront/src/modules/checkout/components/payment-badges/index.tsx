/**
 * Badge-uri vizuale pentru metodele de plată din checkout (lista în stilul
 * magazinelor RO: rând cu radio + titlu + logo-uri în dreapta). Wordmark-uri
 * simple desenate inline — fără asset-uri externe.
 */

const badgeBase =
  "inline-flex h-6 items-center justify-center rounded-md px-1.5 select-none"

export const VisaBadge = () => (
  <span
    className={`${badgeBase} bg-[#1434CB]`}
    aria-label="Visa"
    title="Visa"
  >
    <span className="text-[10px] font-extrabold italic tracking-tight text-white">
      VISA
    </span>
  </span>
)

export const MastercardBadge = () => (
  <span
    className={`${badgeBase} border border-brand-dark/10 bg-white`}
    aria-label="Mastercard"
    title="Mastercard"
  >
    <svg width="26" height="16" viewBox="0 0 26 16" aria-hidden="true">
      <circle cx="10" cy="8" r="7" fill="#EB001B" />
      <circle cx="16" cy="8" r="7" fill="#F79E1B" fillOpacity="0.9" />
      <path
        d="M13 2.7a7 7 0 0 1 0 10.6 7 7 0 0 1 0-10.6Z"
        fill="#FF5F00"
      />
    </svg>
  </span>
)

export const UniCreditBadge = () => (
  <span
    className={`${badgeBase} bg-[#E2001A]`}
    aria-label="UniCredit"
    title="UniCredit Consumer Financing"
  >
    <span className="text-[10px] font-bold tracking-tight text-white">
      UniCredit
    </span>
  </span>
)

export const TbiBadge = () => (
  <span
    className={`${badgeBase} bg-black`}
    aria-label="TBI Bank"
    title="TBI Bank"
  >
    <span className="text-[10px] font-bold lowercase tracking-tight text-white">
      tbi bank
    </span>
  </span>
)

export const CashBadge = () => (
  <span
    className={`${badgeBase} border border-brand-dark/10 bg-brand-light`}
    aria-label="Numerar"
    title="Numerar la livrare"
  >
    <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true">
      <rect x="0.5" y="0.5" width="17" height="11" rx="1.5" fill="#DCEBDD" stroke="#2F6B3A" />
      <circle cx="9" cy="6" r="2.6" fill="none" stroke="#2F6B3A" />
      <circle cx="3.4" cy="6" r="0.8" fill="#2F6B3A" />
      <circle cx="14.6" cy="6" r="0.8" fill="#2F6B3A" />
    </svg>
  </span>
)

export const BankBadge = () => (
  <span
    className={`${badgeBase} border border-brand-dark/10 bg-brand-light`}
    aria-label="Transfer bancar"
    title="Ordin de plată / transfer bancar"
  >
    <svg width="14" height="13" viewBox="0 0 14 13" aria-hidden="true">
      <path d="M7 0 13.5 3.5v1H.5v-1L7 0Z" fill="#333" />
      <rect x="1.6" y="5.3" width="1.6" height="4.6" fill="#333" />
      <rect x="4.8" y="5.3" width="1.6" height="4.6" fill="#333" />
      <rect x="8" y="5.3" width="1.6" height="4.6" fill="#333" />
      <rect x="11" y="5.3" width="1.6" height="4.6" fill="#333" />
      <rect x="0.5" y="10.7" width="13" height="1.8" fill="#333" />
    </svg>
  </span>
)
