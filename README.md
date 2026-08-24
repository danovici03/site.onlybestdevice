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

## Patch-uri peste Medusa

`backend/.yarn/patches/` conține patch-uri Yarn aplicate peste pachete din
`node_modules`. Se aplică automat la `yarn install` (prin `resolutions` din
`backend/package.json`).

| Patch                   | Ce face                                                                 |
| ----------------------- | ----------------------------------------------------------------------- |
| `@medusajs/dashboard`   | adaugă `image/avif` / `.avif` la formatele acceptate în Media pe produs |

**La orice upgrade de Medusa** patch-ul trebuie refăcut: e legat de versiune și
de numele chunk-ului din bundle-ul admin-ului (`dist/chunk-*.mjs` + `dist/app.js`),
amândouă schimbându-se între versiuni.

```bash
cd backend
yarn patch @medusajs/dashboard          # extrage pachetul într-un folder temporar
# adaugă "image/avif" în SUPPORTED_FORMATS și ".avif" în
# SUPPORTED_FORMATS_FILE_EXTENSIONS, în dist/app.js ȘI în dist/chunk-*.mjs
yarn patch-commit -s <folder>
```
