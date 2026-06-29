import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Seeds three armadi imported from otto.de:
 *   1) Wimex "Saigon"   — ante scorrevoli con elementi in vetro (270 cm)
 *   2) freiraum "Taiga" — ante battenti (270 cm)
 *   3) Wimex "Ernie"    — ante scorrevoli con specchio (270 cm, BASIC)
 *
 * Run: yarn medusa exec ./src/scripts/seed-otto-armadi.ts
 *
 * Pre-requisite: `armadi` category must exist —
 *   yarn medusa exec ./src/scripts/seed-categories.ts
 *
 * Images and PDF references are intentionally omitted; thumbnails will be
 * uploaded manually from the admin afterwards. Idempotent: products whose
 * handle already exists are skipped.
 */

type ProductInput = Parameters<
  typeof createProductsWorkflow
>[0] extends never
  ? any
  : any

export default async function seedOttoArmadi({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL)
  const fulfillmentService = container.resolve(Modules.FULFILLMENT)
  const productService = container.resolve(Modules.PRODUCT)

  // --- Sales channel: prefer "Default Sales Channel", fall back to the first.
  const channels = await salesChannelService.listSalesChannels()
  if (!channels.length) {
    throw new Error(
      "No sales channels found. Create one in admin before importing."
    )
  }
  const defaultChannel =
    channels.find((c) => c.name === "Default Sales Channel") ?? channels[0]

  // --- Shipping profile.
  const shippingProfiles = await fulfillmentService.listShippingProfiles()
  const shippingProfile = shippingProfiles[0]
  if (!shippingProfile) {
    throw new Error("No shipping profile found. Run yarn seed first.")
  }

  // --- Resolve target category.
  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle"],
    filters: { handle: ["armadi"] },
  })
  const armadiCategory = (categories as Array<{ id: string; handle: string }>)
    .find((c) => c.handle === "armadi")
  if (!armadiCategory) {
    throw new Error(
      "Category 'armadi' not found. Run: yarn medusa exec ./src/scripts/seed-categories.ts"
    )
  }

  // --- Build product inputs.
  const allProducts: ProductInput[] = [
    {
      title:
        "Wimex Armadio ad ante scorrevoli Saigon – 3 ante, 270 cm, con elementi in vetro",
      subtitle: "Rovere piallato / Vetro grafite / Maniglie alluminio",
      handle: "wimex-armadio-saigon-270-rovere-grafite",
      status: ProductStatus.PUBLISHED,
      description:
        "Un capolavoro di spazio dal design accattivante: l'armadio ad ante scorrevoli «Saigon» di Wimex con elementi in vetro è un valore aggiunto per l'arredamento della tua camera da letto. Un affascinante mix di decori e colori moderni ne caratterizza l'aspetto. Poiché l'armadio è disponibile in diverse varianti di decoro, puoi sceglierlo in base all'ambiente della stanza. Dietro le ante scorrevoli, l'armadio offre molto spazio per il guardaroba grazie all'asta appendiabiti e ai numerosi ripiani. Poiché i ripiani sono in parte regolabili in altezza, puoi adattare il sistema di contenimento alle tue esigenze. Estetici e pratici allo stesso tempo sono i cassetti, posizionati a un'altezza di accesso comoda. L'armadio ad ante scorrevoli «Saigon» di Wimex con elementi in vetro offre spazio per tutto il tuo guardaroba.\n\nPunti di forza:\n• MOLTO SPAZIO – Asta appendiabiti e ripiani flessibili per un ordine ottimale\n• MATERIALI DI ALTA QUALITÀ – Profili maniglia robusti e cerniere in metallo durevoli\n• CASSETTI SCORREVOLI – Guide in metallo per un'apertura e chiusura morbide\n• DESIGN ACCATTIVANTE – Decoro interno grigio lino per un aspetto elegante\n• QUALITÀ TEDESCA – Made in Germany per esigenze elevate e lunga durata",
      is_giftcard: false,
      discountable: true,
      material: "Derivato del legno / Vetro / Metallo",
      origin_country: "DE",
      length: 64,
      width: 270,
      height: 208,
      weight: undefined,
      thumbnail: undefined,
      images: [],
      options: [
        {
          title: "Colore",
          values: ["Rovere piallato / Vetro grafite / Maniglie alluminio"],
        },
      ],
      variants: [
        {
          title: "Rovere piallato / Vetro grafite / Maniglie alluminio",
          sku: "WIMEX-SAIGON-270-ROVERE-GRAFITE",
          manage_inventory: true,
          allow_backorder: false,
          options: {
            Colore: "Rovere piallato / Vetro grafite / Maniglie alluminio",
          },
          prices: [{ amount: 775, currency_code: "eur" }],
        },
      ],
      tags: [
        { value: "Armadio" },
        { value: "Ante scorrevoli" },
        { value: "Camera da letto" },
        { value: "Wimex" },
        { value: "Made in Germany" },
      ],
      metadata: {
        brand: "Wimex",
        serie: "Saigon",
        fonte: "otto.de",
        url_fonte:
          "https://www.otto.de/p/wimex-schwebetuerenschrank-saigon-3-tuerig-graphit-matt-dekor-6-schubladen-6-schubladen-b-270-x-h-208-x-t-64-cm-C1834963500/?variationId=1437915976",
        otto_articolo_nr: "1935111814",
        otto_prodotto_id: "C1834963500",
        otto_variation_id: "1437915976",
        ean: "4038062007701",
        prezzo_consigliato_uvp_eur: 1771.0,
        prezzo_vendita_eur: 775.0,
        valutazione: "3.5/5 (134 recensioni)",
        produttore_eu:
          "WIMEX Wohnbedarf Import Export Handelsges. mbH & Co. KG, Werner-von-Siemens-Str. 35, 49124 Georgsmarienhütte, DE",
        produttore_contatto: "info@wimex-online.com / +49 5401 85980",
        dotazione_e_funzioni: {
          numero_ripiani: "6 pz.",
          numero_ante_in_vetro: "1 pz.",
          numero_aste_appendiabiti: "2 pz.",
          numero_cassetti: "6 pz.",
          numero_ante: "3 pz.",
          tipo_ripiani: "parzialmente regolabili",
          tipo_maniglie: "profilo maniglia",
          tipo_ante: "ante scorrevoli (a scomparsa)",
        },
        dimensioni: {
          larghezza_cm: 270,
          profondita_cm: 64,
          altezza_cm: 208,
          lunghezza_aste_appendiabiti_cm: 87,
          portata_max_asta_kg: 10,
          larghezza_ripiani_cm: 87,
          profondita_ripiani_cm: 50,
          larghezza_ripiani_2_cm: 43,
          profondita_ripiani_2_cm: 50,
          portata_max_ripiani_kg: 10,
          larghezza_interna_cassetti_cm: 40,
          profondita_interna_cassetti_cm: 35,
          altezza_interna_cassetti_cm: 8,
          nota: "Tutte le misure sono approssimative.",
        },
        materiali: {
          materiale: "derivato del legno",
          materiale_struttura: "derivato del legno",
          materiale_guide_cassetti: "metallo",
          materiale_aste_appendiabiti: "metallo",
          materiale_maniglie: "metallo",
          materiale_ferramenta: "metallo",
          materiale_pannello_posteriore: "pannello in fibra dura (HDF)",
          materiale_reggipiani: "metallo",
        },
        colore: {
          colore: "rovere piallato / vetro grafite / maniglie alluminio",
          colore_maniglie: "alluminio",
          colore_decoro_interno: "grigio lino",
        },
        ottica_stile: {
          rivestimento_superficie: "rivestimento in pellicola",
        },
        consegna_e_montaggio: {
          stato_di_consegna: "smontato",
          tipo_montaggio: "montabile in posizione verticale",
          nota_montaggio:
            "Per il montaggio servono ca. 25 cm di spazio aggiuntivo a sinistra, a destra e in alto.",
          note_montaggio:
            "Istruzioni di montaggio incluse - si consiglia una seconda persona per il montaggio.",
          lingue_istruzioni:
            "Istruzioni di montaggio realizzate esclusivamente tramite disegni.",
        },
        accessori_compatibili:
          "Ripiani art. 488856, 862959; Illuminazione armadio art. 752073; Inserto cassetto art. 213366; Chiusura ammortizzata art. 752673",
        paese_di_produzione: "Made in Germany",
        tipo_spina_elettrica: "nessun collegamento elettrico presente",
      },
    },
    {
      title:
        "freiraum Armadio ad ante battenti Taiga – 10 ante, 4 cassetti, 270 cm, Grafite / Rovere Artisan",
      subtitle: "Grafite / Rovere Artisan (decoro) – 270x208x58 cm (LxAxP)",
      handle: "freiraum-armadio-taiga-270-grafite-rovere-artisan",
      status: ProductStatus.PUBLISHED,
      description:
        "L'armadio ad ante battenti «Taiga» è la scelta perfetta per chi dà valore al design moderno e a soluzioni di contenimento funzionali. Con una generosa larghezza di 270 cm, un'altezza di 208 cm e una profondità di 58 cm, l'armadio offre spazio sufficiente per riporre in modo ordinato abbigliamento e accessori. Le ante sono realizzate in un'elegante tonalità grafite e si armonizzano perfettamente con la struttura dello stesso colore. L'accento in rovere Artisan (riproduzione) dona un tocco moderno e naturale e si integra perfettamente in diversi stili d'arredo. L'armadio dispone di 10 ante battenti complessive, che garantiscono un accesso facile e uno spazio ottimale. Dietro le ante trovi 4 ripiani, ciascuno con una larghezza di 90 cm e una profondità di 50 cm. La portata massima per ripiano è di 8 kg. Due aste appendiabiti, lunghe 90 cm ciascuna, offrono spazio aggiuntivo per il guardaroba con una portata massima di 40 kg, perfette per i capi appesi. Con un totale di 4 cassetti e 2 specchi, l'armadio è non solo pratico ma anche estremamente versatile. I cassetti offrono spazio aggiuntivo per oggetti più piccoli, mentre gli specchi aggiungono una funzionalità pratica alla tua camera da letto. L'armadio viene consegnato smontato, il che ne facilita il trasporto. È confezionato in 6 pacchi e si monta facilmente grazie alle istruzioni allegate. La lavorazione di alta qualità e il marchio Made in Germany garantiscono lunga durata e qualità elevata.\n\nPunti di forza:\n• Misure 270 cm (L) × 208 cm (A) × 58 cm (P): ampio spazio per la camera da letto, ideale per abbigliamento e accessori.\n• Realizzato in pannello truciolare di alta qualità, con moderna colorazione grafite e riproduzione rovere Artisan.\n• 10 ante battenti, 4 ripiani e 2 aste appendiabiti; cassetti e specchi per maggiore comfort.\n• Ripiani larghi 90 cm con portata massima di 8 kg ciascuno.\n• Consegnato smontato in 6 pacchi. Made in Germany per qualità e lunga durata.",
      is_giftcard: false,
      discountable: true,
      material: "Pannello truciolare (riproduzione legno)",
      origin_country: "DE",
      length: 58,
      width: 270,
      height: 208,
      weight: 203000,
      thumbnail: undefined,
      images: [],
      options: [
        {
          title: "Colore",
          values: ["Grafite / Rovere Artisan"],
        },
      ],
      variants: [
        {
          title: "Grafite / Rovere Artisan",
          sku: "FREIRAUM-TAIGA-270-GRAFITE-ROVERE",
          manage_inventory: true,
          allow_backorder: false,
          options: {
            Colore: "Grafite / Rovere Artisan",
          },
          prices: [{ amount: 724.95, currency_code: "eur" }],
        },
      ],
      tags: [
        { value: "Armadio" },
        { value: "Ante battenti" },
        { value: "Camera da letto" },
        { value: "freiraum" },
        { value: "Made in Germany" },
      ],
      metadata: {
        brand: "freiraum",
        serie: "Taiga",
        fonte: "otto.de",
        venditore: "moebelando",
        url_fonte:
          "https://www.otto.de/p/freiraum-drehtuerenschrank-taiga-4-schuebe-10-tueren-graphit-artisan-eiche-dekor-270x208x58cm-bxhxt-S00DG0F7/",
        otto_articolo_nr: "S00DG0F7",
        prezzo_vendita_eur: 724.95,
        peso_kg: 203,
        nota_peso:
          "Il campo 'weight' di Medusa è espresso in grammi (203000 g = 203 kg).",
        produttore_eu:
          "Alliance Möbel Marketing GmbH & Co. KG, Marie-Curie-Str. 6, 53359 Rheinbach, Deutschland",
        produttore_contatto: "info@alliance.de",
        dotazione_e_funzioni: {
          numero_ripiani: "4 pz.",
          numero_aste_appendiabiti: "2 pz.",
          numero_cassetti: "4 pz.",
          numero_ante: "10 pz.",
          numero_specchi: "2 pz.",
          tipo_ante: "ante battenti",
        },
        dimensioni: {
          larghezza_cm: 270,
          profondita_cm: 58,
          altezza_cm: 208,
          peso_kg: 203,
          lunghezza_aste_appendiabiti_cm: 90,
          portata_max_asta_kg: 40,
          larghezza_ripiani_cm: 90,
          profondita_ripiani_cm: 50,
          portata_max_ripiani_kg: 8,
          nota: "Tutte le misure sono approssimative.",
        },
        materiali: {
          materiale: "pannello truciolare",
          tipo_legno: "riproduzione (NB)",
          materiale_struttura: "pannello truciolare",
        },
        colore: {
          colore: "Grafite",
          colore_struttura: "GRAFITE",
          colore_ante: "GRAFITE + ROVERE ARTISAN (decoro)",
          note_colore:
            "I colori sul monitor possono differire dalle tonalità originali.",
        },
        consegna_e_montaggio: {
          nota_fornitura: "Consegna senza contenuto e decorazione",
          stato_di_consegna: "smontato",
          numero_pacchi: 6,
          consegna: "Spedizione fino al bordo del marciapiede",
        },
        note_cura:
          "Rispettare le indicazioni di cura secondo il passaporto prodotto e materiale allegato.",
        paese_di_produzione: "Made in Germany",
      },
    },
    {
      title:
        "Wimex Armadio ad ante scorrevoli Ernie – con specchio, 270 cm, Bianco (BASIC)",
      subtitle: "Bianco / Struttura Bianco – 270x210x65 cm – versione BASIC",
      handle: "wimex-armadio-ernie-270-bianco-basic",
      status: ProductStatus.PUBLISHED,
      description:
        "Design elegante e linee pulite: l'armadio ad ante scorrevoli con elementi a specchio sul fronte! Sobrio e raffinato all'esterno, presenta superfici facili da pulire e profili maniglia in metallo. L'interno dell'armadio è realizzato in lino grigio. È proprio questa combinazione di purismo moderno e accogliente effetto legno a convincere. Ripiani e asta appendiabiti offrono molto spazio per guardaroba, accessori e biancheria. Disponibile in diverse dimensioni e colori, l'armadio ad ante scorrevoli si integra perfettamente nei moderni concetti abitativi esistenti.\n\nPunti di forza:\n• Disponibile in larghezza 225 cm o 270 cm: perfetto per ogni stanza e guardaroba, a scelta con diverse dotazioni interne.\n• BASIC: 2 ripiani e 2 aste appendiabiti per l'armadio a 2 ante (225 cm); 3 pezzi ciascuno per quello a 3 ante (270 cm).\n• CLASSIC: inserto aggiuntivo con 3 cassetti e chiusura ammortizzata (soft-close).\n• PREMIUM: 2 ripiani aggiuntivi.\n• Armadio ad ante scorrevoli Ernie: Made in Germany, unisce qualità e stile per la tua casa.",
      is_giftcard: false,
      discountable: true,
      material: "Derivato del legno / Vetro / Metallo",
      origin_country: "DE",
      length: 65,
      width: 270,
      height: 210,
      weight: undefined,
      thumbnail: undefined,
      images: [],
      options: [
        { title: "Colore", values: ["Bianco / Struttura Bianco"] },
        { title: "Dimensioni", values: ["270 x 210 x 65 cm"] },
        { title: "Versione", values: ["BASIC"] },
      ],
      variants: [
        {
          title: "Bianco / 270x210x65 cm / BASIC",
          sku: "WIMEX-ERNIE-270-BIANCO-BASIC",
          manage_inventory: true,
          allow_backorder: false,
          options: {
            Colore: "Bianco / Struttura Bianco",
            Dimensioni: "270 x 210 x 65 cm",
            Versione: "BASIC",
          },
          prices: [{ amount: 499.99, currency_code: "eur" }],
        },
      ],
      tags: [
        { value: "Armadio" },
        { value: "Ante scorrevoli" },
        { value: "Con specchio" },
        { value: "Camera da letto" },
        { value: "Wimex" },
        { value: "Made in Germany" },
      ],
      metadata: {
        brand: "Wimex",
        serie: "Ernie",
        fonte: "otto.de",
        url_fonte:
          "https://www.otto.de/p/wimex-schwebetuerenschrank-ernie-kleiderschrank-mit-spiegel-made-in-germany-waehle-aus-verschiedenen-groessen-deinen-perfekten-stauraum-schlafzimmerschrank-in-verschiedenen-breiten-539468608/?variationId=539468609",
        otto_articolo_nr: "36400784",
        otto_prodotto_id: "539468608",
        otto_variation_id: "539468609",
        prezzo_consigliato_uvp_eur: 1152.0,
        prezzo_vendita_eur: 499.99,
        valutazione: "4.1/5 (97 recensioni)",
        produttore_eu:
          "WIMEX Wohnbedarf Import Export Handelsges. mbH & Co. KG, Werner-von-Siemens-Str. 35, 49124 Georgsmarienhütte, DE",
        produttore_contatto: "info@wimex-online.com / +49 5401 85980",
        varianti_disponibili: {
          colori: ["artisaneiche", "graphit", "saharagrau", "weiß (selezionato)"],
          dimensioni: ["225 x 210 x 65 cm", "270 x 210 x 65 cm (selezionato)"],
          versioni: ["BASIC (selezionato)", "CLASSIC", "PREMIUM"],
          nota: "Questo record rappresenta solo la variante del link: weiß / 270x210x65 / BASIC.",
        },
        dotazione_e_funzioni: {
          numero_ripiani: "3 pz. (BASIC, 270 cm)",
          numero_aste_appendiabiti: "3 pz. (BASIC, 270 cm)",
          tipo_ripiani: "regolabili / variabili",
          tipo_maniglie: "profilo maniglia",
          tipo_ante: "ante scorrevoli (a scomparsa)",
          specchio: "elementi a specchio sul fronte",
        },
        dimensioni: {
          larghezza_cm: 270,
          profondita_cm: 65,
          altezza_cm: 210,
          lunghezza_asta_grande_cm: 87,
          portata_max_asta_kg: 30,
          larghezza_ripiani_cm: 87,
          profondita_ripiani_cm: 50,
          portata_max_ripiani_kg: 15,
          nota: "Tutte le misure sono approssimative.",
        },
        materiali: {
          materiale: "derivato del legno",
          materiale_struttura: "derivato del legno",
          materiale_superficie_struttura: "plastica",
          materiale_superficie_fronte: "vetro / plastica",
          materiale_ante: "pannello truciolare",
          materiale_cassetto: "pannello truciolare",
          materiale_guide_cassetti: "metallo",
          materiale_guide: "metallo",
          materiale_aste_appendiabiti: "metallo",
          materiale_maniglie: "metallo",
          materiale_ripiano_superiore: "pannello truciolare",
          materiale_ferramenta: "metallo",
          materiale_pannello_posteriore: "pannello in fibra dura (HDF)",
          materiale_reggipiani: "metallo",
          materiale_ripiani: "pannello truciolare",
        },
        colore: {
          colore: "bianco",
          colore_struttura: "Bianco",
          colore_ante: "Bianco",
          colore_cassetti: "grigio lino",
          colore_maniglie: "alluminio",
          colore_decoro_interno: "grigio lino",
          colore_ripiani: "grigio lino",
          colore_aste_appendiabiti: "alluminio",
        },
        ottica_stile: {
          rivestimento_superficie: "rivestimento in pellicola",
        },
        consegna_e_montaggio: {
          fornitura:
            "BASIC: 3 ripiani e 3 aste appendiabiti per l'armadio a 3 ante (270 cm). SENZA illuminazione.",
          stato_di_consegna: "smontato",
          tipo_montaggio: "montabile in posizione verticale",
          note_montaggio:
            "Istruzioni di montaggio incluse - si consiglia una seconda persona - con video.",
          lingue_istruzioni:
            "Istruzioni di montaggio realizzate esclusivamente tramite disegni.",
        },
        wissenswertes: {
          decoro_interno: "lino grigio",
          superficie: "superficie in plastica facile da pulire",
          elementi_frontali: "montabili su entrambi i lati",
          distanza_montaggio_consigliata: "25 cm su tutti i lati",
        },
        accessori_compatibili:
          "Ripiani art. 488856; Inserto cassetto art. 740776; Divisori interni art. 522500; Chiusura ammortizzata art. 752673; Illuminazione armadio art. 752073, 692631",
        paese_di_produzione: "Made in Germany",
        tipo_spina_elettrica: "nessun collegamento elettrico presente",
      },
    },
  ]

  // --- Skip products whose handle already exists.
  const allHandles = allProducts.map((p) => p.handle)
  const { data: existing } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
    filters: { handle: allHandles },
  })
  const existingHandles = new Set(
    (existing as Array<{ handle: string }>).map((p) => p.handle)
  )
  if (existingHandles.size) {
    logger.info(
      `Skipping ${existingHandles.size} already-existing product(s): ${[
        ...existingHandles,
      ].join(", ")}`
    )
  }

  const newProducts = allProducts.filter(
    (p) => !existingHandles.has(p.handle)
  )

  if (!newProducts.length) {
    logger.info("All armadi products already exist — nothing to create.")
    return
  }

  // --- Resolve tags by value: reuse existing, create missing.
  const allTagValues = new Set<string>()
  for (const p of newProducts) {
    for (const t of (p.tags as Array<{ value: string }>) || []) {
      if (t?.value) allTagValues.add(t.value)
    }
  }
  const tagValueToId = new Map<string, string>()
  if (allTagValues.size) {
    const { data: existingTags } = await query.graph({
      entity: "product_tag",
      fields: ["id", "value"],
      filters: { value: [...allTagValues] },
    })
    for (const t of existingTags as Array<{ id: string; value: string }>) {
      tagValueToId.set(t.value, t.id)
    }
    const missing = [...allTagValues].filter((v) => !tagValueToId.has(v))
    if (missing.length) {
      logger.info(`Creating ${missing.length} new tag(s): ${missing.join(", ")}`)
      const created = await productService.createProductTags(
        missing.map((value) => ({ value }))
      )
      for (const t of created as Array<{ id: string; value: string }>) {
        tagValueToId.set(t.value, t.id)
      }
    }
  }

  const productsToCreate = newProducts.map((p) => ({
    ...p,
    tags: ((p.tags as Array<{ value: string }>) || [])
      .map((t) => tagValueToId.get(t.value))
      .filter((id): id is string => !!id)
      .map((id) => ({ id })),
    category_ids: [armadiCategory.id],
    sales_channels: [{ id: defaultChannel.id }],
    shipping_profile_id: shippingProfile.id,
  }))

  logger.info(`Creating ${productsToCreate.length} armadi product(s)…`)
  const { result } = await createProductsWorkflow(container).run({
    input: { products: productsToCreate as any },
  })

  logger.info(`Created ${result.length} product(s):`)
  for (const p of result) {
    logger.info(`  • ${p.title} (id: ${p.id})`)
  }
}
