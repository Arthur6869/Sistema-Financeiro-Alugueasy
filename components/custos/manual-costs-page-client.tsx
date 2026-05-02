'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ManualCostFilters } from '@/components/custos/manual-cost-filters'
import { ManualCostForm } from '@/components/custos/manual-cost-form'
import { ManualCostTable } from '@/components/custos/manual-cost-table'

interface Empreendimento {
  id: string
  nome: string
}

interface Apartamento {
  id: string
  numero: string
  empreendimento_id: string
  tipo_gestao: 'adm' | 'sub' | null
}

interface ManualCostItem {
  id: string
  mes: number
  ano: number
  categoria: string
  valor: number
  tipo_gestao: 'adm' | 'sub'
  observacao: string | null
  origem: 'manual' | 'importacao'
  empreendimento_nome: string
  apartamento_numero: string
  criado_por_nome?: string | null
}

interface ManualCostsPageClientProps {
  initialMes: number
  initialAno: number
  empreendimentos: Empreendimento[]
  apartamentos: Apartamento[]
  canWrite: boolean
}

export function ManualCostsPageClient({
  initialMes,
  initialAno,
  empreendimentos,
  apartamentos,
  canWrite,
}: ManualCostsPageClientProps) {
  const [mes, setMes] = useState(initialMes)
  const [ano, setAno] = useState(initialAno)
  const [tipoGestao, setTipoGestao] = useState<'adm' | 'sub'>('adm')
  const [empreendimentoId, setEmpreendimentoId] = useState('')
  const [apartamentoId, setApartamentoId] = useState('')
  const [categoria, setCategoria] = useState('')
  const [outraCategoria, setOutraCategoria] = useState('')
  const [valor, setValor] = useState('')
  const [observacao, setObservacao] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [items, setItems] = useState<ManualCostItem[]>([])

  const apartamentosDisponiveis = useMemo(
    () => apartamentos
      .filter((a) => a.empreendimento_id === empreendimentoId)
      .filter((a) => (a.tipo_gestao ?? tipoGestao) === tipoGestao)
      .map((a) => ({ id: a.id, numero: a.numero })),
    [apartamentos, empreendimentoId, tipoGestao]
  )

  const loadItems = useCallback(async () => {
    const params = new URLSearchParams({
      mes: String(mes),
      ano: String(ano),
      tipo_gestao: tipoGestao,
    })
    if (empreendimentoId) params.set('empreendimento_id', empreendimentoId)
    const res = await fetch(`/api/custos-manual?${params.toString()}`)
    const body = await res.json()
    if (!res.ok) {
      setErrorMessage(body.error ?? 'Erro ao buscar custos')
      return
    }
    setItems(body.data ?? [])
  }, [mes, ano, tipoGestao, empreendimentoId])

  useEffect(() => {
    setApartamentoId('')
  }, [empreendimentoId, tipoGestao])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  function resetForm(keepContext: boolean) {
    setCategoria('')
    setOutraCategoria('')
    setValor('')
    setObservacao('')
    if (!keepContext) {
      setEmpreendimentoId('')
      setApartamentoId('')
    } else {
      setApartamentoId('')
    }
  }

  async function handleSave(keepContext: boolean) {
    setErrorMessage(null)
    setInfoMessage(null)
    const categoriaFinal = categoria === '__outra__' ? outraCategoria.trim() : categoria.trim()
    const valorFinal = Number(valor.replace(',', '.'))

    if (!empreendimentoId || !apartamentoId || !categoriaFinal || isNaN(valorFinal) || valorFinal <= 0) {
      setErrorMessage('Preencha empreendimento, apartamento, categoria e valor válido.')
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch('/api/custos-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empreendimento_id: empreendimentoId,
          apartamento_id: apartamentoId,
          mes,
          ano,
          tipo_gestao: tipoGestao,
          categoria: categoriaFinal,
          valor: valorFinal,
          observacao: observacao.trim() || null,
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        setErrorMessage(body.error ?? 'Erro ao salvar custo manual')
        return
      }
      setInfoMessage('Custo lançado com sucesso.')
      resetForm(keepContext)
      await loadItems()
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setErrorMessage(null)
    const res = await fetch(`/api/custos-manual/${id}`, { method: 'DELETE' })
    const body = await res.json()
    if (!res.ok) {
      setErrorMessage(body.error ?? 'Erro ao excluir custo')
      return
    }
    await loadItems()
  }

  async function handleEdit(id: string, payload: { categoria: string; valor: number; observacao: string | null }) {
    setErrorMessage(null)
    const res = await fetch(`/api/custos-manual/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const body = await res.json()
    if (!res.ok) {
      setErrorMessage(body.error ?? 'Erro ao editar custo')
      return
    }
    await loadItems()
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Lançamento Manual de Custos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Cadastre, edite e exclua custos diretamente no sistema. A importação por planilha/PDF continua disponível em /importar.
        </p>
        {!canWrite && (
          <p className="text-sm text-amber-700 mt-3">
            Seu perfil possui acesso somente leitura. Apenas analistas podem criar, editar ou excluir lançamentos.
          </p>
        )}
      </div>

      <Card className="border border-gray-100 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Contexto do lançamento</CardTitle>
        </CardHeader>
        <CardContent>
          <ManualCostFilters
            mes={mes}
            ano={ano}
            tipoGestao={tipoGestao}
            empreendimentoId={empreendimentoId}
            empreendimentos={empreendimentos}
            onChange={(next) => {
              if (next.mes !== undefined) setMes(next.mes)
              if (next.ano !== undefined) setAno(next.ano)
              if (next.tipoGestao !== undefined) setTipoGestao(next.tipoGestao)
              if (next.empreendimentoId !== undefined) setEmpreendimentoId(next.empreendimentoId)
            }}
          />
        </CardContent>
      </Card>

      <Card className="border border-gray-100 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Novo lançamento manual</CardTitle>
        </CardHeader>
        <CardContent>
          <ManualCostForm
            apartamentoId={apartamentoId}
            categoria={categoria}
            outraCategoria={outraCategoria}
            valor={valor}
            observacao={observacao}
            apartamentosDisponiveis={apartamentosDisponiveis}
            isSaving={isSaving}
            canWrite={canWrite}
            errorMessage={errorMessage}
            onChange={(next) => {
              if (next.apartamentoId !== undefined) setApartamentoId(next.apartamentoId)
              if (next.categoria !== undefined) setCategoria(next.categoria)
              if (next.outraCategoria !== undefined) setOutraCategoria(next.outraCategoria)
              if (next.valor !== undefined) setValor(next.valor)
              if (next.observacao !== undefined) setObservacao(next.observacao)
            }}
            onSave={handleSave}
          />
          {infoMessage && <p className="text-sm text-green-700 mt-3">{infoMessage}</p>}
        </CardContent>
      </Card>

      <Card className="border border-gray-100 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Lançamentos cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          <ManualCostTable items={items} canWrite={canWrite} onDelete={handleDelete} onEdit={handleEdit} />
        </CardContent>
      </Card>
    </div>
  )
}
