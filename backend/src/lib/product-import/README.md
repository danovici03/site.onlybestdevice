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
| `ai.ts`             | extragerea cu model, pentru paginile pe care euristica le ratează    |
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

Unele site-uri refuză cererile venite din datacenter, iar blocajul e pe IP, nu
pe formă: eMAG întoarce **511 Network Authentication Required** plus o pagină de
captcha pentru IP-ul serverului de producție, în timp ce exact aceeași cerere,
cu aceleași antete, întoarce 200 de pe un laptop. Nu există antet care să
rezolve asta.

Singurul browser cu un IP acceptat e al operatorului, deci de acolo luăm pagina.
Widgetul oferă un **bookmarklet** (`src/admin/lib/page-source-bookmarklet.ts`):
se trage o dată în bara de favorite, apoi un click pe pagina magazinului copiază
sursa în clipboard, de unde se lipește în modal. Copiază DOM-ul viu, nu sursa
brută — deci și galeria montată de JavaScript, pe care Cmd+U n-o conține.
Linkul rămâne obligatoriu și în cazul ăsta — din el se rezolvă adresele
relative ale pozelor.

## Stratul de AI

`ai.ts` intră **doar** când euristica a scos prea puțin: fișă goală, **sau** sub
două poze, **sau** descriere sub 200 de caractere (`isThinExtraction`). Condiția
e SAU, nu ȘI — o pagină eMAG cu fișă completă dar fără descriere tot ajunge la
model. Pe o pagină eMAG obișnuită nu se ajunge (adaptorul dă 23 de specificații,
10 poze și 4 KB de descriere pe gratis), deci în practică stratul costă bani
exact pe site-urile pentru care altfel ar fi trebuit scris un adaptor nou.

Se activează punând `ANTHROPIC_API_KEY` în env. Fără cheie, ruta se comportă
identic cu varianta de dinainte. Model implicit `claude-opus-5`, schimbabil cu
`PRODUCT_IMPORT_AI_MODEL`; `PRODUCT_IMPORT_AI=off` îl oprește fără să scoți
cheia.

### Ce ține feature-ul onest

Un model care citește HTML poate inventa un URL de poză plauzibil sau o valoare
care sună corect pentru produsul ăla dar nu scrie nicăieri în pagină. De aceea
nimic din ce întoarce nu ajunge la operator neverificat:

| Ce întoarce  | Cum se verifică                                                        |
| ------------ | ---------------------------------------------------------------------- |
| poze         | URL-ul trebuie să apară literal în HTML-ul sursă (`collectPageUrls`)    |
| specificații | valoarea trebuie să se regăsească în textul paginii, fără diacritice    |
| descriere    | propozițiile lungi trebuie să fie în pagină; sub 60% ⇒ se aruncă toată  |

Comparația pozelor se face pe forma canonică, nu pe șirul brut: `json_encode`
scrie `https:\/\/…` în JSON-urile din pagină, iar atributele conțin des căi
relative — ambele trebuie aduse la același URL absolut, altfel am arunca ca
„inventate" exact pozele reale.

Ce cade la verificare se numără în `notes` și apare în modal. Un model care
halucinează devine astfel un model care întoarce **mai puțin**, nu unul care
umple catalogul cu date inventate.

Ce se aruncă în loc să treacă tăcut: un refuz, un răspuns tăiat de plafonul de
tokeni, un JSON stricat sau o pagină prea mare. Apelul e deja plătit, deci
operatorul primește un motiv, nu o previzualizare inexplicabil de săracă.

Contopirea (`mergeAiExtraction` din `index.ts`) merge într-o singură direcție:
ce s-a citit din structura paginii bate ce a propus modelul. Un `<td>` lângă
altul e un fapt; propunerea modelului e doar plauzibilă.

### Cum se probează

```bash
URL=https://exemplu.ro/produs yarn medusa exec ./src/scripts/check-product-import-ai.ts
```

Arată ce scoate euristica singură, dacă pragurile cheamă modelul, ce a adăugat
el, câți tokeni a costat și ce i s-a aruncat la verificare. `HTML=./pagina.html`
pentru site-urile care refuză serverul, `FORCE=1` ca să vezi modelul lucrând
chiar și pe o pagină pe care euristica o acoperă.

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
