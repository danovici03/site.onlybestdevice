import { Suspense } from "react"

import SideMenuCartCount from "@modules/layout/components/side-menu/cart-count"
import BottomNavClient from "./bottom-nav-client"

export default function BottomNav() {
  return (
    <BottomNavClient
      cartIndicator={
        <Suspense fallback={null}>
          <SideMenuCartCount />
        </Suspense>
      }
    />
  )
}
