# site.onlybestdevice

Magazin online **Only Best Device** — monorepo Medusa + Next.js.

## Structură

| Folder        | Descriere                                                        |
| ------------- | --------------------------------------------------------------- |
| `backend/`    | Medusa v2 (admin + API). Rulează pe `:9000`.                     |
| `storefront/` | Next.js storefront. Rulează pe `:8001`.                         |
| `migration/`  | Scripturi de migrare a datelor din WooCommerce.                 |

## Setup

Fiecare subproiect are propriul `.env` (vezi `.env.template` / `.env.example`).
Secretele **nu** sunt urcate în repo.

```bash
# backend
cd backend && yarn install && yarn dev

# storefront
cd storefront && yarn install && yarn dev
```
