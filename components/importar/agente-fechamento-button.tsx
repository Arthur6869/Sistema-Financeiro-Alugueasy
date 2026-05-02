'use client'

import { useState } from 'react'
import { Bot, CheckCircle2, AlertCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MESES, ANOS, formatCurrency } from '@/lib/constants'

type StatusGeral = 'ok' | 'aviso' | 'erro'

interface RelatorioFechamento {
  periodo: string
  executado_em: string
  status_geral: StatusGeral
  total_alertas: number
  alertas: string[]
  duracao_ms: number
  etapas: {
    sync_amenitiz?: { status: string; reservas?: number; faturamento_liquido?: number; apts_nao_encontrados?: string[] }
    custos_adm?: { empreendimentos_com_dados: number; lista: string[] }
    custos_sub?: { empreendimentos_com_dados: number; lista: string[] }
    kpis?: { faturamento: number; custos: number; lucro: number; margem_percent: number }
    custos_manuais?: { total: number; valor_total: number }
    emails?: { enviados: number; erros: number; lista_enviados: string[]; lista_erros: string[] }
  }
}

function StatusIcon({ status }: { status: StatusGeral }) {
  if (status === 'ok') return <CheckCircle2 size={18} className="text-green-500 shrink-0" />
  if (status === 'aviso') return <AlertCircle size={18} className="text-amber-500 shrink-0" />
  return <XCircle size={18} className="text-red-500 shrink-0" />
}

function etapaStatusOk(etapa: unknown): boolean {
  if (!etapa || typeof etapa !== 'object') return false
  const e = etapa as Record<string, unknown>
  if ('status' in e) return e.status === 'ok'
  return true
}

