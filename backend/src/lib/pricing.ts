import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import {
  batchPriceListPricesWorkflow,
  createPriceListsWorkflow,
  updateProductVariantsWorkflow,
  upsertVariantPricesWorkflow,
} from "@medusajs/medusa/core-flows"

import { resolveCurrencyCode } from "./currency"

/**
 * Prețul unui produs, în forma pe care o știe un operator de magazin: un preț
 * normal și, opțional, unul promoțional.
 *
 * În Medusa v2 cele două nu stau în același loc. Prețul normal e un rând în
 * price set-ul variantei; prețul promoțional e un rând **într-o price list de
 * tip `sale`**, singura formă din care storefront-ul deduce prețul tăiat
 * (`calculated_amount` vs `original_amount`, vezi storefront
 * `lib/util/get-product-price.ts`). Aici ținem ascunsă distincția: cardul din
 * admin trimite două numere, restul se traduce în price set / price list.
 *
 * Tot ce ține de scriere stă pe server dintr-un motiv concret: vectorul
 * `prices` trimis către Medusa e **set complet, nu patch**. `updatePriceSets_`
 * șterge orice rând existent al cărui `id` lipsește din payload, așa că o
 * scriere naivă „doar prețul în RON" ar șterge tăcut orice alt preț al
 * variantei. Clientul nu vede niciodată vectorul; trimite doar numere.
 */

/** Price list-ul unic în care ținem toate prețurile promoționale. */
export const SALE_PRICE_LIST_TITLE = "Reduceri"

const SALE_PRICE_LIST_DESCRIPTION =
  "Prețurile promoționale setate din cardul „Preț” de pe pagina produsului."

export type VariantPrices = {
  id: string
  title: string
  sku: string | null
  /** Prețul normal, în moneda magazinului. `null` = variantă încă fără preț. */
  price: number | null
  /** Prețul promoțional, sau `null` dacă varianta nu e la promoție. */
  sale_price: number | null
}

export type ProductPrices = {
  currency_code: string
  variants: VariantPrices[]
}

export type PriceUpdate = {
  /** Id-ul variantei. */
  id: string
  price?: number
  /** `null` scoate varianta de la promoție. */
  sale_price?: number | null
}

type PriceRow = {
  id: string
  amount: number
  currency_code: string
  price_set_id: string
  price_list_id: string | null
  price_rules?: Array<{ attribute: string; value: string }> | null
}

type VariantRow = {
  id: string
  title: string
  sku: string | null
  hasPriceSet: boolean
  /** Toate prețurile de bază (fără price list), în orice monedă. */
  base: PriceRow[]
  /** Rândul din price list-ul de reduceri pentru moneda magazinului. */
  sale: PriceRow | null
}

/** Prețurile se scriu cu doi zecimali; restul e zgomot din calcule în virgulă. */
const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Prețul „de bază" al variantei: fără price list, în moneda magazinului și
 * **fără reguli**.
 *
 * Ultima condiție nu e paranoia: un preț legat de regiune (`region_id`) trăiește
 * în același price set și în aceeași monedă. Fără filtrul pe reguli l-am
 * confunda cu prețul general și l-am suprascrie. E același criteriu pe care îl
 * folosește și gridul standard din admin (`pricing-edit.tsx`).
 */
const isPlainBase = (p: PriceRow, currency: string) =>
  !p.price_list_id &&
  p.currency_code === currency &&
  !(p.price_rules ?? []).length

/** Id-ul price list-ului de reduceri, sau `null` dacă nu s-a creat încă. */
const findSalePriceListId = async (container: any): Promise<string | null> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: lists } = await query.graph({
    entity: "price_list",
    fields: ["id", "title"],
    filters: { title: SALE_PRICE_LIST_TITLE },
  })

  return (lists as any[])[0]?.id ?? null
}

