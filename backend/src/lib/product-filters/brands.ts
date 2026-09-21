/**
 * Marca din titlu. Mutată aici din `scripts/extract-product-filters.ts`, ca
 * extractorul `brand` al filtrelor să folosească exact aceeași listă.
 *
 * [cuvânt-cheie, Etichetă] — sub-mărcile întâi (iPhone→Apple, Galaxy→Samsung,
 * Redmi/Poco→Xiaomi, Pixel→Google), apoi mărcile de accesorii.
 */
export const BRANDS: [string, string][] = [
  ["apple", "Apple"], ["iphone", "Apple"], ["ipad", "Apple"], ["macbook", "Apple"], ["airpods", "Apple"],
  ["samsung", "Samsung"], ["galaxy", "Samsung"],
  ["xiaomi", "Xiaomi"], ["redmi", "Xiaomi"], ["poco", "Xiaomi"],
  ["google", "Google"], ["pixel", "Google"],
  ["motorola", "Motorola"], ["huawei", "Huawei"], ["honor", "Honor"],
  ["oneplus", "OnePlus"], ["nothing", "Nothing"], ["oppo", "OPPO"], ["vivo", "vivo"],
  ["realme", "realme"], ["nokia", "Nokia"], ["sony", "Sony"], ["blackview", "Blackview"],
  ["oukitel", "Oukitel"], ["ulefone", "Ulefone"], ["doogee", "Doogee"], ["infinix", "Infinix"],
  ["tecno", "Tecno"], ["asus", "Asus"], ["lenovo", "Lenovo"], ["tcl", "TCL"], ["zte", "ZTE"],
  ["uleway", "Uleway"], ["garmin", "Garmin"], ["dji", "DJI"], ["jbl", "JBL"], ["bose", "Bose"],
  ["marshall", "Marshall"], ["canon", "Canon"], ["nikon", "Nikon"], ["gopro", "GoPro"],
  ["nintendo", "Nintendo"], ["playstation", "Sony"], ["xbox", "Microsoft"], ["microsoft", "Microsoft"],
  ["msi", "MSI"], ["dell", "Dell"], ["hp", "HP"], ["acer", "Acer"], ["logitech", "Logitech"],
  ["amazfit", "Amazfit"], ["fitbit", "Google"], ["meta quest", "Meta"],
  // accesorii
  ["benks", "Benks"], ["liavec", "Liavec"], ["spigen", "Spigen"], ["nillkin", "Nillkin"],
  ["ringke", "Ringke"], ["dux ducis", "Dux Ducis"], ["pitaka", "Pitaka"], ["baseus", "Baseus"],
  ["anker", "Anker"], ["ugreen", "Ugreen"], ["hoco", "Hoco"], ["joyroom", "Joyroom"],
  ["esr", "ESR"], ["rock", "Rock"],
]

const BRAND_RES: [RegExp, string][] = BRANDS.map(([kw, label]) => [
  new RegExp("\\b" + kw.replace(/ /g, "\\s+") + "\\b", "i"),
  label,
])

export function brandFromTitle(title: string): string | null {
  for (const [re, label] of BRAND_RES) if (re.test(title)) return label
  return null
}
