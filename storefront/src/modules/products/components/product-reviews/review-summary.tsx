import { Star, StarHalf } from "@phosphor-icons/react/dist/ssr"
import type { ReviewStatsDTO } from "@lib/data/reviews"

type Props = {
  stats: ReviewStatsDTO
}

const Stars = ({ value }: { value: number }) => {
  const clamped = Math.max(0, Math.min(5, value))
  return (
    <div
      className="flex items-center gap-0.5 lg:gap-1 text-brand-accent"
      aria-label={`Notă medie ${clamped.toFixed(1)} din 5`}
    >
      {Array.from({ length: 5 }).map((_, i) => {
        const diff = clamped - i
        const cn = "w-4 h-4 lg:w-[22px] lg:h-[22px]"
        if (diff >= 0.75)
          return <Star key={i} weight="fill" className={cn} />
        if (diff >= 0.25)
          return <StarHalf key={i} weight="fill" className={cn} />
        return (
          <Star
            key={i}
            weight="regular"
            className={`${cn} opacity-25`}
          />
        )
      })}
    </div>
  )
}

const ReviewSummary = ({ stats }: Props) => {
  const total = stats.total
  const buckets = [5, 4, 3, 2, 1] as const

  if (total === 0) {
    return (
      <div className="bg-brand-light rounded-3xl lg:rounded-[2rem] p-6 lg:p-10 flex flex-col items-center text-center gap-3">
        <Stars value={0} />
        <h3 className="font-serif text-xl lg:text-2xl text-brand-dark">
          Nicio recenzie deocamdată
        </h3>
        <p className="text-sm text-brand-dark/60 max-w-md">
          Fii primul care împărtășește experiența cu acest produs.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-brand-light rounded-3xl lg:rounded-[2rem] p-6 lg:p-10">
      <div className="flex items-center gap-6 md:grid md:grid-cols-[auto_1fr] md:gap-12">
        <div className="flex flex-col items-center md:items-start gap-1.5 shrink-0">
          <span className="font-serif text-4xl lg:text-7xl text-brand-dark leading-none">
            {stats.average.toFixed(1)}
          </span>
          <Stars value={stats.average} />
          <span className="text-xs lg:text-sm text-brand-dark/60">
            {total} {total === 1 ? "recenzie" : "recenzii"}
          </span>
        </div>

        <div className="flex-1 flex flex-col gap-1.5 lg:gap-2 min-w-0">
          {buckets.map((b) => {
            const count = stats.distribution[String(b) as "1" | "2" | "3" | "4" | "5"]
            const pct = total > 0 ? Math.round((count / total) * 100) : 0
            return (
              <div key={b} className="grid grid-cols-[1ch_1fr_3ch] items-center gap-2 lg:gap-3">
                <span className="text-xs lg:text-sm text-brand-dark/70 tabular-nums">
                  {b}
                </span>
                <div
                  className="h-1.5 lg:h-2 bg-brand-dark/10 rounded-full overflow-hidden"
                  role="presentation"
                >
                  <div
                    className="h-full bg-brand-dark rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs lg:text-sm text-brand-dark/60 tabular-nums text-right">
                  {pct}%
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default ReviewSummary
