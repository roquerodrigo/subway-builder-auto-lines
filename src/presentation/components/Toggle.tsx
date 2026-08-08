import { h } from '@/infrastructure/ui/react'

export interface ToggleProps {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}

// A switch matching the game's surfaces: label on the left, switch on the right.
export function Toggle({ checked, label, onChange }: ToggleProps): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-primary/5 border border-border px-3 py-2 text-sm">
      <span className="font-semibold">{label}</span>
      <button
        aria-checked={checked}
        aria-label={label}
        className={
          'relative h-5 w-9 shrink-0 rounded-full cursor-pointer transition-colors ' +
          (checked ? 'bg-primary' : 'bg-primary/20')
        }
        onClick={() => onChange(!checked)}
        role="switch"
        type="button"
      >
        <span
          className={
            'absolute top-0.5 h-4 w-4 rounded-full bg-primary-foreground transition-all ' +
            (checked ? 'left-[1.125rem]' : 'left-0.5')
          }
        />
      </button>
    </div>
  )
}
