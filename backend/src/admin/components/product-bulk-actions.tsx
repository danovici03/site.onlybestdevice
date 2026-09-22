import { EllipsisHorizontal, Trash, XMarkMini } from "@medusajs/icons"
import {
  Button,
  DropdownMenu,
  Drawer,
  IconButton,
  Label,
  Select,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useState } from "react"

/**
 * Bara de acțiuni în masă a listei de produse: apare jos, peste listă, cât
 * timp e ceva bifat. Acțiunile merg prin `POST /admin/product-bulk`.
 *
 * Nu e `CommandBar`-ul din @medusajs/ui: acela leagă scurtături de o literă la
 * nivelul întregii pagini, iar aici, cu câmpul de căutare deasupra, un „d"
 * tastat în căutare ar trece produsele în ciornă.
 */

type Action =
  | "publish"
  | "draft"
  | "hide"
  | "show"
  | "category_add"
  | "category_remove"
  | "category_set"
  | "delete"

type CategoryMode = "category_add" | "category_remove" | "category_set"

const CATEGORY_MODES: Record<CategoryMode, { title: string; button: string; hint: string }> = {
  category_add: {
    title: "Adaugă în categorie",
    button: "Adaugă",
    hint: "Produsele rămân și în categoriile în care sunt deja.",
  },
  category_remove: {
    title: "Scoate din categorie",
    button: "Scoate",
    hint: "Celelalte categorii ale produselor rămân neatinse.",
  },
  category_set: {
    title: "Mută în categorie",
    button: "Mută",
    hint: "Produsele ies din toate categoriile lor și rămân doar în aceasta.",
  },
}

const DONE_MESSAGE: Record<Action, string> = {
  publish: "publicate",
  draft: "trecute în ciornă",
  hide: "ascunse din magazin",
  show: "vizibile în magazin",
  category_add: "adăugate în categorie",
  category_remove: "scoase din categorie",
  category_set: "mutate în categorie",
  delete: "șterse",
}

const plural = (n: number) => (n === 1 ? "1 produs" : `${n} produse`)

const ProductBulkActions = ({
  ids,
  categories,
  onClear,
  onDone,
}: {
  ids: string[]
  categories: { id: string; name: string; depth: number }[]
  onClear: () => void
  onDone: () => void
}) => {
  const prompt = usePrompt()
  const [running, setRunning] = useState<Action | null>(null)
  const [categoryMode, setCategoryMode] = useState<CategoryMode | null>(null)
  const [categoryId, setCategoryId] = useState<string>("")

  if (!ids.length) return null

  const run = async (action: Action, categoryIdArg?: string) => {
    setRunning(action)
    try {
      const res = await fetch("/admin/product-bulk", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action, category_id: categoryIdArg }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.message || `Cererea a eșuat: ${res.status}`)

      toast.success(`${plural(body.done)} ${DONE_MESSAGE[action]}`, {
        description: body.skipped
          ? `${plural(body.skipped)} sărite (produsul de serviciu „Garanție extinsă” sau produse deja șterse).`
          : undefined,
      })
      setCategoryMode(null)
      onDone()
    } catch (err: any) {
      toast.error(err.message)
      // O oprire la jumătate lasă o parte aplicată — lista trebuie să arate asta.
      onDone()
    } finally {
      setRunning(null)
    }
  }

  const confirmThen = async (
    action: Action,
    title: string,
    description: string,
    confirmText: string,
    danger = false
  ) => {
    const ok = await prompt({
      title,
      description,
      confirmText,
      cancelText: "Anulează",
      variant: danger ? "danger" : "confirmation",
    })
    if (ok) await run(action)
  }

  const openCategory = (mode: CategoryMode) => {
    setCategoryId("")
    setCategoryMode(mode)
  }

  const n = plural(ids.length)

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-8 z-50 flex justify-center px-4">
        <div className="bg-ui-bg-component shadow-elevation-flyout pointer-events-auto flex flex-wrap items-center gap-1 rounded-xl p-1.5">
          <Text size="small" weight="plus" className="px-3">
            {ids.length} selectate
          </Text>
          <IconButton size="small" variant="transparent" onClick={onClear} aria-label="Deselectează">
            <XMarkMini />
          </IconButton>
          <div className="bg-ui-border-base mx-1 h-5 w-px" />

          <Button
            size="small"
            variant="transparent"
            isLoading={running === "publish"}
            disabled={!!running}
            onClick={() =>
              confirmThen("publish", `Publici ${n}?`, "Produsele apar în magazin.", "Publică")
            }
          >
            Publică
          </Button>
          <Button
            size="small"
            variant="transparent"
            isLoading={running === "draft"}
            disabled={!!running}
            onClick={() =>
              confirmThen(
                "draft",
                `Treci ${n} în ciornă?`,
                "Produsele dispar din magazin (inclusiv pagina lor) până le publici din nou.",
                "Trece în ciornă"
              )
            }
          >
            Ciornă
          </Button>

          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <Button size="small" variant="transparent" disabled={!!running}>
                Categorie
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content side="top">
              <DropdownMenu.Item onClick={() => openCategory("category_add")}>
                Adaugă în categorie…
              </DropdownMenu.Item>
              <DropdownMenu.Item onClick={() => openCategory("category_remove")}>
                Scoate din categorie…
              </DropdownMenu.Item>
              <DropdownMenu.Item onClick={() => openCategory("category_set")}>
                Mută în categorie…
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <IconButton size="small" variant="transparent" disabled={!!running} aria-label="Mai multe">
                <EllipsisHorizontal />
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content side="top" align="end">
              <DropdownMenu.Item
                onClick={() =>
                  confirmThen(
                    "hide",
                    `Ascunzi ${n} din magazin?`,
                    "Produsele rămân publicate (pagina lor merge prin link), dar nu mai apar în liste, căutare și categorii.",
                    "Ascunde"
                  )
                }
              >
                Ascunde din liste
              </DropdownMenu.Item>
              <DropdownMenu.Item onClick={() => run("show")}>Arată în liste</DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item
                className="text-ui-fg-error"
                onClick={() =>
                  confirmThen(
                    "delete",
                    `Ștergi ${n}?`,
                    "Produsele se șterg din magazin cu tot cu variantele lor. Nu se poate anula din admin.",
                    "Șterge",
                    true
                  )
                }
              >
                <Trash />
                Șterge
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>
      </div>

      <Drawer open={!!categoryMode} onOpenChange={(open) => !open && setCategoryMode(null)}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>{categoryMode ? CATEGORY_MODES[categoryMode].title : ""}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-4">
            <Text size="small" className="text-ui-fg-subtle">
              {n} selectate. {categoryMode ? CATEGORY_MODES[categoryMode].hint : ""}
            </Text>
            <div className="flex flex-col gap-2">
              <Label size="small">Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <Select.Trigger>
                  <Select.Value placeholder="Alege categoria" />
                </Select.Trigger>
                <Select.Content>
                  {categories.map((c) => (
                    <Select.Item key={c.id} value={c.id}>
                      {`${"   ".repeat(c.depth)}${c.name}`}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button variant="secondary">Anulează</Button>
            </Drawer.Close>
            <Button
              disabled={!categoryId}
              isLoading={!!running}
              onClick={() => categoryMode && run(categoryMode, categoryId)}
            >
              {categoryMode ? CATEGORY_MODES[categoryMode].button : ""}
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </>
  )
}

export default ProductBulkActions
