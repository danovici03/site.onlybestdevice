import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Restaurarea produselor șterse din Admin, cu aceleași ID-uri.
 *
 * Ștergerea din Medusa e soft delete: rândurile primesc `deleted_at` și dispar
 * din toate interogările, dar rămân în bază. `deleteProductsWorkflow` atinge trei
 * locuri, și fiecare se restaurează separat — Medusa nu are un workflow de
 * restaurare și nici buton în Admin:
 *
 *   1. produsul, cu variantele, opțiunile și pozele;
 *   2. legăturile dintre module: sales channel, profil de livrare, price set
 *      (cu prețurile lui, inclusiv cele din price list), inventory item;
 *   3. inventory item-ul variantei, cu nivelurile de stoc.
 *
 * De ce restaurare și nu recreare: ERP-ul (gestiunea Laravel) ține
 * `medusa_variant_id` / `medusa_product_id`. După ștergere, push-urile lui de stoc
 * pică pe „varianta inexistenta in Medusa”, iar produsul nu se mai retrimite,
 * fiindcă în gestiune figurează ca legat. Cu aceleași ID-uri legătura merge din
 * nou fără nicio atingere în ERP, și rămân pozele, categoriile și textele.
 *
 * ---- De ce e nevoie de o fotografie luată ÎNAINTE de ștergere ---------------
 *
 * „Soft delete” nu marchează doar ce șterge ștergerea produsului. O promoție
 * scoasă, un preț înlocuit, o variantă ștearsă, un canal de vânzare din care
 * produsul a fost scos — toate rămân în bază ca rânduri cu `deleted_at`. Iar
 * cascada de ștergere a produsului le RESCRIE ora (și `updated_at`) cu ora ei,
 * deci după ștergere nu se mai poate spune ce era activ și ce era istoric.
 * Restaurarea „tot ce e șters” ar readuce promoții încheiate, prețuri duble și
 * canale renunțate — verificat pe date reale.
 *
 * De aceea, pe căile de ștergere din Admin (vezi `api/middlewares.ts` și
 * `/admin/product-bulk`), `snapshotBeforeDelete` notează în
 * `product.metadata.restore_snapshot` ID-urile a tot ce era activ. Restaurarea
 * readuce exact lista aceea.
 *
 * Produsele șterse fără fotografie (înainte de 24.09.2026, sau pe altă cale)
 * se restaurează după o euristică — variantele și legăturile după ora legăturilor,
 * singura care nu e rescrisă; prețurile duble se reduc la cel mai nou — și
 * rezultatul poartă un avertisment: promoțiile și opțiunile trebuie verificate.
 *
 * Nu restaurează dacă între timp SKU-ul sau handle-ul au fost luate de alt produs
 * activ — unicitatea lor ignoră doar rândurile șterse, deci restaurarea ar pica
 * pe index. În cazul ăsta produsul nou e cel bun; cel vechi rămâne în bază.
 *
 * Categoriile nu au nevoie de nimic: tabela pivot nu are `deleted_at`. Pozele
 * scoase din produs se șterg definitiv, deci nici ele nu pot reveni din greșeală.
 */

/**
 * Cât de departe de ora ștergerii produsului poate fi desfăcută o legătură ca
 * s-o socotim desfăcută de ștergere. În workflow diferența e de milisecunde;
 * marja e strânsă ca o variantă sau un canal scoase cu puțin înainte să nu fie
 * luate drept parte din ștergere.
 */
const SAME_DELETE_MS = 15_000

/**
 * O fotografie mai veche de atât față de ștergere nu mai descrie produsul șters:
 * produsul a fost restaurat și șters din nou pe o cale fără fotografie.
 */
const SNAPSHOT_MAX_AGE_MS = 10 * 60_000

const SNAPSHOT_KEY = "restore_snapshot"

type Snapshot = {
  taken_at: string
  variant_ids: string[]
  option_ids: string[]
  option_value_ids: string[]
  price_ids: string[]
  sales_channel_ids: string[]
  shipping_profile_ids: string[]
  /** [variant_id, price_set_id] */
  price_sets: [string, string][]
  /** [variant_id, inventory_item_id] */
  inventory_items: [string, string][]
}

export type DeletedProduct = {
  id: string
  title: string
  handle: string | null
  status: string
  thumbnail: string | null
  deleted_at: string
  skus: string[]
  /** False = șters fără fotografie; restaurarea e aproximativă. */
  exact: boolean
  /** De ce nu se poate restaura; gol = se poate. */
  conflicts: string[]
}

