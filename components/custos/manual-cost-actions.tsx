'use client'

import { Button } from '@/components/ui/button'

interface ManualCostActionsProps {
  onEdit: () => void
  onDelete: () => void
  disabled?: boolean
}

export function ManualCostActions({ onEdit, onDelete, disabled = false }: ManualCostActionsProps) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Button type="button" variant="outline" size="sm" onClick={onEdit} disabled={disabled}>
        Editar
      </Button>
      <Button type="button" variant="destructive" size="sm" onClick={onDelete} disabled={disabled}>
        Excluir
      </Button>
    </div>
  )
}
