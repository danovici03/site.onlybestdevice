export type MegaMenuItem = {
  label: string
  href: string
  description: string
  count?: number
  image: string
  // Featured items get a large photo card in the center of the mega-menu;
  // the rest appear only in the left text list.
  featured?: boolean
}

export type MegaMenuRoot = {
  key: string
  label: string
  href: string
  caption: string
  feature: { title: string; body: string; image: string }
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

export type ResolvedMegaRoot = Omit<MegaMenuRoot, "items"> & {
  items: ResolvedMegaItem[]
}

// Structură preluată de pe onlybestdevice.ro: un dropdown „Produse" cu toate
// categoriile. Imaginile sunt placeholder (de înlocuit cu imaginile reale de categorie).
export const MEGA_MENU: MegaMenuRoot[] = [
  {
    key: "produse",
    label: "Produse",
    href: "/store",
    caption: "Cele mai noi device-uri, cu garanție și livrare rapidă.",
    feature: {
      title: "Cele mai noi device-uri",
      body: "Produse noi cu garanție 24 de luni și retur gratuit 14 zile.",
      image:
        "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80",
    },
    items: [
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
        href: "/categories/smartatch-si-wearables",
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

export const FLAT_LINKS: FlatLink[] = [
  { key: "oferte", label: "Oferte", href: "/categories/oferte" },
  { key: "livrare", label: "Livrare", href: "/livrare" },
  { key: "retur", label: "Retur produse", href: "/retur" },
  { key: "garantie", label: "Garanție și service", href: "/garantie" },
  { key: "faq", label: "Întrebări frecvente", href: "/faq" },
  { key: "contact", label: "Contact", href: "/contact" },
]
