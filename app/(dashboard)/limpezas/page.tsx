import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CheckCircle2, AlertTriangle, MailCheck, MailWarning, ListChecks, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { agruparPorArea, duracao, formatarDataHora, inicioDoPeriodo, nomesResponsaveis, type Limpeza } from '@/lib/limpeza'

type SearchParams = Promise<{ dias?: string; operador?: string; status?: string }>

const PERIODOS = [
  { valor: '7', rotulo: '7 dias' },
  { valor: '30', rotulo: '30 dias' },
  { valor: '90', rotulo: '90 dias' },
]

export default async function LimpezasPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAnalista = me?.role === 'analista'

  const params = await searchParams
  const dias = PERIODOS.some(p => p.valor === params.dias) ? Number(params.dias) : 30
  const operador = params.operador && /^[0-9a-f-]{36}$/i.test(params.operador) ? params.operador : ''
  const status = params.status === 'incompleta' ? 'incompleta' : ''
  const desde = inicioDoPeriodo(dias)

  let query = supabase
    .from('limpezas')
    .select('id, apartamento_id, imovel, operador_id, operador_nome, responsaveis, iniciada_em, finalizada_em, itens, total_itens, itens_concluidos, completa, observacao, email_enviado, email_erro')
    .gte('finalizada_em', desde)
    .order('finalizada_em', { ascending: false })
    .limit(300)
  // Filtra por quem FEZ a limpeza (qualquer um dos responsáveis), não por quem enviou
  if (operador) query = query.contains('responsaveis', [{ id: operador }])
  if (status) query = query.eq('completa', false)

  const [{ data, error }, { data: equipe }] = await Promise.all([
    query,
    supabase.from('profiles').select('id, full_name').eq('role', 'operacional').order('full_name'),
  ])

  const limpezas = (data ?? []) as Limpeza[]
  const completas = limpezas.filter(l => l.completa).length
  const semEmail = limpezas.filter(l => !l.email_enviado).length

  const href = (mud: Partial<{ dias: string; operador: string; status: string }>) => {
    const q = new URLSearchParams()
    const v = { dias: String(dias), operador, status, ...mud }
    if (v.dias && v.dias !== '30') q.set('dias', v.dias)
    if (v.operador) q.set('operador', v.operador)
    if (v.status) q.set('status', v.status)
    const s = q.toString()
    return s ? `/limpezas?${s}` : '/limpezas'
  }

  const chip = (ativo: boolean) =>
    `px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
      ativo ? 'bg-[#193660] text-white border-[#193660]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
    }`

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles size={22} className="text-[#0f766e]" />
            Limpezas
          </h1>
          <p className="text-gray-500 text-sm mt-1">Checklists enviados pela equipe operacional</p>
        </div>
        {isAnalista && (
          <Link
            href="/limpezas/checklist"
            className="inline-flex items-center gap-2 text-sm font-semibold text-white rounded-lg px-4 py-2"
            style={{ backgroundColor: '#193660' }}
          >
            <ListChecks size={16} />
            Editar checklist
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="border border-gray-100 shadow-sm"><CardContent className="pt-5">
          <div className="text-xs text-gray-500">Limpezas no período</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{limpezas.length}</div>
        </CardContent></Card>
        <Card className="border border-gray-100 shadow-sm"><CardContent className="pt-5">
          <div className="text-xs text-gray-500">Checklist completo</div>
          <div className="text-2xl font-bold text-green-700 mt-1">
            {completas}<span className="text-sm text-gray-400 font-medium"> / {limpezas.length}</span>
          </div>
        </CardContent></Card>
        <Card className="border border-gray-100 shadow-sm"><CardContent className="pt-5">
          <div className="text-xs text-gray-500">Sem e-mail enviado</div>
          <div className={`text-2xl font-bold mt-1 ${semEmail ? 'text-amber-600' : 'text-gray-900'}`}>{semEmail}</div>
        </CardContent></Card>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        {PERIODOS.map(p => (
          <Link key={p.valor} href={href({ dias: p.valor })} className={chip(String(dias) === p.valor)}>{p.rotulo}</Link>
        ))}
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <Link href={href({ status: '' })} className={chip(!status)}>Todas</Link>
        <Link href={href({ status: 'incompleta' })} className={chip(status === 'incompleta')}>Só incompletas</Link>
        {(equipe ?? []).length > 0 && <span className="w-px h-5 bg-gray-200 mx-1" />}
        {(equipe ?? []).length > 0 && (
          <Link href={href({ operador: '' })} className={chip(!operador)}>Toda a equipe</Link>
        )}
        {(equipe ?? []).map(p => (
          <Link key={p.id} href={href({ operador: p.id })} className={chip(operador === p.id)}>
            {p.full_name?.split(' ')[0] ?? 'Sem nome'}
          </Link>
        ))}
      </div>

      <Card className="border border-gray-100 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-800">Registros</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-sm text-red-600">Não foi possível carregar as limpezas: {error.message}</p>
          ) : limpezas.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Nenhuma limpeza registrada neste filtro.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {limpezas.map(l => {
                const tempo = duracao(l.iniciada_em, l.finalizada_em)
                const pendentes = (l.itens ?? []).filter(i => !i.concluido)
                return (
                  <details key={l.id} className="group py-3">
                    <summary className="flex items-center gap-4 cursor-pointer list-none flex-wrap">
                      <div className="min-w-[160px]">
                        <div className="font-medium text-gray-900">{l.imovel}</div>
                        <div className="text-xs text-gray-500">{formatarDataHora(l.finalizada_em)}{tempo ? ` · ${tempo}` : ''}</div>
                      </div>
                      <div className="text-sm text-gray-700 flex-1 min-w-[120px]">
                        {nomesResponsaveis(l)}
                        {(l.responsaveis ?? []).length > 0 && !(l.responsaveis ?? []).some(r => r.id === l.operador_id) && (
                          <span className="block text-xs text-gray-400">registrado por {l.operador_nome}</span>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={l.completa ? 'border-green-200 bg-green-50 text-green-700' : 'border-amber-200 bg-amber-50 text-amber-700'}
                      >
                        {l.completa ? <CheckCircle2 size={11} className="mr-1" /> : <AlertTriangle size={11} className="mr-1" />}
                        {l.itens_concluidos}/{l.total_itens}
                      </Badge>
                      <span title={l.email_erro ?? 'E-mail enviado'} className={l.email_enviado ? 'text-green-600' : 'text-amber-500'}>
                        {l.email_enviado ? <MailCheck size={16} /> : <MailWarning size={16} />}
                      </span>
                      <span className="text-xs text-gray-400 group-open:hidden">ver itens</span>
                      <span className="text-xs text-gray-400 hidden group-open:inline">fechar</span>
                    </summary>

                    <div className="mt-3 ml-1 grid gap-4 md:grid-cols-2">
                      <div>
                        {agruparPorArea(l.itens ?? []).map(g => (
                          <div key={g.area} className="mb-2">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-[#193660]">{g.area}</div>
                            <ul className="mt-1 space-y-0.5">
                              {g.itens.map((i, k) => (
                                <li key={k} className={`text-sm ${i.concluido ? 'text-gray-600' : 'text-red-700 font-medium'}`}>
                                  {i.concluido ? '✓' : '✗'} {i.descricao}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-3">
                        {pendentes.length > 0 && (
                          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                            {pendentes.length} item(ns) não marcado(s).
                          </div>
                        )}
                        {l.observacao && (
                          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                            <div className="text-xs font-semibold text-gray-500 mb-1">Observações</div>
                            <p className="text-sm text-gray-800 whitespace-pre-wrap">{l.observacao}</p>
                          </div>
                        )}
                        {!l.email_enviado && l.email_erro && (
                          <p className="text-xs text-amber-700">E-mail não enviado: {l.email_erro}</p>
                        )}
                      </div>
                    </div>
                  </details>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
