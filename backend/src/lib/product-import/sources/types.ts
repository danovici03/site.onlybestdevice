import type { Node } from "../html"

/** Ce scoate un adaptor din pagină. Tot ce lipsește cade pe restul surselor. */
export type RawExtraction = {
  title?: string
  /** HTML brut din pagină — NEsanitizat. Sanitizarea se face în `index.ts`. */
  descriptionHtml?: string
  /** Descriere ca text simplu, când sursa nu oferă HTML. */
  descriptionText?: string
  brand?: string
  ean?: string
  images: string[]
  specs: { label: string; value: string; group?: string }[]
  /** Avertismente pentru operator (traducere automată, fișă parțială…). */
  notes: string[]
}

export type SourceAdapter = {
  id: string
  label: string
  matches: (url: URL) => boolean
  extract: (root: Node, url: URL) => Partial<RawExtraction>
}
