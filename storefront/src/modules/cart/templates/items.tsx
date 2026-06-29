import repeat from "@lib/util/repeat"
import { HttpTypes } from "@medusajs/types"

import Item from "@modules/cart/components/item"
import SkeletonLineItem from "@modules/skeletons/components/skeleton-line-item"

type ItemsTemplateProps = {
  cart?: HttpTypes.StoreCart
}

const ItemsTemplate = ({ cart }: ItemsTemplateProps) => {
  const items = cart?.items

  return (
    <div className="bg-white rounded-3xl p-4 sm:p-6 lg:p-8 shadow-sm">
      <div className="hidden sm:grid grid-cols-[1fr_180px_140px] gap-4 pb-4 mb-4 border-b border-brand-dark/10 text-xs uppercase tracking-[0.18em] font-bold text-brand-dark/50">
        <span>Produs</span>
        <span className="text-center">Cantitate</span>
        <span className="text-right">Total</span>
      </div>

      <ul className="flex flex-col divide-y divide-brand-dark/10">
        {items
          ? items
              .sort((a, b) =>
                (a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1
              )
              .map((item) => (
                <Item
                  key={item.id}
                  item={item}
                  currencyCode={cart?.currency_code}
                />
              ))
          : repeat(3).map((i) => <SkeletonLineItem key={i} />)}
      </ul>
    </div>
  )
}

export default ItemsTemplate