const loadVariantRows = async (
  container: any,
  productId: string,
  currency: string
): Promise<VariantRow[]> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "variants.id", "variants.title", "variants.sku", "variants.price_set.id"],
    filters: { id: productId },
  })

  const product = (products as any[])[0]
  if (!product) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Produsul nu există")
  }

  const variants = (product.variants ?? []) as any[]
  const priceSetIds = variants
    .map((v) => v.price_set?.id)
    .filter(Boolean) as string[]

  // Prețurile se citesc pe entitatea `price`, nu prin `variants.price_set.prices`:
  // relația aceea întoarce **doar** prețurile de bază, deci cele promoționale ar
  // fi invizibile. Filtrarea pe price set-urile produsului o ține la un singur
  // query, fără să aducem toată lista de reduceri.
  const prices: PriceRow[] = priceSetIds.length
    ? ((
        await query.graph({
          entity: "price",
          fields: [
            "id",
            "amount",
            "currency_code",
            "price_set_id",
            "price_list_id",
            "price_rules.attribute",
            "price_rules.value",
          ],
          filters: { price_set_id: priceSetIds },
        })
      ).data as PriceRow[])
    : []

  const salePriceListId = await findSalePriceListId(container)

  return variants.map((v): VariantRow => {
    const own = prices.filter((p) => p.price_set_id === v.price_set?.id)

    return {
      id: v.id,
      title: v.title ?? "",
      sku: v.sku ?? null,
      hasPriceSet: !!v.price_set?.id,
      base: own.filter((p) => !p.price_list_id),
      sale:
        own.find(
          (p) =>
            !!salePriceListId &&
            p.price_list_id === salePriceListId &&
            p.currency_code === currency
        ) ?? null,
    }
  })
}

const toPublic = (rows: VariantRow[], currency: string): VariantPrices[] =>
  rows.map((v) => ({
    id: v.id,
    title: v.title,
    sku: v.sku,
    price: v.base.find((p) => isPlainBase(p, currency))?.amount ?? null,
    sale_price: v.sale?.amount ?? null,
  }))

export const readProductPrices = async (
  container: any,
  productId: string
): Promise<ProductPrices> => {
  const currency = await resolveCurrencyCode(container)
  const rows = await loadVariantRows(container, productId, currency)

  return { currency_code: currency, variants: toPublic(rows, currency) }
}

/**
 * Id-ul price list-ului de reduceri, creându-l dacă nu există încă.
 *
 * Nu îl seedăm: prima promoție dintr-un magazin curat îl naște, ca operatorul
 * să nu fie nevoit să treacă întâi prin ecranul de price lists.
 */
