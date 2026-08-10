# Sincronizarea cu ERP-ul (gestiunea Laravel)

Oglinda integrării WooCommerce → gestiune, dar pentru Medusa. Gestiunea (Laravel)
e **sursa de adevăr pentru stoc**; Medusa e sursa de adevăr pentru comenzi.

```
      comenzi (order.*, payment.*)
Medusa ─────────────────────────────► Laravel   POST /webhooks/medusa/order
                                                (HMAC-SHA256, X-OBD-Signature)

      stoc disponibil (absolut, nu delta)
Medusa ◄───────────────────────────── Laravel   POST /admin/erp/stock
                                                (HTTP Basic cu Secret API Key)

      produse noi (draft)
Medusa ◄───────────────────────────── Laravel   POST /admin/erp/products
```

## Config

`backend/.env`:

| Variabilă               | Rol                                                              |
| ----------------------- | ---------------------------------------------------------------- |
| `ERP_WEBHOOK_URL`       | `https://<gestiune>/webhooks/medusa/order`                        |
| `ERP_WEBHOOK_SECRET`    | identic cu `MEDUSA_WEBHOOK_SECRET` din `.env`-ul Laravel          |
| `ERP_STOCK_LOCATION_ID` | opțional; implicit prima stock location din Medusa                |
| `ERP_CURRENCY`          | opțional; implicit moneda default a magazinului                    |

Fără primele două, subscriberul se autodezactivează în tăcere (log `info`) —
comenzile **nu** ajung în gestiune și stocul nu se scade.

În Laravel: `MEDUSA_URL` (backend-ul Medusa), `MEDUSA_ADMIN_KEY` (Secret API Key
din Admin → Settings → API Key Management) și `MEDUSA_WEBHOOK_SECRET`.

## Ce trimitem și când

`erp-order-sync.ts` ascultă `order.placed`, `order.canceled`, `order.completed`,
`order.updated`, `order.archived`, `order.fulfillment_created`,
`order.fulfillment_canceled`, `order.return_received`, `order.claim_created`,
`order.exchange_created`, `payment.captured`, `payment.refunded`.

La fiecare eveniment trimitem **starea completă și curentă** a comenzii, nu un
delta. Handler-ul din Laravel e idempotent (pe `medusa_order_id` și pe schimbarea
de status), deci o retrimitere e inofensivă și un eveniment pierdut se repară de
la sine la următorul.

## Statusul canonic

Medusa descrie o comandă pe trei axe (`status`, `payment_status`,
`fulfillment_status`); gestiunea lucrează cu una singură, în vocabularul
WooCommerce. Reducerea se face în `order-payload.ts::toCanonicalStatus`, o
singură dată, ca regula să nu fie duplicată în PHP:

| Condiție Medusa                                    | Canonic      | Efect în gestiune                                  |
| -------------------------------------------------- | ------------ | -------------------------------------------------- |
| `status=canceled` / `payment_status=canceled`       | `cancelled`  | vânzare anulată, stoc restaurat, garanții anulate  |
| `payment_status=refunded` (integral)                | `refunded`   | idem, marcat ca retur                              |
| `payment_status=requires_action`                    | `failed`     | ca `cancelled`                                     |
| `status=completed`                                  | `completed`  | rezervările devin vânzări, se generează garanțiile |
| `fulfillment_status` ∈ {fulfilled, shipped, delivered} | `completed` | idem                                            |
| `payment_status` ∈ {captured, authorized, partially_*} | `processing` | stocul rămâne rezervat; `date_paid` marchează vânzarea ca încasată |
| altfel                                              | `pending`    | stocul rămâne rezervat                             |

**Încasarea nu e finalizare.** La plata cu cardul banii intră în secunda în care
clientul apasă „Plătește", cu telefonul încă în raft. Dacă `captured` ar da
`completed`, IMEI-ul ar fi marcat vândut și garanția ar porni înainte de livrare.
Faptul că s-a încasat călătorește separat, prin `date_paid` — exact ca la
WooCommerce, unde plata cu cardul lasă comanda în `processing`.

**Stările parțiale nu finalizează.** Gestiunea nu are noțiunea de comandă pe
jumătate livrată; `completed` pe o comandă expediată parțial ar marca vândute
toate IMEI-urile ei, inclusiv cele încă în raft.

