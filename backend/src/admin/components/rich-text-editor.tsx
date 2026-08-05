import {
  ArrowUturnLeft,
  Code,
  Link as LinkIcon,
  ListBullet,
  Photo,
  Trash,
} from "@medusajs/icons"
import {
  Button,
  IconButton,
  Input,
  Popover,
  Textarea,
  Tooltip,
  clx,
  toast,
} from "@medusajs/ui"
import { EditorContent, useEditor, useEditorState } from "@tiptap/react"
import { useCallback, useEffect, useRef, useState } from "react"

import { isSanitizerSafeUrl, uploadImages } from "../lib/admin-uploads"
import { buildExtensions } from "./rich-text-editor-extensions"

/**
 * Editor de text bogat pentru câmpurile HTML din Admin (deocamdată descrierea
 * de produs, dar componenta nu știe nimic despre produse).
 *
 * Două moduri pe aceeași valoare: WYSIWYG și HTML brut. Modul HTML nu e un
 * moft — descrierile se lipesc adesea din pagina altui magazin, iar
 * sanitizatorul de la salvare le curăță oricum.
 */

type Props = {
  value: string
  onChange: (html: string) => void
  disabled?: boolean
  /** Pornește direct în modul HTML (ex. markup pe care editorul l-ar aplatiza). */
  initialHtmlMode?: boolean
  minHeight?: string
}

