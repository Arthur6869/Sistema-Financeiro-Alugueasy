'use client'

import { useState } from 'react'
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  FileX,
  ShieldCheck,
  Wrench,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react'
import { MESES, ANOS } from '@/lib/constants'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface SyncItem {
  mes: number
  ano: number
  tipo: string
  tipo_gestao: string
  arquivo: string
  valorPlanilha: number
  valorDB: number
  diferenca: number
  status: 'ok' | 'divergente' | 'sem_dados_db' | 'planilha_vazia' | 'erro_parsing'
  erroParsing: string | null
}

interface SyncReport {
  report: SyncItem[]
  totalArquivos: number
  ano: number
  aviso?: string
}

// ─── Formatadores ─────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  `R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

const TIPO_LABELS: Record<string, string> = {
  custos_adm: 'Custos ADM',
  custos_sub: 'Custos SUB',
  diarias_adm: 'Faturamento ADM',
  diarias_sub: 'Faturamento SUB',
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SyncItem['status'] }) {
  if (status === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
        <CheckCircle2 size={11} /> Sincronizado
      </span>
    )
  }
  if (status === 'sem_dados_db') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
        <Info size={11} /> Sem dados no banco
      </span>
    )
  }
  if (status === 'divergente') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
        <AlertTriangle size={11} /> Divergente
      </span>
    )
  }
  if (status === 'planilha_vazia') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5">
        <FileX size={11} /> Planilha vazia
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
      <XCircle size={11} /> Erro de parsing
    </span>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface Props {
  mesInicial?: number
  anoInicial?: number
}

