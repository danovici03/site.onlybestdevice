import { z } from "zod"

import {
  DISPLAY_DEFECTS,
  GRADES,
  NETWORKS,
  PHONE_DEFECTS,
  RULE_DEFS,
  RULE_KEYS,
  RULE_KINDS,
  RULE_SCOPES,
  type RuleKey,
} from "./catalog"

/** Răspunsurile evaluării — același schema pentru admin (calculator) și site. */
export const AnswersSchema = z.object({
  network: z.enum(NETWORKS),
  liquid: z.boolean(),
  burn_in: z.boolean().optional(),
  screen: z.enum(GRADES),
  case: z.enum(GRADES),
  battery: z.number().int().min(0).max(100).optional(),
  display_defects: z.array(z.enum(DISPLAY_DEFECTS)).max(DISPLAY_DEFECTS.length).default([]),
  phone_defects: z.array(z.enum(PHONE_DEFECTS)).max(PHONE_DEFECTS.length).default([]),
})

/** Normalizează stocarea ca în catalog: „256 gb” → „256GB”, „1 TB” → „1TB”. */
export function normalizeStorage(s: string): string | null {
  const m = s.trim().match(/^(\d+(?:[.,]\d+)?)\s*(gb|tb)$/i)
  return m ? `${m[1].replace(",", ".")}${m[2].toUpperCase()}` : null
}

/** Pentru sortare: 64GB < 128GB < 1TB. */
export function storageGb(s: string): number {
  const m = s.match(/^(\d+(?:\.\d+)?)(GB|TB)$/)
  if (!m) return Number.MAX_SAFE_INTEGER
  return parseFloat(m[1]) * (m[2] === "TB" ? 1024 : 1)
}

export const RuleInputSchema = z
  .object({
    key: z.enum(RULE_KEYS as [RuleKey, ...RuleKey[]]),
    scope: z.enum(RULE_SCOPES),
    scope_value: z.string().trim().max(200).default(""),
    kind: z.enum(RULE_KINDS),
    value: z.number().min(0).max(100000),
    note: z.string().max(500).nullable().optional(),
  })
  .superRefine((r, ctx) => {
    const def = RULE_DEFS[r.key]
    if (!(def.kinds as readonly string[]).includes(r.kind)) {
      ctx.addIssue({ code: "custom", message: `Tip nepermis pentru ${def.label}` })
    }
    if ("globalOnly" in def && r.scope !== "global") {
      ctx.addIssue({ code: "custom", message: `${def.label} se setează doar global` })
    }
    if (r.scope === "global" && r.scope_value) {
      ctx.addIssue({ code: "custom", message: "Regula globală nu are brand/dispozitiv" })
    }
    if (r.scope !== "global" && !r.scope_value) {
      ctx.addIssue({ code: "custom", message: "Lipsește brandul / dispozitivul" })
    }
    if (r.kind === "percent" && r.value > 100) {
      ctx.addIssue({ code: "custom", message: "Procentul trebuie să fie între 0 și 100" })
    }
  })
