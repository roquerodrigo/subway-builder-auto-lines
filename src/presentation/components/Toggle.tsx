import { h } from '@/infrastructure/ui/react'

const TRACK_WIDTH = 36
const TRACK_HEIGHT = 20
const KNOB_SIZE = 16
const KNOB_INSET = 2

export interface ToggleProps {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}

// A switch matching the game's surfaces: label on the left, switch on the right.
// The game serves a pre-built stylesheet, so only the utility classes it already
// uses exist — `top-0.5` and `left-[1.125rem]` silently do nothing there, which
// left the knob outside its track. Geometry is inline for that reason; colors stay
// on classes the game's own UI proves are there.
export function Toggle({ checked, label, onChange }: ToggleProps): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-primary/5 border border-border px-3 py-2 text-sm">
      <span className="font-semibold">{label}</span>
      <button
        aria-checked={checked}
        aria-label={label}
        className={
          'shrink-0 rounded-full cursor-pointer transition-colors ' + (checked ? 'bg-primary' : 'bg-primary/20')
        }
        onClick={() => onChange(!checked)}
        role="switch"
        style={{ height: TRACK_HEIGHT, position: 'relative', width: TRACK_WIDTH }}
        type="button"
      >
        <span
          className="rounded-full bg-primary-foreground"
          style={{
            height: KNOB_SIZE,
            left: checked ? TRACK_WIDTH - KNOB_SIZE - KNOB_INSET : KNOB_INSET,
            position: 'absolute',
            top: (TRACK_HEIGHT - KNOB_SIZE) / 2,
            transition: 'left 150ms ease',
            width: KNOB_SIZE,
          }}
        />
      </button>
    </div>
  )
}
