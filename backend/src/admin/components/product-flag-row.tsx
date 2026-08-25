import { AdminProduct } from "@medusajs/types"
import { InformationCircleSolid } from "@medusajs/icons"
import { Badge, Switch, Text, Tooltip, toast } from "@medusajs/ui"
import { ReactNode, useState } from "react"

import { hasTag, setProductTag } from "../lib/product-tags"
import { useOptionalQueryClient } from "../lib/use-optional-query-client"

/**
 * Un rând de bifă din cardul „Marcaje produs”, pus/scos ca tag.
 *
 * Forma e comună tuturor bifelor (Ofertă, Outlet, …): widgetul rămâne doar
 * configurație. Fără asta, fiecare bifă nouă ar fi încă o copie a aceluiași
 * handler, iar o corectură — cum a fost citirea tagurilor de la server înainte
 * de scriere — ar trebui aplicată în fiecare copie.
 *
 * Explicația lungă stă în tooltip, nu sub titlu: se citește o dată, la învățarea
 * admin-ului, nu la fiecare produs. Ca paragraf mereu vizibil, cele patru bife
 * ocupau peste 800px din coloana dreaptă și împingeau panourile native ale
 * produsului sub linia de plutire.
 */
const ProductFlagRow = ({
  product,
  tag,
  icon,
  title,
  hint,
  details,
  badge,
  onMessage,
  offMessage,
}: {
  product: AdminProduct
  /** Valoarea tagului scris pe produs (ex. `oferta`). */
  tag: string
  icon: ReactNode
  title: string
  /** Linia scurtă de sub titlu: ce se întâmplă pe site dacă e bifat. */
  hint: ReactNode
  /** Textul lung, arătat în tooltip pe iconița ⓘ. */
  details: ReactNode
  /** Etichetă opțională lângă titlu (ex. „intern”). */
  badge?: string
  /** Textul din toast la bifare / debifare. */
  onMessage: string
  offMessage: string
}) => {
  const queryClient = useOptionalQueryClient()
  const [checked, setChecked] = useState(hasTag(product, tag))
  const [saving, setSaving] = useState(false)

  const toggle = async (next: boolean) => {
    setSaving(true)
    try {
      await setProductTag(product.id, tag, next)
      setChecked(next)
      toast.success(next ? onMessage : offMessage)
      // Restul paginii citește tagurile din cache-ul react-query, iar scrierea
      // de mai sus ocolește SDK-ul. Fără invalidare, cardul „Preț" ar continua
      // să avertizeze „preț tăiat, dar produsul nu e bifat «La ofertă»" după ce
      // tocmai ai pus bifa — și tot așa până la un refresh din browser.
      queryClient?.invalidateQueries({ queryKey: ["products"] })
    } catch (err: any) {
      toast.error(err.message || "Eroare la salvare")
    } finally {
      setSaving(false)
    }
  }

  const id = `${tag}-toggle`

  return (
    <div className="flex items-start gap-3 px-6 py-3">
      <span className="text-ui-fg-subtle mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <label
            htmlFor={id}
            className="txt-compact-small-plus text-ui-fg-base cursor-pointer"
          >
            {title}
          </label>
          {badge && (
            <Badge size="2xsmall" color="grey">
              {badge}
            </Badge>
          )}
          {/*
            Trigger-ul e un buton, nu iconița direct: `Tooltip` randează
            `Radix.Trigger asChild`, iar pe un SVG tooltipul ar apărea doar la
            hover — cu buton se ajunge la el și din tastatură.
          */}
          <Tooltip content={details} maxWidth={320} side="left">
            <button
              type="button"
              aria-label={`Ce înseamnă „${title}”`}
              className="text-ui-fg-muted hover:text-ui-fg-subtle transition-fg shrink-0"
            >
              <InformationCircleSolid />
            </button>
          </Tooltip>
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          {hint}
        </Text>
      </div>
      {/*
        Fără etichetă de stare lângă switch: textul („La ofertă" / „Preț
        normal") își schimba lățimea la fiecare bifare și dezalinia rândurile.
        Starea o arată switch-ul, acțiunea o confirmă toastul.
      */}
      <Switch
        checked={checked}
        disabled={saving}
        onCheckedChange={toggle}
        id={id}
        className="mt-1 shrink-0"
      />
    </div>
  )
}

export default ProductFlagRow