const resolveSalePriceListId = async (container: any): Promise<string> => {
  const existing = await findSalePriceListId(container)
  if (existing) return existing

  const { result } = await createPriceListsWorkflow(container).run({
    input: {
      price_lists_data: [
        {
          title: SALE_PRICE_LIST_TITLE,
          description: SALE_PRICE_LIST_DESCRIPTION,
          type: "sale",
          status: "active",
          prices: [],
        },
      ] as any,
    },
  })

  const created = (result as any[])?.[0]
  if (!created?.id) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Nu am putut crea price list-ul „${SALE_PRICE_LIST_TITLE}”`
    )
  }
  return created.id
}

/**
 * Vectorul complet de prețuri de bază al variantei, cu o singură valoare
 * schimbată.
 *
 * Rândurile neatinse se retrimit cu `id`-ul și regulile lor — altfel Medusa le
 * consideră șterse (vezi comentariul din capul fișierului).
 */
const nextBasePrices = (
  variant: VariantRow,
  currency: string,
  amount: number
) => {
  const rebuilt = variant.base.map((p) => {
    const rules = (p.price_rules ?? []).reduce<Record<string, string>>(
      (acc, r) => {
        acc[r.attribute] = r.value
        return acc
      },
      {}
    )

    return {
      id: p.id,
      currency_code: p.currency_code,
      amount: isPlainBase(p, currency) ? amount : p.amount,
      ...(Object.keys(rules).length ? { rules } : {}),
    }
  })

  const hadPlainBase = variant.base.some((p) => isPlainBase(p, currency))
  if (!hadPlainBase) {
    rebuilt.push({ currency_code: currency, amount } as any)
  }

  return rebuilt
}

/**
 * Anunță storefront-ul că variantele s-au schimbat.
 *
 * Toleranți la lipsa event bus-ului, ca în `api/admin/hero-slides/route.ts`:
 * în dev poate lipsi, iar o revalidare ratată nu are voie să pice salvarea.
 */
const emitVariantsUpdated = async (container: any, variantIds: string[]) => {
  if (!variantIds.length) return

  try {
    const eventBus: any = container.resolve(Modules.EVENT_BUS)
    await eventBus.emit(
      variantIds.map((id) => ({ name: "product-variant.updated", data: { id } }))
    )
  } catch {
    // revalidarea cade pe cea bazată pe timp
  }
}

/**
 * Scrie prețul normal și/sau cel promoțional pentru variantele date.
 *
 * Întoarce starea proaspătă, ca apelantul să nu mai facă o citire separată.
 */
export const writeProductPrices = async (
  container: any,
  productId: string,
  updates: PriceUpdate[]
): Promise<ProductPrices> => {
  const currency = await resolveCurrencyCode(container)
  const rows = await loadVariantRows(container, productId, currency)
  const byId = new Map(rows.map((v) => [v.id, v]))

  /* ---------------- Validare ---------------- */

  type Planned = {
    variant: VariantRow
    price?: number
    salePrice?: number | null
  }
  const planned: Planned[] = []

  for (const u of updates) {
    const variant = byId.get(u.id)
    if (!variant) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Varianta ${u.id} nu aparține acestui produs`
      )
    }

    const price = u.price != null ? round2(u.price) : undefined
    const salePrice =
      u.sale_price === null ? null : u.sale_price != null ? round2(u.sale_price) : undefined

    if (price != null && !(price > 0)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Prețul trebuie să fie mai mare decât zero"
      )
    }
    if (salePrice != null && !(salePrice > 0)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Prețul promoțional trebuie să fie mai mare decât zero"
      )
    }

    // Prețul de referință e cel care va exista după scriere, nu cel de acum:
    // altfel un card care schimbă ambele câmpuri deodată ar fi respins pe
    // baza prețului vechi.
    const effectivePrice =
      price ?? toPublic([variant], currency)[0].price ?? null

    if (salePrice != null && effectivePrice == null) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Setează întâi prețul normal, apoi pe cel promoțional"
      )
    }
    if (salePrice != null && effectivePrice != null && salePrice >= effectivePrice) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Prețul promoțional trebuie să fie mai mic decât prețul normal"
      )
    }

    planned.push({ variant, price, salePrice })
  }

  /* ---------------- Prețurile de bază ---------------- */

  // Varianta care are deja un price set merge pe drumul standard din admin.
  // Cea fără price set (produs creat din ERP și nepublicat, de exemplu) nu are
  // ce actualiza: `upsertVariantPricesWorkflow` e singurul care îi creează
  // price set-ul și link-ul. Cu `previousVariantIds` gol nimerește exact ramura
  // de creare — pe o variantă care avea deja price set ar face al doilea, deci
  // ramurile nu se pot inversa.
  const toUpdate = planned.filter((p) => p.price != null && p.variant.hasPriceSet)
  const toCreate = planned.filter((p) => p.price != null && !p.variant.hasPriceSet)

  if (toUpdate.length) {
    await updateProductVariantsWorkflow(container).run({
      input: {
        product_variants: toUpdate.map((p) => ({
          id: p.variant.id,
          prices: nextBasePrices(p.variant, currency, p.price!),
        })) as any,
      },
    })
  }

  if (toCreate.length) {
    await upsertVariantPricesWorkflow(container).run({
      input: {
        variantPrices: toCreate.map((p) => ({
          variant_id: p.variant.id,
          product_id: productId,
          prices: [{ amount: p.price!, currency_code: currency }],
        })),
        previousVariantIds: [],
      },
    })
  }

  /* ---------------- Prețurile promoționale ---------------- */

  const saleChanges = planned.filter((p) => p.salePrice !== undefined)

  if (saleChanges.length) {
    const create: any[] = []
    const update: any[] = []
    const remove: string[] = []

    for (const p of saleChanges) {
      const existing = p.variant.sale

      if (p.salePrice === null) {
        if (existing) remove.push(existing.id)
        continue
      }
      if (existing) {
        update.push({
          id: existing.id,
          variant_id: p.variant.id,
          amount: p.salePrice,
        })
      } else {
        create.push({
          variant_id: p.variant.id,
          amount: p.salePrice,
          currency_code: currency,
        })
      }
    }

    // Nu atingem price list-ul (și nu îl creăm) dacă tot ce ni s-a cerut era
    // scoaterea unei promoții care oricum nu exista.
    if (create.length || update.length || remove.length) {
      const priceListId = await resolveSalePriceListId(container)

      await batchPriceListPricesWorkflow(container).run({
        input: { data: { id: priceListId, create, update, delete: remove } },
      })

      // Workflow-urile de price list nu emit niciun eveniment, deci storefront-ul
      // ar rămâne pe cache-ul vechi cu prețul dinainte de promoție. Îl anunțăm
      // noi, cu evenimentul pe care `revalidate-storefront.ts` îl ascultă oricum
      // pentru prețul de bază.
      await emitVariantsUpdated(
        container,
        saleChanges.map((p) => p.variant.id)
      )
    }
  }

  return {
    currency_code: currency,
    variants: toPublic(await loadVariantRows(container, productId, currency), currency),
  }
}
