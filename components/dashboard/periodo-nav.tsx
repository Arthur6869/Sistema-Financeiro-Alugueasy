'use client'

import { useSyncExternalStore } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { MESES, ANOS } from '@/lib/constants'
import { cn } from '@/lib/utils'

// "Em que mês estamos" só o navegador sabe (o servidor roda em outro fuso).
const semAssinatura = () => () => {}
const mesDeHoje = () => {
  const d = new Date()
  return `${d.getMonth() + 1}-${d.getFullYear()}`
}

const campo =
  'h-9 cursor-pointer appearance-none rounded-full bg-transparent pl-3 pr-7 text-sm font-medium text-tinta ' +
  'transition-colors hover:bg-creme focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-marca-700'

const seta =
  'grid size-9 place-items-center rounded-full text-tinta-suave transition-colors hover:bg-creme hover:text-tinta ' +
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-marca-700 ' +
  'disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent'

/**
 * Período do dashboard. As setas andam um mês (ou um ano, quando "Todos os
 * meses" está selecionado); os seletores mantêm as opções "Todos" do filtro
 * antigo — mes=0 e ano=0 continuam valendo na URL.
 */
export function PeriodoNav({ mes, ano, onIr, pendente, permitirTodos = true }: {
  mes: number // 0 = todos
  ano: number // 0 = todos
  onIr: (mes: number, ano: number) => void
  pendente: boolean
  /**
   * `false` nas abas que consultam um mês específico (lá "Todos" não tem como ser calculado);
   * `'meses'` oferece só "Todos os meses" (o ano inteiro), sem "Todos os anos".
   */
  permitirTodos?: boolean | 'meses'
}) {
  const hoje = useSyncExternalStore(semAssinatura, mesDeHoje, () => null)
  const noMesAtual = hoje === `${mes}-${ano}`

  // Uma URL pode trazer um ano fora da lista padrão; ele entra como opção
  const anos = ano === 0 || ANOS.includes(ano) ? ANOS : [...ANOS, ano].sort((a, b) => a - b)
  const [anoMin, anoMax] = [anos[0], anos[anos.length - 1]]

  const vizinho = (passo: -1 | 1): [number, number] | null => {
    if (ano === 0) return null
    if (mes === 0) {
      const a = ano + passo
      return a < anoMin || a > anoMax ? null : [0, a]
    }
    let m = mes + passo
    let a = ano
    if (m < 1) { m = 12; a -= 1 } else if (m > 12) { m = 1; a += 1 }
    return a < anoMin || a > anoMax ? null : [m, a]
  }
  const anterior = vizinho(-1)
  const proximo = vizinho(1)
  const unidade = mes === 0 ? 'ano' : 'mês'

  return (
    // `contents`: a pílula e o botão entram direto na linha de controles do cabeçalho
    <div className="contents">
      <div
        role="group"
        aria-label="Período"
        aria-busy={pendente}
        className="inline-flex items-center rounded-full border border-linha bg-white p-1 shadow-[0_1px_2px_rgba(15,38,71,0.05)] max-sm:w-full max-sm:justify-between"
      >
        <button
          type="button" className={seta} disabled={!anterior}
          onClick={() => anterior && onIr(...anterior)} aria-label={`${unidade === 'ano' ? 'Ano' : 'Mês'} anterior`}
        >
          <ChevronLeft size={17} />
        </button>

        <span className="relative">
          <select
            aria-label="Mês" className={campo} value={mes}
            onChange={e => onIr(Number(e.target.value), ano)}
          >
            {permitirTodos !== false && <option value={0}>Todos os meses</option>}
            {MESES.map((nome, i) => <option key={nome} value={i + 1}>{nome}</option>)}
          </select>
          <ChevronDown size={14} aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-apagado" />
        </span>

        <span className="relative">
          <select
            aria-label="Ano" className={campo} value={ano}
            onChange={e => onIr(mes, Number(e.target.value))}
          >
            {permitirTodos === true && <option value={0}>Todos os anos</option>}
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <ChevronDown size={14} aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-apagado" />
        </span>

        <button
          type="button" className={seta} disabled={!proximo}
          onClick={() => proximo && onIr(...proximo)} aria-label={`Próximo ${unidade}`}
        >
          <ChevronRight size={17} />
        </button>
      </div>

      <button
        type="button"
        disabled={noMesAtual}
        onClick={() => { const d = new Date(); onIr(d.getMonth() + 1, d.getFullYear()) }}
        className={cn(
          'h-11 rounded-full border border-linha bg-white px-4 text-sm font-medium text-tinta transition-colors',
          'hover:bg-creme-escuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700',
          'disabled:cursor-default disabled:border-transparent disabled:bg-transparent disabled:text-apagado max-sm:disabled:hidden',
        )}
      >
        Mês atual
      </button>
    </div>
  )
}
