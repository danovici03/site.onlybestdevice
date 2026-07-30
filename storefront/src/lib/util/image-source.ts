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
 * Mutarea pe object storage (iulie 2026) a schimbat doar hostul, nu și fișierele:
 * cele 1906 de `res_*` din catalog sunt aceleași AVIF-uri de ~6 KB, deci regula
 * se aplică mai departe. Fără hostul bucket-ului aici, 62% din poze ar intra
 * inutil prin Image Optimization.
 */
const PRE_OPTIMIZED_NAME = /\/res_[^/]+$/

const PRE_OPTIMIZED_HOSTS = [
  "onlybestdevice.ro",
  "www.onlybestdevice.ro",
  process.env.NEXT_PUBLIC_S3_HOSTNAME || process.env.S3_HOSTNAME,
].filter(Boolean) as string[]

export const isPreOptimizedImage = (src: unknown): boolean => {
  if (typeof src !== "string" || !PRE_OPTIMIZED_NAME.test(src)) {
    return false
  }
  try {
    return PRE_OPTIMIZED_HOSTS.includes(new URL(src).hostname)
  } catch {
    return false
  }
}