const RichTextEditor = ({
  value,
  onChange,
  disabled,
  initialHtmlMode = false,
  minHeight = "24rem",
}: Props) => {
  const [htmlMode, setHtmlMode] = useState(initialHtmlMode)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  /** Ce face fișierul ales: se inserează sau înlocuiește poza selectată. */
  const pickerIntent = useRef<"insert" | "replace">("insert")

  const editor = useEditor({
    extensions: buildExtensions(),
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    // Descrierile ajung la 100k caractere; fără asta, fiecare tastă ar
    // re-randa tot arborele React al widgetului.
    shouldRerenderOnTransaction: false,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      handlePaste: (_view, event) => insertDroppedFiles(event.clipboardData),
      handleDrop: (_view, event) =>
        insertDroppedFiles((event as DragEvent).dataTransfer),
    },
  })

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            h2: e.isActive("heading", { level: 2 }),
            h3: e.isActive("heading", { level: 3 }),
            bulletList: e.isActive("bulletList"),
            orderedList: e.isActive("orderedList"),
            link: e.isActive("link"),
            image: e.isActive("image"),
            imageAlt: (e.getAttributes("image")?.alt ?? "") as string,
            canUndo: e.can().undo(),
            canRedo: e.can().redo(),
          }
        : null,
  })

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [editor, disabled])

  /**
   * Valoarea venită din afară (încărcarea inițială, textul sanitizat după
   * salvare, ieșirea din modul HTML) trebuie dusă în editor.
   *
   * La tastare nu se întâmplă nimic: `onChange` primește exact `getHTML()`,
   * deci comparația iese egală. În modul HTML editorul e ascuns și ar fi doar
   * risipă să-l resincronizăm la fiecare tastă — o facem la ieșire.
   */
  useEffect(() => {
    if (!editor || htmlMode) return
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [editor, value, htmlMode])

  const uploadAndInsert = useCallback(
    async (files: File[], mode: "insert" | "replace") => {
      if (!editor || !files.length) return
      setUploading(true)
      try {
        const urls = await uploadImages(files)
        if (mode === "replace" && editor.isActive("image")) {
          editor.chain().focus().updateAttributes("image", {
            src: urls[0],
            width: null,
            height: null,
          }).run()
        } else {
          editor
            .chain()
            .focus()
            .insertContent(urls.map((src) => ({ type: "image", attrs: { src } })))
            .run()
        }
        toast.success(urls.length > 1 ? "Imagini încărcate" : "Imagine încărcată")
      } catch (err: any) {
        toast.error(err.message || "Încărcarea a eșuat")
      } finally {
        setUploading(false)
      }
    },
    [editor]
  )

  /** Poze lipite sau trase în editor — orice altceva merge pe calea normală. */
  function insertDroppedFiles(data: DataTransfer | null): boolean {
    const files = Array.from(data?.files ?? []).filter((f) =>
      f.type.startsWith("image/")
    )
    if (!files.length) return false
    void uploadAndInsert(files, "insert")
    return true
  }

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (fileInputRef.current) fileInputRef.current.value = ""
    await uploadAndInsert(files, pickerIntent.current)
  }

  const openPicker = (intent: "insert" | "replace") => {
    pickerIntent.current = intent
    fileInputRef.current?.click()
  }

  if (!editor) {
    return null
  }

  const busy = disabled || uploading

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onPickFile}
      />

      <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-ui-bg-subtle p-1">
        {!htmlMode && (
          <>
            <ToolbarButton
              label="Îngroșat"
              active={state?.bold}
              disabled={busy}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <span className="font-bold">B</span>
            </ToolbarButton>
            <ToolbarButton
              label="Cursiv"
              active={state?.italic}
              disabled={busy}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <span className="italic font-serif">I</span>
            </ToolbarButton>

            <Separator />

            <ToolbarButton
              label="Subtitlu"
              active={state?.h2}
              disabled={busy}
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 2 }).run()
              }
            >
              <span className="text-xs font-semibold">H2</span>
            </ToolbarButton>
            <ToolbarButton
              label="Sub-subtitlu"
              active={state?.h3}
              disabled={busy}
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 3 }).run()
              }
            >
              <span className="text-xs font-semibold">H3</span>
            </ToolbarButton>

            <Separator />

            <ToolbarButton
              label="Listă cu buline"
              active={state?.bulletList}
              disabled={busy}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              <ListBullet />
            </ToolbarButton>
            <ToolbarButton
              label="Listă numerotată"
              active={state?.orderedList}
              disabled={busy}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              <span className="text-xs font-semibold">1.</span>
            </ToolbarButton>

            <Separator />

            <LinkButton editor={editor} active={state?.link} disabled={busy} />
            <ImageButton
              disabled={busy}
              onUpload={() => openPicker("insert")}
              onUrl={(url) =>
                editor.chain().focus().setImage({ src: url }).run()
              }
            />

            <Separator />

            <ToolbarButton
              label="Anulează"
              disabled={busy || !state?.canUndo}
              onClick={() => editor.chain().focus().undo().run()}
            >
              <ArrowUturnLeft />
            </ToolbarButton>
            <ToolbarButton
              label="Refă"
              disabled={busy || !state?.canRedo}
              onClick={() => editor.chain().focus().redo().run()}
            >
              <ArrowUturnLeft className="-scale-x-100" />
            </ToolbarButton>
          </>
        )}

        <div className="ml-auto">
          <ToolbarButton
            label={htmlMode ? "Înapoi la editor" : "Editează HTML-ul brut"}
            active={htmlMode}
            disabled={busy}
            onClick={() => setHtmlMode((m) => !m)}
          >
            <Code />
          </ToolbarButton>
        </div>
      </div>

      {state?.image && !htmlMode && (
        <ImageActions
          alt={state.imageAlt}
          disabled={busy}
          onAlt={(alt) =>
            editor.chain().focus().updateAttributes("image", { alt }).run()
          }
          onReplace={() => openPicker("replace")}
          onDelete={() => editor.chain().focus().deleteSelection().run()}
        />
      )}

      {htmlMode ? (
        <Textarea
          value={value}
          disabled={busy}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-xs"
          style={{ minHeight }}
        />
      ) : (
        <EditorContent
          editor={editor}
          style={{ minHeight }}
          className={clx(
            "rounded-lg border bg-ui-bg-field px-4 py-3 text-ui-fg-base",
            "[&_.ProseMirror]:outline-none [&_.ProseMirror]:leading-relaxed",
            "[&_.ProseMirror_p]:my-2",
            "[&_.ProseMirror_h2]:mb-2 [&_.ProseMirror_h2]:mt-4 [&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h2]:font-semibold",
            "[&_.ProseMirror_h3]:mb-2 [&_.ProseMirror_h3]:mt-4 [&_.ProseMirror_h3]:text-base [&_.ProseMirror_h3]:font-semibold",
            "[&_.ProseMirror_ul]:my-2 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6",
            "[&_.ProseMirror_ol]:my-2 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6",
            "[&_.ProseMirror_a]:text-ui-fg-interactive [&_.ProseMirror_a]:underline",
            "[&_.ProseMirror_figure]:my-4 [&_.ProseMirror_img]:mx-auto [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:rounded-lg",
            "[&_.ProseMirror-selectednode]:outline [&_.ProseMirror-selectednode]:outline-2 [&_.ProseMirror-selectednode]:outline-ui-fg-interactive",
            busy && "opacity-60"
          )}
        />
      )}
    </div>
  )
}

