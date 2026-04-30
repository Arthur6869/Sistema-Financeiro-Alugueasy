'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { MESES, ANOS } from '@/lib/constants'

interface MonthYearFilterProps {
  mes: number // 0 = Todos
  ano: number // 0 = Todos
}

export function MonthYearFilter({ mes, ano }: MonthYearFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set(key, value)
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  return (
    <div className="flex items-center gap-2">
      <select
        value={mes}
        onChange={(e) => updateParam('mes', e.target.value)}
        className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#193660]/30 cursor-pointer"
      >
        <option value={0}>Todos os meses</option>
        {MESES.map((nome, i) => (
          <option key={i + 1} value={i + 1}>
            {nome}
          </option>
        ))}
      </select>

      <select
        value={ano}
        onChange={(e) => updateParam('ano', e.target.value)}
        className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#193660]/30 cursor-pointer"
      >
        <option value={0}>Todos os anos</option>
        {ANOS.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    </div>
  )
}
