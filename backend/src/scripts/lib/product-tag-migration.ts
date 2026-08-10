import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createProductTagsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Pune sau scoate un tag de pe o listă de produse, dintr-un script de migrare.
 *
 * Aceeași grijă ca la bifa din admin (`src/admin/lib/product-tags.ts`):
 * `updateProductsWorkflow` înlocuiește lista de taguri în întregime, deci
 * trebuie trimis mereu setul complet. Tagurile se recitesc de la server chiar
 * înainte de fiecare scriere — un snapshot luat la începutul migrării ar rejuca,
 * peste zece minute, o listă din care lipsește ce a bifat între timp operatorul
 * din Admin, ștergându-i tagul fără nicio eroare.
 *
 * Scrierea se face în loturi: o singură rulare cu tot catalogul într-un array
 * poate depăși limitele workflow-ului, iar când crapă operatorul nu mai știe
 * câte produse au apucat să fie scrise.
 */

const BATCH_SIZE = 50

/** Id-ul tagului cu valoarea dată, creându-l dacă lipsește. */
const resolveTagId = async (
  container: any,
  value: string,
  create: boolean
): Promise<string | undefined> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_tag",
    fields: ["id", "value"],
    filters: { value },
  })
  const existing = data?.[0]?.id
  if (existing || !create) return existing

  const { result } = await createProductTagsWorkflow(container).run({
    input: { product_tags: [{ value }] },
  })
  return (result as any)[0].id
}

const chunk = <T,>(items: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/**
 * Scrie tagul pe produsele date (`mode: "add"`) sau îl scoate (`mode: "remove"`).
 * Întoarce câte produse au fost efectiv modificate.
 *
 * `onProgress` primește totalul scris până acum, ca scriptul apelant să poată
 * loga progresul — dacă un lot crapă, operatorul știe de unde să reia.
 */
export const applyTagToProducts = async (
  container: any,
  {
    productIds,
    tagValue,
    mode,
    onProgress,
  }: {
    productIds: string[]
    tagValue: string
    mode: "add" | "remove"
    onProgress?: (done: number, total: number) => void
  }
): Promise<number> => {
  if (!productIds.length) return 0

  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  // La scoatere n-are rost să creăm tagul: dacă nu există, nu-l poartă nimeni.
  const tagId = await resolveTagId(container, tagValue, mode === "add")
  if (!tagId) return 0

  let written = 0

  for (const batch of chunk(productIds, BATCH_SIZE)) {
    const { data: fresh } = await query.graph({
      entity: "product",
      fields: ["id", "tags.id", "tags.value"],
      filters: { id: batch } as any,
    })

    const updates = (fresh as any[])
      .map((p) => {
        const current = (p.tags ?? []) as { id: string; value?: string }[]
        const has = current.some((t) => t.id === tagId)
        if (mode === "add" && has) return null
        if (mode === "remove" && !has) return null

        const tags =
          mode === "add"
            ? [...current.map((t) => ({ id: t.id })), { id: tagId }]
            : current.filter((t) => t.id !== tagId).map((t) => ({ id: t.id }))

        return { id: p.id, tags }
      })
      .filter(Boolean) as { id: string; tags: { id: string }[] }[]

    if (!updates.length) continue

    await updateProductsWorkflow(container).run({
      input: { products: updates } as any,
    })

    written += updates.length
    onProgress?.(written, productIds.length)
  }

  return written
}
