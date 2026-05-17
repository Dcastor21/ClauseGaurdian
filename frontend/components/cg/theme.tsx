'use client'

import * as React from 'react'

export type Aesthetic = 'garden' | 'editorial' | 'cool' | 'dense'
export type Density = 'compact' | 'regular' | 'spacious'

export interface Tweaks {
  aesthetic: Aesthetic
  density: Density
  showGrain: boolean
  dark: boolean
}

const DEFAULTS: Tweaks = {
  aesthetic: 'garden',
  density: 'regular',
  showGrain: true,
  dark: false,
}

const STORAGE_KEY = 'cg-tweaks'

interface TweaksCtx {
  t: Tweaks
  setTweak: (keyOrEdits: keyof Tweaks | Partial<Tweaks>, val?: unknown) => void
}

const Ctx = React.createContext<TweaksCtx | null>(null)

export function useTweaks(): TweaksCtx {
  const ctx = React.useContext(Ctx)
  if (!ctx) throw new Error('useTweaks must be used within <CgThemeProvider>')
  return ctx
}

function applyToDOM(t: Tweaks) {
  const el = document.documentElement
  el.dataset.aesthetic = t.aesthetic
  el.dataset.density = t.density
  if (t.showGrain === false) el.dataset.grain = 'off'
  else delete el.dataset.grain
  if (t.dark) el.dataset.theme = 'dark'
  else delete el.dataset.theme
}

export function CgThemeProvider({ children }: { children: React.ReactNode }) {
  const [t, setT] = React.useState<Tweaks>(DEFAULTS)

  // Hydrate from localStorage once on mount.
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setT({ ...DEFAULTS, ...JSON.parse(raw) })
    } catch {
      /* ignore malformed storage */
    }
  }, [])

  React.useEffect(() => {
    applyToDOM(t)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(t))
    } catch {
      /* storage may be unavailable */
    }
  }, [t])

  const setTweak = React.useCallback<TweaksCtx['setTweak']>((keyOrEdits, val) => {
    const edits =
      typeof keyOrEdits === 'object' && keyOrEdits !== null
        ? keyOrEdits
        : ({ [keyOrEdits as keyof Tweaks]: val } as Partial<Tweaks>)
    setT((prev) => ({ ...prev, ...edits }))
  }, [])

  return <Ctx.Provider value={{ t, setTweak }}>{children}</Ctx.Provider>
}
