import {
  DeviceMobile,
  DeviceTablet,
  Plug,
  Watch,
  GameController,
  Laptop,
  Desktop,
  Television,
  Shield,
  ShieldCheck,
  Package,
  Tag,
} from "@phosphor-icons/react/dist/ssr"

// Iconița fiecărei categorii, după href. Ținută separat pentru că o folosesc
// și panoul de pe desktop, și drawer-ul de pe mobil — dacă o categorie are alt
// simbol în cele două locuri, meniul nu mai pare același meniu.
export const CATEGORY_ICONS: Record<string, React.ElementType> = {
  "/categories/oferte": Tag,
  "/categories/telefoane-mobile": DeviceMobile,
  "/categories/tablete": DeviceTablet,
  "/categories/incarcatoare-accesorii": Plug,
  "/categories/smartwatch-wearables": Watch,
  "/categories/console-jocuri": GameController,
  "/categories/laptop": Laptop,
  "/categories/desktop-pc-periferice": Desktop,
  "/categories/tv-audio-video-si-foto": Television,
  "/categories/huse-telefoane": Shield,
  "/categories/folii-de-protectie": ShieldCheck,
  "/categories/diverse": Package,
}

export const getCategoryIcon = (href: string): React.ElementType =>
  CATEGORY_ICONS[href] ?? Package
