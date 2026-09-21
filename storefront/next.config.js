const checkEnvVariables = require("./check-env-variables")

checkEnvVariables()

// Object storage host whitelisted for next/image (e.g. Hetzner Object Storage).
const S3_HOSTNAME = process.env.S3_HOSTNAME
const S3_PATHNAME = process.env.S3_PATHNAME

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",

  // Fonturile facturii PDF sunt citite de pe disc la randare (vezi
  // src/lib/pdf/invoice.tsx). Nu apar în niciun `import`, deci trasarea
  // automată a fișierelor nu le vede și ruta ar crăpa în producție cu ENOENT.
  outputFileTracingIncludes: {
    "/[countryCode]/api/invoice/[orderId]": ["./src/lib/pdf/fonts/*.ttf"],
    "**/api/invoice/**": ["./src/lib/pdf/fonts/*.ttf"],
  },

  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    // `image-source.ts` rulează și în client components, unde doar variabilele
    // NEXT_PUBLIC_* sunt inline-uite. Aici le derivăm din S3_HOSTNAME, ca să
    // rămână o singură variabilă de setat în Vercel.
    NEXT_PUBLIC_S3_HOSTNAME: S3_HOSTNAME || "",
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // Fiecare combinație unică (url + w + q + Accept) e o transformare facturată
    // pe Vercel, la fiecare MISS/STALE. Config-ul de mai jos ține numărul de
    // combinații posibile mic și cache-ul cald cât mai mult timp.

    // 31 de zile. TTL-ul real e max(Cache-Control al sursei, minimumCacheTTL);
    // WordPress-ul trimite doar max-age=604800 (7 zile), deci fără asta tot
    // catalogul se re-transformă săptămânal.
    minimumCacheTTL: 2678400,

    // Scara de lățimi: 16 trepte în mod implicit (8 deviceSizes + 8 imageSizes).
    // Cu 6 trepte, cererile se concentrează pe aceleași intrări din cache.
    // Sursele de pe WordPress sunt pătrate de ~700-720px, deci treptele de
    // 1920/2048/3840 nu făceau decât upscale — fișier mai mare, zero detaliu.
    //
    // Excepția e hero-ul (full-bleed, `sizes="100vw"`): plafonat la 1280, pe un
    // monitor de 1920 poza era întinsă 1.5x (3x pe retina) și ieșea vizibil
    // blurată până pornea videoul. 1920/2560 sunt pentru el; pozele de produs
    // au `sizes` plafonat la 640px, ca să rămână pe treptele de mai jos.
    deviceSizes: [640, 828, 1280, 1920, 2560],
    imageSizes: [64, 128, 256, 384],

    // Allowlist de calitate: fără el, oricine poate cere q=1..100 pe același
    // url și genera 100 de transformări per imagine.
    qualities: [75],

    // Doar webp; avif ar dubla transformările.
    formats: ["image/webp"],

    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      // Pozele de produs stau încă pe WordPress-ul vechi. `search: ""` respinge
      // query string-urile, altfel ?v=1, ?v=2... sunt url-uri sursă distincte.
      {
        protocol: "https",
        hostname: "onlybestdevice.ro",
        pathname: "/wp-content/uploads/**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "www.onlybestdevice.ro",
        pathname: "/wp-content/uploads/**",
        search: "",
      },
      // Produsele demo din seed-onlybestdevice.ts au poze de pe Unsplash; fără
      // hostname aici, orice pagină care le afișează crapă cu „Invalid src prop".
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      ...(S3_HOSTNAME && S3_PATHNAME
        ? [
            {
              protocol: "https",
              hostname: S3_HOSTNAME,
              pathname: S3_PATHNAME,
            },
          ]
        : []),
    ],
  },
}

module.exports = nextConfig
