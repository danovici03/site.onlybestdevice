import { AdminProduct } from "@medusajs/types"
import { Container, Heading, Switch, Text, toast } from "@medusajs/ui"
import { ReactNode, useState } from "react"

import { hasTag, setProductTag } from "../lib/product-tags"

/**
 * Bifă de produs pe pagina de detaliu, pusă/scoasă ca tag.
 *
 * Forma e comună tuturor bifelor (Ofertă, Outlet, …): widgetul rămâne doar
 * configurație. Fără asta, fiecare bifă nouă ar fi încă o copie a aceluiași
 * handler, iar o corectură — cum a fost citirea tagurilor de la server înainte
 * de scriere — ar trebui aplicată în fiecare copie.
 */
const ProductTagToggle = ({
  product,
  tag,
  icon,
  title,
  description,
  onLabel,
  offLabel,
  onMessage,
  offMessage,
}: {
  product: AdminProduct
  /** Valoarea tagului scris pe produs (ex. `oferta`). */
  tag: string
  icon: ReactNode
  title: string
  description: ReactNode
  /** Eticheta de lângă switch când e bifat / debifat. */
  onLabel: string
  offLabel: string
  /** Textul din toast la bifare / debifare. */
  onMessage: string
  offMessage: string
}) => {
  const [checked, setChecked] = useState(hasTag(product, tag))
  const [saving, setSaving] = useState(false)

  const toggle = async (next: boolean) => {
    setSaving(true)
    try {
      await setProductTag(product.id, tag, next)
      setChecked(next)
      toast.success(next ? onMessage : offMessage)
    } catch (err: any) {
      toast.error(err.message || "Eroare la salvare")
    } finally {
      setSaving(false)
    }
  }

  const id = `${tag}-toggle`

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          {icon}
          <Heading level="h2">{title}</Heading>
        </div>
      </div>
      <div className="px-6 py-4 flex items-start justify-between gap-6">
        <div className="flex flex-col gap-1 max-w-2xl">{description}</div>
        <div className="flex items-center gap-2 shrink-0">
          <Switch
            checked={checked}
            disabled={saving}
            onCheckedChange={toggle}
            id={id}
          />
          <label htmlFor={id} className="text-sm font-medium cursor-pointer">
            {checked ? onLabel : offLabel}
          </label>
        </div>
      </div>
    </Container>
  )
}

export default ProductTagToggle
