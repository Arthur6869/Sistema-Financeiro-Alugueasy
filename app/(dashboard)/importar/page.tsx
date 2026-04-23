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
  RefreshCw,
  Trash2,
} from 'lucide-react'

import { MESES, ANOS } from '@/lib/constants'
import { AmenitizSyncButton } from '@/components/shared/amenitiz-sync-button'
import { SyncPlanilhasButton } from '@/components/shared/sync-planilhas-button'

const TIPOS = [
  {
    id: 'custos_adm',
    label: 'Conferência de Custos — ADM',
    desc: 'Custos de imóveis administrados diretamente',
    icon: Receipt,
    color: '#193660',
    grupo: 'Custos',
  },
  {
    id: 'custos_sub',
    label: 'Conferência de Custos — SUB',
    desc: 'Custos de imóveis sublocados',
    icon: Receipt,
    color: '#7c3aed',
    grupo: 'Custos',
  },
  {
    id: 'diarias_adm',
    label: 'Faturamento de Diárias — ADM',
    desc: 'Receitas de diárias de imóveis administrados (upload manual)',
    icon: FileSpreadsheet,
    color: '#0891b2',
    grupo: 'Diárias',
  },
  {
    id: 'diarias_sub',
    label: 'Faturamento de Diárias — SUB',
    desc: 'Receitas de diárias de imóveis sublocados (upload manual)',
    icon: FileSpreadsheet,
    color: '#059669',
    grupo: 'Diárias',
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
  const [filtroMes, setFiltroMes] = useState(0)
  const [filtroAno, setFiltroAno] = useState(now.getFullYear())
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [role, setRole] = useState<'analista' | 'admin' | null>(null)

  const supabase = createClient()

  // Carregar role do usuário logado
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('role').eq('id', user.id).single()
        .then(({ data }) => setRole(data?.role ?? 'admin'))
    })
  }, [])

  const loadHistorico = useCallback(async (fMes: number, fAno: number) => {
    setLoadingHistorico(true)
    let query = supabase
      .from('importacoes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    if (fMes > 0) query = query.eq('mes', fMes) as typeof query
    if (fAno > 0) query = query.eq('ano', fAno) as typeof query
    const { data } = await query
    setHistorico(data ?? [])
    setLoadingHistorico(false)
  }, [])

  useEffect(() => {
    loadHistorico(filtroMes, filtroAno)
  }, [loadHistorico, filtroMes, filtroAno])

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
        await loadHistorico(filtroMes, filtroAno)
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

  async function handleDelete(imp: any) {
    const periodoLabel = `${MESES[(imp.mes ?? 1) - 1]} ${imp.ano}`
    const tipoLabel = TIPO_LABELS[imp.tipo] ?? imp.tipo
    if (!confirm(`Excluir todos os dados de "${tipoLabel}" referentes a ${periodoLabel}?\n\nEsta ação remove os registros do banco e não pode ser desfeita.`)) return

    setDeletingId(imp.id)
    try {
      const tipo_gestao = imp.tipo.includes('adm') ? 'adm' : 'sub'

      if (imp.tipo.startsWith('custos')) {
        await supabase
          .from('custos')
          .delete()
          .eq('mes', imp.mes)
          .eq('ano', imp.ano)
          .eq('tipo_gestao', tipo_gestao)
      } else {
        const dataInicio = `${imp.ano}-${String(imp.mes).padStart(2, '0')}-01`
        const dataFim = new Date(imp.ano, imp.mes, 0).toISOString().slice(0, 10)
        await supabase
          .from('diarias')
          .delete()
          .gte('data', dataInicio)
          .lte('data', dataFim)
          .eq('tipo_gestao', tipo_gestao)
      }

      await supabase.from('importacoes').delete().eq('id', imp.id)
      await loadHistorico(filtroMes, filtroAno)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Importar Planilhas</h1>
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

      {/* Seções exclusivas do Analista */}
      {role === 'analista' && (
        <>
          {/* Seção Verificação com Planilhas Locais */}
          <div className="mb-6">
            <SyncPlanilhasButton mesInicial={mes} anoInicial={ano} />
          </div>

          {/* Seção Amenitiz */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: '#19366018' }}
              >
                <RefreshCw size={20} style={{ color: '#193660' }} />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  Sincronização Automática — Amenitiz
                </h2>
                <p className="text-xs text-gray-500">
                  Busca reservas diretamente da plataforma e aplica as taxas automaticamente
                  (Booking: 13%-16% | Airbnb: sem taxa | Alugueasy: 10%)
                </p>
              </div>
            </div>
            <AmenitizSyncButton mesInicial={mes} anoInicial={ano} />
          </div>

          {/* Cards de Upload por grupo */}
          {(['Custos', 'Diárias'] as const).map((grupo) => {
            const tiposGrupo = TIPOS.filter(t => t.grupo === grupo)
            return (
              <div key={grupo} className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-4 rounded-full inline-block" style={{ backgroundColor: tiposGrupo[0]?.color }} />
                  {grupo === 'Diárias'
                    ? 'Diárias — Upload Manual (use quando a sincronização Amenitiz não estiver disponível)'
                    : 'Custos — Upload de Planilhas'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tiposGrupo.map((tipo) => {
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
                                : 'Clique ou arraste o arquivo .xlsx ou .csv'}
                            </span>
                            <span className="text-xs text-gray-400">Formatos aceitos: .xlsx, .csv</span>
                          </label>
                          <input
                            id={`upload-${tipo.id}`}
                            type="file"
                            accept=".xlsx,.csv"
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
              </div>
            )
          })}
        </>
      )}

      {/* Histórico */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <Upload size={18} />
            Histórico de Importações
          </CardTitle>
          <div className="flex items-center gap-2">
            <select
              value={filtroMes}
              onChange={(e) => setFiltroMes(Number(e.target.value))}
              className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#193660]/30 cursor-pointer"
            >
              <option value={0}>Todos os meses</option>
              {MESES.map((nome, i) => (
                <option key={i + 1} value={i + 1}>{nome}</option>
              ))}
            </select>
            <select
              value={filtroAno}
              onChange={(e) => setFiltroAno(Number(e.target.value))}
              className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#193660]/30 cursor-pointer"
            >
              <option value={0}>Todos os anos</option>
              {ANOS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
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
                <TableHead className="text-gray-500 w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingHistorico ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 size={20} className="animate-spin text-gray-300 mx-auto" />
                  </TableCell>
                </TableRow>
              ) : historico.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                    Nenhuma importação encontrada
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
                    <TableCell>
                      {role === 'analista' && (
                        <button
                          onClick={() => handleDelete(imp)}
                          disabled={deletingId === imp.id}
                          className="p-1.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Excluir importação e dados"
                        >
                          {deletingId === imp.id
                            ? <Loader2 size={14} className="animate-spin" />
                            : <Trash2 size={14} />
                          }
                        </button>
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
