/**
 * Maparea etichetelor din pagina sursă pe vocabularul nostru de specificații.
 *
 * În baza noastră etichetele vin din importul WooCommerce și sunt FĂRĂ
 * diacritice („Rezolutie camera principala"), pentru că așa au fost copiate în
 * WordPress. eMAG le scrie cu diacritice („Rezoluție cameră principală"). Dacă
 * am scrie eticheta sursei ca atare, panoul „Specificații" din storefront ar
 * ajunge să aibă două rânduri pentru același lucru, iar `SPEC_PRIORITY`
 * (regex-uri fără diacritice, în product-tabs) n-ar mai prinde niciunul.
 *
 * De aceea vocabularul NU e o listă scrisă de mână: se citește din baza de
 * date, adică din ce folosesc deja produsele. Se auto-întreține — o etichetă
 * nouă intrată azi devine mâine ținta de mapare pentru importurile următoare.
 *
 * Potrivirea se face pe `specKey` (fără diacritice, fără punctuație). Nu facem
 * potrivire „aproximativă" (distanță de editare): „Memorie RAM" și „Memorie
 * interna" sunt la distanță mică și sunt lucruri complet diferite. Ce nu se
 * potrivește exact rămâne cu eticheta sursei, iar operatorul decide în modal.
 */
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"

import { specKey } from "./specs"

export type VocabularyEntry = {
  /** Eticheta canonică, exact cum e scrisă în baza de date. */
  label: string
  /** La câte produse apare — sugerează cât de „oficială" e. */
  usage: number
}

export type Vocabulary = Map<string, VocabularyEntry>

/**
 * Cât ține vocabularul în memorie.
 *
 * E doar o listă de etichete, se schimbă rar, iar un import durează minute —
 * nu are sens o interogare pe fiecare preview. La 5 minute, o etichetă nouă
 * apare oricum înainte ca operatorul să treacă la produsul următor.
 */
const TTL_MS = 5 * 60 * 1000

let cache: { at: number; value: Vocabulary } | null = null

export function clearVocabularyCache() {
  cache = null
}

export async function loadVocabulary(container: MedusaContainer): Promise<Vocabulary> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value

  const knex: any = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  // `jsonb_each_text` peste `metadata->'specs'` — o singură trecere prin tabel.
  // `deleted_at is null` ține afară produsele șterse soft, ale căror etichete
  // n-ar mai trebui să tragă importurile noi după ele.
  const rows: { label: string; usage: string }[] = await knex.raw(
    `select t.key as label, count(distinct p.id)::text as usage
       from product p, jsonb_each_text(p.metadata->'specs') as t(key, value)
      where p.metadata ? 'specs'
        and jsonb_typeof(p.metadata->'specs') = 'object'
        and p.deleted_at is null
      group by t.key`
  ).then((r: any) => r.rows ?? r)

  const vocabulary: Vocabulary = new Map()
  for (const row of rows) {
    const key = specKey(row.label)
    if (!key) continue
    const usage = Number(row.usage) || 0
    const existing = vocabulary.get(key)
    // La chei egale (aceeași etichetă scrisă cu și fără diacritice) câștigă
    // varianta folosită la mai multe produse — aia e forma „de casă".
    if (!existing || usage > existing.usage) {
      vocabulary.set(key, { label: row.label, usage })
    }
  }

  cache = { at: Date.now(), value: vocabulary }
  return vocabulary
}

export type MappedSpec = {
  /** Eticheta din pagina sursă, neatinsă. */
  sourceLabel: string
  /** Eticheta cu care se va scrie: canonica noastră, dacă există. */
  label: string
  value: string
  group?: string
  /** `true` dacă eticheta e deja folosită de alte produse ale noastre. */
  known: boolean
  /** La câte produse apare eticheta canonică (0 dacă e nouă). */
  usage: number
}

/** Aplică vocabularul peste perechile extrase, fără să arunce nimic. */
export function mapSpecs(
  pairs: { label: string; value: string; group?: string }[],
  vocabulary: Vocabulary
): MappedSpec[] {
  return pairs.map((pair) => {
    const hit = vocabulary.get(specKey(pair.label))
    return {
      sourceLabel: pair.label,
      label: hit?.label ?? pair.label,
      value: pair.value,
      ...(pair.group ? { group: pair.group } : {}),
      known: !!hit,
      usage: hit?.usage ?? 0,
    }
  })
}
