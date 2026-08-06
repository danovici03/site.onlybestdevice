import { HttpTypes } from "@medusajs/types"

/**
 * Tipurile și pragurile rail-urilor de pe prima pagină.
 *
 * Stau separat de `@lib/data/rails` pentru că le citește și componenta din
 * browser: fișierul de date importă cookie-urile și `next/headers`, iar un
 * import de acolo într-un component client rupe build-ul. Aici nu e decât
 * formă, fără acces la date.
 */

/**
 * Criteriul după care un rail își alege produsele:
 *  - `sale`        — bifa „La ofertă" din admin (tagul `oferta`), adică
 *                    selecția făcută de echipă; aceeași sursă ca /oferte;
 *  - `featured`    — recomandările: produsele bifate „Recomandat" în admin
 *                    (tagul `recomandat`) urcă în față, restul e catalogul
 *                    recent al categoriei;
 *  - `bestsellers` — clasamentul din comenzi, completat cu produse noi din
 *                    aceeași categorie cât timp istoricul e subțire.
 */
export type RailKind = "sale" | "featured" | "bestsellers"

export type RailSource = {
  kind: RailKind
  countryCode: string
  /** Numele categoriei de nivel 1, așa cum vine din fațeta catalogului. */
  category?: string
  /**
   * Id-urile aceleiași categorii. Sunt mai multe pentru că importul a lăsat
   * categorii duplicate cu același nume; clasamentul și umplutura lucrează pe
   * id, nu pe nume, deci le au nevoie pe toate.
   */
  categoryIds?: string[]
}

export type RailPage = {
  products: HttpTypes.StoreProduct[]
  /** Mai există o pagină de încărcat la drag? */
  hasMore: boolean
}

/** Un tab de rail: sursa lui plus prima pagină, randată deja pe server. */
export type RailTab = {
  id: string
  label: string
  category?: string
  categoryIds?: string[]
  products: HttpTypes.StoreProduct[]
  hasMore: boolean
}

/** Câte produse aduce o pagină de rail (prima e randată pe server). */
export const RAIL_PAGE_SIZE = 12

/**
 * Plafonul de produse per tab. Un rail nu e o pagină de catalog: după câteva
 * încărcări clientul are ce vedea, iar restul e treaba butonului „Vezi tot".
 */
export const RAIL_MAX_ITEMS = 48
