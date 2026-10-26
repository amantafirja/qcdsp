import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Quote,
  Redo2,
  Table2,
  Underline,
  Undo2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { uploadArticleImage } from '@/hooks/use-api'
import { cn } from '@/lib/utils'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  error?: string
  placeholder?: string
}

const BLOCK_TAGS = new Set(['H1', 'H2', 'H3', 'P', 'BLOCKQUOTE', 'LI', 'TD', 'TH'])

export function RichTextEditor({ value, onChange, error, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [focused, setFocused] = useState(false)
  const lastValue = useRef(value)

  useEffect(() => {
    if (editorRef.current && value !== lastValue.current) {
      editorRef.current.innerHTML = value || ''
      lastValue.current = value
    }
  }, [value])

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML === '' && value) {
      editorRef.current.innerHTML = value
    }
  }, [value])

  const sync = useCallback(() => {
    if (!editorRef.current) return
    const html = editorRef.current.innerHTML
    lastValue.current = html
    onChange(html)
  }, [onChange])

  const exec = useCallback(
    (command: string, argument?: string) => {
      editorRef.current?.focus()
      document.execCommand(command, false, argument)
      sync()
    },
    [sync],
  )

  const formatBlock = (tag: string) => {
    editorRef.current?.focus()
    const selection = window.getSelection()
    let current = ''
    if (selection && selection.anchorNode) {
      let node: Node | null = selection.anchorNode
      while (node && node !== editorRef.current) {
        if (node.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((node as HTMLElement).tagName)) {
          current = (node as HTMLElement).tagName
          break
        }
        node = node.parentNode
      }
    }
    document.execCommand('formatBlock', false, current === tag ? 'p' : tag.toLowerCase())
    sync()
  }

  const insertTable = () => {
    const table = `<table><thead><tr><th>Header 1</th><th>Header 2</th></tr></thead><tbody><tr><td>Isi</td><td>Isi</td></tr><tr><td>Isi</td><td>Isi</td></tr></tbody></table><p><br/></p>`
    exec('insertHTML', table)
  }

  const insertLink = () => {
    const url = window.prompt('Masukkan URL tautan', 'https://')
    if (!url) return
    exec('createLink', url)
  }

  const handleImageUpload = async (file: File) => {
    setUploading(true)
    try {
      const url = await uploadArticleImage(file)
      if (!url) throw new Error('URL gambar tidak tersedia')
      exec('insertHTML', `<p><img src="${url}" alt="Gambar artikel" /></p>`)
      toast.success('Gambar berhasil disisipkan')
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : 'Gagal mengunggah gambar'
      toast.error(message)
    } finally {
      setUploading(false)
      if (imageInputRef.current) imageInputRef.current.value = ''
    }
  }

  const toolbarButton = (
    label: string,
    icon: React.ReactNode,
    action: () => void,
    options?: { disabled?: boolean },
  ) => (
    <button
      key={label}
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={action}
      disabled={options?.disabled}
      className="flex h-8 w-8 items-center justify-center rounded-md text-navy-600 transition-colors hover:bg-white hover:text-navy-900 hover:shadow-sm disabled:opacity-40"
    >
      {icon}
    </button>
  )

  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          'overflow-hidden rounded-lg border bg-white transition-colors',
          focused ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-input',
          error && 'border-destructive',
        )}
      >
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-navy-50/70 p-1.5">
          {toolbarButton('Heading 1', <Heading1 className="h-4 w-4" />, () => formatBlock('H1'))}
          {toolbarButton('Heading 2', <Heading2 className="h-4 w-4" />, () => formatBlock('H2'))}
          {toolbarButton('Heading 3', <Heading3 className="h-4 w-4" />, () => formatBlock('H3'))}
          <span className="mx-1 h-5 w-px bg-navy-200" />
          {toolbarButton('Bold', <Bold className="h-4 w-4" />, () => exec('bold'))}
          {toolbarButton('Italic', <Italic className="h-4 w-4" />, () => exec('italic'))}
          {toolbarButton('Underline', <Underline className="h-4 w-4" />, () => exec('underline'))}
          <span className="mx-1 h-5 w-px bg-navy-200" />
          {toolbarButton('Bullet list', <List className="h-4 w-4" />, () => exec('insertUnorderedList'))}
          {toolbarButton('Numbered list', <ListOrdered className="h-4 w-4" />, () => exec('insertOrderedList'))}
          {toolbarButton('Kutipan', <Quote className="h-4 w-4" />, () => formatBlock('BLOCKQUOTE'))}
          <span className="mx-1 h-5 w-px bg-navy-200" />
          {toolbarButton('Sisipkan tabel', <Table2 className="h-4 w-4" />, insertTable)}
          {toolbarButton('Sisipkan tautan', <Link2 className="h-4 w-4" />, insertLink)}
          {toolbarButton(
            'Unggah gambar',
            uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />,
            () => imageInputRef.current?.click(),
            { disabled: uploading },
          )}
          <span className="mx-1 h-5 w-px bg-navy-200" />
          {toolbarButton('Undo', <Undo2 className="h-4 w-4" />, () => exec('undo'))}
          {toolbarButton('Redo', <Redo2 className="h-4 w-4" />, () => exec('redo'))}

          <span className="ml-auto hidden pr-2 text-[11px] font-medium text-navy-400 sm:block">
            Rich Text Editor
          </span>
        </div>

        <div
          ref={editorRef}
          contentEditable
          role="textbox"
          aria-multiline="true"
          aria-label="Isi artikel"
          data-placeholder={placeholder ?? 'Tulis isi artikel di sini...'}
          onInput={sync}
          onBlur={() => {
            setFocused(false)
            sync()
          }}
          onFocus={() => setFocused(true)}
          onPaste={(event) => {
            event.preventDefault()
            const text = event.clipboardData.getData('text/plain')
            document.execCommand('insertText', false, text)
            sync()
          }}
          className={cn(
            'article-body min-h-[320px] max-w-none px-4 py-3 outline-none',
            'empty:before:pointer-events-none empty:before:text-navy-400 empty:before:content-[attr(data-placeholder)]',
          )}
        />

        <input
          ref={imageInputRef}
          type="file"
          accept=".jpg,.jpeg,.png"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void handleImageUpload(file)
          }}
        />
      </div>

      <div className="flex items-center justify-between">
        {error ? <p className="field-error">{error}</p> : <p className="field-hint">Mendukung heading, bullet list, tabel, gambar, dan tautan.</p>}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => imageInputRef.current?.click()}
          disabled={uploading}
        >
          <ImagePlus className="h-3.5 w-3.5" />
          Gambar
        </Button>
      </div>
    </div>
  )
}
