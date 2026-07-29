import NextImage, { type ImageProps } from "next/image"

import { isPreOptimizedImage } from "@lib/util/image-source"

/**
 * Drop-in peste `next/image`, cu aceleași props.
 *
 * Singura diferență: sursele deja optimizate (vezi `isPreOptimizedImage`) sunt
 * servite direct de la origine, fără să treacă prin `/_next/image` — adică fără
 * transformări facturate pe Vercel. Restul pozelor se optimizează ca înainte.
 *
 * Se poate forța oricând comportamentul cu `unoptimized` explicit pe componentă.
 */
const Image = (props: ImageProps) => (
  <NextImage
    {...props}
    unoptimized={props.unoptimized ?? isPreOptimizedImage(props.src)}
  />
)

export default Image
