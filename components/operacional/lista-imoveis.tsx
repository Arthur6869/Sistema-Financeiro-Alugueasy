'use client'

import './quartos.css'
import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, ChevronRight, CheckCircle2, AlertTriangle, BedDouble, SprayCan, RefreshCw, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  descreverSituacao, ordenarPorPrioridade, tempoDesde,
  type ImovelLimpeza, type SituacaoLimpeza,
} from '@/lib/limpeza'

type Filtro = 'todos' | 'limpar' | 'ocupado' | 'limpo'

// A ocupação vem do sync da Amenitiz (a cada 10 min); a lista se atualiza
// sozinha com a tela aberta.
const ATUALIZAR_A_CADA_MS = 2 * 60_000

function normalizar(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const PARA_LIMPAR: SituacaoLimpeza[] = ['pendente', 'incompleta']

function noFiltro(i: ImovelLimpeza, f: Filtro) {
  if (f === 'limpar') return PARA_LIMPAR.includes(i.situacao)
  if (f === 'ocupado') return i.situacao === 'ocupado'
  if (f === 'limpo') return i.situacao === 'limpo'
  return true
}

function Pilula({ i }: { i: ImovelLimpeza }) {
  const rotulo: Record<SituacaoLimpeza, string> = {
    pendente: i.entrada_hoje ? 'Urgente' : 'Pendente',
    incompleta: 'Incompleta',
    ocupado: 'Hospedado',
    limpo: i.limpa_hoje ? 'Finalizado' : 'Pronto',
    livre: 'Livre',
  }
  return <span className="quarto-pilula">{rotulo[i.situacao]}</span>
}

function IconeSituacao({ s }: { s: SituacaoLimpeza }) {
  const props = { size: 20, className: 'quarto-status shrink-0' }
  if (s === 'pendente') return <SprayCan {...props} />
  if (s === 'incompleta') return <AlertTriangle {...props} />
  if (s === 'ocupado') return <BedDouble {...props} />
  if (s === 'limpo') return <CheckCircle2 {...props} />
  return <ChevronRight size={18} className="text-gray-300 shrink-0" />
}

function CartaoQuarto({ i }: { i: ImovelLimpeza }) {
  const { titulo, detalhe } = descreverSituacao(i)
  return (
    <Link
      href={`/operacional/limpeza/${i.unidade_id}`}
      className="quarto"
      data-situacao={i.situacao}
      data-urgente={i.situacao === 'pendente' && i.entrada_hoje}
    >
      <div className="quarto-selo">{i.numero}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-[15px] text-[#0f1a2e] truncate">Apto {i.numero}</span>
          <Pilula i={i} />
        </div>
        <div className="quarto-status text-[12.5px] font-medium mt-0.5 truncate">{titulo}</div>
        <div className="text-[11.5px] text-gray-500 truncate">{detalhe}</div>
      </div>
      <IconeSituacao s={i.situacao} />
    </Link>
  )
}

// Blocos da lista, na ordem em que a equipe trabalha
const SECOES: { chave: string; titulo: string; cor: string; icone: React.ReactNode; inclui: (i: ImovelLimpeza) => boolean }[] = [
  { chave: 'limpar', titulo: 'Limpar agora', cor: 'text-[#b45309]', icone: <SprayCan size={13} />, inclui: i => PARA_LIMPAR.includes(i.situacao) },
  { chave: 'ocupado', titulo: 'Hospedados', cor: 'text-[#1d4ed8]', icone: <BedDouble size={13} />, inclui: i => i.situacao === 'ocupado' },
  { chave: 'limpo', titulo: 'Prontos', cor: 'text-[#047857]', icone: <CheckCircle2 size={13} />, inclui: i => i.situacao === 'limpo' },
  { chave: 'livre', titulo: 'Livres', cor: 'text-[#5a6a82]', icone: null, inclui: i => i.situacao === 'livre' },
]

/** Unidades de UM prédio, por ordem de prioridade de limpeza. */
export function ListaImoveis({ imoveis }: { imoveis: ImovelLimpeza[] }) {
  const router = useRouter()
  const [atualizando, iniciarAtualizacao] = useTransition()
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')

  useEffect(() => {
    const t = setInterval(() => router.refresh(), ATUALIZAR_A_CADA_MS)
    return () => clearInterval(t)
  }, [router])

  const contagem = useMemo(() => ({
    limpar: imoveis.filter(i => PARA_LIMPAR.includes(i.situacao)).length,
    urgentes: imoveis.filter(i => i.situacao === 'pendente' && i.entrada_hoje).length,
    ocupado: imoveis.filter(i => i.situacao === 'ocupado').length,
    limpo: imoveis.filter(i => i.situacao === 'limpo').length,
  }), [imoveis])

  const secoes = useMemo(() => {
    const termo = normalizar(busca.trim())
    const visiveis = ordenarPorPrioridade(imoveis.filter(i =>
      noFiltro(i, filtro) && (!termo || normalizar(i.numero).includes(termo))))
    return SECOES
      .map(s => ({ ...s, itens: visiveis.filter(s.inclui) }))
      .filter(s => s.itens.length > 0)
  }, [imoveis, busca, filtro])

  const atualizadoEm = imoveis[0]?.ocupacao_atualizada_em ?? null

  const contadores: { f: Filtro; situacao: string; numero: number; rotulo: string }[] = [
    { f: 'limpar', situacao: contagem.urgentes ? 'urgente' : 'pendente', numero: contagem.limpar, rotulo: contagem.urgentes ? `Limpar · ${contagem.urgentes} urg.` : 'Para limpar' },
    { f: 'ocupado', situacao: 'ocupado', numero: contagem.ocupado, rotulo: 'Hospedados' },
    { f: 'limpo', situacao: 'limpo', numero: contagem.limpo, rotulo: 'Prontos' },
    { f: 'todos', situacao: 'todos', numero: imoveis.length, rotulo: 'Todos' },
  ]

  return (
    <div>
      <div className="grid grid-cols-4 gap-2 mb-2">
        {contadores.map(c => (
          <button
            key={c.f}
            type="button"
            className="contador"
            data-situacao={c.situacao}
            aria-pressed={filtro === c.f}
            onClick={() => setFiltro(atual => (atual === c.f ? 'todos' : c.f))}
          >
            <span className="contador-numero">{c.numero}</span>
            <span className="contador-rotulo">{c.rotulo}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-[11.5px] text-gray-500 mb-3 px-1">
        <span className="flex items-center gap-1.5">
          <Circle size={7} className="fill-emerald-500 text-emerald-500" />
          Entradas e saídas da Amenitiz{atualizadoEm ? ` · atualizado ${tempoDesde(atualizadoEm)}` : ''}
        </span>
        <button
          type="button"
          onClick={() => iniciarAtualizacao(() => router.refresh())}
          className="flex items-center gap-1 text-[#0f766e] font-medium disabled:opacity-50"
          disabled={atualizando}
        >
          <RefreshCw size={12} className={cn(atualizando && 'animate-spin')} />
          Atualizar
        </button>
      </div>

      <div className="relative mb-5">
        <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar pelo número do apartamento"
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-base outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15"
        />
      </div>

      {secoes.length === 0 && (
        <div className="text-center text-sm text-gray-500 py-10">
          {filtro === 'limpar' ? 'Nenhum apartamento esperando limpeza neste prédio.' : 'Nenhum apartamento encontrado.'}
        </div>
      )}

      <div className="space-y-6">
        {secoes.map(s => (
          <section key={s.chave}>
            <h2 className={cn('flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider mb-2 px-1', s.cor)}>
              {s.icone}
              {s.titulo} <span className="font-medium text-gray-400">· {s.itens.length}</span>
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {s.itens.map(i => <CartaoQuarto key={i.unidade_id} i={i} />)}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
