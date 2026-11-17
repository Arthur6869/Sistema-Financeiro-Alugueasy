'use client'

import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PaginaInterna } from '@/components/painel/pagina'
import { moeda, porcento } from '@/components/dashboard/valor'
import { IndicadoresFin } from './detalhe-empreendimento'
import { SeloGestao, temMovimento, type Fin, type Visao } from './fin'

export type DiariaItem = { data: string /* aaaa-mm-dd */; valor: number; tipo_gestao: string | null }
export type CustoItem = { categoria: string; valor: number; tipo_gestao: string | null }

const dia = (data: string) => Number(data.slice(8, 10))
const dataCompleta = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}`

/**
 * Uma coluna por dia do mês. Substitui o gráfico de área: diária é um valor
 * por dia, não uma curva contínua — a linha ligando os pontos sugeria
 * faturamento em dias sem hospedagem.
 */
function FaturamentoPorDia({ diarias, mes, ano }: { diarias: DiariaItem[]; mes: number; ano: number }) {
  const diasNoMes = new Date(ano, mes, 0).getDate()
  const porDia = new Map<number, number>()
  diarias.forEach(d => porDia.set(dia(d.data), (porDia.get(dia(d.data)) ?? 0) + d.valor))

  const maior = Math.max(1, ...porDia.values())
  const total = diarias.reduce((s, d) => s + d.valor, 0)
  const [diaDoPico] = [...porDia].sort((a, b) => b[1] - a[1])[0] ?? [0]
  const mm = String(mes).padStart(2, '0')
  const dias = Array.from({ length: diasNoMes }, (_, i) => i + 1)
  // rótulos do eixo: poucos e redondos
  const rotulado = (d: number) => d === 1 || d % 5 === 0

  return (
    <section data-entrada aria-labelledby="titulo-dia" className="rounded-2xl border border-linha bg-white p-5">
      <h2 id="titulo-dia" className="text-[15px] font-semibold text-tinta">Faturamento por dia</h2>
      <p className="mt-0.5 text-[13px] text-apagado">
        {porDia.size} {porDia.size === 1 ? 'dia' : 'dias'} com diária · média de {moeda(total / Math.max(porDia.size, 1))} · maior em{' '}
        {String(diaDoPico).padStart(2, '0')}/{mm} ({moeda(maior)})
      </p>

      <div className="mt-5 flex h-36 items-end gap-[3px] border-b border-linha" role="group" aria-label="Faturamento de cada dia do mês">
        {dias.map(d => {
          const valor = porDia.get(d) ?? 0
          const rotulo = `${String(d).padStart(2, '0')}/${mm}`
          return (
            <Tooltip key={d}>
              <TooltipTrigger
                render={<button type="button" aria-label={`${rotulo}: ${valor > 0 ? moeda(valor) : 'sem diária'}`} />}
                className="group flex h-full min-w-0 flex-1 items-end justify-center rounded-t-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-marca-700"
              >
                {valor > 0 ? (
                  <span
                    data-coluna
                    className="w-full max-w-6 origin-bottom rounded-t-[4px] bg-serie-faturamento transition-[filter] group-hover:brightness-125"
                    style={{ height: `${Math.max(3, (valor / maior) * 100)}%` }}
                  />
                ) : (
                  // dia sem diária: só um traço, para a base não parecer interrompida
                  <span className="h-px w-full max-w-6 bg-transparent" />
                )}
              </TooltipTrigger>
              <TooltipContent>
                <span className="font-semibold">{valor > 0 ? moeda(valor) : 'Sem diária'}</span>
                <span className="opacity-75">{rotulo}</span>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
      <div aria-hidden="true" className="mt-1.5 flex gap-[3px] text-[10.5px] tabular-nums text-apagado">
        {dias.map(d => <span key={d} className="min-w-0 flex-1 text-center">{rotulado(d) ? d : ''}</span>)}
      </div>
    </section>
  )
}

/**
 * Categorias de custo em barras ordenadas, uma cor só. Substitui a pizza de
 * até dez cores: fatias parecidas não dão para comparar, barras dão.
 */
function CustosPorCategoria({ custos }: { custos: CustoItem[] }) {
  const porCategoria = new Map<string, number>()
  custos.forEach(c => porCategoria.set(c.categoria, (porCategoria.get(c.categoria) ?? 0) + c.valor))
  const linhas = [...porCategoria].sort((a, b) => b[1] - a[1])
  const total = linhas.reduce((s, [, v]) => s + v, 0)
  const maior = Math.max(1, ...linhas.map(([, v]) => v))

  return (
    <section data-entrada aria-labelledby="titulo-categorias" className="rounded-2xl border border-linha bg-white p-5">
      <h2 id="titulo-categorias" className="text-[15px] font-semibold text-tinta">Custos por categoria</h2>
      <p className="mt-0.5 text-[13px] text-apagado">
        {linhas.length} {linhas.length === 1 ? 'categoria' : 'categorias'} · {moeda(total)} no total
      </p>
      <ol className="mt-4 space-y-3">
        {linhas.map(([categoria, valor]) => (
          <li key={categoria}>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="min-w-0 truncate font-medium text-tinta">{categoria}</span>
              <span className="shrink-0 tabular-nums text-tinta-suave">
                <span className="font-medium text-tinta">{moeda(valor)}</span> · {total > 0 ? porcento((valor / total) * 100) : '—'}
              </span>
            </div>
            <span aria-hidden="true" className="mt-1.5 block h-2">
              <span data-barra className="block h-full origin-left rounded-r-[4px] bg-serie-custo-reservas" style={{ width: `${(valor / maior) * 100}%` }} />
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Lancamentos({ titulo, total, colunaNome, vazio, linhas }: {
  titulo: string
  total: number
  colunaNome: string
  vazio: string
  linhas: { chave: string; nome: string; tipo: string | null; valor: number }[]
}) {
  return (
    <section data-entrada className="rounded-2xl border border-linha bg-white">
      <div className="flex items-baseline justify-between gap-3 px-5 pt-5">
        <h2 className="text-[15px] font-semibold text-tinta">{titulo}</h2>
        {linhas.length > 0 && <p className="text-sm font-semibold tabular-nums text-tinta">{moeda(total)}</p>}
      </div>
      {linhas.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-apagado/80">{vazio}</p>
      ) : (
        <table className="mt-3 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-linha text-[13px] text-apagado">
              <th scope="col" className="px-3 py-2.5 pl-5 text-left font-medium">{colunaNome}</th>
              <th scope="col" className="px-3 py-2.5 text-left font-medium">Gestão</th>
              <th scope="col" className="px-3 py-2.5 pr-5 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(l => (
              <tr key={l.chave} className="border-b border-linha/70 last:border-0">
                <th scope="row" className="px-3 py-2.5 pl-5 text-left font-normal text-tinta">{l.nome}</th>
                <td className="px-3 py-2.5"><SeloGestao tipo={l.tipo} /></td>
                <td className="px-3 py-2.5 pr-5 text-right font-medium tabular-nums text-tinta">{moeda(l.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

/** Nível 3 da aba: um apartamento, dia a dia e custo a custo. */
export function DetalheApartamento({ mes, ano, periodo, visao, emp, apt, fin, diarias, custos }: {
  mes: number
  ano: number
  periodo: string
  visao: Visao
  emp: { id: string; nome: string }
  apt: { numero: string }
  fin: Fin
  diarias: DiariaItem[]
  custos: CustoItem[]
}) {
  const nomeMes = periodo.split(' ')[0]
  // Sem diárias importadas, o faturamento vem das reservas da Amenitiz (regra da página)
  const veioDasReservas = diarias.length === 0 && fin.fat > 0

  return (
    <PaginaInterna
      rotulo="Apartamento"
      titulo={`Apartamento ${apt.numero}`}
      sub={`${emp.nome} · ${periodo}`}
      voltar={{ href: `/empreendimentos?emp=${emp.id}&mes=${mes}&ano=${ano}&view=${visao}`, rotulo: emp.nome }}
      periodo={{ mes, ano, permitirTodos: false }}
    >
      {temMovimento(fin) ? (
        <IndicadoresFin fin={fin} periodo={periodo} />
      ) : (
        <p data-entrada className="rounded-2xl border border-linha bg-white px-5 py-10 text-center text-sm text-apagado">
          Sem faturamento nem custos em {periodo}.
        </p>
      )}

      {veioDasReservas && (
        <p data-entrada className="flex items-start gap-2.5 rounded-2xl border border-linha bg-white px-4 py-3 text-sm leading-snug text-tinta-suave">
          <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-marca-700" />
          <span>
            <strong className="font-semibold text-tinta">Faturamento vindo das reservas da Amenitiz.</strong>{' '}
            Não há diárias importadas para este apartamento em {nomeMes}, então não existe detalhe dia a dia.
          </span>
        </p>
      )}

      {(diarias.length > 0 || custos.length > 0) && (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          {diarias.length > 0 && <FaturamentoPorDia diarias={diarias} mes={mes} ano={ano} />}
          {custos.length > 0 && <CustosPorCategoria custos={custos} />}
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Lancamentos
          titulo="Diárias"
          total={diarias.reduce((s, d) => s + d.valor, 0)}
          colunaNome="Data"
          vazio={`Sem diárias em ${nomeMes}`}
          linhas={diarias.map((d, i) => ({ chave: `${d.data}-${i}`, nome: dataCompleta(d.data), tipo: d.tipo_gestao, valor: d.valor }))}
        />
        <Lancamentos
          titulo="Custos"
          total={custos.reduce((s, c) => s + c.valor, 0)}
          colunaNome="Categoria"
          vazio={`Sem custos em ${nomeMes}`}
          linhas={custos.map((c, i) => ({ chave: `${c.categoria}-${i}`, nome: c.categoria, tipo: c.tipo_gestao, valor: c.valor }))}
        />
      </div>
    </PaginaInterna>
  )
}
