import { defineMiddlewares } from '@medusajs/framework/http'

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
  ],
})
