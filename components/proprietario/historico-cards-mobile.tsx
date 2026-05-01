'use client'

import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { formatCurrency, MESES } from '@/lib/constants'

type StatusBadge = 'em_andamento' | 'fechado' | 'sem_dados'

function StatusPill({ status }: { status: StatusBadge }) {
  if (status === 'em_andamento') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">
        Em andamento
      </span>
    )
  }
  if (status === 'fechado') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">
        Fechado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500">
      Sem dados
    </span>
  )
}

type MesDado = {
  m: number
  a: number
  faturamento: number
  lucro: number
  valorProprietario: number
  semDados: boolean
  status: StatusBadge
}

export function HistoricoCardsMobile({ dados }: { dados: MesDado[] }) {
  const router = useRouter()

  return (
    <div className="md:hidden space-y-3">
      {dados.map(({ m, a, faturamento, lucro, valorProprietario, semDados, status }) => (
        <button
          key={`${a}-${m}`}
          onClick={() => router.push(`/proprietario/extrato?mes=${m}&ano=${a}`)}
          className="w-full bg-white rounded-xl px-4 py-4 shadow-sm border border-gray-100 text-left active:scale-[0.98] transition-transform"
        >
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">
                {MESES[m - 1]} {a}
              </span>
              <StatusPill status={status} />
            </div>
            <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
          </div>

          {semDados ? (
            <p className="text-xs text-gray-400 italic">Sem dados disponíveis</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-gray-500 mb-0.5">Faturamento</div>
                <div className="font-semibold text-[#193660]">{formatCurrency(faturamento)}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-0.5">Lucro</div>
                <div className={`font-semibold ${lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(lucro)}
                </div>
              </div>
              <div>
                <div className="text-gray-500 mb-0.5">Seu valor</div>
                <div className="font-semibold text-amber-600">{formatCurrency(valorProprietario)}</div>
              </div>
            </div>
          )}
        </button>
      ))}
    </div>
  )
}
