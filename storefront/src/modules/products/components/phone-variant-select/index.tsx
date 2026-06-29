import { buildPhoneMatrix, type PhoneMatrix } from "@lib/util/phone-group"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Selector de stocare + culoare pentru telefoanele aceluiași model. Fiecare
 * variantă e un produs separat, legat prin `metadata.phone_siblings` (vezi
 * scriptul backend `link-phone-variants.ts`). Comutarea înseamnă navigare
 * către produsul-frate — de aceea opțiunile sunt simple link-uri, calculabile
 * pe server, fără stare de client.
 */

const lower = (s: string | null) => (s ?? "").toLowerCase()

// Handle-ul pentru o capacitate dată, păstrând culoarea curentă dacă există;
// altfel prima culoare disponibilă la acea capacitate.
function handleForStorage(matrix: PhoneMatrix, storageLabel: string) {
  const exact = matrix.combos.get(`${storageLabel}|${lower(matrix.current.color)}`)
  if (exact) return exact
  for (const [key, handle] of Array.from(matrix.combos)) {
    if (key.startsWith(`${storageLabel}|`)) return handle
  }
  return null
}

// Handle-ul pentru o culoare dată, păstrând capacitatea curentă dacă există;
// altfel prima capacitate disponibilă pentru acea culoare.
function handleForColor(matrix: PhoneMatrix, colorLower: string) {
  const exact = matrix.combos.get(`${matrix.current.storage ?? ""}|${colorLower}`)
  if (exact) return exact
  for (const [key, handle] of Array.from(matrix.combos)) {
    if (key.endsWith(`|${colorLower}`)) return handle
  }
  return null
}

const colorAvailableForCurrentStorage = (matrix: PhoneMatrix, colorLower: string) =>
  matrix.combos.has(`${matrix.current.storage ?? ""}|${colorLower}`)

export default function PhoneVariantSelect({
  product,
}: {
  product: HttpTypes.StoreProduct
}) {
  const matrix = buildPhoneMatrix(product)
  if (!matrix) return null

  const showStorages = matrix.storages.length > 1
  const showColors = matrix.colors.length > 1
  if (!showStorages && !showColors) return null

  const currentStorage = matrix.current.storage
  const currentColorLower = lower(matrix.current.color)

  return (
    <div className="flex flex-col gap-y-5 pb-6 border-b border-brand-dark/10">
      {showStorages && (
        <div className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-[0.18em] font-bold text-brand-dark/50">
            Capacitate
          </span>
          <div className="flex flex-wrap gap-2">
            {matrix.storages.map((s) => {
              const isCurrent = s.label === currentStorage
              const href = handleForStorage(matrix, s.label)
              const base =
                "px-4 py-2 rounded-full text-sm font-bold border transition-colors"
              if (isCurrent || !href) {
                return (
                  <span
                    key={s.label}
                    aria-current={isCurrent ? "true" : undefined}
                    className={`${base} ${
                      isCurrent
                        ? "bg-brand-dark text-white border-brand-dark"
                        : "border-brand-dark/15 text-brand-dark/40"
                    }`}
                  >
                    {s.label}
                  </span>
                )
              }
              return (
                <LocalizedClientLink
                  key={s.label}
                  href={`/products/${href}`}
                  className={`${base} border-brand-dark/15 text-brand-dark hover:border-brand-dark`}
                >
                  {s.label}
                </LocalizedClientLink>
              )
            })}
          </div>
        </div>
      )}

      {showColors && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.18em] font-bold text-brand-dark/50">
              Culoare
            </span>
            {matrix.current.color && (
              <span className="text-sm text-brand-dark/60">
                {matrix.current.color}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {matrix.colors.map((c) => {
              const cl = c.label.toLowerCase()
              const isCurrent = cl === currentColorLower
              const available = colorAvailableForCurrentStorage(matrix, cl)
              const href = handleForColor(matrix, cl)
              const ring = isCurrent
                ? "ring-2 ring-offset-2 ring-brand-dark"
                : "ring-1 ring-inset ring-brand-dark/15 hover:ring-brand-dark/50"
              const swatch = (
                <span
                  className={`block h-9 w-9 rounded-full ${ring} ${
                    !available && !isCurrent ? "opacity-45" : ""
                  }`}
                  style={{ backgroundColor: c.hex ?? "#e5e7eb" }}
                />
              )
              const title = available
                ? c.label
                : `${c.label} · la altă capacitate`
              if (isCurrent || !href) {
                return (
                  <span
                    key={c.label}
                    title={title}
                    aria-label={c.label}
                    aria-current={isCurrent ? "true" : undefined}
                  >
                    {swatch}
                  </span>
                )
              }
              return (
                <LocalizedClientLink
                  key={c.label}
                  href={`/products/${href}`}
                  title={title}
                  aria-label={c.label}
                >
                  {swatch}
                </LocalizedClientLink>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
