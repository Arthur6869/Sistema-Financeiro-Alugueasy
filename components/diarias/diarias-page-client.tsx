'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { DiariasEditavelTabela, DiariaRow } from '@/components/diarias/diarias-editavel-tabela'
import { DiariasNovaForm } from '@/components/diarias/diarias-nova-form'
import { Input } from '@/components/ui/input'

interface Apartamento {
  id: string
  numero: string
  empreendimento_id: string
  tipo_gestao: 'adm' | 'sub' | null
  empreendimento_nome: string
}

interface Props {
  initialDiarias: DiariaRow[]
  apartamentos: Apartamento[]
  role: string
  mes: number
  ano: number
  initialBusca: string
  initialTipo: 'adm' | 'sub' | ''
}

export function DiariasPageClient({
  initialDiarias,
  apartamentos,
  role,
  mes,
  ano,
  initialBusca,
  initialTipo,
}: Props) {
  const [diarias, setDiarias] = useState<DiariaRow[]>(initialDiarias)
  const canWrite = role === 'analista'
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [buscaLocal, setBuscaLocal] = useState(initialBusca)

  function navigate(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(updates)) {
      if (v) params.set(k, v)
      else params.delete(k)
    }
    params.delete('page')
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  function handleBuscaChange(v: string) {
    setBuscaLocal(v)
  }

  function handleBuscaSubmit() {
    navigate({ busca: buscaLocal })
  }

  function handleTipo(t: 'adm' | 'sub' | '') {
    navigate({ tipo: t })
  }

  function handleInserted(nova: {
    id: string
    data: string
    valor: number
    tipo_gestao: string
    apartamentos: { numero: string; empreendimentos: { nome: string } | null } | null
  }) {
    setDiarias((prev) => [nova as DiariaRow, ...prev])
  }

  return (
    <div className="space-y-4">
      {canWrite && (
        <DiariasNovaForm
          apartamentos={apartamentos}
          defaultMes={mes}
          defaultAno={ano}
          onInserted={handleInserted}
        />
      )}

      {/* Resumo */}
      <div className="flex flex-wrap gap-4 text-sm">
        <span className="text-gray-500">
          <strong className="text-gray-800">{diarias.length}</strong> registro(s) nesta página
        </span>
      </div>

      {/* Toolbar de filtros (server-side via URL) */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1">
          <Input
            placeholder="Buscar empreendimento..."
            value={buscaLocal}
            onChange={(e) => handleBuscaChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleBuscaSubmit() }}
            onBlur={handleBuscaSubmit}
            className="max-w-xs text-sm"
          />
        </div>
        <div className="flex gap-1">
          {([['', 'Todos'], ['adm', 'ADM'], ['sub', 'SUB']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => handleTipo(val)}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                initialTipo === val
                  ? 'bg-[#193660] text-white border-[#193660]'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <DiariasEditavelTabela diarias={diarias} role={role} />
    </div>
  )
}
