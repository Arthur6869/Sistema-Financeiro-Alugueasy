'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Receipt,
  CalendarDays,
} from 'lucide-react'

import { MESES, ANOS } from '@/lib/constants'

const TIPOS = [
  {
    id: 'custos_adm',
    label: 'Conferência de Custos — ADM',
    desc: 'Custos de imóveis administrados diretamente',
    icon: Receipt,
    color: '#193660',
  },
  {
    id: 'diarias_adm',
    label: 'Conferência de Diárias — ADM',
    desc: 'Receita de diárias — gestão ADM',
    icon: CalendarDays,
    color: '#0891b2',
  },
  {
    id: 'custos_sub',
    label: 'Conferência de Custos — SUB',
    desc: 'Custos de imóveis sublocados',
    icon: Receipt,
    color: '#7c3aed',
  },
  {
    id: 'diarias_sub',
    label: 'Conferência de Diárias — SUB',
    desc: 'Receita de diárias — gestão SUB',
    icon: CalendarDays,
    color: '#059669',
  },
]

const TIPO_LABELS: Record<string, string> = {
  custos_adm: 'Custos ADM',
  custos_sub: 'Custos SUB',
  diarias_adm: 'Diárias ADM',
  diarias_sub: 'Diárias SUB',
}

export default function ImportarPage() {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano, setAno] = useState(now.getFullYear())
  const [uploading, setUploading] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, 'ok' | 'error'>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [historico, setHistorico] = useState<any[]>([])
  const [loadingHistorico, setLoadingHistorico] = useState(true)

  const supabase = createClient()

  const loadHistorico = useCallback(async () => {
    setLoadingHistorico(true)
    const { data } = await supabase
      .from('importacoes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    setHistorico(data ?? [])
    setLoadingHistorico(false)
  }, []) // supabase é estável por ser criado fora do render

  useEffect(() => {
    loadHistorico()
  }, [loadHistorico])

  async function handleUpload(tipo: string, file: File) {
    setUploading(tipo)
    setResults((prev) => ({ ...prev, [tipo]: undefined as any }))
    setErrors((prev) => ({ ...prev, [tipo]: '' }))

    const formData = new FormData()
    formData.append('file', file)
    formData.append('tipo', tipo)
    formData.append('mes', String(mes))
    formData.append('ano', String(ano))

    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        setResults((prev) => ({ ...prev, [tipo]: 'ok' }))
        await loadHistorico()
      } else {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        setErrors((prev) => ({ ...prev, [tipo]: body?.error ?? `HTTP ${res.status}` }))
        setResults((prev) => ({ ...prev, [tipo]: 'error' }))
      }
    } catch (e: any) {
      setErrors((prev) => ({ ...prev, [tipo]: e?.message ?? 'Erro de rede' }))
      setResults((prev) => ({ ...prev, [tipo]: 'error' }))
    } finally {
      setUploading(null)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Importar Planilhas</h1>
          <Badge style={{ backgroundColor: '#193660' }} className="text-white text-xs">
            Admin only
          </Badge>
        </div>
        <p className="text-gray-500 text-sm mt-1">
          Faça upload das planilhas Excel de conferência do mês
        </p>
      </div>

      {/* Seletor de Mês/Ano */}
      <Card className="border border-gray-100 shadow-sm mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-800">
            Período de Referência
          </CardTitle>
          <CardDescription className="text-xs text-gray-400">
            Selecione o mês e ano ao qual os dados pertencem
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <select
              value={mes}
              onChange={(e) => {
                setMes(Number(e.target.value))
                setResults({})
              }}
              className="text-sm border border-gray-200 rounded-md px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#193660]/30 cursor-pointer"
            >
              {MESES.map((nome, i) => (
                <option key={i + 1} value={i + 1}>
                  {nome}
                </option>
              ))}
            </select>
            <select
              value={ano}
              onChange={(e) => {
                setAno(Number(e.target.value))
                setResults({})
              }}
              className="text-sm border border-gray-200 rounded-md px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#193660]/30 cursor-pointer"
            >
              {ANOS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <span className="text-sm text-gray-500 font-medium">
              Importando para: <strong>{MESES[mes - 1]} {ano}</strong>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Cards de upload */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {TIPOS.map((tipo) => {
          const Icon = tipo.icon
          const status = results[tipo.id]
          const isLoading = uploading === tipo.id

          return (
            <Card
              key={tipo.id}
              className="border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: tipo.color + '15' }}
                  >
                    <Icon size={20} style={{ color: tipo.color }} />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold text-gray-800">
                      {tipo.label}
                    </CardTitle>
                    <CardDescription className="text-xs text-gray-400 mt-0.5">
                      {tipo.desc}
                    </CardDescription>
                  </div>
                  {status === 'ok' && (
                    <CheckCircle2 size={18} className="ml-auto text-green-500 flex-shrink-0" />
                  )}
                  {status === 'error' && (
                    <AlertCircle size={18} className="ml-auto text-red-500 flex-shrink-0" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <label
                  htmlFor={`upload-${tipo.id}`}
                  className={`
                    flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed cursor-pointer
                    transition-all duration-150
                    ${isLoading
                      ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                      : status === 'ok'
                      ? 'border-green-200 bg-green-50'
                      : status === 'error'
                      ? 'border-red-200 bg-red-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }
                  `}
                >
                  {isLoading ? (
                    <Loader2 size={24} className="animate-spin text-gray-400" />
                  ) : (
                    <FileSpreadsheet
                      size={24}
                      style={{ color: status === 'ok' ? '#22c55e' : status === 'error' ? '#ef4444' : tipo.color }}
                    />
                  )}
                  <span className="text-sm text-gray-500 font-medium">
                    {isLoading
                      ? 'Processando...'
                      : status === 'ok'
                      ? 'Importado com sucesso!'
                      : status === 'error'
                      ? 'Erro ao importar — tente novamente'
                      : 'Clique ou arraste o arquivo .xlsx'}
                  </span>
                  <span className="text-xs text-gray-400">Formato aceito: .xlsx</span>
                </label>
                <input
                  id={`upload-${tipo.id}`}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  disabled={isLoading}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleUpload(tipo.id, file)
                    e.target.value = ''
                  }}
                />
                {errors[tipo.id] && (
                  <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2 break-all">
                    {errors[tipo.id]}
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Histórico real */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <Upload size={18} />
            Histórico de Importações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-gray-100">
                <TableHead className="text-gray-500">Data</TableHead>
                <TableHead className="text-gray-500">Tipo</TableHead>
                <TableHead className="text-gray-500">Período</TableHead>
                <TableHead className="text-gray-500">Arquivo</TableHead>
                <TableHead className="text-gray-500">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingHistorico ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Loader2 size={20} className="animate-spin text-gray-300 mx-auto" />
                  </TableCell>
                </TableRow>
              ) : historico.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                    Nenhuma importação realizada ainda
                  </TableCell>
                </TableRow>
              ) : (
                historico.map((imp) => (
                  <TableRow key={imp.id} className="border-gray-100 hover:bg-gray-50">
                    <TableCell className="text-gray-600 text-sm">
                      {new Date(imp.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {TIPO_LABELS[imp.tipo] ?? imp.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-600 text-sm">
                      {MESES[(imp.mes ?? 1) - 1]} {imp.ano}
                    </TableCell>
                    <TableCell className="text-gray-600 text-sm max-w-[180px] truncate">
                      {imp.nome_arquivo}
                    </TableCell>
                    <TableCell>
                      {imp.status === 'concluido' ? (
                        <Badge className="bg-green-100 text-green-700 border-green-200 text-xs" variant="outline">
                          <CheckCircle2 size={10} className="mr-1" /> Concluído
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700 border-red-200 text-xs" variant="outline">
                          <AlertCircle size={10} className="mr-1" /> Erro
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
