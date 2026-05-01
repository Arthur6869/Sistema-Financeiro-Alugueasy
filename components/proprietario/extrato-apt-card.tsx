'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/constants'
import { Home, FileText, ChevronDown, Download } from 'lucide-react'

export type CustoCategoria = {
  categoria: string
  valor: number
}

export type ExtratoAptProps = {
  aptId: string
  numero: string
  empreendimento: string | null
  tipoGestao: 'adm' | 'sub' | null
  faturamento: number
  custos: number
  lucro: number
  repasse: number
  valorProprietario: number
  taxaRepasse: number
  tipoRepasse: 'lucro' | 'faturamento'
  custosPorCategoria: CustoCategoria[]
  semFaturamento: boolean
  semCustos: boolean
  mesLabel: string
  mes: number
  ano: number
}

export function ExtratoAptCard(props: ExtratoAptProps) {
  const {
    aptId, numero, empreendimento, tipoGestao,
    faturamento, custos, lucro, repasse, valorProprietario,
    taxaRepasse, tipoRepasse, custosPorCategoria,
    semFaturamento, semCustos, mesLabel, mes, ano,
  } = props

  const [custosAberto, setCustosAberto] = useState(false)
  const semTudo = semFaturamento && semCustos

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header do card */}
      <div className="bg-gray-50 border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Home size={14} className="text-[#193660]" />
            <span className="text-sm font-semibold text-gray-800">
              Apt {numero} — {empreendimento}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={tipoGestao === 'adm'
                ? 'border-blue-200 bg-blue-50 text-blue-700 text-xs'
                : 'border-purple-200 bg-purple-50 text-purple-700 text-xs'}
            >
              {tipoGestao === 'adm' ? 'Administração' : 'Sublocação'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Corpo */}
      {semTudo ? (
        <div className="flex flex-col items-center justify-center py-8 text-center text-gray-400 px-4">
          <FileText size={28} className="mb-2 text-gray-200" />
          <p className="text-sm">Nenhum dado disponível para {mesLabel}</p>
          <p className="text-xs mt-1">Os dados podem levar alguns dias para ser processados</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {/* Faturamento */}
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-sm text-gray-600">Faturamento</span>
            {semFaturamento
              ? <span className="text-xs text-gray-400 italic">Não disponível</span>
              : <span className="text-sm font-semibold text-[#193660]">{formatCurrency(faturamento)}</span>
            }
          </div>

          {/* Custos — linha clicável com accordion no mobile */}
          <div>
            <button
              className="w-full flex justify-between items-center px-4 py-3 text-left"
              onClick={() => setCustosAberto(v => !v)}
            >
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                Custos
                {!semCustos && (
                  <ChevronDown
                    size={14}
                    className={`text-gray-400 transition-transform ${custosAberto ? 'rotate-180' : ''}`}
                  />
                )}
              </div>
              {semCustos
                ? <span className="text-xs text-gray-400 italic">Não disponível</span>
                : <span className="text-sm font-semibold text-red-600">{formatCurrency(custos)}</span>
              }
            </button>

            {/* Categorias de custo */}
            {custosAberto && !semCustos && (
              <div className="bg-gray-50 divide-y divide-gray-100">
                {custosPorCategoria.map((c, i) => (
                  <div key={i} className="flex justify-between items-center pl-8 pr-4 py-2">
                    <span className="text-xs text-gray-500">{c.categoria}</span>
                    <span className="text-xs text-gray-700">{formatCurrency(c.valor)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lucro */}
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-sm text-gray-600">Lucro</span>
            <span className={`text-sm font-semibold ${lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(lucro)}
            </span>
          </div>

          {/* Taxa repasse */}
          <div className="flex justify-between items-center px-4 py-2.5">
            <span className="text-xs text-gray-500">
              Repasse ({taxaRepasse}% s/ {tipoRepasse === 'faturamento' ? 'fat.' : 'lucro'})
            </span>
            <span className="text-sm text-amber-600">− {formatCurrency(repasse)}</span>
          </div>

          {/* Valor líquido — destaque */}
          <div className="flex justify-between items-center px-4 py-3 bg-[#193660]/5">
            <span className="text-sm font-bold text-[#193660]">Seu repasse</span>
            <span className={`text-base font-bold ${valorProprietario >= 0 ? 'text-[#193660]' : 'text-red-600'}`}>
              {formatCurrency(valorProprietario)}
            </span>
          </div>
        </div>
      )}

      {/* Botão PDF — inline no desktop, flutuante já cuidado na página pai */}
      <div className="px-4 py-3 bg-white border-t border-gray-100">
        <a
          href={`/api/prestacao-contas-pdf?apartamento_id=${aptId}&mes=${mes}&ano=${ano}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 text-xs font-medium text-[#193660] border border-[#193660] hover:bg-[#193660] hover:text-white transition-colors rounded-lg px-3 py-2 w-full md:w-auto md:inline-flex"
        >
          <Download size={13} />
          Baixar PDF
        </a>
      </div>
    </div>
  )
}
