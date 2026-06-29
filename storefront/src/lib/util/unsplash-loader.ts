import type { ImageLoaderProps } from "next/image"

export const unsplashLoader = ({ src, width, quality }: ImageLoaderProps) => {
  const u = new URL(src)
  u.searchParams.set("w", String(width))
  u.searchParams.set("q", String(quality ?? 75))
  u.searchParams.set("auto", "format")
  u.searchParams.set("fit", "crop")
  return u.toString()
}
