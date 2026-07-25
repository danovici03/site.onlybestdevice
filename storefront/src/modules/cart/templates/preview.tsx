"use client"

import repeat from "@lib/util/repeat"
import { isWarrantyLine, shouldOfferWarranty } from "@lib/util/warranty"
import { HttpTypes } from "@medusajs/types"
import { Table, clx } from "@medusajs/ui"

import Item from "@modules/cart/components/item"
import WarrantyOffer from "@modules/cart/components/warranty-offer"
import SkeletonLineItem from "@modules/skeletons/components/skeleton-line-item"
import { Fragment } from "react"

type ItemsTemplateProps = {
  cart: HttpTypes.StoreCart
  warranty?: HttpTypes.StoreProduct
}

const ItemsPreviewTemplate = ({ cart, warranty }: ItemsTemplateProps) => {
  const items = cart.items
  const hasOverflow = items && items.length > 4

  return (
    <div
      className={clx({
        "pl-[1px] overflow-y-scroll overflow-x-hidden no-scrollbar max-h-[420px]":
          hasOverflow,
      })}
    >
      <Table>
        <Table.Body data-testid="items-table">
          {items
            ? items
                .sort((a, b) => {
                  return (a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1
                })
                .map((item) => {
                  return (
                    <Fragment key={item.id}>
                      <Item
                        item={item}
                        type="preview"
                        currencyCode={cart.currency_code}
                        removable={isWarrantyLine(item)}
                      />
                      {/* Propunerea stă pe rândul ei, pe toată lățimea
                          rezumatului — coloana de titlu e prea îngustă și ar
                          sparge banda în trei rânduri. */}
                      {warranty && shouldOfferWarranty(item, cart) && (
                        // <tr>/<td> native: Table.Cell din @medusajs/ui nu
                        // acceptă colSpan în tipuri.
                        <tr>
                          <td colSpan={3} className="p-0 pb-3">
                            <WarrantyOffer
                              warranty={warranty}
                              item={item}
                              compact
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })
            : repeat(5).map((i) => {
                return <SkeletonLineItem key={i} />
              })}
        </Table.Body>
      </Table>
    </div>
  )
}

export default ItemsPreviewTemplate
