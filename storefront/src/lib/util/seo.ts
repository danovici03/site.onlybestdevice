/**
 * Titluri și descrieri SEO pentru produse și categorii.
 *
 * Ordinea de prioritate, peste tot:
 * 1. `metadata.seo_title` / `metadata.seo_description` — completate din admin
 *    (secțiunea Metadata a produsului sau a categoriei), fără deploy;
 * 2. textele scrise aici pentru categoriile existente (`CATEGORY_SEO`);
 * 3. un fallback generat, care rămâne unic pe pagină.
 *
 * Titlurile NU includ „| Onlybestdevice": îl adaugă șablonul din layout-ul
 * rădăcină. Țintă: titlul + sufixul (17 caractere) sub ~65 de caractere, cât
 * încape în rezultatul Google; descrierea 120–160.
 */

type Metadata = Record<string, unknown> | null | undefined

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")

export const seoOverride = (metadata: Metadata) => ({
  title: str(metadata?.seo_title),
  description: str(metadata?.seo_description),
})

const PROMISE =
  "Garanție 24 de luni, plată cu cardul sau în rate, livrare rapidă în toată România."

/**
 * Cheia e calea canonică a categoriei (`tv-audio-video-si-foto/casti`), nu
 * handle-ul: handle-urile din import sunt dezambiguizate artificial
 * (`iphone-15-pro-folii-de-protectie`), iar pe două categorii cu același nume
 * titlul generat ar ieși identic — Google le-ar trata drept duplicate.
 */
const CATEGORY_SEO: Record<string, { title: string; description: string }> = {
  "telefoane-mobile": {
    title: "Telefoane mobile iPhone și Samsung, în rate",
    description: `Telefoane mobile noi Apple iPhone și Samsung Galaxy, în toate capacitățile și culorile. ${PROMISE}`,
  },
  "telefoane-mobile/iphone-16": {
    title: "Apple iPhone 16 și iPhone 16e, în rate",
    description: `iPhone 16 și iPhone 16e noi, 128 GB și 256 GB, în toate culorile. ${PROMISE}`,
  },
  tablete: {
    title: "Tablete iPad și Samsung Galaxy Tab, în rate",
    description: `Tablete noi Apple iPad și Samsung Galaxy Tab, e-readere Kobo și accesorii precum Apple Pencil. ${PROMISE}`,
  },
  laptop: {
    title: "Laptopuri Apple MacBook Air și MacBook Pro",
    description: `Laptopuri Apple MacBook Air și MacBook Pro noi, cu procesoare Apple. ${PROMISE}`,
  },
  "smartwatch-wearables": {
    title: "Smartwatch Apple Watch și wearables, în rate",
    description: `Apple Watch Series, Apple Watch SE și alte smartwatch-uri, GPS sau GPS + Cellular, în toate mărimile. ${PROMISE}`,
  },
  "tv-audio-video-si-foto": {
    title: "Căști wireless, audio, TV și foto",
    description: `Căști Apple AirPods, Anker Soundcore, LG și alte produse audio, video și foto, noi. ${PROMISE}`,
  },
  "tv-audio-video-si-foto/casti": {
    title: "Căști wireless Apple AirPods și true wireless",
    description: `Căști Apple AirPods 4, AirPods Pro, AirPods Max și alte căști true wireless cu anulare activă a zgomotului. ${PROMISE}`,
  },
  "tv-audio-video-si-foto/boxe": {
    title: "Boxe portabile și boxe Bluetooth",
    description: `Boxe portabile și boxe Bluetooth noi, pentru acasă sau în deplasare. ${PROMISE}`,
  },
  "tv-audio-video-si-foto/aparate-foto": {
    title: "Aparate foto și camere video",
    description: `Aparate foto, camere video și accesorii foto noi. ${PROMISE}`,
  },
  "desktop-pc-periferice": {
    title: "Periferice PC și Mac: tastaturi, mouse, docking",
    description: `Tastaturi Apple Magic Keyboard și mecanice, mouse-uri, stații de andocare și echipamente de rețea pentru PC și Mac. ${PROMISE}`,
  },
  "console-jocuri": {
    title: "Console PS5, Steam Deck, VR și jocuri",
    description: `Console PlayStation 5 și Valve Steam Deck, ochelari VR Meta Quest, drone DJI, jocuri și accesorii. ${PROMISE}`,
  },
  "console-jocuri/drona": {
    title: "Drone DJI Mini și DJI Neo",
    description: `Drone DJI Mini și DJI Neo, singure sau în pachete Fly More Combo. ${PROMISE}`,
  },
  "console-jocuri/incarcatoare-si-cabluri": {
    title: "Încărcătoare și cabluri pentru console",
    description: `Încărcătoare și cabluri de date pentru console, controlere și dispozitive portabile. ${PROMISE}`,
  },
  "huse-telefoane": {
    title: "Huse telefoane iPhone și Samsung",
    description: `Huse de protecție pentru iPhone și alte telefoane, din silicon, piele sau plastic dur. ${PROMISE}`,
  },
  "huse-telefoane/iphone-15-pro-max": {
    title: "Huse iPhone 15 Pro Max",
    description: `Huse de protecție pentru iPhone 15 Pro Max. ${PROMISE}`,
  },
  "huse-telefoane/iphone-15-pro": {
    title: "Huse iPhone 15 Pro",
    description: `Huse de protecție pentru iPhone 15 Pro. ${PROMISE}`,
  },
  "folii-de-protectie": {
    title: "Folii de protecție pentru telefoane",
    description: `Folii de sticlă și folii de protecție pentru ecranul telefonului. ${PROMISE}`,
  },
  "folii-de-protectie/iphone-15-pro": {
    title: "Folii de protecție iPhone 15 Pro",
    description: `Folii de sticlă și folii de protecție pentru ecranul iPhone 15 Pro. ${PROMISE}`,
  },
  "incarcatoare-accesorii": {
    title: "Încărcătoare, cabluri și accesorii telefon",
    description: `Încărcătoare rapide, cabluri, suporturi auto și alte accesorii pentru telefon și tabletă. ${PROMISE}`,
  },
  "incarcatoare-accesorii/suporturi-auto": {
    title: "Suporturi auto și încărcătoare auto",
    description: `Suporturi auto magnetice pentru telefon și încărcătoare auto USB-C cu încărcare rapidă. ${PROMISE}`,
  },
  "pentru-casa": {
    title: "Aspiratoare robot iRobot, Dreame și scule",
    description: `Aspiratoare robot iRobot Roomba, Dreame și Roborock, aspiratoare verticale și scule electrice Bosch. ${PROMISE}`,
  },
  diverse: {
    title: "Gadgeturi și electronice diverse",
    description: `Gadgeturi și electronice: Apple AirTag, uscătoare de păr Dyson, aspiratoare, accesorii și multe altele. ${PROMISE}`,
  },
  "ceasuri-analogice": {
    title: "Ceasuri Casio G-Shock și ceasuri analogice",
    description: `Ceasuri Casio G-Shock și alte ceasuri analogice, originale. ${PROMISE}`,
  },
}

