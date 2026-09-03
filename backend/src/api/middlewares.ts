import {
  defineMiddlewares,
  type MedusaNextFunction,
  type MedusaRequest,
  type MedusaResponse,
} from '@medusajs/framework/http'

/**
 * Lista de produse din admin, cu ultimele create primele.
 *
 * Dashboard-ul nu trimite `order` la încărcarea tabelului, iar fără el Medusa
 * întoarce produsele în ordinea implicită a bazei — adică cele mai vechi sus.
 * Produsele de test din seed stăteau în capul listei, iar un produs nou creat
 * din gestiune trebuia căutat pe ultima pagină.
 *
 * Sortăm după `id`, nu după `created_at`, deși data ar fi criteriul evident.
 * Importul în masă din WooCommerce a dat aceeași dată la zeci de produse
 * deodată: cele 638 de produse au doar 20 de valori distincte de `created_at`,
 * în blocuri de câte 50. Cu pagini de 20 de rânduri, fiecare pagină ar cădea în
 * interiorul unui bloc egal, iar Postgres nu garantează ordinea la egalitate —
 * paginile s-ar suprapune de la o cerere la alta, exact bug-ul documentat
 * pentru `/store/products` în `storefront/src/lib/data/rails.ts`. `order`
 * acceptă un singur câmp (vezi `prepareListQuery`), deci un tiebreaker gen
 * `-created_at,-id` nu e posibil.
 *
 * Id-ul de produs e un ULID cu timestampul la început, deci `-id` dă aceeași
 * ordine cronologică, dar totală: două produse nu pot fi la egalitate. Merge și
 * pentru produsele create din gestiune, pentru că id-ul îl generează Medusa —
 * validatorul lui `POST /admin/products` n-are câmp `id`, deci nu poate fi impus
 * din afară.
 */
const defaultNewestFirst = (
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) => {
  // Fără `methods` mai jos, matcher-ul se înregistrează cu `app.use`, care
  // prinde prin prefix și `/admin/products/:id`. Acolo `order` n-are ce căuta,
  // deci ne uităm la calea rămasă după punctul de montare.
  if (req.method === 'GET' && req.path === '/' && !req.query.order) {
    req.query.order = '-id'
  }
  next()
}

/**
 * IPN-ul Netopia v2 semnează hash-ul (sha512) al body-ului exact așa cum a
 * plecat de la ei. Dacă am recalcula hash-ul dintr-un `JSON.stringify` peste
 * body-ul parsat, spațiile și ordinea cheilor ar diferi și orice IPN ar fi
 * respins — deci păstrăm bufferul brut în `req.rawBody`.
 */
export default defineMiddlewares({
  routes: [
    {
      matcher: '/hooks/netopia',
      methods: ['POST'],
      bodyParser: { preserveRawBody: true },
    },
    {
      // Sursa unei pagini lipită de operator (vezi bookmarkletul din widgetul
      // de import). Limita implicită a lui `body-parser` e 100 KB, iar o pagină
      // de produs reală are 270 KB după ce i se scot scripturile — deci fără
      // rândul ăsta calea de rezervă pentru site-urile care refuză serverul
      // răspundea 500 „request entity too large" la fiecare încercare.
      // 8 MB acoperă plafonul de 6 MB verificat în rută, plus JSON-ul din jur.
      matcher: '/admin/product-import/preview',
      methods: ['POST'],
      bodyParser: { sizeLimit: '8mb' },
    },
    {
      // Intenționat FĂRĂ `methods`: asta îl pune în bucketul `global` al
      // sorterului, singurul care rulează înaintea bucketului `static`. Cu
      // `methods: ['GET']` ar ajunge în `static`, lângă `validateAndTransformQuery`
      // din miez — și cum dir-ul core e scanat înaintea celui din proiect, ar
      // rula DUPĂ validare, când `order` e deja citit. Metoda se verifică în
      // handler.
      matcher: '/admin/products',
      middlewares: [defaultNewestFirst],
    },
  ],
})
