'use client'

import type { ReactNode } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Janela de diálogo das abas internas (Base UI): prende o foco, fecha com Esc
 * e com clique fora, devolve o foco a quem abriu e trava a rolagem da página.
 * Os modais antigos do projeto são `div`s soltas e não fazem nada disso.
 *
 * O conteúdo é montado fora da casca da página (portal), então aqui dentro o
 * título usa a fonte sem serifa — a serifa da marca não chega até aqui.
 */
export function Dialogo({ aberto, onFechar, titulo, descricao, children, className }: {
  aberto: boolean
  onFechar: () => void
  titulo: string
  descricao?: ReactNode
  children: ReactNode
  /** Largura máxima; padrão `max-w-lg` */
  className?: string
}) {
  return (
    <Dialog.Root open={aberto} onOpenChange={abrir => { if (!abrir) onFechar() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-marca-950/45 backdrop-blur-[2px] transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup
          className={cn(
            'fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto',
            'rounded-2xl border border-linha bg-white p-5 text-tinta shadow-xl sm:p-6',
            'transition duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold leading-tight text-tinta">{titulo}</Dialog.Title>
              {descricao && <Dialog.Description className="mt-1 text-sm text-apagado">{descricao}</Dialog.Description>}
            </div>
            <Dialog.Close
              aria-label="Fechar"
              className="-mr-1.5 -mt-1.5 grid size-9 shrink-0 place-items-center rounded-full text-apagado transition-colors hover:bg-creme hover:text-tinta focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-marca-700"
            >
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="mt-5">{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
