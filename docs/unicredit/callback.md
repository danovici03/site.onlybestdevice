# UniCredit ePOS — structura callback-ului de statusuri

Documentul comunicat UCFin ca răspuns la întrebarea „cum doriți să primiți
statusurile – structura callback-ului". Implementarea: `backend/src/api/hooks/unicredit/route.ts`.

## Endpoint

```
POST https://<backend>/hooks/unicredit?token=<TOKEN>
Content-Type: application/json
```

- `<backend>` — URL-ul public al backend-ului Medusa (producție: se comunică la go-live; staging: se poate expune prin tunel).
- `<TOKEN>` — secret static generat de noi (`UNICREDIT_CALLBACK_TOKEN` în `backend/.env`), comunicat UCFin pe canal separat. Alternativ acceptăm același token în header-ul `X-Callback-Token`.

## Corp cerere (JSON)

```json
{
  "external_id": "order_01JABCDEF...",
  "status": "Disbursed",
  "application_id": "REF-UCFIN-123456",
  "amount": 4999.99,
  "timestamp": "2026-07-23T10:00:00Z"
}
```

| Câmp             | Tip     | Obligatoriu | Descriere                                                                 |
| ---------------- | ------- | ----------- | ------------------------------------------------------------------------- |
| `external_id`    | string  | da          | Exact valoarea `external_id` trimisă de noi la `POST /api/online/offers`. |
| `status`         | string  | da          | `Disbursed` \| `Rejected` \| `Cancelled` (case-insensitive).              |
| `application_id` | string  | nu          | Referința internă UCFin a cererii de credit.                              |
| `amount`         | number  | nu          | Suma finanțată, în lei.                                                   |
| `timestamp`      | string  | nu          | Momentul schimbării de status, ISO 8601.                                  |

## Semantica statusurilor

- **Disbursed** — coșul a fost finanțat → capturăm plata în Medusa, comanda intră în livrare.
- **Rejected** — creditul a fost respins → comanda se anulează automat, produsele nu se livrează.
- **Cancelled** — cererea a fost anulată → comanda se anulează automat, produsele nu se livrează.

## Răspunsuri

- `200 {"received": true}` — status procesat (sau duplicat deja procesat: `{"received": true, "duplicate": true}`).
- `400` — `external_id`/`status` invalid.
- `401` — token lipsă/greșit.
- `404` — comandă inexistentă.

Orice răspuns ≠ 200 poate fi retrimis (endpoint-ul e idempotent: același status
primit de mai multe ori nu re-execută nimic).

## Test local

```bash
curl -X POST "http://localhost:9000/hooks/unicredit?token=$UNICREDIT_CALLBACK_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"external_id":"<order_id>","status":"Disbursed","application_id":"TEST-1"}'
```
