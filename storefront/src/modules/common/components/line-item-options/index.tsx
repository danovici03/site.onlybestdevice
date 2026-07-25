import { HttpTypes } from "@medusajs/types"
import { Text } from "@medusajs/ui"

type LineItemOptionsProps = {
  variant: HttpTypes.StoreProductVariant | undefined
  /**
   * Titlul produsului din linia de coș. La produsele cu o singură variantă,
   * titlul variantei îl repetă — în acel caz nu mai afișăm nimic.
   */
  productTitle?: string | null
  "data-testid"?: string
  "data-value"?: HttpTypes.StoreProductVariant
}

const LineItemOptions = ({
  variant,
  productTitle,
  "data-testid": dataTestid,
  "data-value": dataValue,
}: LineItemOptionsProps) => {
  const title = variant?.title

  if (!title || title === productTitle) {
    return null
  }

  return (
    <Text
      data-testid={dataTestid}
      data-value={dataValue}
      className="inline-block txt-medium text-ui-fg-subtle w-full overflow-hidden text-ellipsis"
    >
      Variante: {title}
    </Text>
  )
}

export default LineItemOptions
