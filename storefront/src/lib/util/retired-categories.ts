/**
 * Handle-uri de categorie scoase din uz → calea canonică de azi.
 *
 * Catalogul a avut categorii duplicate din cele două valuri de import (seed RO
 * + WooCommerce). După unirea din `merge-duplicate-categories.ts`, rândurile
 * retrase nu mai există în baza de date, deci URL-urile lor n-ar mai putea fi
 * rezolvate — de aici, 308 în loc de 404. Restul mutărilor de URL (sufixul de
 * dezambiguizare: `apple-tablete` → `tablete/apple`) se redirectează dinamic în
 * pagina de categorie, care poate încă rezolva handle-ul; aici stau doar cele
 * care au dispărut sau au fost înlocuite de o pagină dedicată.
 *
 * Cheile sunt scrise decodat: unele conțineau virgule și diacritice, care în
 * URL ajung percent-encodate. Valorile sunt căi relative la regiune, nu doar
 * handle-uri — „Fără categorie" nu are echivalent, deci pleacă în catalog.
 *
 * Folosit în două locuri, care trebuie să spună același lucru: `middleware.ts`
 * emite redirectul, iar `sitemap.ts` sare peste categoriile de aici — un
 * sitemap care declară URL-uri ce redirectează irosește crawl budget.
 */
export const RETIRED_CATEGORY_HANDLES: Record<string, string> = {
  "console,-jocuri": "/categories/console-jocuri",
  "tv,-audio-video-și-foto": "/categories/tv-audio-video-si-foto",
  "folii-de-protecție": "/categories/folii-de-protectie",
  "desktop-pc-&-periferice": "/categories/desktop-pc-periferice",
  "încărcătoare-&-accesorii": "/categories/incarcatoare-accesorii",
  "smartwatch-&-wearables": "/categories/smartwatch-wearables",
  "honor-2": "/categories/telefoane-mobile/honor",
  // Redenumite, nu șterse — vechiul handle avea typo-ul din slug-ul WooCommerce.
  "incarcatoare-acccesorii": "/categories/incarcatoare-accesorii",
  "smartatch-si-wearables": "/categories/smartwatch-wearables",
  // Pubela WooCommerce pentru produse necategorizate: nu e o categorie de
  // navigat, iar produsele ei sunt oricum în catalog.
  "fara-categorie": "/store",
  // Categoria există în continuare, dar nu mai e sursa ofertelor: selecția e
  // acum bifa „La ofertă" de pe produs, iar /oferte listează după ea. Fără
  // redirect am avea două pagini care se contrazic pe măsură ce tagul se
  // schimbă și categoria rămâne în urmă.
  oferte: "/oferte",
}
