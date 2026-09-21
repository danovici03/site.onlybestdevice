import { colorHex, parsePhone } from "../phone-group"
import { brandFromTitle } from "./brands"
import { fold } from "./normalize"

/**
 * Extractoarele din cod: ce nu se poate citi direct dintr-o etichetă a fișei
 * tehnice. Un atribut alege cel mult unul (`filter_attribute.extractor`), iar
 * lista de aici e și lista din dropdown-ul din admin.
 *
 * Toate primesc titlul și fișa (`metadata.specs`) și întorc valori brute —
 * potrivirea pe valorile canonice se face în `autofill.ts`.
 */
export type ExtractInput = { title: string; specs: Record<string, string> }

export type Extractor = {
  label: string
  type: "select" | "number"
  run: (input: ExtractInput) => string[] | number | null
}

/** Toate aparițiile GB/TB din titlu, marcate dacă stau lângă „RAM". */
const memoryTokens = (title: string) => {
  const out: { gb: number; disp: string; ram: boolean }[] = []
  for (const seg of title.split(",")) {
    const ramSeg = /\bram\b/i.test(seg)
    const re = /(\d+(?:[.,]\d+)?)\s*(TB|GB)\b/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(seg))) {
      const val = parseFloat(m[1].replace(",", "."))
      const tb = /tb/i.test(m[2])
      out.push({ gb: tb ? val * 1024 : val, disp: `${val} ${tb ? "TB" : "GB"}`, ram: ramSeg })
    }
  }
  return out
}

/**
 * Ordinea contează: „Qualcomm SM6375 Snapdragon" e Snapdragon, nu altceva.
 *
 * Apple se recunoaște doar după nume sau „Bionic", ori când fișa e DOAR
 * cipul („A18", „M4 Pro"). Un „A\d\d" oriunde în text prindea nucleele din
 * fișele Android („Octa-core (2x Cortex-A76 + 6x Cortex-A55)") și trecea
 * telefonul MediaTek la Apple.
 */
const CPU_FAMILIES: [RegExp, string][] = [
  [/\bapple\b|\bbionic\b|^\s*(a\d{2}|m\d)(\s+(pro|max|ultra))?\s*$/i, "Apple"],
  [/snapdragon|qualcom/i, "Qualcomm Snapdragon"],
  [/dimensity/i, "MediaTek Dimensity"],
  [/helio|mediatek|\bmt\d{4}/i, "MediaTek Helio"],
  [/exynos/i, "Samsung Exynos"],
  [/tensor/i, "Google Tensor"],
  [/kirin/i, "HiSilicon Kirin"],
  [/unisoc|\bt6\d{2}\b|\bsc\d{4}/i, "Unisoc"],
  [/intel|core\s+i\d|celeron|pentium/i, "Intel"],
  [/\bamd\b|ryzen/i, "AMD"],
]

/**
 * Bucățile de fișă care vorbesc despre Wi-Fi: „Wi-Fi 2.4G/5G", „802.11ac",
 * „5 GHz". Acolo „5G" e banda radio, nu rețeaua mobilă — fără filtrul ăsta un
 * laptop cu Wi-Fi dual-band primea „5G" și o tabletă Wi-Fi apărea „cu SIM".
 * O bucată care pomenește și modemul („Wi-Fi + Cellular") rămâne.
 */
const withoutWifiBands = (parts: string[]): string =>
  parts
    .flatMap((p) => p.split(/[,;\n]/))
    .filter((p) => !/wi-?fi|wlan|802\.11|ghz/i.test(p) || /cellular|\blte\b|\bsim\b/i.test(p))
    .join(" ")

/** RAM realist; peste 32 GB e aproape sigur stocarea prinsă greșit. */
const realisticRam = (gb: number) => gb > 0 && gb <= 32

