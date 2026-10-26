import { useCallback, useState } from 'react'
import { FileUp, Trash2, UploadCloud } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatFileSize } from '@/lib/format'
import { MAX_UPLOAD_BYTES } from '@/lib/constants'

interface FileUploadProps {
  id?: string
  label?: string
  hint?: string
  accept?: string[]
  required?: boolean
  error?: string
  value?: File | null
  existingName?: string | null
  onChange: (file: File | null) => void
  disabled?: boolean
}

export function FileUpload({
  id,
  label = 'Unggah file',
  hint,
  accept = ['.pdf', '.jpg', '.jpeg', '.png'],
  required,
  error,
  value,
  existingName,
  onChange,
  disabled,
}: FileUploadProps) {
  const [dragging, setDragging] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const validate = useCallback(
    (file: File): boolean => {
      setLocalError(null)
      const lowerName = file.name.toLowerCase()
      const allowed = accept.some((ext) => lowerName.endsWith(ext.toLowerCase()))
      if (!allowed) {
        setLocalError(`Format file harus ${accept.join(', ')}`)
        return false
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        setLocalError('Ukuran file maksimal 10 MB')
        return false
      }
      return true
    },
    [accept],
  )

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    if (!validate(file)) {
      onChange(null)
      return
    }
    onChange(file)
  }

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="field-label block">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </label>
      )}

      <div
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          if (!disabled) handleFiles(event.dataTransfer.files)
        }}
        className={cn(
          'relative rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors',
          dragging ? 'border-primary-400 bg-primary-50/60' : 'border-navy-200 bg-navy-50/40',
          (error || localError) && 'border-destructive/60 bg-rose-50/40',
          disabled && 'opacity-60',
        )}
      >
        <input
          id={id}
          type="file"
          accept={accept.join(',')}
          disabled={disabled}
          onChange={(event) => handleFiles(event.target.files)}
          className="sr-only"
        />

        {value ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-700">
              <FileUp className="h-5 w-5" />
            </div>
            <div>
              <p className="max-w-[260px] truncate text-sm font-medium text-navy-900">{value.name}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(value.size)}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                onChange(null)
                setLocalError(null)
              }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Hapus file
            </button>
          </div>
        ) : (
          <label htmlFor={id} className={cn('flex cursor-pointer flex-col items-center gap-2', disabled && 'cursor-not-allowed')}>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-navy-500 shadow-sm ring-1 ring-navy-100">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-navy-800">
                <span className="text-primary-700">Pilih file</span> atau tarik ke sini
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {existingName ? `File saat ini: ${existingName}` : `Format ${accept.join(', ')} · maks 10 MB`}
              </p>
            </div>
          </label>
        )}
      </div>

      {hint && !error && !localError && <p className="field-hint">{hint}</p>}
      {(error || localError) && <p className="field-error">{error || localError}</p>}
    </div>
  )
}
