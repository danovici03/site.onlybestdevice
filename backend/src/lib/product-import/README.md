# Import de produs de pe un link

Copiază descrierea, fișa tehnică și pozele de pe pagina de produs a altui
magazin (eMAG, Altex, site-ul producătorului) în produsul curent din Medusa.

```
Admin (widgetul „Import de pe link")
   │  1. POST /admin/product-import/preview  { url, product_id }
   │     → extrage, NU scrie nimic; arată și ce are produsul acum
   │
   │  2. operatorul bifează ce ia și corectează etichetele
   │
   └─ 3. POST /admin/product-import/apply    { product_id, description, specs, images }
         → aduce pozele în stocarea noastră și scrie în produs
```

## De ce aici și nu în gestiunea Laravel

Gestiunea e master pe SKU/preț/stoc și împinge produse noi ca draft
(`/admin/erp/products`), dar **pozele și textele de magazin rămân ale Medusei**
— vezi `MEDUSA_SYNC.md` din repo-ul Laravel. Aici sunt deja stocarea S3,
sanitizatorul de HTML străin (`../woo-description.ts`) și editorul de descriere
din Admin; un scraper în Laravel ar fi trebuit să le rescrie pe toate.

## Fișiere

| Fișier              | Rol                                                                 |
| ------------------- | ------------------------------------------------------------------- |
| `html.ts`           | arbore HTML minimal, fără dependințe: `parseHtml`, `find`, `text`, `absolutizeUrls` |
| `specs.ts`          | perechile etichetă/valoare din tabele, `dl`-uri și grile de `div`    |
| `vocabulary.ts`     | maparea etichetelor pe cele deja folosite în catalog                 |
| `sources/json-ld.ts`| `application/ld+json` de tip `Product` (standard, merge pe orice site)|
| `sources/emag.ts`   | galeria, descrierea și fișa de pe eMAG                               |
| `sources/generic.ts`| OpenGraph + euristici, pentru site-urile fără adaptor                 |
| `fetch-page.ts`     | aducerea paginii, cu apărare împotriva adreselor interne             |
| `rehost.ts`         | descărcarea pozelor și urcarea lor în stocarea noastră               |
| `index.ts`          | contopește cele trei surse și sanitizează descrierea                 |

## Cum se mapează specificațiile

Etichetele din catalog vin din importul WooCommerce și sunt **fără diacritice**
(„Rezolutie camera principala"); eMAG scrie cu diacritice. `vocabulary.ts`
citește etichetele existente din `product.metadata.specs` și potrivește pe o
cheie normalizată (fără diacritice, fără punctuație), deci eticheta importată
capătă forma de casă. Ce nu se potrivește rămâne cum scrie sursa și e marcat
„etichetă nouă" în modal — operatorul o poate rescrie, cu sugestii din
vocabular.

Vocabularul **nu e o listă scrisă de mână**: se auto-întreține din catalog, cu
5 minute de cache per proces.

Potrivirea e exactă pe cheia normalizată, nu aproximativă: „Memorie RAM" și
„Memorie interna" sunt la distanță mică de editare și sunt lucruri diferite.

## Pozele

Se descarcă și se urcă la noi (S3 în producție, `./static` în dev), iar
`src`-urile din descriere se rescriu. Diferă intenționat de descrierile
importate din WooCommerce, care au rămas hotlinkate: costul acelei decizii se
vede în `scripts/import-woo-descriptions.ts`, un script întreg care umblă după
pozele moarte. Pozele descărcate din containerul de producție pot primi 403 de
la unele CDN-uri — dacă se întâmplă, apar în `failures` fără să oprească restul
importului.

## Când magazinul refuză cererea

Unele site-uri întorc 403 pentru cererile venite din datacenter. Modalul oferă
atunci un câmp în care se lipește sursa paginii, salvată din browser (Cmd+U).
Linkul rămâne obligatoriu și în cazul ăsta — din el se rezolvă adresele
relative ale pozelor.

## Adăugarea unui magazin nou

Un adaptor în `sources/`, cu `matches(url)` și `extract(root, url)`, înregistrat
în `ADAPTERS` din `index.ts`. Nu e nevoie să acopere tot: ce nu întoarce cade pe
JSON-LD și pe euristica generică. Merită scris doar dacă `generic` chiar ratează
ceva — pe site-urile cu JSON-LD complet nu aduce nimic în plus.

## Teste

```bash
cd backend && yarn test:unit
```

`__tests__/` conține tiparele reale care rup extragerea: tabele de layout, fișe
duplicate în `<script type="text/template">`, poze lazy cu `data-src`, JSON-LD
invalid (newline-uri brute), `mpn` care nu e EAN.
