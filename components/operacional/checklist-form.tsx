'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, CheckCircle2, AlertTriangle, Loader2, MailCheck, MailWarning, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { agruparPorArea, type ItemChecklistModelo, type MembroEquipe } from '@/lib/limpeza'

type Rascunho = { marcados: string[]; observacao: string; iniciadaEm: string; responsaveis?: string[] }

type Resultado = { completa: boolean; feitos: number; total: number; emailEnviado: boolean; nomes: string[] }

// O rascunho fica no aparelho: se a página recarregar ou o celular travar no meio
// da limpeza, nada do que já foi marcado se perde. Some ao enviar.
const chave = (aptId: string) => `alugueasy:limpeza:${aptId}`
const RASCUNHO_VALIDADE_MS = 12 * 3600_000

function lerRascunho(aptId: string): Rascunho | null {
  try {
    const bruto = localStorage.getItem(chave(aptId))
    if (!bruto) return null
    const r = JSON.parse(bruto) as Rascunho
    if (Date.now() - Date.parse(r.iniciadaEm) > RASCUNHO_VALIDADE_MS) return null
    return r
  } catch { return null }
}

export function ChecklistForm({
  unidadeId, imovel, itens, equipe, usuarioId,
}: {
  unidadeId: string
  imovel: string
  itens: ItemChecklistModelo[]
  equipe: MembroEquipe[]
  usuarioId: string
}) {
  const router = useRouter()
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  // Quem fez a limpeza: a própria pessoa já vem marcada; ela adiciona colegas.
  const [responsaveis, setResponsaveis] = useState<Set<string>>(() => new Set([usuarioId]))
  const [observacao, setObservacao] = useState('')
  const [iniciadaEm, setIniciadaEm] = useState(() => new Date().toISOString())
  const [carregouRascunho, setCarregouRascunho] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [resultado, setResultado] = useState<Resultado | null>(null)

  const grupos = useMemo(() => agruparPorArea(itens), [itens])
  const total = itens.length
  const feitos = itens.filter(i => marcados.has(i.id)).length
  const completo = total > 0 && feitos === total
  const pct = total ? Math.round((feitos / total) * 100) : 0
  const idsEquipe = useMemo(() => new Set(equipe.map(m => m.id)), [equipe])

  useEffect(() => {
    const r = lerRascunho(unidadeId)
    // Leitura do armazenamento do navegador só existe no cliente: precisa do efeito.
    if (r) {
      setMarcados(new Set(r.marcados))
      setObservacao(r.observacao)
      setIniciadaEm(r.iniciadaEm)
      if (r.responsaveis?.length) setResponsaveis(new Set(r.responsaveis))
    }
    setCarregouRascunho(true)
  }, [unidadeId])

  useEffect(() => {
    if (!carregouRascunho || resultado) return
    try {
      localStorage.setItem(chave(unidadeId), JSON.stringify({
        marcados: [...marcados], observacao, iniciadaEm, responsaveis: [...responsaveis],
      }))
    } catch { /* armazenamento indisponível: segue sem rascunho */ }
  }, [marcados, observacao, iniciadaEm, responsaveis, unidadeId, carregouRascunho, resultado])

  function alternar(id: string) {
    setErro('')
    setMarcados(prev => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id); else novo.add(id)
      return novo
    })
  }

  function alternarArea(ids: string[]) {
    setErro('')
    setMarcados(prev => {
      const novo = new Set(prev)
      const todos = ids.every(id => novo.has(id))
      ids.forEach(id => (todos ? novo.delete(id) : novo.add(id)))
      return novo
    })
  }

  function alternarResponsavel(id: string) {
    setErro('')
    setResponsaveis(prev => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id); else novo.add(id)
      return novo
    })
  }

  async function finalizar() {
    setErro('')
    // Só ids que ainda existem na equipe (alguém pode ter sido desativado)
    const ids = [...responsaveis].filter(id => idsEquipe.has(id))
    if (ids.length === 0) {
      setErro('Marque quem fez a limpeza.')
      document.getElementById('responsaveis')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (!completo && observacao.trim().length < 5) {
      setErro('Alguns itens não foram marcados. Explique nas observações o que não foi feito e por quê.')
      document.getElementById('observacao')?.focus()
      return
    }
    setEnviando(true)
    try {
      const res = await fetch('/api/limpezas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unidade_id: unidadeId,
          itens: itens.map(i => ({ id: i.id, concluido: marcados.has(i.id) })),
          responsaveis_ids: ids,
          observacao,
          iniciada_em: iniciadaEm,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok && !data.duplicada) {
        setErro(data.error ?? 'Não foi possível enviar. Verifique a internet e tente de novo.')
        return
      }
      try { localStorage.removeItem(chave(unidadeId)) } catch { /* ignore */ }
      setResultado({
        completa: data.duplicada ? completo : !!data.completa,
        feitos: data.itens_concluidos ?? feitos,
        total: data.total_itens ?? total,
        emailEnviado: data.duplicada ? true : !!data.email_enviado,
        nomes: equipe.filter(m => ids.includes(m.id)).map(m => m.nome.split(' ')[0]),
      })
      router.refresh()
      window.scrollTo({ top: 0 })
    } catch {
      setErro('Sem conexão. Seu checklist continua salvo neste aparelho; tente enviar de novo.')
    } finally {
      setEnviando(false)
    }
  }

  if (resultado) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
        <div className={cn(
          'w-16 h-16 rounded-full mx-auto flex items-center justify-center',
          resultado.completa ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700',
        )}>
          {resultado.completa ? <CheckCircle2 size={34} /> : <AlertTriangle size={32} />}
        </div>
        <h2 className="text-xl font-bold text-[#0f1a2e] mt-4">Limpeza registrada!</h2>
        <p className="text-sm text-gray-600 mt-1">
          {imovel} · {resultado.feitos} de {resultado.total} itens
        </p>
        <p className="text-sm text-gray-500 mt-1">Feita por {resultado.nomes.join(', ')}</p>
        <div className={cn(
          'inline-flex items-center gap-1.5 text-xs mt-3 px-3 py-1 rounded-full',
          resultado.emailEnviado ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600',
        )}>
          {resultado.emailEnviado ? <MailCheck size={13} /> : <MailWarning size={13} />}
          {resultado.emailEnviado ? 'A AlugEasy foi avisada por e-mail' : 'Registro salvo. O escritório verá no sistema.'}
        </div>
        <Link
          href="/operacional"
          className="block w-full mt-6 py-3.5 rounded-xl bg-[#0f766e] text-white font-semibold"
        >
          Voltar para os imóveis
        </Link>
      </div>
    )
  }

  if (total === 0) {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
        Nenhum item de checklist cadastrado. Avise o escritório.
      </div>
    )
  }

  return (
    <div>
      {/* Progresso fixo no topo para quem rola a lista no celular */}
      <div className="sticky top-14 z-30 -mx-4 px-4 py-3 bg-[#f4f5f7]/95 backdrop-blur border-b border-gray-200 mb-4">
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="font-semibold text-[#0f1a2e]">{feitos} de {total} itens</span>
          <span className={cn('font-semibold', completo ? 'text-green-700' : 'text-gray-500')}>{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
          <div className={cn('h-full transition-all', completo ? 'bg-green-600' : 'bg-[#0f766e]')} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="space-y-4">
        {grupos.map(g => {
          const ids = g.itens.map(i => i.id)
          const todos = ids.every(id => marcados.has(id))
          return (
            <section key={g.area} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h2 className="font-bold text-[#0f1a2e]">{g.area}</h2>
                <button
                  type="button"
                  onClick={() => alternarArea(ids)}
                  className="text-xs font-semibold text-[#0f766e] px-2 py-1 rounded-md hover:bg-[#0f766e]/10"
                >
                  {todos ? 'Desmarcar todos' : 'Marcar todos'}
                </button>
              </div>
              <ul className="divide-y divide-gray-100">
                {g.itens.map(item => {
                  const on = marcados.has(item.id)
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => alternar(item.id)}
                        aria-pressed={on}
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50"
                      >
                        <span className={cn(
                          'w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors',
                          on ? 'bg-[#0f766e] border-[#0f766e] text-white' : 'border-gray-300 bg-white',
                        )}>
                          {on && <Check size={17} strokeWidth={3} />}
                        </span>
                        <span className={cn('text-[15px]', on ? 'text-gray-500 line-through' : 'text-[#0f1a2e]')}>
                          {item.descricao}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}

        <section className="bg-white rounded-2xl border border-gray-200 p-4">
          <label htmlFor="observacao" className="font-bold text-[#0f1a2e] block">
            Observações {!completo && <span className="text-amber-700 font-semibold text-sm">(obrigatório se faltar algum item)</span>}
          </label>
          <p className="text-xs text-gray-500 mt-0.5 mb-2">Algo quebrado, faltando ou que não deu para fazer? Conte aqui. O escritório recebe por e-mail.</p>
          <textarea
            id="observacao"
            value={observacao}
            onChange={e => { setObservacao(e.target.value); setErro('') }}
            rows={4}
            maxLength={2000}
            placeholder="Ex.: lâmpada do banheiro queimada; faltou papel higiênico no estoque."
            className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-base outline-none focus:border-[#0f766e] focus:bg-white focus:ring-2 focus:ring-[#0f766e]/15"
          />
        </section>

        <section id="responsaveis" className="bg-white rounded-2xl border border-gray-200 p-4">
          <h2 className="font-bold text-[#0f1a2e] flex items-center gap-2">
            <Users size={17} className="text-[#0f766e]" />
            Quem fez a limpeza?
          </h2>
          <p className="text-xs text-gray-500 mt-0.5 mb-3">Marque todas as pessoas que participaram. Os nomes vão no registro e no e-mail.</p>
          {equipe.length === 0 ? (
            <p className="text-sm text-amber-700">Nenhuma conta da equipe encontrada. Avise o escritório.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {equipe.map(m => {
                const on = responsaveis.has(m.id)
                const euMesmo = m.id === usuarioId
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => alternarResponsavel(m.id)}
                    aria-pressed={on}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full border-2 text-sm font-medium transition-colors',
                      on ? 'bg-[#0f766e] border-[#0f766e] text-white' : 'bg-white border-gray-200 text-gray-700',
                    )}
                  >
                    {on && <Check size={14} strokeWidth={3} />}
                    {m.nome.split(' ')[0]}{euMesmo ? ' (você)' : ''}
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {erro && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{erro}</div>
        )}

        <button
          type="button"
          onClick={finalizar}
          disabled={enviando}
          className={cn(
            'w-full py-4 rounded-xl text-white font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-60',
            completo ? 'bg-green-700' : 'bg-[#0f766e]',
          )}
        >
          {enviando
            ? <><Loader2 size={18} className="animate-spin" /> Enviando…</>
            : completo ? 'Finalizar limpeza' : `Finalizar com ${total - feitos} item(ns) pendente(s)`}
        </button>
      </div>
    </div>
  )
}
