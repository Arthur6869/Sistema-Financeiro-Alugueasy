'use client'

import { useState, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/constants'
import { ClipboardList, Users, Wrench, Building2, FileCheck } from 'lucide-react'

const TOTAL_FIXO = 43509.92
const CUSTO_DIARIA = 250.00

const CUSTOS_FIXOS = [
  { categoria: 'Pessoal & Limpeza', descricao: 'Salário fixo — Limpeza', quantidade: 1, valorUnitario: 3100.00 },
  { categoria: 'Pessoal & Limpeza', descricao: 'Salários — Limpeza', quantidade: 4, valorUnitario: 2500.00 },
  { categoria: 'Operacional', descricao: 'Atendimento', quantidade: 1, valorUnitario: 2765.44 },
  { categoria: 'Operacional', descricao: 'Manutenção', quantidade: 1, valorUnitario: 4000.00 },
  { categoria: 'Operacional', descricao: 'Financeiro', quantidade: 1, valorUnitario: 1500.00 },
  { categoria: 'Infraestrutura', descricao: 'Aluguel', quantidade: 1, valorUnitario: 1800.00 },
  { categoria: 'Infraestrutura', descricao: 'Condomínio', quantidade: 1, valorUnitario: 980.00 },
  { categoria: 'Contratos & Licenças', descricao: 'Softwares', quantidade: 1, valorUnitario: 3500.00 },
  { categoria: 'Contratos & Licenças', descricao: 'Consórcio (cota A)', quantidade: 3, valorUnitario: 2602.82 },
  { categoria: 'Contratos & Licenças', descricao: 'Consórcio (cota B)', quantidade: 1, valorUnitario: 1058.42 },
]

const ICONES_CATEGORIA: Record<string, React.ReactNode> = {
  'Pessoal & Limpeza': <Users size={15} />,
  'Operacional': <Wrench size={15} />,
  'Infraestrutura': <Building2 size={15} />,
  'Contratos & Licenças': <FileCheck size={15} />,
}

interface Props {
  mes: number
  ano: number
  diariasIniciais: number
  role: string
}

export function CustosOperacionaisClient({ mes, ano, diariasIniciais, role }: Props) {
  const [diarias, setDiarias] = useState(diariasIniciais)
  const [salvando, setSalvando] = useState(false)
  const [savedDiarias, setSavedDiarias] = useState(diariasIniciais)

  const totalComDiarias = TOTAL_FIXO + diarias * CUSTO_DIARIA
  const totalVariavel = diarias * CUSTO_DIARIA

  const handleDiariasChange = useCallback((val: number) => {
    setDiarias(val)
  }, [])

  const handleSalvar = useCallback(async () => {
    if (role !== 'analista') return
    setSalvando(true)
    try {
      await fetch('/api/custos-operacionais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes, ano, diarias }),
      })
      setSavedDiarias(diarias)
    } finally {
      setSalvando(false)
    }
  }, [mes, ano, diarias, role])

  const categorias = Array.from(new Set(CUSTOS_FIXOS.map((c) => c.categoria)))

  return (
    <div className="space-y-6">
      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Fixo Mensal"
          value={formatCurrency(TOTAL_FIXO)}
          sub="custos fixos recorrentes"
          borderColor="#f87171"
          iconBg="#fef2f2"
          iconColor="#ef4444"
        />
        <MetricCard
          label="Custo por Diária"
          value={`${formatCurrency(CUSTO_DIARIA)}/un.`}
          sub="limpeza avulsa"
          borderColor="#fb923c"
          iconBg="#fff7ed"
          iconColor="#f97316"
        />
        <MetricCard
          label="Total com Diárias"
          value={formatCurrency(totalComDiarias)}
          sub={`${diarias} diária${diarias !== 1 ? 's' : ''} × ${formatCurrency(CUSTO_DIARIA)}`}
          borderColor="#3b82f6"
          iconBg="#eff6ff"
          iconColor="#3b82f6"
          highlight
        />
        <MetricCard
          label="% sobre Faturamento"
          value="—"
          sub="ver dashboard para %"
          borderColor="#22c55e"
          iconBg="#f0fdf4"
          iconColor="#16a34a"
        />
      </div>

      {/* Controle de diárias variáveis */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-orange-50">
              <ClipboardList size={17} className="text-orange-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Diárias avulsas no mês</p>
              <p className="text-xs text-gray-400">Limpezas variáveis — {formatCurrency(CUSTO_DIARIA)} por diária</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 whitespace-nowrap">Quantidade:</label>
              <input
                type="number"
                min={0}
                value={diarias}
                onChange={(e) => handleDiariasChange(Math.max(0, parseInt(e.target.value) || 0))}
                disabled={role !== 'analista'}
                className="w-24 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            <div className="text-sm text-gray-500">
              Total variável: <span className="font-bold text-orange-600">{formatCurrency(totalVariavel)}</span>
            </div>
            {role === 'analista' && diarias !== savedDiarias && (
              <button
                onClick={handleSalvar}
                disabled={salvando}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabela de custos por categoria */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Detalhamento por categoria</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <th className="px-6 py-3 text-left">Descrição</th>
                <th className="px-4 py-3 text-center">Qtd</th>
                <th className="px-4 py-3 text-right">Valor Unit.</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-center">Tipo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {categorias.map((cat) => {
                const itens = CUSTOS_FIXOS.filter((c) => c.categoria === cat)
                const subtotal = itens.reduce((s, i) => s + i.quantidade * i.valorUnitario, 0)
                return (
                  <>
                    <tr key={`cat-${cat}`} className="bg-gray-50/60">
                      <td colSpan={4} className="px-6 py-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          <span className="text-gray-400">{ICONES_CATEGORIA[cat]}</span>
                          {cat}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right text-xs font-bold text-gray-600">
                        {formatCurrency(subtotal)}
                      </td>
                    </tr>
                    {itens.map((item) => (
                      <tr key={item.descricao} className="hover:bg-gray-50/40 transition-colors">
                        <td className="px-6 py-3 text-gray-700 pl-10">{item.descricao}</td>
                        <td className="px-4 py-3 text-center text-gray-500">{item.quantidade}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(item.valorUnitario)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-800">
                          {formatCurrency(item.quantidade * item.valorUnitario)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge className="text-xs bg-blue-50 text-blue-700 border-blue-200 border hover:bg-blue-50">
                            Fixo
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </>
                )
              })}

              {/* Linha de diárias variáveis */}
              <tr className="bg-gray-50/60">
                <td colSpan={4} className="px-6 py-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <span className="text-gray-400"><Users size={15} /></span>
                    Pessoal & Limpeza — Variável
                  </div>
                </td>
                <td className="px-4 py-2 text-right text-xs font-bold text-gray-600">
                  {formatCurrency(totalVariavel)}
                </td>
              </tr>
              <tr className="hover:bg-gray-50/40 transition-colors">
                <td className="px-6 py-3 text-gray-700 pl-10">Diárias avulsas</td>
                <td className="px-4 py-3 text-center text-gray-500">{diarias}</td>
                <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(CUSTO_DIARIA)}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-800">
                  {formatCurrency(totalVariavel)}
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge className="text-xs bg-orange-50 text-orange-700 border-orange-200 border hover:bg-orange-50">
                    Variável
                  </Badge>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td colSpan={3} className="px-6 py-4 font-bold text-gray-700">Total Geral</td>
                <td className="px-4 py-4 text-right font-extrabold text-gray-900 text-base">
                  {formatCurrency(totalComDiarias)}
                </td>
                <td className="px-4 py-4 text-center">
                  <span className="text-xs text-gray-400">{diarias} var.</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

interface MetricCardProps {
  label: string
  value: string
  sub: string
  borderColor: string
  iconBg: string
  iconColor: string
  highlight?: boolean
}

function MetricCard({ label, value, sub, borderColor, iconBg, iconColor, highlight }: MetricCardProps) {
  return (
    <div className="relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ backgroundColor: borderColor }} />
      <div className="p-5 pl-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">{label}</p>
        <p className={`text-2xl font-extrabold leading-none mb-1 ${highlight ? 'text-blue-700' : 'text-gray-900'}`}>
          {value}
        </p>
        <p className="text-xs text-gray-400 mt-1">{sub}</p>
      </div>
    </div>
  )
}
