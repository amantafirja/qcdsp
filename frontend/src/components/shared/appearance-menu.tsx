import { Moon, SlidersHorizontal, Sparkles, Sun } from 'lucide-react'
import { useAppearance } from '@/contexts/appearance-context'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const PRESETS = [
  { label: 'Solid', value: 10 },
  { label: 'Seimbang', value: 60 },
  { label: 'Transparan', value: 100 },
]

export function AppearanceMenu({ compact = false }: { compact?: boolean }) {
  const { mode, glass, setMode, setGlass } = useAppearance()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? 'icon' : 'sm'}
          className={cn('text-navy-600 hover:text-navy-900', !compact && 'gap-2')}
          aria-label="Pengaturan tampilan"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {!compact && <span className="hidden sm:inline">Tampilan</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-3">
        <DropdownMenuLabel className="px-1 pb-2 pt-0 text-sm font-semibold text-navy-900">
          Tampilan
        </DropdownMenuLabel>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setMode('light')}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              mode === 'light'
                ? 'border-primary-300 bg-primary-50 text-primary-800'
                : 'border-navy-200 text-navy-600 hover:bg-navy-50',
            )}
            aria-pressed={mode === 'light'}
          >
            <Sun className="h-4 w-4" />
            Terang
          </button>
          <button
            type="button"
            onClick={() => setMode('dark')}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              mode === 'dark'
                ? 'border-primary-300 bg-primary-50 text-primary-800'
                : 'border-navy-200 text-navy-600 hover:bg-navy-50',
            )}
            aria-pressed={mode === 'dark'}
          >
            <Moon className="h-4 w-4" />
            Gelap
          </button>
        </div>

        <DropdownMenuSeparator className="my-3" />

        <div className="px-1">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-medium text-navy-800">
              <Sparkles className="h-3.5 w-3.5 text-primary-600" />
              Efek kaca
            </span>
            <span className="text-sm font-semibold tabular-nums text-navy-500">{glass}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={glass}
            onChange={(event) => setGlass(Number(event.target.value))}
            className="glass-slider mt-3"
            aria-label="Intensitas efek kaca"
          />
          <div className="mt-1 flex justify-between text-sm text-navy-400">
            <span>Solid</span>
            <span>Transparan</span>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setGlass(preset.value)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-sm font-medium transition-colors',
                  glass === preset.value
                    ? 'border-primary-300 bg-primary-50 text-primary-800'
                    : 'border-navy-200 text-navy-600 hover:bg-navy-50',
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