export type RestoreResult = {
  id: string
  title: string
  restored: boolean
  exact: boolean
  conflicts: string[]
  warnings: string[]
  variants: number
  images: number
  categories: number
  sales_channels: number
  shipping_profile: boolean
  prices: number[][]
  stock: number[][]
}

const time = (value: unknown) => new Date(value as string).getTime()

const nearDelete = (value: unknown, deletedAt: unknown) =>
  !!value && Math.abs(time(value) - time(deletedAt)) <= SAME_DELETE_MS

/* ------------------------------------------------------------------------ */
/* Fotografia dinaintea ștergerii                                            */
/* ------------------------------------------------------------------------ */

/**
 * Notează în fiecare produs ce e activ acum, chiar înainte de ștergere. Nu
 * aruncă: o fotografie ratată face restaurarea aproximativă, dar nu are voie să
 * blocheze o ștergere cerută din Admin.
 */
export const snapshotBeforeDelete = async (container: any, productIds: string[]) => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const ids = [...new Set(productIds.filter(Boolean))]
  if (!ids.length) return

  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const productModule = container.resolve(Modules.PRODUCT)
    const pricingModule = container.resolve(Modules.PRICING)

    const { data: products } = await query.graph({
      entity: "product",
      fields: [
        "id",
        "metadata",
        "variants.id",
        "variants.price_set.id",
        "variants.inventory_items.inventory_item_id",
        "options.id",
        "options.values.id",
        "sales_channels.id",
        "shipping_profile.id",
      ],
      filters: { id: ids },
    })

    const takenAt = new Date().toISOString()

    for (const p of products as any[]) {
      const variants = p.variants ?? []
      const priceSets: [string, string][] = variants
        .filter((v: any) => v.price_set?.id)
        .map((v: any) => [v.id, v.price_set.id])

      const prices = priceSets.length
        ? await pricingModule.listPrices(
            { price_set_id: priceSets.map(([, ps]) => ps) },
            { select: ["id"] },
          )
        : []

      const snapshot: Snapshot = {
        taken_at: takenAt,
        variant_ids: variants.map((v: any) => v.id),
        option_ids: (p.options ?? []).map((o: any) => o.id),
        option_value_ids: (p.options ?? []).flatMap((o: any) =>
          (o.values ?? []).map((v: any) => v.id),
        ),
        price_ids: prices.map((pr: any) => pr.id),
        sales_channel_ids: (p.sales_channels ?? []).map((s: any) => s.id),
        shipping_profile_ids: p.shipping_profile?.id ? [p.shipping_profile.id] : [],
        price_sets: priceSets,
        inventory_items: variants.flatMap((v: any) =>
          (v.inventory_items ?? [])
            .filter((i: any) => i.inventory_item_id)
            .map((i: any) => [v.id, i.inventory_item_id]),
        ),
      }

      await productModule.updateProducts(p.id, {
        metadata: { ...(p.metadata ?? {}), [SNAPSHOT_KEY]: snapshot },
      })
    }
  } catch (e) {
    logger.warn(
      `[restore] fotografia dinaintea ștergerii a eșuat pentru ${ids.join(", ")}: ` +
        `${(e as Error).message}. Ștergerea continuă; restaurarea va fi aproximativă.`,
    )
  }
}

const readSnapshot = (product: any): Snapshot | null => {
  const s = product?.metadata?.[SNAPSHOT_KEY] as Snapshot | undefined
  if (!s?.taken_at || !Array.isArray(s.variant_ids)) return null
  const age = time(product.deleted_at) - time(s.taken_at)
  return age >= 0 && age <= SNAPSHOT_MAX_AGE_MS ? s : null
}

/* ------------------------------------------------------------------------ */
/* Starea din bază a unui produs șters                                       */
/* ------------------------------------------------------------------------ */

const LINKS = {
  sales_channel: {
    entity: "product_sales_channel",
    modules: [Modules.PRODUCT, "product_id", Modules.SALES_CHANNEL, "sales_channel_id"],
  },
  shipping_profile: {
    entity: "product_shipping_profile",
    modules: [Modules.PRODUCT, "product_id", Modules.FULFILLMENT, "shipping_profile_id"],
  },
  price_set: {
    entity: "product_variant_price_set",
    modules: [Modules.PRODUCT, "variant_id", Modules.PRICING, "price_set_id"],
  },
  inventory: {
    entity: "product_variant_inventory_item",
    modules: [Modules.PRODUCT, "variant_id", Modules.INVENTORY, "inventory_item_id"],
  },
} as const

