export type MegaMenuItem = {
  label: string
  href: string
  description: string
  count?: number
  /**
   * Poza de rezervă a categoriei, arătată doar când categoria n-are încă
   * produse. „Oferte" n-are una: acolo lista nu e goală decât dacă magazinul
   * chiar n-are nicio ofertă, iar atunci o poză de stoc ar minți.
   */
  image?: string
  // Featured items get a large photo card in the center of the mega-menu;
  // the rest appear only in the left text list.
  featured?: boolean
  /**
   * Intrare evidențiată, ținută prima în listă și colorată în accent. „Oferte"
   * era link separat în nav; mutat aici, are nevoie de ceva care să-l scoată
   * din șirul de categorii, altfel se pierde printre ele.
   */
  highlight?: boolean
  /**
   * Intrarea nu e o categorie Medusa, ci lista de oferte: produsele ei se
   * rezolvă după bifa „La ofertă", nu după handle-ul din `href`. Fără marcaj,
   * `resolveMegaMenu` ar căuta categoria „oferte" și ar arăta altceva decât
   * pagina spre care duce linkul.
   */
  sale?: boolean
}

export type MegaMenuRoot = {
  key: string
  label: string
  href: string
  caption: string
  feature: {
    title: string
    body: string
    href?: string
    /** Supratitlul bannerului; implicit „Recomandarea noastră". */
    eyebrow?: string
  }
  items: MegaMenuItem[]
}

export type FlatLink = {
  key: string
  label: string
  href: string
}

// --- Runtime-resolved shapes (curated data + real Medusa products) ---

export type MegaMenuProduct = {
  title: string
  handle: string
  thumbnail: string | null
  price: string | null
}

// A curated category enriched at request time with its real products + count.
export type ResolvedMegaItem = MegaMenuItem & {
  count: number
  products: MegaMenuProduct[]
}

export type ResolvedMegaRoot = Omit<MegaMenuRoot, "items" | "feature"> & {
  items: ResolvedMegaItem[]
  feature: MegaMenuRoot["feature"] & {
    /**
     * Produsul real arătat în bannerul din dreapta. `null` cât timp magazinul
     * n-are nicio ofertă activă (sau backendul nu răspunde) — bannerul rămâne
     * atunci doar text, fără poză.
     */
    product: MegaMenuProduct | null
  }
}

// Structură preluată de pe onlybestdevice.ro: un dropdown „Produse" cu toate
// categoriile. Imaginile sunt placeholder (de înlocuit cu imaginile reale de categorie).
export const MEGA_MENU: MegaMenuRoot[] = [
  {
    key: "produse",
    label: "Produse",
    href: "/store",
    caption: "Cele mai noi device-uri, cu garanție și livrare rapidă.",
    // Bannerul din dreapta duce la Oferte, nu la tot catalogul: „Oferte" a
    // ieșit din bara de sus și ăsta e locul unde rămâne vizibil de la prima
    // deschidere a meniului.
    //
    // Nu are `image`: poza e a unui produs aflat chiar atunci la ofertă, adusă
    // de `resolveMegaMenu` odată cu lista de oferte. O poză de stoc ar arăta
    // altceva decât găsește clientul după click și ar rămâne aceeași și după ce
    // se schimbă ofertele.
    feature: {
      eyebrow: "Prețuri reduse",
      title: "Ofertele săptămânii",
      body: "Reduceri la telefoane, laptopuri și accesorii — stoc limitat.",
      href: "/oferte",
    },
    items: [
      {
        label: "Oferte",
        href: "/oferte",
        description: "Reducerile active, actualizate săptămânal.",
        highlight: true,
        sale: true,
      },
      {
        label: "Telefoane mobile",
        href: "/categories/telefoane-mobile",
        description: "Smartphone-uri noi, sigilate, cu garanție.",
        image:
          "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80",
        featured: true,
      },
      {
        label: "Tablete",
        href: "/categories/tablete",
        description: "Tablete pentru muncă și divertisment.",
        image:
          "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&q=80",
        featured: true,
      },
      {
        label: "Smartwatch & Wearables",
        href: "/categories/smartwatch-wearables",
        description: "Ceasuri smart și brățări fitness.",
        image:
          "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80",
      },
      {
        label: "Laptop",
        href: "/categories/laptop",
        description: "Laptopuri pentru orice buget.",
        image:
          "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&q=80",
        featured: true,
      },
      {
        label: "Desktop PC & Periferice",
        href: "/categories/desktop-pc-periferice",
        description: "Sisteme desktop, monitoare și periferice.",
        image:
          "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&q=80",
      },
      {
        label: "TV, Audio-Video și Foto",
        href: "/categories/tv-audio-video-si-foto",
        description: "Televizoare, audio și aparate foto.",
        image:
          "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&q=80",
      },
    ],
  },
]

/**
 * Linkurile de suport. NU mai apar în bara de sus: acolo a rămas doar mega-
 * meniul „Produse" plus căutarea, ca navigarea să aibă o singură intrare în
 * catalog. Aceleași subiecte sunt acoperite de footer (pe orice pagină) și de
 * pagina de întrebări frecvente; aici rămân doar pentru meniul de pe mobil,
 * unde drawer-ul ține loc de footer cât timp e deschis.
 */
export const SECONDARY_LINKS: FlatLink[] = [
  { key: "livrare", label: "Livrare", href: "/livrare" },
  { key: "retur", label: "Retur produse", href: "/retur" },
  { key: "garantie", label: "Garanție și service", href: "/garantie" },
  { key: "faq", label: "Întrebări frecvente", href: "/faq" },
  { key: "contact", label: "Contact", href: "/contact" },
]
