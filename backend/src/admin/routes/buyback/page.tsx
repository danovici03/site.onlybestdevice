import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ArrowPath } from "@medusajs/icons"
import { Container, Heading, Tabs, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"

import { CalculatorTab } from "../../components/buyback/calculator-tab"
import { OrdersTab } from "../../components/buyback/orders-tab"
import { PricesTab } from "../../components/buyback/prices-tab"
import { RulesTab } from "../../components/buyback/rules-tab"
import { api, type BuybackDevice } from "../../components/buyback/shared"

/**
 * Preluarea telefoanelor de la clienți (buyback): prețurile de bază pe model și
 * stocare, regulile de scădere și un calculator care arată exact oferta pe
 * care o primește clientul. Logica de calcul: `lib/buyback/pricing.ts`.
 */
const BuybackPage = () => {
  const [devices, setDevices] = useState<BuybackDevice[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const data = await api<{ devices: BuybackDevice[] }>("/admin/buyback/devices")
      setDevices(data.devices)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading>Preluare telefoane</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Cât plătim pe telefoanele aduse de clienți — prin transfer bancar sau
          voucher pe site cu bonus.
        </Text>
      </div>
      <Tabs defaultValue="orders">
        <div className="px-6 py-3">
          <Tabs.List>
            <Tabs.Trigger value="orders">Preluări</Tabs.Trigger>
            <Tabs.Trigger value="prices">Prețuri</Tabs.Trigger>
            <Tabs.Trigger value="rules">Reguli</Tabs.Trigger>
            <Tabs.Trigger value="calculator">Calculator</Tabs.Trigger>
          </Tabs.List>
        </div>
        <Tabs.Content value="orders">
          <OrdersTab />
        </Tabs.Content>
        <Tabs.Content value="prices">
          {loading ? (
            <Text size="small" className="text-ui-fg-subtle px-6 py-8">
              Se încarcă…
            </Text>
          ) : (
            <PricesTab devices={devices} reload={load} />
          )}
        </Tabs.Content>
        <Tabs.Content value="rules">
          <RulesTab devices={devices} />
        </Tabs.Content>
        <Tabs.Content value="calculator">
          <CalculatorTab devices={devices} />
        </Tabs.Content>
      </Tabs>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Preluare telefoane",
  icon: ArrowPath,
})

export default BuybackPage
