/**
 * Pozele de catalog stau încă pe WordPress-ul vechi, unde sunt de două feluri:
 *
 *  - `res_<hash>.avif|webp` — trecute prin pluginul de optimizare: pătrate de
 *    ~700-720px, mediana 6 KB, maxim ~90 KB.
 *  - originalele încărcate în admin (`toptel_photo-5-2.jpg` etc.) — mediana
 *    140 KB, până la 800 KB.
 *
 * Vercel recomandă să nu treci prin Image Optimization sursele sub 10 KB:
 * fiecare lățime cerută e o transformare + un cache write facturate, iar dintr-un
 * AVIF de 5 KB iese un WebP adesea mai mare. Deci `res_*` se servesc direct, iar
 * originalele grele trec mai departe prin optimizare — acolo chiar se plătește.
 *
 * Când pozele se mută pe object storage, sursele alea nu intră aici și se
 * optimizează normal.
 */
const PRE_OPTIMIZED_SOURCE =
  /^https?:\/\/(www\.)?onlybestdevice\.ro\/wp-content\/uploads\/.*\/res_[^/]+$/

export const isPreOptimizedImage = (src: unknown): boolean =>
  typeof src === "string" && PRE_OPTIMIZED_SOURCE.test(src)
