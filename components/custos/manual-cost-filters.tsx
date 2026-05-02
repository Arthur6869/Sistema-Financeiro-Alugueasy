'use client'

import { MESES, ANOS } from '@/lib/constants'

interface Option {
  id: string
  nome: string
}

interface ManualCostFiltersProps {
  mes: number
  ano: number
  tipoGestao: 'adm' | 'sub'
  empreendimentoId: string
  empreendimentos: Option[]
  onChange: (next: {
    mes?: number
    ano?: number
    tipoGestao?: 'adm' | 'sub'
    empreendimentoId?: string
  }) => void
}

export function ManualCostFilters({
  mes,
  ano,
  tipoGestao,
  empreendimentoId,
  empreendimentos,
  onChange,
}: ManualCostFiltersProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      <select
        value={mes}
        onChange={(e) => onChange({ mes: Number(e.target.value) })}
        className="text-sm border border-gray-200 rounded-md px-3 py-2 bg-white text-gray-700"
      >
        {MESES.map((nome, i) => (
          <option key={nome} value={i + 1}>{nome}</option>
        ))}
      </select>

      <select
        value={ano}
        onChange={(e) => onChange({ ano: Number(e.target.value) })}
        className="text-sm border border-gray-200 rounded-md px-3 py-2 bg-white text-gray-700"
      >
        {ANOS.map((a) => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>

      <select
        value={tipoGestao}
        onChange={(e) => onChange({ tipoGestao: e.target.value as 'adm' | 'sub' })}
        className="text-sm border border-gray-200 rounded-md px-3 py-2 bg-white text-gray-700"
      >
        <option value="adm">ADM</option>
        <option value="sub">SUB</option>
      </select>

      <select
        value={empreendimentoId}
        onChange={(e) => onChange({ empreendimentoId: e.target.value })}
        className="text-sm border border-gray-200 rounded-md px-3 py-2 bg-white text-gray-700"
      >
        <option value="">Selecione o empreendimento</option>
        {empreendimentos.map((e) => (
          <option key={e.id} value={e.id}>{e.nome}</option>
        ))}
      </select>
    </div>
  )
}
