import {
  SH_GRADES,
  SecondHandGrade,
  isSecondHandProduct,
  secondHandDetails,
} from "@lib/util/second-hand"
import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"
import {
  BatteryFull,
  BatteryHigh,
  BatteryMedium,
  BatteryLow,
  Recycle,
  SealCheck,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr"

const GRADE_ORDER: SecondHandGrade[] = ["bun", "foarte-bun", "excelent", "ca-nou"]

const batteryTone = (pct: number) =>
  pct >= 90
    ? { bar: "bg-emerald-500", text: "text-emerald-700", label: "Excelentă", Icon: BatteryFull }
    : pct >= 85
      ? { bar: "bg-emerald-500", text: "text-emerald-700", label: "Foarte bună", Icon: BatteryHigh }
      : pct >= 80
        ? { bar: "bg-amber-500", text: "text-amber-700", label: "Bună", Icon: BatteryMedium }
        : { bar: "bg-orange-500", text: "text-orange-700", label: "Uzată", Icon: BatteryLow }

/**
 * Starea unui produs Second Hand pe pagina lui: grad (cu scala celor patru),
 * sănătatea bateriei, garanția și observațiile. Datele vin din cardul
 * „Second Hand" din admin (metadata produsului); un câmp necompletat nu apare.
 */
const SecondHandDetails = ({ product }: { product: HttpTypes.StoreProduct }) => {
  if (!isSecondHandProduct(product)) return null

  const { grade, batteryHealth, warrantyMonths, notes } = secondHandDetails(
    product.metadata as Record<string, unknown> | null
  )
  const gradeInfo = grade ? SH_GRADES[grade] : null
  const tone = batteryHealth !== null ? batteryTone(batteryHealth) : null

  return (
    <section
      aria-label="Starea produsului"
      className="flex flex-col gap-4 rounded-3xl border border-brand-dark/10 bg-brand-light/50 p-5"
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-dark text-white">
          <Recycle size={18} weight="bold" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-brand-dark leading-tight">
            Produs folosit · Second Hand
          </p>
          <p className="flex items-center gap-1 text-xs text-brand-dark/60 leading-tight mt-0.5">
            <SealCheck size={13} weight="fill" className="text-emerald-600" />
            Verificat și testat de echipa noastră
          </p>
        </div>
      </div>

      {gradeInfo && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-brand-dark">
            Aspect: <span className="font-bold">{gradeInfo.label}</span>
          </p>
          <div className="grid grid-cols-4 gap-1.5" aria-hidden>
            {GRADE_ORDER.map((g) => (
              <div key={g} className="flex flex-col gap-1">
                <span
                  className={clx(
                    "h-1.5 rounded-full",
                    SH_GRADES[g].level <= gradeInfo.level
                      ? "bg-brand-dark"
                      : "bg-brand-dark/10"
                  )}
                />
                <span
                  className={clx(
                    "text-[11px] leading-tight",
                    g === grade
                      ? "font-bold text-brand-dark"
                      : "text-brand-dark/45"
                  )}
                >
                  {SH_GRADES[g].label}
                </span>
              </div>
            ))}
          </div>
          <p className="border-l-2 border-emerald-500 pl-3 text-xs text-brand-dark/70 leading-relaxed">
            {gradeInfo.description}
          </p>
        </div>
      )}

      {(tone || warrantyMonths) && (
        <div className="grid grid-cols-2 gap-2">
          {tone && batteryHealth !== null && (
            <div className="flex flex-col gap-1.5 rounded-2xl bg-white px-3.5 py-3">
              <span className="flex items-center gap-1.5 text-xs text-brand-dark/60">
                <tone.Icon size={15} weight="fill" className={tone.text} />
                Sănătate baterie
              </span>
              <span className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-brand-dark leading-none">
                  {batteryHealth}%
                </span>
                <span className={clx("text-xs font-bold", tone.text)}>
                  {tone.label}
                </span>
              </span>
              <span
                className="h-1.5 w-full overflow-hidden rounded-full bg-brand-dark/10"
                role="meter"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={batteryHealth}
                aria-label="Sănătatea bateriei"
              >
                <span
                  className={clx("block h-full rounded-full", tone.bar)}
                  style={{ width: `${batteryHealth}%` }}
                />
              </span>
            </div>
          )}
          {warrantyMonths && (
            <div
              className={clx(
                "flex flex-col gap-1.5 rounded-2xl bg-white px-3.5 py-3",
                !tone && "col-span-2"
              )}
            >
              <span className="flex items-center gap-1.5 text-xs text-brand-dark/60">
                <ShieldCheck size={15} weight="fill" className="text-emerald-600" />
                Garanție
              </span>
              <span className="text-lg font-bold text-brand-dark leading-none">
                {warrantyMonths} luni
              </span>
              <span className="text-xs text-brand-dark/60 leading-tight">
                Inclusă în preț
              </span>
            </div>
          )}
        </div>
      )}

      {notes && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-dark/50">
            Observații
          </p>
          <p className="whitespace-pre-line text-sm text-brand-dark/80 leading-relaxed">
            {notes}
          </p>
        </div>
      )}
    </section>
  )
}

export default SecondHandDetails
