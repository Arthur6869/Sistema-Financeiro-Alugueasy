'use client'

import { useState } from 'react'
import { DiariasEditavelTabela, DiariaRow } from '@/components/diarias/diarias-editavel-tabela'
import { DiariasNovaForm } from '@/components/diarias/diarias-nova-form'

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
}

export function DiariasPageClient({ initialDiarias, apartamentos, role, mes, ano }: Props) {
  const [diarias, setDiarias] = useState<DiariaRow[]>(initialDiarias)
  const canWrite = role === 'analista'

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
      <DiariasEditavelTabela diarias={diarias} role={role} />
    </div>
  )
}
