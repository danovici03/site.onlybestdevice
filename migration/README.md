# Migrare WooCommerce → Medusa

Pipeline în 2 pași pentru cele ~700 de produse din WordPress/WooCommerce.

## 1. Export din WooCommerce

```bash
cp migration/.env.example migration/.env   # completează WC_URL / WC_KEY / WC_SECRET
node migration/wc-export.mjs
```

Generează cheile în WP Admin → WooCommerce → Settings → Advanced → REST API → **Add key** (Permissions: **Read**).
Rezultat: `migration/data/wc-export.json` (categorii + produse + variații).

## 2. Import în Medusa

```bash
cd backend
yarn medusa exec ./src/scripts/import-woocommerce.ts
```

Ce face:
- creează **categoriile** mirror după WooCommerce (handle = slug WC, cu ierarhie părinte);
- creează **produsele** ca **DRAFT** (le verifici în Admin înainte de publicare);
- mapează **variante** (simple → 1 variantă; variabile → din WC variations), **prețuri RON**, imagini, SKU;
- **descrierile** rămân HTML, curățat de `src/lib/woo-description.ts`: păstrează
  galeriile din „rich description" (poze hotlinkate pe eMAG/Altex/producători),
  aruncă fișele de specificații (sunt în `metadata.specs`), desface tabelele de
  layout și scoate `script`/`iframe`/linkurile către magazinul-sursă;
- **idempotent**: re-rularea sare peste produsele al căror handle există deja.

Opțiuni (env):
- `PUBLISH=1` — importă direct ca `published` în loc de `draft`.
- `WC_EXPORT=/cale/altfel.json` — alt fișier de export.
- `IMPORT_CURRENCY=ron` — moneda prețurilor (default `ron`).
- `IMPORT_BATCH=50` — câte produse pe lot.

## 3. Descrieri pentru produsele deja importate

Primul import (înainte de iulie 2026) tăia tot HTML-ul, deci descrierile au
rămas fără cele ~5.900 de imagini. Pentru produsele care există deja în Medusa:

```bash
cd backend
yarn medusa exec ./src/scripts/import-woo-descriptions.ts              # doar raport
APPLY=1 CHECK_IMAGES=1 yarn medusa exec ./src/scripts/import-woo-descriptions.ts
```

- `CHECK_IMAGES=1` cere fiecare poză și le scoate pe cele moarte la sursă
  (ultima rulare: 76 din 2.839).
- Sare peste descrierile care nu mai seamănă cu sursa (editate în Admin);
  `FORCE=1` le rescrie și pe alea.
- Idempotent: a doua rulare raportează totul „neschimbat".
- Raport: `backend/woo-descriptions-report.csv`.

Pozele rămân găzduite pe domeniile originale. Dacă vreun CDN blochează
hotlinkul, mutarea lor se face cu `migrate-images-to-s3.ts`.

Descrierile salvate din Admin trec prin același sanitizator, în subscriber-ul
`src/subscribers/product-description-sanitize.ts` — deci se poate lipi HTML brut
copiat de pe alt site (pozele lazy se rezolvă, fișele de specificații și
`script`/`iframe`-urile dispar). Textul fără tag-uri nu e atins.

## De verificat după import
- Numărul de produse create vs. cele din WooCommerce.
- Variantele fără preț (raportate de script) — de completat în Admin.
- Reconciliază slug-urile din mega-menu (`storefront/.../mega-menu/data.ts`) cu
  slug-urile reale ale categoriilor WooCommerce, dacă diferă.
- Stoc: produsele se importă cu `manage_inventory: false` (mereu disponibile).
  Pentru stoc real, activează gestiunea și setează nivelurile în Admin.
