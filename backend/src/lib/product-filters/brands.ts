/**
 * Marca din titlu, pentru extractorul `brand` al filtrelor.
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
  ["esr", "ESR"], ["rock", "Rock"], ["borofone", "Borofone"], ["forcell", "Forcell"],
  ["ottocast", "Ottocast"],
  // audio
  ["beats", "Beats"], ["beoplay", "Bang & Olufsen"], ["bang & olufsen", "Bang & Olufsen"],
  ["shokz", "Shokz"], ["soundcore", "Anker"], ["razer", "Razer"], ["corsair", "Corsair"],
  ["lg", "LG"], ["elgato", "Elgato"], ["rode", "Rode"], ["hollyland", "Hollyland"],
  // foto-video
  ["lumix", "Panasonic"], ["panasonic", "Panasonic"], ["nikkor", "Nikon"], ["kodak", "Kodak"],
  ["polaroid", "Polaroid"], ["insta360", "Insta360"], ["akaso", "Akaso"], ["feiyu", "Feiyu"],
  ["zhiyun", "Zhiyun"], ["vilta", "Vilta"], ["viltrox", "Viltrox"], ["feelworld", "Feelworld"],
  ["holy stone", "Holy Stone"], ["reolink", "Reolink"], ["blink", "Blink"],
  // stocare
  ["sandisk", "SanDisk"], ["transcend", "Transcend"], ["crucial", "Crucial"],
  ["verbatim", "Verbatim"], ["wd", "WD"],
  // PC și periferice
  ["tp-link", "TP-Link"], ["minisforum", "Minisforum"], ["acemagician", "ACEMAGIC"],
  ["acemagic", "ACEMAGIC"], ["nipogi", "NiPoGi"], ["awow", "AWOW"],
  ["cooler master", "Cooler Master"], ["glorious", "Glorious"], ["powera", "PowerA"],
  // casă și îngrijire
  ["roomba", "iRobot"], ["irobot", "iRobot"], ["dreame", "Dreame"], ["mova", "Mova"],
  ["roborock", "Roborock"], ["dyson", "Dyson"], ["de'longhi", "De'Longhi"],
  ["delonghi", "De'Longhi"], ["ninja", "Ninja"], ["cecotec", "Cecotec"], ["braun", "Braun"],
  ["oral-b", "Oral-B"], ["philips", "Philips"],
  // ceasuri și altele
  ["polar", "Polar"], ["suunto", "Suunto"], ["cressisub", "Cressi"], ["cressi", "Cressi"],
  ["kobo", "Kobo"],
  // Ultimele: „Intel"/„AMD" apar și în titlurile de Mini PC și laptopuri, unde
  // marca e alta. Doar procesoarele vândute ca atare.
  ["procesor amd", "AMD"], ["procesor intel", "Intel"],
]

const BRAND_RES: [RegExp, string][] = BRANDS.map(([kw, label]) => [
  new RegExp("\\b" + kw.replace(/ /g, "\\s+") + "\\b", "i"),
  label,
])

export function brandFromTitle(title: string): string | null {
  for (const [re, label] of BRAND_RES) if (re.test(title)) return label
  return null
}
