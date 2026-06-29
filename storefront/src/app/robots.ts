import { MetadataRoute } from "next"

const BASE = (
  process.env.NEXT_PUBLIC_BASE_URL || "https://onlybestdevice.ro"
).replace(/\/$/, "")

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/*/account", "/*/checkout", "/*/cart"],
    },
    sitemap: `${BASE}/sitemap.xml`,
  }
}
