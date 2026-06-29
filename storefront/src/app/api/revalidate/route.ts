import { revalidateTag } from "next/cache"
import { NextResponse, type NextRequest } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const KNOWN_TAGS = new Set([
  "categories",
  "products",
  "collections",
  "regions",
  "locales",
  "best-sellers",
  "faq",
  "hero",
])

// Tags prefixed with one of these keys are scoped per-entity (e.g.
// `reviews-prod_01XYZ`). Accepting the prefix avoids enumerating every id.
const KNOWN_PREFIXES = ["reviews-"]

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