const Separator = () => <div className="mx-1 h-5 w-px bg-ui-border-base" />

const ToolbarButton = ({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) => (
  <Tooltip content={label}>
    <IconButton
      type="button"
      size="small"
      variant="transparent"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={clx(active && "bg-ui-bg-base-pressed text-ui-fg-base")}
    >
      {children}
    </IconButton>
  </Tooltip>
)

/** Link: adaugă/înlocuiește pe selecție, sau îl scoate. */
const LinkButton = ({
  editor,
  active,
  disabled,
}: {
  editor: NonNullable<ReturnType<typeof useEditor>>
  active?: boolean
  disabled?: boolean
}) => {
  const [open, setOpen] = useState(false)
  const [href, setHref] = useState("")

  const apply = () => {
    const url = href.trim()
    if (!url) return
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
    setOpen(false)
    setHref("")
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setHref((editor.getAttributes("link")?.href as string) ?? "")
      }}
    >
      <Popover.Trigger asChild>
        <IconButton
          type="button"
          size="small"
          variant="transparent"
          aria-label="Link"
          disabled={disabled}
          className={clx(active && "bg-ui-bg-base-pressed")}
        >
          <LinkIcon />
        </IconButton>
      </Popover.Trigger>
      <Popover.Content className="p-3">
        <div className="flex flex-col gap-2">
          <Input
            autoFocus
            placeholder="https://…"
            value={href}
            onChange={(e) => setHref(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), apply())}
          />
          <div className="flex justify-between gap-2">
            <Button
              size="small"
              variant="secondary"
              type="button"
              disabled={!active}
              onClick={() => {
                editor.chain().focus().extendMarkRange("link").unsetLink().run()
                setOpen(false)
              }}
            >
              Scoate
            </Button>
            <Button size="small" type="button" onClick={apply}>
              Aplică
            </Button>
          </div>
        </div>
      </Popover.Content>
    </Popover>
  )
}

/** Imagine: din fișier sau după URL (pozele vechi sunt hotlinkate). */
const ImageButton = ({
  disabled,
  onUpload,
  onUrl,
}: {
  disabled?: boolean
  onUpload: () => void
  onUrl: (url: string) => void
}) => {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState("")

  const apply = () => {
    const value = url.trim()
    if (!value) return
    // Aceeași verificare ca la upload: altfel poza s-ar vedea în editor și ar
    // dispărea la salvare, fiindcă sanitizatorul refuză sursa.
    if (!isSanitizerSafeUrl(value)) {
      toast.error("URL neacceptat — trebuie să înceapă cu http:// sau https://")
      return
    }
    onUrl(value)
    setOpen(false)
    setUrl("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <IconButton
          type="button"
          size="small"
          variant="transparent"
          aria-label="Imagine"
          disabled={disabled}
        >
          <Photo />
        </IconButton>
      </Popover.Trigger>
      <Popover.Content className="p-3">
        <div className="flex w-80 flex-col gap-2">
          <Button
            size="small"
            variant="secondary"
            type="button"
            onClick={() => {
              setOpen(false)
              onUpload()
            }}
          >
            Încarcă de pe calculator
          </Button>
          <div className="flex items-center gap-2">
            <Input
              placeholder="sau lipește un URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && (e.preventDefault(), apply())
              }
            />
            <Button size="small" type="button" onClick={apply}>
              Adaugă
            </Button>
          </div>
        </div>
      </Popover.Content>
    </Popover>
  )
}

/** Bara care apare când e selectată o poză. */
const ImageActions = ({
  alt,
  disabled,
  onAlt,
  onReplace,
  onDelete,
}: {
  alt: string
  disabled?: boolean
  onAlt: (alt: string) => void
  onReplace: () => void
  onDelete: () => void
}) => (
  <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-ui-bg-subtle px-3 py-2">
    <span className="text-xs text-ui-fg-subtle">Poza selectată</span>
    <Input
      size="small"
      className="max-w-xs"
      placeholder="Text alternativ (pentru SEO și cititoare de ecran)"
      value={alt}
      disabled={disabled}
      onChange={(e) => onAlt(e.target.value)}
    />
    <Button
      size="small"
      variant="secondary"
      type="button"
      disabled={disabled}
      onClick={onReplace}
    >
      Înlocuiește
    </Button>
    <Button
      size="small"
      variant="danger"
      type="button"
      disabled={disabled}
      onClick={onDelete}
    >
      <Trash />
      Șterge
    </Button>
  </div>
)

export default RichTextEditor
