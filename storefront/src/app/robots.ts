import { MetadataRoute } from "next"

const BASE = (
  process.env.NEXT_PUBLIC_BASE_URL || "https://onlybestdevice.ro"
).replace(/\/$/, "")

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
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
