/**
 * Tagurile de cache ale produselor, peste tagul global `products`.
 *
 * Fiecare fetch de produse poartă în continuare `products`: revalidarea lui
 * reîmprospătează tot catalogul (modificări din Admin, scripturi, categorii).
 * Stocul venit din gestiune se schimbă însă la fiecare vânzare din magazin, iar
 * pe Vercel fiecare pagină invalidată și apoi vizitată e o regenerare facturată.
 * De aceea backendul revalidează la stoc doar ce s-a schimbat:
 *
 * - `product-<id>` și `product-<handle>`: cererile directe după produs (pagina
 *   lui, upgrade-urile care trimit spre el, best-sellerii aduși după id);
 * - `product-lists`: listările (categorii, magazin, căutare, rafturile de pe
 *   homepage), doar când un produs intră în stoc sau iese din stoc — ordinea
 *   „în stoc primele" și filtrul de stoc depind doar de asta.
 *
 * Listările prezente pe TOATE paginile de produs (mega-meniul din header,
 * „S-ar putea să-ți placă") nu poartă `product-lists`: altfel orice produs
 * epuizat ar invalida iar întregul catalog. Ele rămân pe `products` și pe TTL.
 *
 * Tagurile trebuie acceptate și de `/api/revalidate` (prefixul `product-`).
 */

export const PRODUCT_LISTS_TAG = "product-lists"

export const PRODUCT_TAG_PREFIX = "product-"

export const productTag = (idOrHandle: string) =>
  `${PRODUCT_TAG_PREFIX}${idOrHandle}`

/**
 * Next.js acceptă cel mult 128 de taguri pe fetch. O cerere directă după mai
 * multe produse decât atât se tratează ca listare.
 */
export const MAX_PRODUCT_TAGS = 100
