'use client'

import './quartos.css'
import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, ChevronRight, RefreshCw, Circle, SprayCan, BedDouble, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resumirPredios, tempoDesde, type ImovelLimpeza, type ResumoPredio } from '@/lib/limpeza'

// A ocupação vem do sync da Amenitiz (a cada 10 min); a tela se atualiza
// sozinha enquanto estiver aberta.
const ATUALIZAR_A_CADA_MS = 2 * 60_000

function normalizar(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`
}

function CartaoPredio({ p }: { p: ResumoPredio }) {
  return (
    <Link href={`/operacional/predio/${p.slug}`} className="predio" data-situacao={p.pior}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="predio-nome truncate">{p.nome}</div>
          <div className="predio-sub">{plural(p.total, 'unidade', 'unidades')}</div>
        </div>
        <ChevronRight size={20} className="text-gray-300 shrink-0 mt-1" />
      </div>
      <div className="predio-chips">
        {p.limpar > 0 ? (
          <span className="predio-chip" data-tipo={p.urgentes ? 'urgente' : 'limpar'}>
            <SprayCan size={12} />
            {p.limpar} para limpar{p.urgentes ? ` · ${plural(p.urgentes, 'urgente', 'urgentes')}` : ''}
          </span>
        ) : (
          <span className="predio-chip" data-tipo="ok">
            <CheckCircle2 size={12} />
            Nada a limpar
          </span>
        )}
        {p.hospedados > 0 && (
          <span className="predio-chip" data-tipo="ocupado">
            <BedDouble size={12} />
            {plural(p.hospedados, 'hospedado', 'hospedados')}
          </span>
        )}
        {p.prontos > 0 && (
          <span className="predio-chip" data-tipo="pronto">
            <CheckCircle2 size={12} />
            {plural(p.prontos, 'pronto', 'prontos')}
          </span>
        )}
      </div>
    </Link>
  )
}

/** Tela inicial da equipe: um cartão por prédio, com o resumo do que há para fazer. */
export function ListaPredios({ imoveis }: { imoveis: ImovelLimpeza[] }) {
  const router = useRouter()
  const [atualizando, iniciarAtualizacao] = useTransition()
  const [busca, setBusca] = useState('')

  useEffect(() => {
    const t = setInterval(() => router.refresh(), ATUALIZAR_A_CADA_MS)
    return () => clearInterval(t)
  }, [router])

  const predios = useMemo(() => resumirPredios(imoveis), [imoveis])

  const visiveis = useMemo(() => {
    const termo = normalizar(busca.trim())
    if (!termo) return predios
    // Busca pelo nome do prédio ou por um número de apartamento dentro dele
    return predios.filter(p =>
      normalizar(p.nome).includes(termo)
      || imoveis.some(i => i.empreendimento === p.nome && normalizar(i.numero).includes(termo)))
  }, [predios, imoveis, busca])

  const totais = useMemo(() => predios.reduce(
    (t, p) => ({ limpar: t.limpar + p.limpar, urgentes: t.urgentes + p.urgentes, hospedados: t.hospedados + p.hospedados, prontos: t.prontos + p.prontos }),
    { limpar: 0, urgentes: 0, hospedados: 0, prontos: 0 },
  ), [predios])

  const atualizadoEm = imoveis[0]?.ocupacao_atualizada_em ?? null

  return (
    <div>
      {imoveis.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div className="contador" data-situacao={totais.urgentes ? 'urgente' : 'pendente'}>
            <span className="contador-numero">{totais.limpar}</span>
            <span className="contador-rotulo">
              Para limpar{totais.urgentes ? ` · ${totais.urgentes} urg.` : ''}
            </span>
          </div>
          <div className="contador" data-situacao="ocupado">
            <span className="contador-numero">{totais.hospedados}</span>
            <span className="contador-rotulo">Hospedados</span>
          </div>
          <div className="contador" data-situacao="limpo">
            <span className="contador-numero">{totais.prontos}</span>
            <span className="contador-rotulo">Prontos</span>
          </div>
        </div>
      )}

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
          placeholder="Buscar prédio ou número do apartamento"
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-base outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15"
        />
      </div>

      {visiveis.length === 0 && (
        <div className="text-center text-sm text-gray-500 py-10">Nenhum prédio encontrado.</div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {visiveis.map(p => <CartaoPredio key={p.slug} p={p} />)}
      </div>
    </div>
  )
}