export function AgenteFechamentoButton() {
  const now = new Date()
  const defMes = now.getMonth() === 0 ? 12 : now.getMonth()
  const defAno = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()

  const [mes, setMes] = useState(defMes)
  const [ano, setAno] = useState(defAno)
  const [loading, setLoading] = useState(false)
  const [relatorio, setRelatorio] = useState<RelatorioFechamento | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [alertasAberto, setAlertasAberto] = useState(true)

  async function executar() {
    setLoading(true)
    setRelatorio(null)
    setErro(null)
    try {
      const res = await fetch('/api/agente-fechamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes, ano }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.error ?? 'Erro ao executar o agente')
        return
      }
      setRelatorio(data as RelatorioFechamento)
      setAlertasAberto((data as RelatorioFechamento).total_alertas > 0)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const statusColor = relatorio
    ? relatorio.status_geral === 'ok'
      ? 'border-green-200 bg-green-50'
      : relatorio.status_geral === 'aviso'
        ? 'border-amber-200 bg-amber-50'
        : 'border-red-200 bg-red-50'
    : ''

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#19366018' }}>
          <Bot size={20} style={{ color: '#193660' }} />
        </div>
        <div>
          <h2 className="text-base font-bold text-gray-900">Agente de Fechamento</h2>
          <p className="text-xs text-gray-500">
            Executa sync, verifica custos ADM/SUB, calcula KPIs e envia extratos automaticamente
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Mês</label>
          <select
            value={mes}
            onChange={e => setMes(Number(e.target.value))}
            disabled={loading}
            className="text-sm border border-gray-200 rounded-md px-3 py-2 bg-white text-gray-700"
          >
            {MESES.map((nome, i) => (
              <option key={nome} value={i + 1}>{nome}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Ano</label>
          <select
            value={ano}
            onChange={e => setAno(Number(e.target.value))}
            disabled={loading}
            className="text-sm border border-gray-200 rounded-md px-3 py-2 bg-white text-gray-700"
          >
            {ANOS.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <Button
          onClick={executar}
          disabled={loading}
          className="bg-[#193660] hover:bg-[#193660]/90 gap-2"
        >
          {loading ? (
            <>
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              Executando... (até 60s)
            </>
          ) : (
            <>
              <Bot size={16} />
              Executar Agente
            </>
          )}
        </Button>
      </div>

      {erro && (
        <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {erro}
        </div>
      )}

      {relatorio && (
        <div className="mt-5 space-y-4">
          {/* Header do resultado */}
          <div className={`rounded-xl border p-4 ${statusColor}`}>
            <div className="flex items-center gap-2 mb-1">
              <StatusIcon status={relatorio.status_geral} />
              <span className="font-semibold text-gray-900">
                {relatorio.status_geral === 'ok'
                  ? 'Fechamento concluído sem alertas'
                  : relatorio.status_geral === 'aviso'
                    ? `Concluído com ${relatorio.total_alertas} alerta(s)`
                    : `Erro — ${relatorio.total_alertas} problema(s) encontrado(s)`}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              {relatorio.periodo} · {(relatorio.duracao_ms / 1000).toFixed(1)}s
            </p>
          </div>

          {/* KPIs */}
          {relatorio.etapas.kpis && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Faturamento', value: formatCurrency(relatorio.etapas.kpis.faturamento), color: 'text-[#193660]' },
                { label: 'Custos', value: formatCurrency(relatorio.etapas.kpis.custos), color: 'text-red-600' },
                { label: 'Lucro', value: formatCurrency(relatorio.etapas.kpis.lucro), color: relatorio.etapas.kpis.lucro >= 0 ? 'text-green-600' : 'text-red-600' },
                { label: 'Margem', value: `${relatorio.etapas.kpis.margem_percent}%`, color: relatorio.etapas.kpis.margem_percent >= 10 ? 'text-green-600' : 'text-amber-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white rounded-lg border border-gray-100 px-3 py-2.5">
                  <div className="text-xs text-gray-400 mb-0.5">{label}</div>
                  <div className={`text-sm font-bold ${color}`}>{value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Etapas */}
          <div className="space-y-2">
            {[
              {
                label: 'Sync Amenitiz',
                ok: relatorio.etapas.sync_amenitiz?.status === 'ok',
                detalhe: relatorio.etapas.sync_amenitiz
                  ? `${relatorio.etapas.sync_amenitiz.reservas ?? 0} reservas · ${formatCurrency(relatorio.etapas.sync_amenitiz.faturamento_liquido ?? 0)}`
                  : '—',
              },
              {
                label: 'Custos ADM',
                ok: (relatorio.etapas.custos_adm?.empreendimentos_com_dados ?? 0) >= 5,
                detalhe: `${relatorio.etapas.custos_adm?.empreendimentos_com_dados ?? 0} empreendimentos`,
              },
              {
                label: 'Custos SUB',
                ok: (relatorio.etapas.custos_sub?.empreendimentos_com_dados ?? 0) >= 5,
                detalhe: `${relatorio.etapas.custos_sub?.empreendimentos_com_dados ?? 0} empreendimentos`,
              },
              {
                label: 'Lançamentos manuais',
                ok: (relatorio.etapas.custos_manuais?.total ?? 0) === 0,
                detalhe: relatorio.etapas.custos_manuais?.total === 0
                  ? 'Nenhum'
                  : `${relatorio.etapas.custos_manuais?.total} lançamento(s) — ${formatCurrency(relatorio.etapas.custos_manuais?.valor_total ?? 0)}`,
              },
              {
                label: 'Emails proprietários',
                ok: (relatorio.etapas.emails?.erros ?? 0) === 0,
                detalhe: `${relatorio.etapas.emails?.enviados ?? 0} enviados · ${relatorio.etapas.emails?.erros ?? 0} erros`,
              },
            ].map(({ label, ok, detalhe }) => (
              <div key={label} className="flex items-center gap-3 text-sm">
                {ok
                  ? <CheckCircle2 size={15} className="text-green-500 shrink-0" />
                  : <AlertCircle size={15} className="text-amber-500 shrink-0" />}
                <span className="text-gray-700 font-medium w-40 shrink-0">{label}</span>
                <span className="text-gray-500 text-xs">{detalhe}</span>
              </div>
            ))}
          </div>

          {/* Alertas */}
          {relatorio.alertas.length > 0 && (
            <div className="rounded-xl border border-amber-100 overflow-hidden">
              <button
                onClick={() => setAlertasAberto(v => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-amber-50 text-sm font-medium text-amber-800"
              >
                <span>{relatorio.alertas.length} alerta(s)</span>
                {alertasAberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {alertasAberto && (
                <ul className="px-4 py-3 space-y-2 bg-white">
                  {relatorio.alertas.map((a, i) => (
                    <li key={i} className="text-sm text-gray-700">{a}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
