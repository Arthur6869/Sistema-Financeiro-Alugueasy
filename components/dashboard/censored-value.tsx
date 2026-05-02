'use client'

interface CensoredValueProps {
  value: string
  censored: boolean
  className?: string
}

export function CensoredValue({ value, censored, className = '' }: CensoredValueProps) {
  return (
    <span
      className={[
        'inline-block rounded-md px-1 transition-all duration-200',
        className,
        censored ? 'text-transparent bg-gray-900/80 select-none' : '',
      ].join(' ')}
    >
      {value}
    </span>
  )
}
