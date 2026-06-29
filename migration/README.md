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
- mapează **variante** (simple → 1 variantă; variabile → din WC variations), **prețuri RON**, imagini, SKU, descriere (HTML curățat);
- **idempotent**: re-rularea sare peste produsele al căror handle există deja.

Opțiuni (env):
- `PUBLISH=1` — importă direct ca `published` în loc de `draft`.
- `WC_EXPORT=/cale/altfel.json` — alt fișier de export.
- `IMPORT_CURRENCY=ron` — moneda prețurilor (default `ron`).
- `IMPORT_BATCH=50` — câte produse pe lot.

## De verificat după import
- Numărul de produse create vs. cele din WooCommerce.
- Variantele fără preț (raportate de script) — de completat în Admin.
- Reconciliază slug-urile din mega-menu (`storefront/.../mega-menu/data.ts`) cu
  slug-urile reale ale categoriilor WooCommerce, dacă diferă.
- Stoc: produsele se importă cu `manage_inventory: false` (mereu disponibile).
  Pentru stoc real, activează gestiunea și setează nivelurile în Admin.