type LinkKind = keyof typeof LINKS

/** Rândurile unei legături, cu tot cu cele desfăcute. */
const linkRows = async (
  container: any,
  kind: LinkKind,
  filters: Record<string, string[]>,
): Promise<any[]> => {
  const [key, ids] = Object.entries(filters)[0]
  if (!ids.length) return []
  const [, a, , b] = LINKS[kind].modules
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: LINKS[kind].entity,
    fields: [a, b, "deleted_at"],
    filters: { [key]: ids },
    withDeleted: true,
  } as any)
  return data as any[]
}

/**
 * Ce se restaurează, pentru un lot de produse șterse. Cu fotografie: exact ce
 * era activ. Fără: variantele și legăturile desfăcute la ora ștergerii.
 *
 * Fără fotografie, `deleted_at`-ul variantei nu ajută — cascada l-a rescris și
 * pe al variantelor deja șterse. Ora reală rămâne pe legăturile variantei (preț,
 * stoc): o variantă ștearsă separat și-a pierdut legăturile la ștergerea ei,
 * deci cea mai recentă legătură desfăcută e mai veche decât produsul.
 */
const planFor = async (container: any, products: any[]) => {
  const productModule = container.resolve(Modules.PRODUCT)

  const variants = await productModule.listProductVariants(
    { product_id: products.map((p) => p.id) },
    { withDeleted: true, select: ["id", "sku", "product_id", "deleted_at"] },
  )
  const variantIds = variants.map((v: any) => v.id)

  const [priceSetRows, inventoryRows] = await Promise.all([
    linkRows(container, "price_set", { variant_id: variantIds }),
    linkRows(container, "inventory", { variant_id: variantIds }),
  ])

  const lastUnlinked = new Map<string, number>()
  for (const row of [...priceSetRows, ...inventoryRows]) {
    if (!row.deleted_at) continue
    const t = time(row.deleted_at)
    if (t > (lastUnlinked.get(row.variant_id) ?? -Infinity)) lastUnlinked.set(row.variant_id, t)
  }

  return new Map(
    products.map((p) => {
      const snapshot = readSnapshot(p)
      const own = variants.filter((v: any) => v.product_id === p.id && v.deleted_at)

      const keep = snapshot
        ? own.filter((v: any) => snapshot.variant_ids.includes(v.id))
        : own.filter((v: any) => {
            const t = lastUnlinked.get(v.id)
            return t === undefined || t >= time(p.deleted_at) - SAME_DELETE_MS
          })

      return [p.id, { snapshot, keep, drop: own.filter((v: any) => !keep.includes(v)) }]
    }),
  )
}

/**
 * Ce produs activ ține deja handle-ul sau SKU-urile fiecărui produs șters. În
 * lot, pentru toată lista. Mesajul numește produsul care le ține, pe titlu — din
 * el se decide care dintre cele două rămâne.
 */
const findConflicts = async (
  container: any,
  items: Array<{ id: string; handle: string | null; skus: string[] }>,
): Promise<Map<string, string[]>> => {
  const productModule = container.resolve(Modules.PRODUCT)

  const handles = items.map((i) => i.handle).filter(Boolean) as string[]
  const skus = items.flatMap((i) => i.skus)

  const [byHandle, bySku] = await Promise.all([
    handles.length
      ? productModule.listProducts({ handle: handles }, { select: ["id", "title", "handle"] })
      : [],
    skus.length
      ? productModule.listProductVariants({ sku: skus }, { select: ["sku", "product_id"] })
      : [],
  ])

  const titles = new Map<string, string>(byHandle.map((p: any) => [p.id, p.title]))
  const missing = [...new Set<string>(bySku.map((v: any) => v.product_id))].filter(
    (id) => !titles.has(id),
  )
  if (missing.length) {
    const owners = await productModule.listProducts({ id: missing }, { select: ["id", "title"] })
    for (const p of owners) titles.set(p.id, p.title)
  }

  const handleOwner = new Map<string, string>(byHandle.map((p: any) => [p.handle, p.id]))
  const skuOwner = new Map<string, string>(bySku.map((v: any) => [v.sku, v.product_id]))

  const result = new Map<string, string[]>()
  for (const item of items) {
    // Pe proprietar: de obicei același produs ține și handle-ul, și SKU-ul.
    const reasons = new Map<string, string[]>()
    const add = (owner: string | undefined, what: string) => {
      if (owner) reasons.set(owner, [...(reasons.get(owner) ?? []), what])
    }
    if (item.handle) add(handleOwner.get(item.handle), `adresa „${item.handle}”`)
    for (const sku of item.skus) add(skuOwner.get(sku), `SKU-ul ${sku}`)

    result.set(
      item.id,
      [...reasons].map(
        ([owner, what]) =>
          `${what.join(" și ")} ${what.length > 1 ? "sunt" : "e"} acum la „${titles.get(owner) ?? owner}”`,
      ),
    )
  }

  return result
}

