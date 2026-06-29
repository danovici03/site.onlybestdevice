import repeat from "@lib/util/repeat"
import SkeletonProductCard from "@modules/skeletons/components/skeleton-product-card"

const SkeletonProductGrid = ({
  numberOfProducts = 8,
}: {
  numberOfProducts?: number
}) => {
  return (
    <ul
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-12 w-full"
      data-testid="products-list-loader"
    >
      {repeat(numberOfProducts).map((index) => (
        <li key={index}>
          <SkeletonProductCard />
        </li>
      ))}
    </ul>
  )
}

export default SkeletonProductGrid
