import { Photo } from "@medusajs/icons"
import { Text } from "@medusajs/ui"

type HeroSlidePreviewProps = {
  imageUrl?: string
  titleLine1?: string
  titleLine2?: string | null
  ctaText?: string | null
}

// Reproduce aproximativ aspectul slide-ului de pe storefront (imagine full-bleed
// + gradiente întunecate + titlu uppercase + buton rotunjit), ca să vezi cum
// arată înainte de publicare. Fonturile/culorile de brand pot diferi ușor față
// de site — e o previzualizare orientativă, nu pixel-perfect.
const HeroSlidePreview = ({
  imageUrl,
  titleLine1,
  titleLine2,
  ctaText,
}: HeroSlidePreviewProps) => {
  return (
    <div className="flex flex-col gap-1.5">
      <Text size="small" weight="plus">
        Previzualizare
      </Text>
      <div className="relative w-full overflow-hidden rounded-lg bg-ui-bg-subtle aspect-[16/8] isolate">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-ui-fg-muted">
            <Photo />
          </div>
        )}

        {/* Aceleași straturi ca pe site: întunecare + gradient sus + gradient jos */}
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-black/70 via-black/20 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

        {/* Conținut aliniat jos, ca în hero */}
        <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-5">
          <h3 className="font-black uppercase leading-[1.05] tracking-tight text-white text-lg sm:text-2xl drop-shadow">
            {titleLine1 ? (
              titleLine1
            ) : (
              <span className="text-white/50">Titlu — rândul 1</span>
            )}
            {titleLine2 && (
              <>
                <br />
                {titleLine2}
              </>
            )}
          </h3>
          {ctaText && (
            <span className="mt-3 inline-block self-start rounded-full bg-white px-4 py-2 text-xs font-bold text-neutral-900">
              {ctaText}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default HeroSlidePreview
