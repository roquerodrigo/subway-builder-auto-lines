import { h } from '@/infrastructure/ui/react'

export interface SpinnerProps {
  label?: string
}

// A large loading spinner (spinning ring) with its label stacked below.
export function Spinner({ label }: SpinnerProps): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-3 text-muted-foreground">
      <span className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-current border-t-transparent" />
      {label ? <span className="text-sm">{label}</span> : null}
    </div>
  )
}
