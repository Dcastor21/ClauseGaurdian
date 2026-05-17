'use client'

// components/cg/tweaks-panel.tsx — floating live-theme switcher.
// The design handoff shipped this as a design-tool host panel; in production it
// is a real, self-contained control surface backed by the CgThemeProvider.
import * as React from 'react'
import { useTweaks, type Aesthetic, type Density } from './theme'
import { Leaf } from './primitives'

const TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    background:rgba(250,249,247,.82);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:pointer;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}
  .twk-body::-webkit-scrollbar{width:8px}
  .twk-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:4px;
    border:2px solid transparent;background-clip:content-box}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}
  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:pointer;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}
  .twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
    background:rgba(0,0,0,.15);transition:background .15s;cursor:pointer;padding:0}
  .twk-toggle[data-on="1"]{background:#34c759}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(14px)}
  .twk-launch{position:fixed;right:16px;bottom:16px;z-index:2147483645;
    display:inline-flex;align-items:center;gap:7px;height:38px;padding:0 14px;border:0;
    border-radius:999px;cursor:pointer;color:#fff;
    background:rgba(41,38,27,.92);box-shadow:0 8px 24px rgba(0,0,0,.22);
    font:12px/1 ui-sans-serif,system-ui,sans-serif;font-weight:500}
  .twk-launch:hover{transform:translateY(-1px)}
`

function TweakSection({ label }: { label: string }) {
  return <div className="twk-sect">{label}</div>
}

function TweakRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="twk-row">
      <div className="twk-lbl">
        <span>{label}</span>
      </div>
      {children}
    </div>
  )
}

function TweakToggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="twk-row twk-row-h">
      <div className="twk-lbl">
        <span>{label}</span>
      </div>
      <button
        type="button"
        className="twk-toggle"
        data-on={value ? '1' : '0'}
        role="switch"
        aria-checked={!!value}
        onClick={() => onChange(!value)}
      >
        <i />
      </button>
    </div>
  )
}

function TweakRadio<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  const idx = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  )
  const n = options.length
  return (
    <TweakRow label={label}>
      <div className="twk-seg" role="radiogroup">
        <div
          className="twk-seg-thumb"
          style={{
            left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
            width: `calc((100% - 4px) / ${n})`,
          }}
        />
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </TweakRow>
  )
}

const AESTHETICS: { key: Aesthetic; label: string; sub: string }[] = [
  { key: 'garden', label: 'Garden', sub: 'Warm, opinionated' },
  { key: 'editorial', label: 'Editorial', sub: 'Cream, ink, serif-led' },
  { key: 'cool', label: 'Cool SaaS', sub: 'Refined blue' },
  { key: 'dense', label: 'Dense Pro', sub: 'Slate, compact' },
]

export function CgTweaksPanel() {
  const { t, setTweak } = useTweaks()
  const [open, setOpen] = React.useState(false)
  const dragRef = React.useRef<HTMLDivElement>(null)
  const offsetRef = React.useRef({ x: 16, y: 16 })

  const onDragStart = (e: React.MouseEvent) => {
    const panel = dragRef.current
    if (!panel) return
    const r = panel.getBoundingClientRect()
    const sx = e.clientX
    const sy = e.clientY
    const startRight = window.innerWidth - r.right
    const startBottom = window.innerHeight - r.bottom
    const move = (ev: MouseEvent) => {
      const x = Math.max(8, startRight - (ev.clientX - sx))
      const y = Math.max(8, startBottom - (ev.clientY - sy))
      offsetRef.current = { x, y }
      panel.style.right = x + 'px'
      panel.style.bottom = y + 'px'
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  if (!open) {
    return (
      <>
        <style>{TWEAKS_STYLE}</style>
        <button className="twk-launch" onClick={() => setOpen(true)} aria-label="Open theme tweaks">
          <Leaf size={13} />
          Tweaks
        </button>
      </>
    )
  }

  return (
    <>
      <style>{TWEAKS_STYLE}</style>
      <div
        ref={dragRef}
        className="twk-panel"
        style={{ right: offsetRef.current.x, bottom: offsetRef.current.y }}
      >
        <div className="twk-hd" onMouseDown={onDragStart}>
          <b>Tweaks</b>
          <button
            className="twk-x"
            aria-label="Close tweaks"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setOpen(false)}
          >
            ✕
          </button>
        </div>
        <div className="twk-body">
          <TweakSection label="Aesthetic" />
          <TweakRadio<Aesthetic>
            label="Direction"
            value={t.aesthetic}
            options={AESTHETICS.map((a) => ({ value: a.key, label: a.label }))}
            onChange={(v) => {
              const edits: Partial<typeof t> = { aesthetic: v }
              if (v === 'dense') edits.density = 'compact'
              else if (t.aesthetic === 'dense') edits.density = 'regular'
              setTweak(edits)
            }}
          />
          <p
            className="text-[10.5px] leading-snug"
            style={{ color: 'rgba(41,38,27,.55)', marginTop: -2 }}
          >
            {AESTHETICS.find((a) => a.key === t.aesthetic)?.sub}
          </p>

          <TweakSection label="Layout" />
          <TweakRadio<Density>
            label="Density"
            value={t.density}
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'regular', label: 'Regular' },
              { value: 'spacious', label: 'Spacious' },
            ]}
            onChange={(v) => setTweak('density', v)}
          />
          <TweakToggle
            label="Paper grain"
            value={!!t.showGrain}
            onChange={(v) => setTweak('showGrain', v)}
          />
          <TweakToggle label="Dark mode" value={!!t.dark} onChange={(v) => setTweak('dark', v)} />
        </div>
      </div>
    </>
  )
}
