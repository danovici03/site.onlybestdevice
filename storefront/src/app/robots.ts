import { MetadataRoute } from "next"

const BASE = (
  process.env.NEXT_PUBLIC_BASE_URL || "https://onlybestdevice.ro"
).replace(/\/$/, "")

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      // `/api/related/` e excepția: de acolo vine raftul de produse, iar fără el
      // paginile de produs ar pierde linkurile interne la randarea Google.
      allow: ["/", "/api/related/"],
      // Căutarea internă și API-ul n-au conținut de indexat, dar fiecare cerere
      // e o funcție Vercel facturată (paginile sunt dinamice).
      disallow: [
        "/*/account",
        "/*/checkout",
        "/*/cart",
        "/*/search",
        "/api/",
      ],
    },
    sitemap: `${BASE}/sitemap.xml`,
  }
}
