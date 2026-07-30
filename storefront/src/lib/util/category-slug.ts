/**
 * Slug-ul de URL al unei categorii, derivat din nume.
 *
 * De ce nu folosim direct `handle`-ul: în Medusa handle-ul e unic **global**,
 * așa că importul a trebuit să dezambiguizeze surorile cu același nume prin
 * sufixul părintelui — „Apple" de sub Tablete a devenit `apple-tablete`, cea de
 * sub Laptop `apple-laptop`. În URL ierarhic sufixul e redundant și urât:
 * `/categories/tablete/apple-tablete`.
 *
 * Segmentele de URL se rezolvă deci pe slug-ul numelui, unic doar **între
 * frați** — de unde `/categories/tablete/apple` și
 * `/categories/telefoane-mobile/apple`, două pagini diferite, ambele curate.
 *
 * Trebuie să rămână identică cu `categorySlug` din
 * `backend/src/scripts/merge-duplicate-categories.ts`, care normalizează
 * handle-urile după aceeași regulă.
 */
export const categorySlug = (name: string): string =>
  name
    // `ș`/`ț` (U+0219/U+021B) se descompun în s/t + virgulă combinată, la fel
    // ca ă/â/î — deci NFD + tăierea semnelor combinate le acoperă pe toate.
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
