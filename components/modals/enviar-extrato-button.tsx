'use client'

import { useState } from 'react'
import { Mail, Loader2, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MESES } from '@/lib/constants'

interface Props {
  proprietarioId: string
  proprietarioNome: string
}

const ANOS = [2024, 2025, 2026, 2027]

export function EnviarExtratoButton({ proprietarioId, proprietarioNome }: Props) {
  const now = new Date()
  const [aberto, setAberto] = useState(false)
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano, setAno] = useState(now.getFullYear())
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string } | null>(null)

  async function enviar() {
    setLoading(true)
    setResultado(null)
    try {
      const res = await fetch('/api/enviar-extrato-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proprietario_id: proprietarioId, mes, ano }),
      })
      const data = await res.json()
      if (res.ok) {
        setResultado({ ok: true, msg: `Email enviado para ${data.email_enviado_para}` })
        setTimeout(() => { setAberto(false); setResultado(null) }, 3000)
      } else {
        setResultado({ ok: false, msg: data.error ?? 'Erro desconhecido' })
      }
    } catch {
      setResultado({ ok: false, msg: 'Erro de conexão' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative inline-block">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs border-[#193660] text-[#193660] hover:bg-[#193660] hover:text-white"
        onClick={() => { setAberto(v => !v); setResultado(null) }}
      >
        <Mail size={12} />
        Enviar Extrato
        <ChevronDown size={10} className={`transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </Button>

      {aberto && (
        <div className="absolute right-0 top-9 z-50 w-64 bg-white border border-gray-200 rounded-xl shadow-lg p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-700">
            Enviar extrato para<br />
            <span className="text-[#193660]">{proprietarioNome}</span>
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold block mb-1">Mês</label>
              <select
                value={mes}
                onChange={e => setMes(Number(e.target.value))}
                className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#193660]"
              >
                {MESES.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold block mb-1">Ano</label>
              <select
                value={ano}
                onChange={e => setAno(Number(e.target.value))}
                className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#193660]"
              >
                {ANOS.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>

          {resultado && (
            <p className={`text-xs px-2 py-1.5 rounded-md ${resultado.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {resultado.ok ? '✅ ' : '❌ '}{resultado.msg}
            </p>
          )}

          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-xs text-gray-500 hover:text-gray-700"
              onClick={() => setAberto(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="flex-1 text-xs bg-[#193660] hover:bg-[#193660]/90"
              onClick={enviar}
              disabled={loading}
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : 'Enviar'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