**De ce contează livrarea:** în Medusa `order.status` rămâne `pending` pe tot
parcursul vieții comenzii (se schimbă doar la anulare sau la închiderea manuală).
Dacă am aștepta doar `completed`, IMEI-ul rezervat n-ar trece niciodată pe
„vândut". De aceea expedierea marfii e tratată ca finalizare — la fel ca în WC,
unde operatorul pune `completed` la expediere.

Refund-ul **parțial** nu declanșează `refunded`: ar elibera tot stocul comenzii
pentru un retur de o bucată.

## Stocul (`/admin/erp/stock`)

`quantity` din payload = **bucăți disponibile pentru vânzare online**, așa cum le
vede gestiunea (stoc nou, nerezervat).

Medusa calculează disponibilul ca `stocked_quantity - reserved_quantity`, iar
comenzile neonorate țin rezervări active. Dacă am scrie direct
`stocked_quantity = quantity`, comenzile pe care Laravel le-a scăzut deja ar fi
scăzute **a doua oară** prin rezervările Medusa. De aceea ruta scrie
`stocked_quantity = quantity + reserved_quantity`.

Ruta face tot upsert-ul într-un apel: aprinde `manage_inventory` (cu
`allow_backorder=false`) unde e încă oprit, creează `inventory_item` + nivelul
dacă lipsesc, apoi scrie nivelul. Un singur request per lot, ca ERP-ul să nu
rămână la jumătate dacă pică rețeaua.

## Produsele noi (`/admin/erp/products`)

Un produs se naște în gestiune (acolo intră marfa la recepție). Marcat „Publicat
pe site", ERP-ul îl împinge aici ca **draft**, ca să nu fie tastat a doua oară:

```
POST /admin/erp/products
{ "items": [ { "sku": "IPH15-128-BLK", "title": "iPhone 15 128GB Negru",
               "description": "…", "handle": "iphone-15-128gb-negru",
               "price": 3999, "quantity": 3, "ean": "194253…",
               "specs": { "Display": "6.7 inch", "Memorie RAM": "8GB" } } ] }
```

Un produs Laravel = un produs Medusa cu **o singură variantă**, cu opțiunea
`Variantă: Standard` — aceeași formă pe care o are un produs simplu importat din
WooCommerce. Varianta e unitatea de stoc, deci răspunsul întoarce `variant_id`
(+ `product_id`), pe care ERP-ul le salvează și de acolo încolo merge pe
`/admin/erp/stock`.

Ruta rezolvă singură sales channel-ul implicit, profilul de livrare, moneda
magazinului și locația de stoc, aplică `manage_inventory` și scrie stocul inițial
prin același mecanism ca `/admin/erp/stock` — un apel, nu patru din PHP.

`specs` ajunge în `product.metadata.specs`, exact unde scrie și
`extract-product-specs.ts` și de unde citește tab-ul de specificații din
storefront. Ruta acceptă doar perechi **plate** etichetă → text (gestiunea le
aplatizează înainte); ce nu e text, număr sau boolean se aruncă, fiindcă
storefront-ul afișează fiecare valoare cu `String(value)`.

Rămâne **draft**: prețul brut, SKU-ul, EAN-ul, numele și fișa tehnică vin din
gestiune, dar pozele, categoria și textele de magazin nu au de unde, se
completează în Admin.

La un SKU deja existent metadata **nu** se suprascrie: produsul e deja al
Medusei, ERP-ul doar se leagă de el.

**Idempotent pe SKU.** Un SKU care există deja nu se duplică; se întoarce varianta
găsită cu `created: false`, ca ERP-ul să se lege de ea. Un retry după timeout sau
un produs creat între timp manual se rezolvă de la sine.

Handle-ul e unic în Medusa, deci două produse cu același nume ar pica la creare;
ruta dezambiguizează cu SKU-ul (`iphone-15` → `iphone-15-iph15-128-blk`).
Un produs picat nu oprește lotul — apare în `errors` și ERP-ul îl reia, fiindcă
a rămas fără `medusa_variant_id`.

`ERP_CURRENCY` forțează moneda prețurilor; implicit e moneda default a magazinului.

## Comenzi din gestiune

```bash
php artisan medusa:match-products --apply   # leagă produsele pe SKU
php artisan medusa:match-products --suggest # + potriviri probabile pe nume
php artisan medusa:sync-stock                # trimite tot stocul legat
php artisan medusa:audit-unlinked            # ce a rămas nelegat
php artisan medusa:reimport-order order_01…  # comandă pierdută de webhook
```

Produsele noi nu au comandă separată: pleacă automat din `ProductObserver` la
salvare (job-ul `CreateProductInMedusa`).