export const EXTRACTORS: Record<string, Extractor> = {
  brand: {
    label: "Marca din titlu",
    type: "select",
    run: ({ title }) => {
      // Doar lista de mărci cunoscute: primul cuvânt din titlu („Aspirator",
      // „Drona") nu e o marcă. Mărcile noi se adaugă în `brands.ts` sau se
      // citesc din fișă (sursa „Brand").
      const b = brandFromTitle(title)
      return b ? [b] : null
    },
  },
  title_storage: {
    label: "Stocare din titlu (cel mai mare GB/TB)",
    type: "select",
    run: ({ title }) => {
      const t = memoryTokens(title)
        .filter((x) => !x.ram && x.gb >= 16)
        .sort((a, b) => b.gb - a.gb)
      return t.length ? [t[0].disp] : null
    },
  },
  title_ram: {
    label: "Memorie RAM din titlu",
    type: "select",
    run: ({ title }) => {
      const toks = memoryTokens(title)
      const marked = toks.filter((x) => x.ram && realisticRam(x.gb))
      if (marked.length) return [marked[0].disp]
      // Două valori nemarcate („256GB, 8GB"): cea mică e RAM-ul.
      const plain = toks.filter((x) => !x.ram).sort((a, b) => a.gb - b.gb)
      if (plain.length > 1 && realisticRam(plain[0].gb)) return [plain[0].disp]
      return null
    },
  },
  phone_color: {
    label: "Culoare din titlu (format telefoane)",
    type: "select",
    run: ({ title }) => {
      const c = parsePhone(title)?.color
      // Fără cifre („45W") și scurtă — altfel e o bucată de fișă, nu o culoare.
      return c && !/\d/.test(c) && c.length <= 22 ? [c] : null
    },
  },
  cpu_family: {
    label: "Familia procesorului (din fișă)",
    type: "select",
    run: ({ specs }) => {
      // Filtrul util e familia, nu modelul exact: 27 de modele de procesor pe
      // 48 de produse înseamnă 27 de bife cu câte un produs fiecare.
      const raw = specs["model procesor"] ?? specs["procesor"] ?? specs["chipset"] ?? ""
      if (!raw) return null
      for (const [re, family] of CPU_FAMILIES) if (re.test(raw)) return [family]
      return null
    },
  },
  cellular: {
    label: "Tabletă cu SIM sau doar Wi-Fi (titlu + fișă)",
    type: "select",
    run: ({ title, specs }) => {
      // Modemul câștigă: „Wi-Fi, 4G" e o tabletă cu SIM, nu una doar Wi-Fi.
      const parts = [title, specs["conectivitate"] ?? "", specs["retea"] ?? "", specs["tip sim"] ?? ""]
      const modem = withoutWifiBands(parts)
      if (/fara sim|f[aă]r[aă] sim/i.test(modem)) return ["Doar Wi-Fi"]
      if (/cellular|\blte\b|\b[45]g\b|cu sim|nano ?sim|esim/i.test(modem)) return ["Wi-Fi + Cellular"]
      if (/wi-?fi/i.test(parts.join(" "))) return ["Doar Wi-Fi"]
      return null
    },
  },
  network_5g: {
    label: "5G din titlu sau fișă",
    type: "select",
    run: ({ title, specs }) => {
      const hay = withoutWifiBands([title, ...Object.values(specs)])
      return /\b5g\b/i.test(hay) ? ["5G"] : null
    },
  },
  compatible_model: {
    label: "Model compatibil din titlu (huse, folii)",
    type: "select",
    run: ({ title }) => {
      // „iPhone 17/16 Pro" = două modele; „Galaxy S25 Ultra" rămâne întreg.
      const out = new Set<string>()
      const iphone = /iphone\s+(\d{1,2}(?:\s*\/\s*\d{1,2})*)(\s+(?:pro\s+max|pro|plus|air|mini|e)\b)?/gi
      let m: RegExpExecArray | null
      while ((m = iphone.exec(title))) {
        const suffix = (m[2] ?? "").trim().replace(/\b\w/g, (c) => c.toUpperCase())
        for (const n of m[1].split("/")) out.add(`iPhone ${n.trim()}${suffix ? " " + suffix : ""}`)
      }
      const galaxy = /galaxy\s+([a-z]\d{1,2})(\s+(?:ultra|plus|fe|edge)\b|\+)?/gi
      while ((m = galaxy.exec(title))) {
        const suffix = (m[2] ?? "").trim()
        const tail = suffix === "+" ? "+" : suffix ? " " + suffix[0].toUpperCase() + suffix.slice(1).toLowerCase() : ""
        out.add(`Galaxy ${m[1].toUpperCase()}${tail}`)
      }
      return out.size ? [...out] : null
    },
  },
  screen_inch: {
    label: "Diagonală în inch, din titlu",
    type: "number",
    run: ({ title }) => {
      const m = title.match(/(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:"|”|''|inch|inchi|inci|toli)/i)
      const n = m ? parseFloat(m[1].replace(",", ".")) : NaN
      return Number.isFinite(n) && n > 0 && n < 120 ? n : null
    },
  },
}

/**
 * Numărul dintr-o valoare de fișă, în unitatea atributului: „1 TB" → 1024 dacă
 * atributul e în GB, „15.5 cm" → 6.1 dacă e în inch, „Pana la 30 ore" → 30.
 */
export const parseNumber = (raw: string, unit: string | null): number | null => {
  const m = raw.replace(/(\d),(\d)/g, "$1.$2").match(/(\d+(?:\.\d+)?)\s*([a-zA-Z"”]*)/)
  if (!m) return null
  let n = parseFloat(m[1])
  if (!Number.isFinite(n)) return null
  const u = (unit ?? "").toLowerCase()
  const src = m[2].toLowerCase()
  if (u === "gb" && src === "tb") n *= 1024
  if (u === "gb" && src === "mb") n /= 1024
  if ((u === "inch" || u === '"') && src === "cm") n /= 2.54
  if (u === "mah" && src === "ah") n *= 1000
  return Math.round(n * 100) / 100
}

/** Fișa ca hartă cu chei normalizate — etichetele vin cu și fără diacritice. */
export const foldSpecs = (specs: unknown): Record<string, string> => {
  const out: Record<string, string> = {}
  if (!specs || typeof specs !== "object") return out
  for (const [k, v] of Object.entries(specs as Record<string, unknown>)) {
    if (v == null) continue
    const val = String(v).trim()
    if (val) out[fold(k).replace(/:$/, "")] = val
  }
  return out
}

export { colorHex }
