import type { Endpoint, ForkOption } from '@/domain/line/ExpansionPlan'

import { h } from '@/infrastructure/ui/react'
import { BranchSelect } from '@/presentation/components/BranchSelect'

export interface ForkSelectorProps {
  endpoint: Endpoint
  chosen: ForkOption | null | undefined
  onChoose: (option: ForkOption | null) => void
}

// The branch picker shown for an endpoint that ends at a fork.
export function ForkSelector({ endpoint, chosen, onChoose }: ForkSelectorProps): JSX.Element | null {
  const fork = endpoint.fork
  if (!fork) {
    return null
  }

  const options = [{ value: '', label: '— Don\'t extend —' }].concat(
    fork.options.map((option, i) => ({ value: String(i), label: '→ ' + option.name })),
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