/**
 * @param names lanțul de nume de la rădăcină la categorie
 * @param slugs același lanț, ca segmente de URL
 */
export const categorySeo = ({
  names,
  slugs,
  metadata,
  description,
}: {
  names: string[]
  slugs: string[]
  metadata: Metadata
  description?: string | null
}) => {
  const override = seoOverride(metadata)
  const curated = CATEGORY_SEO[slugs.join("/")]
  const name = names[names.length - 1] ?? ""
  // „iPhone 15 Pro – Huse telefoane": fără părinte, subcategoriile cu același
  // nume (huse/folii pe același model) ar avea titluri identice.
  const fallbackTitle =
    names.length > 1 ? `${name} – ${names[names.length - 2]}` : name

  return {
    title: override.title || curated?.title || fallbackTitle,
    // Medusa întoarce `""` (nu `null`) la categoriile fără descriere, iar un
    // `description` gol nu mai ajunge deloc în <head>: Google își alegea atunci
    // singur fragmentul, de obicei textul de abonare din footer.
    description:
      override.description ||
      description?.trim() ||
      curated?.description ||
      `${fallbackTitle} la Onlybestdevice: produse noi. ${PROMISE}`,
  }
}

export const productSeo = ({
  title,
  metadata,
  price,
}: {
  title: string
  metadata: Metadata
  /** Prețul cel mai mic, deja formatat („1.299,00 lei"). */
  price?: string | null
}) => {
  const override = seoOverride(metadata)
  // Descrierea lungă vine copiată de la producători și marketplace-uri — același
  // text e pe zeci de site-uri. Prețul și condițiile sunt ce ne diferențiază
  // în rezultat; Google reafișează prețul nou la următorul crawl (ISR).
  return {
    title: override.title || title,
    description:
      override.description ||
      // Titlul deschide fraza: începe uneori cu o marcă („Apple iPad"), deci
      // nu poate fi pus cu literă mică după un „Cumpără".
      `${title}${price ? ` la ${price}` : ""} pe Onlybestdevice. ${PROMISE}`,
  }
}
