import { h } from '@/infrastructure/ui/react'
import { Select, type SelectOption } from '@/presentation/components/Select'
import { FORK_LABEL_COLOR } from '@/presentation/theme'

export interface BranchSelectProps {
  label: string
  options: SelectOption[]
  value: null | string
  onChange: (value: string) => void
}

// A fork picker: the colored prompt above a select whose first option opts out.
// Shared by the extend and new-line fork flows; each caller maps its own domain
// branch type to the options and value.
export function BranchSelect({ label, options, value, onChange }: BranchSelectProps): JSX.Element {
  return (
    <div className="space-y-1">
      <div className="text-xs" style={{ color: FORK_LABEL_COLOR }}>
        {label}
      </div>
      <Select onChange={onChange} options={options} value={value} />
    </div>
  )
}
