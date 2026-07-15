import type { Endpoint, ForkOption } from '@/domain/line/ExpansionPlan'

import { h } from '@/infrastructure/ui/react'
import { BranchSelect } from '@/presentation/components/BranchSelect'

export interface ForkSelectorProps {
  chosen: ForkOption | null | undefined
  endpoint: Endpoint
  onChoose: (option: ForkOption | null) => void
}

// The branch picker shown for an endpoint that ends at a fork.
export function ForkSelector({ chosen, endpoint, onChoose }: ForkSelectorProps): JSX.Element | null {
  const fork = endpoint.fork
  if (!fork) {
    return null
  }

  const options = [{ label: '— Don\'t extend —', value: '' }].concat(
    fork.options.map((option, i) => ({ label: '→ ' + option.name, value: String(i) })),
  )

  return (
    <BranchSelect
      label={'Fork after ' + fork.atName + ':'}
      onChange={(v) => onChoose(v === '' ? null : fork.options[Number(v)])}
      options={options}
      value={chosen ? String(fork.options.indexOf(chosen)) : ''}
    />
  )
}
