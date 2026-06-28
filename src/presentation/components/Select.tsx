import { h } from '@/infrastructure/ui/react'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps {
  value: null | string
  options: SelectOption[]
  onChange: (value: string) => void
}

// A styled <select> matching the game's surfaces.
export function Select({ value, options, onChange }: SelectProps): JSX.Element {
  return (
    <select
      className="w-full bg-primary/5 border border-border rounded-md px-3 py-2 text-sm cursor-pointer"
      onChange={(event) => onChange(event.target.value)}
      value={value == null ? '' : value}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
