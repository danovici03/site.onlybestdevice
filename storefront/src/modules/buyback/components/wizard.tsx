"use client"

import {
  ArrowLeft,
  Bank,
  CheckCircle,
  Gift,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr"
import Image from "next/image"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"

import {
  getBuybackQuote,
  type BuybackAnswers,
  type BuybackDevice,
  type BuybackGrade,
  type BuybackQuote,
} from "@lib/data/buyback"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

import DeviceSilhouette from "./device-silhouette"

import SellForm from "./sell-form"
import {
  DISPLAY_DEFECT_OPTIONS,
  GRADE_OPTIONS,
  lei,
  NETWORK_OPTIONS,
  PHONE_DEFECT_OPTIONS,
  storageLabel,
} from "../questions"

type Draft = {
  storage: string | null
  color: string | null
  network: BuybackAnswers["network"] | null
  liquid: boolean | null
  burn_in: boolean | null
  screen: BuybackGrade | null
  case: BuybackGrade | null
  battery: number
  display_defects: string[] | null
  phone_defects: string[] | null
}

const EMPTY: Draft = {
  storage: null,
  color: null,
  network: null,
  liquid: null,
  burn_in: null,
  screen: null,
  case: null,
  battery: 85,
  display_defects: null,
  phone_defects: null,
}

type StepId =
  | "config"
  | "liquid"
  | "burn_in"
  | "screen"
  | "case"
  | "battery"
  | "display_defects"
  | "phone_defects"

const storageKey = (handle: string) => `buyback:${handle}`

/** Progresul se păstrează la refresh, doar în tab-ul curent. */
const loadDraft = (handle: string): Draft => {
  try {
    const raw = sessionStorage.getItem(storageKey(handle))
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY
  } catch {
    return EMPTY
  }
}

const saveDraft = (handle: string, d: Draft) => {
  try {
    sessionStorage.setItem(storageKey(handle), JSON.stringify(d))
  } catch {}
}

const optionClass = (selected: boolean) =>
  `w-full rounded-2xl border px-5 py-4 text-left transition-colors ${
    selected
      ? "border-brand-dark bg-brand-dark/[0.04] ring-1 ring-brand-dark"
      : "border-brand-dark/15 bg-white hover:border-brand-dark/40"
  }`

const primaryButton =
  "w-full rounded-full bg-brand-dark px-8 py-4 font-semibold text-white transition-colors hover:bg-brand-accent disabled:cursor-not-allowed disabled:opacity-40"

const deviceName = (d: BuybackDevice) =>
  d.brand === "Apple" || d.model.startsWith(d.brand) ? d.model : `${d.brand} ${d.model}`

export default function BuybackWizard({ device }: { device: BuybackDevice }) {
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [stepIndex, setStepIndex] = useState(0)
  const [quote, setQuote] = useState<BuybackQuote | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const d = loadDraft(device.handle)
    // O stocare care nu mai e oferită (ai scos-o din admin) nu rămâne aleasă.
    setDraft(d.storage && !device.storages.includes(d.storage) ? { ...d, storage: null } : d)
  }, [device.handle, device.storages])

  const steps = useMemo<StepId[]>(
    () =>
      [
        "config",
        "liquid",
        device.questions.burn_in && "burn_in",
        "screen",
        "case",
        device.questions.battery && "battery",
        "display_defects",
        "phone_defects",
      ].filter(Boolean) as StepId[],
    [device.questions]
  )
  const step = steps[stepIndex]

  const update = (patch: Partial<Draft>) =>
    setDraft((d) => {
      const next = { ...d, ...patch }
      saveDraft(device.handle, next)
      return next
    })

  const next = () => {
    setError(null)
    if (stepIndex < steps.length - 1) setStepIndex((i) => i + 1)
    else requestQuote()
  }
  const back = () => {
    setError(null)
    if (quote) return setQuote(null)
    setStepIndex((i) => Math.max(0, i - 1))
  }

  /**
   * Alegerile simple trec singure la pasul următor. Un singur avans per pas:
   * două atingeri rapide ar sări peste pasul următor, rămas necompletat.
   */
  const advancing = useRef(false)
  const choose = (patch: Partial<Draft>) => {
    update(patch)
    if (advancing.current) return
    advancing.current = true
    setTimeout(() => {
      advancing.current = false
      next()
    }, 150)
  }

  const requestQuote = () => {
    const d = draft
    // Un pas sărit (draft vechi, navigare ciudată) nu blochează butonul în tăcere:
    // ducem clientul înapoi la primul pas necompletat.
    const missing: StepId | null =
      !d.storage || !d.network ? "config" : d.liquid == null ? "liquid" : !d.screen ? "screen" : !d.case ? "case" : null
    if (missing) {
      setStepIndex(Math.max(0, steps.indexOf(missing)))
      setError("Mai ai de răspuns la o întrebare.")
      return
    }
    startTransition(async () => {
      const res = await getBuybackQuote({
        handle: device.handle,
        storage: d.storage!,
        color: d.color,
        answers: {
          network: d.network!,
          liquid: d.liquid!,
          burn_in: device.questions.burn_in ? !!d.burn_in : undefined,
          screen: d.screen!,
          case: d.case!,
          battery: device.questions.battery ? d.battery : undefined,
          display_defects: d.display_defects ?? [],
          phone_defects: d.phone_defects ?? [],
        },
      })
      if (!res.ok) {
        setError(
          res.error === "rate_limited"
            ? "Ai făcut multe evaluări într-un timp scurt. Încearcă din nou în câteva minute."
            : res.error === "unavailable"
              ? "Nu mai preluăm această variantă. Alege altă memorie sau alt model."
              : "Nu am putut calcula oferta. Încearcă din nou."
        )
        return
      }
      setQuote(res.quote)
    })
  }

  const progress = quote ? 100 : Math.round((stepIndex / steps.length) * 100)
  const summary = [
    draft.storage && storageLabel(draft.storage),
    draft.color,
    draft.network && NETWORK_OPTIONS.find((o) => o.value === draft.network)?.label,
  ].filter(Boolean)

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <div className="flex items-center gap-5 rounded-3xl bg-brand-dark/[0.04] p-5 lg:flex-col lg:p-8 lg:text-center">
          <div className="relative h-24 w-20 shrink-0 lg:h-64 lg:w-full">
            {device.image_url ? (
              <Image
                src={device.image_url}
                alt={deviceName(device)}
                fill
                sizes="(min-width: 1024px) 360px, 80px"
                className="object-contain"
                priority
              />
            ) : (
              <DeviceSilhouette brand={device.brand} className="mx-auto h-full w-auto" />
            )}
          </div>
          <div>
            <p className="text-xl font-bold text-brand-dark lg:text-2xl">{deviceName(device)}</p>
            {summary.length > 0 && <p className="mt-1 text-sm text-brand-dark/60">{summary.join(" · ")}</p>}
            {device.max_price != null && !quote && (
              <p className="mt-2 text-sm font-semibold text-emerald-600">
                până la {lei(device.max_price)}
              </p>
            )}
          </div>
        </div>
      </aside>

      <section aria-live="polite">
        <div className="mb-6 flex items-center gap-4">
          {(stepIndex > 0 || quote) && (
            <button
              onClick={back}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand-dark/15 hover:border-brand-dark"
              aria-label="Înapoi"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-dark/10">
            <div className="h-full rounded-full bg-brand-accent transition-all" style={{ width: `${progress}%` }} />
          </div>
          {!quote && (
            <span className="shrink-0 text-xs font-semibold text-brand-dark/50">
              {stepIndex + 1}/{steps.length}
            </span>
          )}
        </div>

        {error && (
          <div role="alert" className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <WarningCircle size={20} weight="fill" className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {quote ? (
          <QuoteView quote={quote} device={device} />
        ) : (
          <>
            {step === "config" && (
              <Step title="Ce variantă ai?">
                <Label>Memorie</Label>
                <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {device.storages.map((s) => (
                    <button key={s} className={optionClass(draft.storage === s)} onClick={() => update({ storage: s })}>
                      <span className="font-semibold">{storageLabel(s)}</span>
                    </button>
                  ))}
                </div>
                {device.colors.length > 0 && (
                  <>
                    <Label>Culoare</Label>
                    <div className="mb-6 flex flex-wrap gap-2">
                      {device.colors.map((c) => (
                        <button
                          key={c}
                          className={`rounded-full border px-4 py-2 text-sm ${
                            draft.color === c
                              ? "border-brand-dark bg-brand-dark text-white"
                              : "border-brand-dark/15 hover:border-brand-dark/40"
                          }`}
                          onClick={() => update({ color: c })}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <Label>Rețea</Label>
                <div className="mb-8 flex flex-col gap-2">
                  {NETWORK_OPTIONS.map((o) => (
                    <button key={o.value} className={optionClass(draft.network === o.value)} onClick={() => update({ network: o.value })}>
                      <span className="font-semibold">{o.label}</span>
                      {o.help && <span className="mt-0.5 block text-sm text-brand-dark/60">{o.help}</span>}
                    </button>
                  ))}
                </div>
                <button className={primaryButton} disabled={!draft.storage || !draft.network} onClick={next}>
                  Continuă
                </button>
              </Step>
            )}

            {step === "liquid" && (
              <Step
                title="A avut telefonul contact cu apa sau alte lichide?"
                help="A căzut în apă, a stat în umezeală sau a fost reparat după un contact cu lichide."
              >
                <YesNo value={draft.liquid} onChange={(v) => choose({ liquid: v })} />
              </Step>
            )}

            {step === "burn_in" && (
              <Step
                title="Are ecranul imagini „arse”?"
                help="Deschide o imagine complet albă sau gri: se văd urme fixe ale tastaturii, ale barei de sus sau ale altor elemente?"
              >
                <YesNo value={draft.burn_in} onChange={(v) => choose({ burn_in: v })} />
              </Step>
            )}

            {step === "screen" && (
              <Step title="Cum arată ecranul?" help="Uită-te la ecran stins, în lumină puternică, din mai multe unghiuri.">
                <Grades kind="screen" value={draft.screen} onChange={(v) => choose({ screen: v })} />
              </Step>
            )}

            {step === "case" && (
              <Step title="Cum arată carcasa și rama?" help="Spatele, rama și colțurile.">
                <Grades kind="case" value={draft.case} onChange={(v) => choose({ case: v })} />
              </Step>
            )}

            {step === "battery" && (
              <Step
                title="Care este sănătatea bateriei?"
                help="O găsești în Configurări › Baterie › Starea și încărcarea bateriei (Capacitate maximă)."
              >
                <div className="mb-8 rounded-2xl border border-brand-dark/15 p-6">
                  <p className="mb-4 text-center text-5xl font-bold text-brand-dark">{draft.battery}%</p>
                  <input
                    type="range"
                    min={50}
                    max={100}
                    step={1}
                    value={draft.battery}
                    onChange={(e) => update({ battery: Number(e.target.value) })}
                    className="w-full accent-brand-dark"
                    aria-label="Sănătatea bateriei în procente"
                  />
                  <div className="mt-1 flex justify-between text-xs text-brand-dark/50">
                    <span>50% sau mai puțin</span>
                    <span>100%</span>
                  </div>
                </div>
                <button className={primaryButton} onClick={next}>
                  Continuă
                </button>
              </Step>
            )}

            {step === "display_defects" && (
              <Step title="Are ecranul defecte?" help="Deschide o pagină albă pe tot ecranul. Poți bifa mai multe.">
                <MultiDefects
                  options={DISPLAY_DEFECT_OPTIONS}
                  value={draft.display_defects}
                  onChange={(v) => update({ display_defects: v })}
                  onNext={next}
                />
              </Step>
            )}

            {step === "phone_defects" && (
              <Step title="Mai are telefonul alte probleme?" help="Poți bifa mai multe.">
                <MultiDefects
                  options={PHONE_DEFECT_OPTIONS}
                  value={draft.phone_defects}
                  onChange={(v) => update({ phone_defects: v })}
                  onNext={next}
                  cta={pending ? "Calculăm oferta…" : "Vezi oferta"}
                  disabled={pending}
                />
              </Step>
            )}
          </>
        )}
      </section>
    </div>
  )
}

function Step({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-brand-dark md:text-3xl">{title}</h2>
      {help && <p className="mt-2 text-brand-dark/60">{help}</p>}
      <div className="mt-6">{children}</div>
    </div>
  )
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-2 text-sm font-semibold text-brand-dark">{children}</p>
)

function YesNo({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <button className={optionClass(value === false)} onClick={() => onChange(false)}>
        <span className="font-semibold">Nu</span>
      </button>
      <button className={optionClass(value === true)} onClick={() => onChange(true)}>
        <span className="font-semibold">Da</span>
      </button>
    </div>
  )
}

function Grades({
  kind,
  value,
  onChange,
}: {
  kind: "screen" | "case"
  value: BuybackGrade | null
  onChange: (v: BuybackGrade) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {GRADE_OPTIONS.map((g) => (
        <button key={g.value} className={optionClass(value === g.value)} onClick={() => onChange(g.value)}>
          <span className="font-semibold">{g.label}</span>
          <span className="mt-0.5 block text-sm text-brand-dark/60">{g[kind]}</span>
        </button>
      ))}
    </div>
  )
}

/** Listă cu „Fără defecte” exclusiv: bifarea lui golește restul și invers. */
function MultiDefects({
  options,
  value,
  onChange,
  onNext,
  cta = "Continuă",
  disabled,
}: {
  options: readonly { value: string; label: string; help: string }[]
  value: string[] | null
  onChange: (v: string[]) => void
  onNext: () => void
  cta?: string
  disabled?: boolean
}) {
  const none = value !== null && value.length === 0
  const toggle = (v: string) => {
    const cur = value ?? []
    onChange(cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v])
  }
  return (
    <>
      <div className="mb-8 flex flex-col gap-2">
        <button className={optionClass(none)} onClick={() => onChange([])}>
          <span className="flex items-center gap-2 font-semibold">
            <CheckCircle size={20} weight={none ? "fill" : "regular"} className="text-emerald-600" />
            Fără defecte
          </span>
        </button>
        {options.map((o) => {
          const on = !!value?.includes(o.value)
          return (
            <button key={o.value} className={optionClass(on)} onClick={() => toggle(o.value)} aria-pressed={on}>
              <span className="font-semibold">{o.label}</span>
              <span className="mt-0.5 block text-sm text-brand-dark/60">{o.help}</span>
            </button>
          )
        })}
      </div>
      <button className={primaryButton} disabled={value === null || disabled} onClick={onNext}>
        {cta}
      </button>
    </>
  )
}

function QuoteView({ quote, device }: { quote: BuybackQuote; device: BuybackDevice }) {
  const [payout, setPayout] = useState<"voucher" | "bank">("voucher")
  const [selling, setSelling] = useState(false)

  if (quote.status === "rejected") {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8">
        <WarningCircle size={44} weight="fill" className="mb-4 text-amber-600" />
        <h2 className="text-2xl font-bold text-brand-dark">Nu putem face o ofertă online</h2>
        <p className="mt-2 text-brand-dark/70">
          Pentru un telefon cu {quote.reasons.map((r) => r.toLowerCase()).join(" și ")} nu putem
          estima un preț fără să-l vedem.
        </p>
        <LocalizedClientLink href="/contact" className="mt-6 inline-block font-semibold text-brand-accent hover:underline">
          Scrie-ne pentru o evaluare în magazin →
        </LocalizedClientLink>
      </div>
    )
  }

  if (quote.status === "too_low") {
    return (
      <div className="rounded-3xl border border-brand-dark/10 bg-brand-dark/[0.03] p-8">
        <h2 className="text-2xl font-bold text-brand-dark">Valoarea e prea mică pentru o preluare</h2>
        <p className="mt-2 text-brand-dark/70">
          În starea descrisă, costul verificării și al transportului depășește valoarea telefonului.
          Te putem ajuta în schimb cu reciclarea lui.
        </p>
        <LocalizedClientLink href="/contact" className="mt-6 inline-block font-semibold text-brand-accent hover:underline">
          Contactează-ne →
        </LocalizedClientLink>
      </div>
    )
  }

  const expires = new Date(quote.expires_at).toLocaleDateString("ro-RO", { day: "numeric", month: "long" })
  const bonus = quote.voucher_price - quote.price

  return (
    <div>
      <h2 className="text-2xl font-bold text-brand-dark md:text-3xl">Oferta pentru {deviceName(device)}</h2>
      <p className="mt-2 text-brand-dark/60">Alege cum vrei să primești banii. Oferta e valabilă până pe {expires}.</p>

      <div className="mt-6 flex flex-col gap-3">
        <button
          onClick={() => setPayout("voucher")}
          className={`relative rounded-3xl border p-6 text-left transition-colors ${
            payout === "voucher" ? "border-brand-dark ring-1 ring-brand-dark" : "border-brand-dark/15 hover:border-brand-dark/40"
          }`}
        >
          {bonus > 0 && (
            <span className="absolute -top-3 left-6 rounded-full bg-brand-accent px-3 py-1 text-xs font-bold text-white">
              +{quote.voucher_bonus_percent}% bonus
            </span>
          )}
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <Gift size={28} className="shrink-0 text-brand-accent" />
              <div>
                <p className="font-bold text-brand-dark">Voucher pe Onlybestdevice</p>
                <p className="mt-1 text-sm text-brand-dark/60">
                  Îl folosești la orice produs de pe site.
                  {bonus > 0 && ` Primești cu ${lei(bonus)} mai mult.`}
                </p>
              </div>
            </div>
            <p className="shrink-0 text-2xl font-bold text-brand-dark">{lei(quote.voucher_price)}</p>
          </div>
        </button>

        <button
          onClick={() => setPayout("bank")}
          className={`rounded-3xl border p-6 text-left transition-colors ${
            payout === "bank" ? "border-brand-dark ring-1 ring-brand-dark" : "border-brand-dark/15 hover:border-brand-dark/40"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <Bank size={28} className="shrink-0 text-brand-dark/70" />
              <div>
                <p className="font-bold text-brand-dark">Transfer bancar</p>
                <p className="mt-1 text-sm text-brand-dark/60">Banii ajung în cont după verificarea telefonului.</p>
              </div>
            </div>
            <p className="shrink-0 text-2xl font-bold text-brand-dark">{lei(quote.price)}</p>
          </div>
        </button>
      </div>

      {selling ? (
        <SellForm
          quoteToken={quote.token}
          payout={payout}
          onSubmitted={() => {
            try {
              sessionStorage.removeItem(storageKey(device.handle))
            } catch {}
          }}
        />
      ) : (
        <button className={`${primaryButton} mt-8`} onClick={() => setSelling(true)}>
          Vinde telefonul
        </button>
      )}

      <p className="mt-4 text-sm text-brand-dark/50">
        Prețul final se confirmă după ce tehnicianul nostru verifică telefonul. Dacă starea diferă de
        cea descrisă, îți facem o ofertă nouă, pe care o poți accepta sau refuza.
      </p>
    </div>
  )
}
