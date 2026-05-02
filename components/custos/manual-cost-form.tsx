'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export const COST_CATEGORIES = [
  'Amenitiz',
  'Condomínio',
  'Energia',
  'Água',
  'Lavanderia',
  'Limpeza',
  'Manutenção',
  'Internet',
  'Gás',
  'Outros',
] as const

interface ApartmentOption {
  id: string
  numero: string
}

interface ManualCostFormProps {
  apartamentoId: string
  categoria: string
  outraCategoria: string
  valor: string
  observacao: string
  apartamentosDisponiveis: ApartmentOption[]
  isSaving: boolean
  canWrite: boolean
  errorMessage: string | null
  onChange: (next: {
    apartamentoId?: string
    categoria?: string
    outraCategoria?: string
    valor?: string
    observacao?: string
  }) => void
  onSave: (keepOpen: boolean) => void
}

export function ManualCostForm({
  apartamentoId,
  categoria,
  outraCategoria,
  valor,
  observacao,
  apartamentosDisponiveis,
  isSaving,
  canWrite,
  errorMessage,
  onChange,
  onSave,
}: ManualCostFormProps) {
  const exigeOutraCategoria = categoria === '__outra__'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label>Apartamento</Label>
          <select
            value={apartamentoId}
            onChange={(e) => onChange({ apartamentoId: e.target.value })}
            className="text-sm border border-gray-200 rounded-md px-3 py-2 bg-white text-gray-700 w-full"
            disabled={!canWrite}
          >
            <option value="">Selecione o apartamento</option>
            {apartamentosDisponiveis.map((a) => (
              <option key={a.id} value={a.id}>{a.numero}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label>Categoria</Label>
          <select
            value={categoria}
            onChange={(e) => onChange({ categoria: e.target.value })}
            className="text-sm border border-gray-200 rounded-md px-3 py-2 bg-white text-gray-700 w-full"
            disabled={!canWrite}
          >
            <option value="">Selecione uma categoria</option>
            {COST_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
            <option value="__outra__">Outra categoria</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label>Valor (R$)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={valor}
            onChange={(e) => onChange({ valor: e.target.value })}
            placeholder="0,00"
            disabled={!canWrite}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Observação (opcional)</Label>
          <Input
            value={observacao}
            onChange={(e) => onChange({ observacao: e.target.value })}
            placeholder="Detalhes do lançamento"
            disabled={!canWrite}
          />
        </div>
      </div>

      {exigeOutraCategoria && (
        <div className="space-y-1.5 max-w-md">
          <Label>Nome da categoria</Label>
          <Input
            value={outraCategoria}
            onChange={(e) => onChange({ outraCategoria: e.target.value })}
            placeholder="Ex: Taxa extraordinária"
            disabled={!canWrite}
          />
        </div>
      )}

      {errorMessage && (
        <p className="text-sm text-red-600">{errorMessage}</p>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={() => onSave(false)}
          disabled={!canWrite || isSaving}
          className="bg-[#193660] hover:bg-[#193660]/90"
        >
          {isSaving ? 'Salvando...' : 'Salvar custo'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onSave(true)}
          disabled={!canWrite || isSaving}
        >
          {isSaving ? 'Salvando...' : 'Salvar e lançar outro'}
        </Button>
      </div>
    </div>
  )
}
