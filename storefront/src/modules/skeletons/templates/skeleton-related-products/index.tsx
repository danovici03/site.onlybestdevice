import repeat from "@lib/util/repeat"
import SkeletonProductCard from "@modules/skeletons/components/skeleton-product-card"

const SkeletonRelatedProducts = () => {
  return (
    <div className="flex flex-col gap-5 sm:gap-8">
      <div className="flex flex-col gap-2">
        <div className="h-9 sm:h-11 w-72 max-w-full rounded-full bg-brand-dark/[0.06] animate-pulse" />
        <div className="h-4 w-56 max-w-full rounded-full bg-brand-dark/[0.06] animate-pulse" />
      </div>
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 w-full">
        {repeat(4).map((index) => (
          <li key={index} className="h-full">
            <SkeletonProductCard />
          </li>
        ))}
      </ul>
    </div>
  )
}

export default SkeletonRelatedProducts
