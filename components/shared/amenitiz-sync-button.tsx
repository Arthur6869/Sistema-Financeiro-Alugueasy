'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, Wifi, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { MESES, formatCurrency } from '@/lib/constants'

interface Props { mesInicial: number; anoInicial: number }

type Resultado = {
  success?: boolean
  error?: string
  // campos do GET (testar conexão)
  ok?: boolean
  status?: number
  detail?: string
  hotelId?: string
  reservasCount?: number
  mensagem?: string
  // campos do POST (sincronizar)
  total_reservas?: number
  faturamento_bruto?: number
  faturamento_liquido?: number
  apartamentos_sincronizados?: number
  apartamentos_nao_encontrados?: string[]
}

export function AmenitizSyncButton({ mesInicial, anoInicial }: Props) {
  const [mes, setMes] = useState(mesInicial)
  const [ano, setAno] = useState(anoInicial)
  const [loading, setLoading] = useState(false)
  const [testando, setTestando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)

  async function testarConexao() {
    setTestando(true)
    setResultado(null)
    try {
      const res = await fetch('/api/amenitiz-sync')
      const text = await res.text()
      try {
        setResultado(JSON.parse(text))
      } catch {
        setResultado({ error: `Resposta inválida do servidor (HTTP ${res.status}): ${text.slice(0, 200)}` })
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro de rede ao alcançar /api/amenitiz-sync'
      setResultado({ error: msg })
    } finally {
      setTestando(false)
    }
  }

  async function sincronizar() {
    if (!confirm(
      `Sincronizar ${MESES[mes - 1]} ${ano} com a Amenitiz?\n\n` +
      `Taxas aplicadas automaticamente:\n` +
      `• Booking: 13% ou 16% por empreendimento\n` +
      `• Airbnb: sem taxa\n` +
      `• Alugueasy / Manual: 10%`
    )) return

    setLoading(true)
    setResultado(null)
    try {
      const res = await fetch('/api/amenitiz-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes, ano }),
      })
      const text = await res.text()
      try {
        const data = JSON.parse(text)
        setResultado(data)
        if (data.success) window.location.reload()
      } catch {
        setResultado({ error: `Resposta inválida do servidor (HTTP ${res.status}): ${text.slice(0, 200)}` })
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro de rede ao alcançar /api/amenitiz-sync'
      setResultado({ error: msg })
    } finally {
      setLoading(false)
    }
  }

  const isError = !!resultado?.error || resultado?.ok === false
  const isSuccess = resultado?.success || resultado?.ok === true

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={mes}
          onChange={e => setMes(+e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
        >
          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select
          value={ano}
          onChange={e => setAno(+e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
        >
          {[2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <Button
          onClick={sincronizar}
          disabled={loading}
          className="bg-[#193660] hover:bg-[#152d52] text-white"
        >
          <RefreshCw size={15} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Sincronizando...' : 'Sincronizar Reservas'}
        </Button>
        <Button onClick={testarConexao} disabled={testando} variant="outline">
          <Wifi size={15} className="mr-2" />
          {testando ? 'Testando...' : 'Testar Conexão'}
        </Button>
      </div>

      {resultado && (
        <div className={`rounded-xl p-4 text-sm border ${
          isError
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-green-50 border-green-200 text-green-800'
        }`}>
          <div className="flex items-start gap-2">
            {isError
              ? <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              : isSuccess
              ? <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
              : <Info size={16} className="flex-shrink-0 mt-0.5" />
            }
            <div className="space-y-1 min-w-0">
              {/* Mensagem principal */}
              {resultado.error && (
                <p className="font-semibold">Erro: {resultado.error}</p>
              )}

              {/* Resultado do teste de conexão */}
              {resultado.ok !== undefined && !resultado.error && (
                <p className="font-semibold">{resultado.mensagem}</p>
              )}
              {resultado.detail && !resultado.ok && (
                <p className="text-xs opacity-80 break-all font-mono bg-red-100 rounded p-1 mt-1">
                  {resultado.detail}
                </p>
              )}
              {resultado.hotelId && (
                <p className="text-xs opacity-70">hotel_id usado: <code>{resultado.hotelId}</code></p>
              )}

              {/* Resultado da sincronização */}
              {resultado.success && (
                <div className="space-y-1">
                  <p className="font-semibold">Sincronização concluída com sucesso</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
                    <span>Reservas processadas:</span>
                    <span className="font-bold">{resultado.total_reservas}</span>
                    <span>Faturamento bruto:</span>
                    <span className="font-bold">{formatCurrency(resultado.faturamento_bruto ?? 0)}</span>
                    <span>Faturamento líquido:</span>
                    <span className="font-bold">{formatCurrency(resultado.faturamento_liquido ?? 0)}</span>
                    <span>Apartamentos atualizados:</span>
                    <span className="font-bold">{resultado.apartamentos_sincronizados}</span>
                  </div>
                  {(resultado.apartamentos_nao_encontrados?.length ?? 0) > 0 && (
                    <p className="text-amber-700 font-medium mt-2 p-2 bg-amber-50 rounded-lg border border-amber-200">
                      ⚠️ Não encontrados no banco (cadastrar em /empreendimentos):{' '}
                      {resultado.apartamentos_nao_encontrados?.join(', ')}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