const PRODUCT_SELECT = ["id", "title", "handle", "status", "thumbnail", "metadata", "deleted_at"]

/** Produsele șterse, cele mai recente primele. */
export const listDeletedProducts = async (
  container: any,
  { limit = 200 }: { limit?: number } = {},
): Promise<DeletedProduct[]> => {
  const productModule = container.resolve(Modules.PRODUCT)

  const products = await productModule.listProducts(
    { deleted_at: { $ne: null } },
    { withDeleted: true, take: limit, order: { deleted_at: "DESC" }, select: PRODUCT_SELECT },
  )
  if (!products.length) return []

  const plans = await planFor(container, products)
  const skusOf = (id: string) =>
    (plans.get(id)?.keep ?? []).map((v: any) => v.sku).filter(Boolean) as string[]

  const conflicts = await findConflicts(
    container,
    products.map((p: any) => ({ id: p.id, handle: p.handle ?? null, skus: skusOf(p.id) })),
  )

  return products.map((p: any) => ({
    id: p.id,
    title: p.title,
    handle: p.handle ?? null,
    status: p.status,
    thumbnail: p.thumbnail ?? null,
    deleted_at: new Date(p.deleted_at).toISOString(),
    skus: skusOf(p.id),
    exact: !!plans.get(p.id)?.snapshot,
    conflicts: conflicts.get(p.id) ?? [],
  }))
}

/* ------------------------------------------------------------------------ */
/* Restaurarea                                                               */
/* ------------------------------------------------------------------------ */

/**
 * Prețurile duble rămase după o restaurare fără fotografie: pentru același
 * price set, aceeași listă (sau prețul de bază), aceeași monedă și același prag
 * de cantitate, păstrăm rândul cel mai nou. Un preț înlocuit (promoția 90 → 110)
 * lasă rândul vechi șters în bază; cascada îl readuce lângă cel nou.
 */
const dropDuplicatePrices = async (pricingModule: any, priceSetIds: string[]) => {
  if (!priceSetIds.length) return 0
  const prices = await pricingModule.listPrices(
    { price_set_id: priceSetIds },
    {
      select: [
        "id",
        "price_set_id",
        "price_list_id",
        "currency_code",
        "min_quantity",
        "max_quantity",
        "rules_count",
        "created_at",
      ],
    },
  )
  const newest = new Map<string, any>()
  const drop: string[] = []
  for (const p of [...prices].sort((a: any, b: any) => time(b.created_at) - time(a.created_at))) {
    const key = [
      p.price_set_id,
      p.price_list_id ?? "base",
      p.currency_code,
      p.min_quantity ?? "",
      p.max_quantity ?? "",
      p.rules_count ?? 0,
    ].join("|")
    if (newest.has(key)) drop.push(p.id)
    else newest.set(key, p)
  }
  if (drop.length) await pricingModule.softDeletePrices(drop)
  return drop.length
}

/**
 * Restaurează un produs șters. Cu `dryRun` doar verifică (conflicte, variante)
 * fără să scrie.
 */
