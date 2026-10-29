import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type ThemeMode = 'light' | 'dark'

interface AppearanceState {
  mode: ThemeMode
  glass: number
  setMode: (mode: ThemeMode) => void
  toggleMode: () => void
  setGlass: (value: number) => void
}

const MODE_KEY = 'qcdsp:theme-mode'
const GLASS_KEY = 'qcdsp:glass-intensity'

const AppearanceContext = createContext<AppearanceState | null>(null)

function readMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem(MODE_KEY)
  if (stored === 'dark' || stored === 'light') return stored
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readGlass(): number {
  if (typeof window === 'undefined') return 60
  const stored = Number(window.localStorage.getItem(GLASS_KEY))
  if (Number.isFinite(stored) && stored >= 0 && stored <= 100) return stored
  return 60
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readMode)
  const [glass, setGlassState] = useState<number>(readGlass)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', mode === 'dark')
    root.style.colorScheme = mode
    window.localStorage.setItem(MODE_KEY, mode)
  }, [mode])

  useEffect(() => {
    const root = document.documentElement
    const normalized = Math.min(100, Math.max(0, Math.round(glass)))
    const alpha = 0.98 - (normalized / 100) * 0.55
    const blur = 6 + (normalized / 100) * 22
    const borderAlpha = 0.18 + (normalized / 100) * 0.42
    root.style.setProperty('--glass-alpha', alpha.toFixed(3))
    root.style.setProperty('--glass-blur', `${blur.toFixed(1)}px`)
    root.style.setProperty('--glass-border-alpha', borderAlpha.toFixed(3))
    root.dataset.glass = normalized >= 55 ? 'high' : normalized > 15 ? 'medium' : 'low'
    window.localStorage.setItem(GLASS_KEY, String(normalized))
  }, [glass])

  const setMode = useCallback((next: ThemeMode) => setModeState(next), [])
  const toggleMode = useCallback(
    () => setModeState((current) => (current === 'dark' ? 'light' : 'dark')),
    [],
  )
  const setGlass = useCallback((value: number) => {
    setGlassState(Math.min(100, Math.max(0, Math.round(value))))
  }, [])

  const value = useMemo<AppearanceState>(
    () => ({ mode, glass, setMode, toggleMode, setGlass }),
    [mode, glass, setMode, toggleMode, setGlass],
  )

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}

export function useAppearance(): AppearanceState {
  const context = useContext(AppearanceContext)
  if (!context) {
    throw new Error('useAppearance harus dipakai di dalam AppearanceProvider')
  }
  return context
}
