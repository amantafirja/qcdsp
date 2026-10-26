import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, X, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface SearchInputProps {
  placeholder?: string
  className?: string
  defaultValue?: string
  value?: string
  onChange?: (value: string) => void
  onSubmit?: (value: string) => void
  debounceMs?: number
  autoFocus?: boolean
  syncUrlParam?: string
  isLoading?: boolean
}

export function SearchInput({
  placeholder = 'Cari...',
  className,
  defaultValue = '',
  value,
  onChange,
  onSubmit,
  debounceMs = 400,
  autoFocus,
  syncUrlParam,
  isLoading,
}: SearchInputProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initial = syncUrlParam ? (searchParams.get(syncUrlParam) ?? defaultValue) : defaultValue
  const [internal, setInternal] = useState(value ?? initial)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const isControlled = value !== undefined

  useEffect(() => {
    if (isControlled) setInternal(value as string)
  }, [value, isControlled])

  useEffect(() => {
    if (!isControlled && syncUrlParam) {
      const current = searchParams.get(syncUrlParam) ?? defaultValue
      setInternal((previous) => (previous === current ? previous : current))
    }
  }, [searchParams, syncUrlParam, defaultValue, isControlled])

  const commit = (next: string) => {
    if (syncUrlParam) {
      const params = new URLSearchParams(searchParams)
      if (next) params.set(syncUrlParam, next)
      else params.delete(syncUrlParam)
      params.delete('page')
      navigate({ search: params.toString() }, { replace: true })
    }
    onSubmit?.(next)
  }

  const handleChange = (next: string) => {
    if (!isControlled) setInternal(next)
    onChange?.(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => commit(next), debounceMs)
  }

  const handleClear = () => {
    if (timer.current) clearTimeout(timer.current)
    if (!isControlled) setInternal('')
    onChange?.('')
    commit('')
  }

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" />
      <Input
        value={internal}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            if (timer.current) clearTimeout(timer.current)
            commit(internal)
          }
        }}
        placeholder={placeholder}
        className="h-10 pl-9 pr-9"
        autoFocus={autoFocus}
        aria-label={placeholder}
      />
      {isLoading ? (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-navy-400" />
      ) : (
        internal && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-navy-400 transition-colors hover:bg-navy-100 hover:text-navy-700"
            aria-label="Hapus pencarian"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )
      )}
    </div>
  )
}