export const restoreDeletedProduct = async (
  container: any,
  productId: string,
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<RestoreResult> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const productModule = container.resolve(Modules.PRODUCT)
  const pricingModule = container.resolve(Modules.PRICING)
  const inventoryModule = container.resolve(Modules.INVENTORY)
  const eventBus = container.resolve(Modules.EVENT_BUS)

  const [product] = await productModule.listProducts(
    { id: productId },
    { withDeleted: true, select: PRODUCT_SELECT },
  )

  if (!product) throw new Error(`Produsul ${productId} nu există.`)
  if (!product.deleted_at) throw new Error(`Produsul „${product.title}” nu e șters.`)

  const { snapshot, keep, drop } = (await planFor(container, [product])).get(product.id)!
  const keepIds = keep.map((v: any) => v.id)
  const skus = keep.map((v: any) => v.sku).filter(Boolean) as string[]

  const result: RestoreResult = {
    id: product.id,
    title: product.title,
    restored: false,
    exact: !!snapshot,
    conflicts:
      (
        await findConflicts(container, [{ id: product.id, handle: product.handle ?? null, skus }])
      ).get(product.id) ?? [],
    warnings: [],
    variants: keep.length,
    images: 0,
    categories: 0,
    sales_channels: 0,
    shipping_profile: false,
    prices: [],
    stock: [],
  }

  if (result.conflicts.length || dryRun) return result

  // ---- Ce legături se readuc ------------------------------------------------
  // Cu fotografie: perechile notate. Fără: cele desfăcute la ora ștergerii — o
  // legătură desfăcută mai devreme (produs scos dintr-un canal, profil de
  // livrare schimbat, variantă mutată pe alt inventory item) rămâne desfăcută.
  const [scRows, spRows, psRows, invRows] = await Promise.all([
    linkRows(container, "sales_channel", { product_id: [product.id] }),
    linkRows(container, "shipping_profile", { product_id: [product.id] }),
    linkRows(container, "price_set", { variant_id: keepIds }),
    linkRows(container, "inventory", { variant_id: keepIds }),
  ])

  // O legătură încă activă pe un produs șters vine dintr-o încercare anterioară
  // care a picat după pasul legăturilor. Intră în plan ca price set-ul sau
  // inventory item-ul din capătul ei să fie restaurate și de data asta.
  const pick = (rows: any[], inSnapshot: (row: any) => boolean) =>
    rows.filter((r) =>
      snapshot
        ? inSnapshot(r)
        : !r.deleted_at || nearDelete(r.deleted_at, product.deleted_at),
    )

  const has = (pairs: [string, string][], a: string, b: string) =>
    pairs.some(([x, y]) => x === a && y === b)

  const restoreLinks: Record<LinkKind, any[]> = {
    sales_channel: pick(scRows, (r) => snapshot!.sales_channel_ids.includes(r.sales_channel_id)),
    shipping_profile: pick(spRows, (r) =>
      snapshot!.shipping_profile_ids.includes(r.shipping_profile_id),
    ),
    price_set: pick(psRows, (r) => has(snapshot!.price_sets, r.variant_id, r.price_set_id)),
    inventory: pick(invRows, (r) => has(snapshot!.inventory_items, r.variant_id, r.inventory_item_id)),
  }

  const priceSetIds = [...new Set(restoreLinks.price_set.map((r) => r.price_set_id as string))]
  const inventoryItemIds = [
    ...new Set(restoreLinks.inventory.map((r) => r.inventory_item_id as string)),
  ]

  // Opțiunile se pot deosebi doar cu fotografie; fără ea le lăsăm pe toate.
  const options = snapshot
    ? await productModule.listProductOptions(
        { product_id: product.id },
        { withDeleted: true, select: ["id", "deleted_at"], relations: ["values"] },
      )
    : []

  // ---- Scrierea -------------------------------------------------------------
  // 1. Produsul; cascada modelului aduce variantele, opțiunile și pozele — pe
  //    toate, și pe cele șterse mai demult, deci le punem înapoi pe acelea.
  await productModule.restoreProducts([product.id])

  try {
    if (drop.length) {
      await productModule.softDeleteProductVariants(drop.map((v: any) => v.id))
    }

    if (snapshot) {
      const staleOptions = options.filter((o: any) => !snapshot.option_ids.includes(o.id))
      const staleValues = options
        .flatMap((o: any) => o.values ?? [])
        .filter((v: any) => !snapshot.option_value_ids.includes(v.id))
      if (staleValues.length) {
        await productModule.softDeleteProductOptionValues(staleValues.map((v: any) => v.id))
      }
      if (staleOptions.length) {
        await productModule.softDeleteProductOptions(staleOptions.map((o: any) => o.id))
      }
    }

    // 2. Legăturile, pereche cu pereche, prin serviciul fiecărei legături.
    //    `link.restore` din framework nu merge aici: restaurează după cheie
    //    (tot ce ține de produs) și întoarce erorile în loc să le arunce.
    for (const kind of Object.keys(LINKS) as LinkKind[]) {
      const rows = restoreLinks[kind].filter((r) => r.deleted_at)
      if (!rows.length) continue
      const [modA, keyA, modB, keyB] = LINKS[kind].modules
      const service = (link as any).getLinkModule(modA, keyA, modB, keyB)
      if (!service) throw new Error(`Legătura ${LINKS[kind].entity} nu e înregistrată.`)
      await service.restore(rows.map((r) => ({ [keyA]: r[keyA], [keyB]: r[keyB] })))
    }

    // 3. Price set-urile cu prețurile lor. Cascada le readuce pe toate, inclusiv
    //    promoțiile scoase și prețurile înlocuite; le scoatem la loc.
    if (priceSetIds.length) {
      await pricingModule.restorePriceSets(priceSetIds)

      if (snapshot) {
        const all = await pricingModule.listPrices(
          { price_set_id: priceSetIds },
          { select: ["id"] },
        )
        const stale = all.map((p: any) => p.id).filter((id: string) => !snapshot.price_ids.includes(id))
        if (stale.length) await pricingModule.softDeletePrices(stale)
      } else {
        await dropDuplicatePrices(pricingModule, priceSetIds)
      }
    }

    // 4. Inventory item-urile, cu nivelurile de stoc (cascada modelului).
    if (inventoryItemIds.length) {
      await inventoryModule.restoreInventoryItems(inventoryItemIds)
    }
  } catch (e) {
    // Fără tranzacție între module: dacă un pas pică, produsul ar apărea înapoi
    // fără preț ori fără stoc — și, nemaifiind șters, n-ar mai putea fi reluat
    // din pagina „Produse șterse”. Îl ștergem la loc, cu fotografia reîmprospătată
    // ca să rămână valabilă pentru o nouă încercare. Ce s-a restaurat deja din
    // legături și prețuri se reia fără efect la următoarea încercare.
    try {
      if (snapshot) {
        await productModule.updateProducts(product.id, {
          metadata: {
            ...(product.metadata ?? {}),
            [SNAPSHOT_KEY]: { ...snapshot, taken_at: new Date().toISOString() },
          },
        })
      }
      await productModule.softDeleteProducts([product.id])
    } catch {}
    throw e
  }

  // Fotografia și-a făcut treaba; nu rămâne în metadatele produsului. Modulul
  // îmbină metadata, deci omiterea cheii n-o scoate, iar `null` o lasă cu valoarea
  // null (vizibilă în editorul de metadata din Admin). Șirul gol o scoate.
  if (product.metadata && SNAPSHOT_KEY in product.metadata) {
    await productModule.updateProducts(product.id, { metadata: { [SNAPSHOT_KEY]: "" } })
  }

  if (!snapshot) {
    result.warnings.push(
      "Produsul a fost șters fără fotografia stării de dinainte: verifică prețul " +
        "promoțional și opțiunile. O promoție scoasă înainte de ștergere poate reapărea.",
    )
  }

  // `product.updated` pornește abonații obișnuiți: revalidarea storefront-ului,
  // relegarea telefoanelor din același model, filtrele. Restaurarea nu emite
  // nimic singură, iar fără asta un produs publicat ar rămâne invizibil pe site
  // până la următoarea salvare.
  await eventBus.emit({ name: "product.updated", data: { id: product.id } })

  // ---- Ce a revenit, pentru raport -----------------------------------------
  const {
    data: [check],
  } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "images.id",
      "categories.id",
      "sales_channels.id",
      "shipping_profile.id",
      "variants.prices.amount",
      "variants.inventory_items.inventory.location_levels.stocked_quantity",
    ],
    filters: { id: product.id },
  })

  const c = check as any
  result.restored = true
  result.variants = c?.variants?.length ?? 0
  result.images = c?.images?.length ?? 0
  result.categories = c?.categories?.length ?? 0
  result.sales_channels = c?.sales_channels?.length ?? 0
  result.shipping_profile = !!c?.shipping_profile?.id
  result.prices = (c?.variants ?? []).map((v: any) =>
    (v.prices ?? []).map((p: any) => Number(p.amount)),
  )
  result.stock = (c?.variants ?? []).map((v: any) =>
    (v.inventory_items ?? []).flatMap((i: any) =>
      (i.inventory?.location_levels ?? []).map((l: any) => Number(l.stocked_quantity)),
    ),
  )

  return result
}
