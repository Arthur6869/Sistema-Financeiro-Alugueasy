'use client'

import { NumericFormat } from 'react-number-format'
import { cn } from '@/lib/utils'

/**
 * Campo de valor em reais: a pessoa digita "1234,5" e vê "R$ 1.234,50", com o
 * cursor no lugar certo (react-number-format). O valor sai como número
 * (`1234.5`) ou `null` quando o campo está vazio — sem `parseFloat` de texto
 * com vírgula, que era onde os lançamentos erravam.
 */
export function CampoMoeda({ valor, onMudar, className, ...resto }: {
  valor: number | null
  onMudar: (valor: number | null) => void
  className?: string
  id?: string
  autoFocus?: boolean
  disabled?: boolean
  'aria-label'?: string
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
  onBlur?: React.FocusEventHandler<HTMLInputElement>
}) {
  return (
    <NumericFormat
      value={valor ?? ''}
      onValueChange={v => onMudar(v.floatValue ?? null)}
      thousandSeparator="."
      decimalSeparator=","
      decimalScale={2}
      fixedDecimalScale
      allowNegative={false}
      prefix="R$ "
      inputMode="decimal"
      placeholder="R$ 0,00"
      className={cn(
        'h-10 w-full rounded-xl border border-linha bg-white px-3 text-right text-sm tabular-nums text-tinta transition-colors',
        'focus-visible:border-marca-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-marca-700/15',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...resto}
    />
  )
}