export function SyncPlanilhasButton({
  mesInicial = new Date().getMonth() + 1,
  anoInicial = new Date().getFullYear(),
}: Props) {
  const [loading, setLoading] = useState(false)
  const [corrigindo, setCorrigindo] = useState<string | null>(null)
  const [report, setReport] = useState<SyncReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [mes, setMes] = useState(mesInicial)
  const [ano, setAno] = useState(anoInicial)

  async function verificar() {
    setLoading(true)
    setError(null)
    setReport(null)
    setExpanded(true)
    try {
      const res = await fetch(`/api/sync-local?ano=${ano}&mes=${mes}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? `Erro HTTP ${res.status}`)
        return
      }
      setReport(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro de rede')
    } finally {
      setLoading(false)
    }
  }

  async function corrigir(item: SyncItem) {
    const key = `${item.tipo}-${item.mes}-${item.ano}`
    setCorrigindo(key)
    try {
      const res = await fetch('/api/sync-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes: item.mes, ano: item.ano, tipo: item.tipo }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(`Erro ao corrigir: ${data?.error ?? res.status}`)
        return
      }
      // Re-verificar após correção
      await verificar()
    } catch (e: unknown) {
      alert(`Erro: ${e instanceof Error ? e.message : 'Erro de rede'}`)
    } finally {
      setCorrigindo(null)
    }
  }

  // Resumo do relatório
  const totalOk = report?.report.filter(r => r.status === 'ok').length ?? 0
  const totalDivergente = report?.report.filter(r => r.status === 'divergente' || r.status === 'sem_dados_db').length ?? 0
  const totalErro = report?.report.filter(r => r.status === 'erro_parsing').length ?? 0

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      {/* Cabeçalho */}
      <div className="flex items-start gap-3 mb-5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: '#19366018' }}
        >
          <ShieldCheck size={20} style={{ color: '#193660' }} />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-bold text-gray-900">
            Verificação com Planilhas Locais
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Compara os dados do banco com as planilhas de conferência nas pastas{' '}
            <code className="bg-gray-100 px-1 rounded text-xs">dados jan/</code>,{' '}
            <code className="bg-gray-100 px-1 rounded text-xs">dados fev/</code>, etc.
            e permite corrigir divergências.
          </p>
        </div>
      </div>

      {/* Controles */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={mes}
          onChange={(e) => { setMes(Number(e.target.value)); setReport(null) }}
          className="text-sm border border-gray-200 rounded-md px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#193660]/30"
          disabled={loading}
        >
          {MESES.map((nome, i) => (
            <option key={i + 1} value={i + 1}>{nome}</option>
          ))}
        </select>

        <select
          value={ano}
          onChange={(e) => { setAno(Number(e.target.value)); setReport(null) }}
          className="text-sm border border-gray-200 rounded-md px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#193660]/30"
          disabled={loading}
        >
          {ANOS.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <button
          onClick={verificar}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#193660' }}
        >
          {loading
            ? <Loader2 size={16} className="animate-spin" />
            : <RefreshCw size={16} />}
          {loading ? 'Verificando…' : `Verificar ${MESES[mes - 1]}`}
        </button>

        {report && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors ml-auto"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expanded ? 'Ocultar' : 'Ver detalhes'}
          </button>
        )}
      </div>

      {/* Erro geral */}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">
          <XCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Aviso sem pastas */}
      {report?.aviso && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700 mb-4">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{report.aviso}</span>
        </div>
      )}

      {/* Resumo */}
      {report && !report.aviso && (
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-1.5 text-sm">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            <span className="text-gray-600">{totalOk} sincronizado{totalOk !== 1 ? 's' : ''}</span>
          </div>
          {totalDivergente > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
              <span className="text-gray-600">{totalDivergente} divergente{totalDivergente !== 1 ? 's' : ''}</span>
            </div>
          )}
          {totalErro > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
              <span className="text-gray-600">{totalErro} com erro</span>
            </div>
          )}
          <span className="text-xs text-gray-400 ml-auto">{report.totalArquivos} arquivo{report.totalArquivos !== 1 ? 's' : ''} encontrado{report.totalArquivos !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Tabela de resultados */}
      {report && expanded && report.report.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Período</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Tipo</th>
                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">Planilha</th>
                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">Banco</th>
                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">Diferença</th>
                <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3">Status</th>
                <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3">Ação</th>
              </tr>
            </thead>
            <tbody>
              {report.report.map((item) => {
                const key = `${item.tipo}-${item.mes}-${item.ano}`
                const isFixing = corrigindo === key
                const canFix = item.status === 'divergente' || item.status === 'sem_dados_db'

                return (
                  <tr
                    key={key}
                    className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {MESES[item.mes - 1]} {item.ano}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {TIPO_LABELS[item.tipo] ?? item.tipo}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-800">
                      {item.valorPlanilha > 0 ? fmt(item.valorPlanilha) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-600">
                      {item.valorDB > 0 ? fmt(item.valorDB) : '—'}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold ${
                      item.diferenca === 0 ? 'text-gray-400' :
                      item.diferenca > 0 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {item.diferenca === 0 ? '—' :
                       `${item.diferenca > 0 ? '+' : '-'}${fmt(item.diferenca)}`}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={item.status} />
                      {item.erroParsing && (
                        <p className="text-xs text-red-500 mt-1 max-w-[200px] mx-auto truncate" title={item.erroParsing}>
                          {item.erroParsing}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {canFix && (
                        <button
                          onClick={() => corrigir(item)}
                          disabled={isFixing || !!corrigindo}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ backgroundColor: item.status === 'sem_dados_db' ? '#193660' : '#d97706' }}
                          title={`Importar valores da planilha para ${TIPO_LABELS[item.tipo]} de ${MESES[item.mes - 1]}`}
                        >
                          {isFixing
                            ? <Loader2 size={12} className="animate-spin" />
                            : <Wrench size={12} />}
                          {item.status === 'sem_dados_db' ? 'Importar' : 'Corrigir'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legenda */}
      {report && expanded && (
        <p className="text-xs text-gray-400 mt-3">
          <strong>Importar</strong> → grava valores da planilha no banco (sem dados anteriores) ·{' '}
          <strong>Corrigir</strong> → sobrescreve valores divergentes com os da planilha ·{' '}
          Diárias corrigidas passam a ser exibidas no dashboard no lugar dos dados da Amenitiz.
        </p>
      )}
    </div>
  )
}
