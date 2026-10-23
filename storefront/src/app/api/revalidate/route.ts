import { revalidateTag } from "next/cache"
import { NextResponse, type NextRequest } from "next/server"
import { PRODUCT_LISTS_TAG, PRODUCT_TAG_PREFIX } from "@lib/util/cache-tags"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const KNOWN_TAGS = new Set([
  "categories",
  "products",
  // Listările de produse, revalidate de stocul din gestiune doar când un
  // produs intră sau iese din stoc (vezi `lib/util/cache-tags.ts`).
  PRODUCT_LISTS_TAG,
  // Payload-ul coșului conține date de produs (inclusiv tagurile, de care
  // depinde oferta de garanție extinsă), deci o schimbare de produs trebuie să
  // poată invalida și coșurile — altfel bifa debifată din Admin lasă oferta
  // vizibilă în coșurile deja existente.
  "carts",
  "collections",
  "regions",
  "locales",
  "best-sellers",
  "faq",
  "hero",
  // Lista metodelor de plată e cache-uită cu force-cache; revalidează după
  // activarea/dezactivarea unui provider pe regiune.
  "payment_providers",
])

// Tags prefixed with one of these keys are scoped per-entity (e.g.
// `reviews-prod_01XYZ`). Accepting the prefix avoids enumerating every id.
// `product-<id>` / `product-<handle>`: un singur produs, la schimbarea stocului.
const KNOWN_PREFIXES = ["reviews-", PRODUCT_TAG_PREFIX]

const isKnownTag = (t: string) =>
  KNOWN_TAGS.has(t) || KNOWN_PREFIXES.some((p) => t.startsWith(p))

export async function POST(request: NextRequest) {
  const expected = process.env.REVALIDATE_SECRET
  if (!expected) {
    return NextResponse.json(
      { error: "Revalidation is not configured" },
      { status: 503 }
    )
  }

  const auth = request.headers.get("authorization") ?? ""
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : null
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { tags?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const tags = Array.isArray(body.tags)
    ? body.tags.filter((t): t is string => typeof t === "string")
    : []

  if (tags.length === 0) {
    return NextResponse.json(
      { error: "Body must include a non-empty `tags` array" },
      { status: 400 }
    )
  }

  const unknown = tags.filter((t) => !isKnownTag(t))
  if (unknown.length > 0) {
    return NextResponse.json(
      { error: `Unknown tags: ${unknown.join(", ")}` },
      { status: 400 }
    )
  }

  for (const tag of tags) {
    revalidateTag(tag)
  }

  return NextResponse.json({ revalidated: tags, now: Date.now() })
}
