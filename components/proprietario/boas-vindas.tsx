import Link from 'next/link'
import { ArrowRight, Check, FileText, History, Wallet } from 'lucide-react'
import { LogoMarca } from '@/components/marca/logo-marca'
import { Entrada } from '@/components/painel/entrada'

const RECURSOS = [
  { titulo: 'Repasse do mês em tempo real', desc: 'Veja quanto vai receber antes do fechamento' },
  { titulo: 'Histórico de 12 meses', desc: 'Faturamento, custos e lucro, mês a mês' },
  { titulo: 'Prestação de contas em PDF', desc: 'Pronta para o contador ou para o seu arquivo' },
]

const PREVIAS = [
  { icone: Wallet, titulo: 'Seu repasse', desc: 'Valor do mês atual' },
  { icone: History, titulo: 'Histórico', desc: 'Últimos 12 meses' },
  { icone: FileText, titulo: 'PDF', desc: 'Prestação de contas' },
]

/** Boas-vindas do primeiro acesso: o que o portal oferece e a ALU. Só visual. */
export function BoasVindas({ nome }: { nome: string }) {
  return (
    <Entrada className="grid min-h-[calc(100dvh-4rem)] lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      {/* ── painel da marca ── */}
      <aside className="relative isolate overflow-hidden bg-[linear-gradient(160deg,#18396a_0%,#0f2647_48%,#0a1b36_100%)] px-6 py-7 text-white lg:px-10 lg:py-10">
        <div aria-hidden="true" className="absolute -right-24 -top-28 -z-10 size-80 rounded-full border border-white/10" />
        <div aria-hidden="true" className="absolute -bottom-20 -left-20 -z-10 size-60 rounded-full border border-white/5" />
        <div aria-hidden="true" className="absolute -bottom-16 -right-16 -z-10 size-72 rounded-full bg-[radial-gradient(circle,rgba(74,222,128,0.22)_0%,transparent_70%)]" />

        <div className="flex h-full flex-col gap-8 lg:gap-12">
          <div data-entrada className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-white/10"><LogoMarca size={22} /></span>
            <span className="leading-tight">
              <span className="block text-[13px] font-bold tracking-[0.08em]">ALUGUEASY</span>
              <span className="block font-rotulo text-[10px] uppercase tracking-[0.14em] text-white/55">Portal do proprietário</span>
            </span>
          </div>

          <div className="hidden flex-1 lg:block">
            <p data-entrada className="font-titulo text-[34px] leading-[1.15] tracking-[-0.01em]">
              Transparência financeira<br />do seu imóvel,<br />todo mês.
            </p>
            <p data-entrada className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">
              Acompanhe o rendimento dos seus imóveis, entenda cada centavo e baixe a prestação de contas quando precisar.
            </p>
            <ul className="mt-8 space-y-4 border-t border-white/10 pt-8">
              {RECURSOS.map(r => (
                <li key={r.titulo} data-entrada className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[rgba(74,222,128,0.2)] text-[#4ade80]"><Check size={13} strokeWidth={3} aria-hidden="true" /></span>
                  <span>
                    <span className="block text-sm font-semibold text-white/90">{r.titulo}</span>
                    <span className="block text-xs text-white/50">{r.desc}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p data-entrada className="hidden text-[11px] leading-relaxed text-white/35 lg:block">
            AlugEasy © 2026 — Gestão financeira<br />de imóveis por temporada
          </p>
        </div>
      </aside>

      {/* ── boas-vindas ── */}
      <section className="relative flex items-center justify-center bg-creme px-4 py-8 sm:px-8 lg:px-12">
        <div aria-hidden="true" className="absolute inset-0 opacity-[0.35] [background-image:radial-gradient(circle,#cfc8b6_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="relative z-10 flex w-full max-w-[960px] items-center gap-9">
          <div data-entrada className="w-full max-w-[26rem] shrink-0 rounded-3xl border border-linha bg-white p-7 shadow-[0_2px_12px_rgba(15,26,46,0.06)] sm:p-10">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-positivo/20 bg-positivo/10 px-3 py-1 font-rotulo text-[10.5px] font-semibold uppercase tracking-[0.1em] text-positivo">
              <LogoMarca size={11} />
              Sua área exclusiva
            </span>
            <p className="mt-6 text-[13px] text-apagado">Seja bem-vindo</p>
            <h1 data-split className="mt-1 break-words font-titulo text-[36px] leading-[1.1] tracking-[-0.01em] text-tinta">{nome}</h1>
            <p className="mt-4 text-sm leading-relaxed text-tinta-suave">
              Seu portal está pronto. Aqui você acompanha o faturamento, os custos e o repasse dos seus imóveis todos os meses.
            </p>

            <Link
              href="/proprietario"
              className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-positivo text-sm font-semibold text-white shadow-[0_2px_8px_rgba(21,128,61,0.25)] transition-colors hover:bg-[#166534] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-positivo"
            >
              Acessar meu portal
              <ArrowRight size={16} aria-hidden="true" />
            </Link>

            {/* a ALU, assistente do portal */}
            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-positivo/20 bg-positivo/5 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/alu-avatar.png" alt="" width={42} height={42} className="size-[42px] shrink-0 rounded-full object-cover" />
              <p className="text-xs leading-relaxed text-tinta-suave">
                <span className="block text-[13px] font-semibold text-tinta">Conheça a ALU, sua assistente</span>
                Ela te guia pelo portal no primeiro acesso e responde suas dúvidas a qualquer momento.
              </p>
            </div>

            <ul className="mt-6 grid grid-cols-3 gap-2 border-t border-linha pt-6">
              {PREVIAS.map(p => (
                <li key={p.titulo} className="rounded-2xl border border-linha px-2 py-3.5 text-center">
                  <span className="mx-auto grid size-8 place-items-center rounded-xl bg-marca-50 text-marca-700"><p.icone size={15} aria-hidden="true" /></span>
                  <span className="mt-2 block text-[11.5px] font-semibold text-tinta">{p.titulo}</span>
                  <span className="block text-[10.5px] text-apagado">{p.desc}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* arte de apresentação da ALU — só em telas largas */}
          <div data-entrada className="hidden min-w-0 flex-1 overflow-hidden rounded-3xl bg-[#0d1c3f] shadow-[0_2px_12px_rgba(15,26,46,0.08)] xl:block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/alu-apresentacao.png" alt="ALU, assistente virtual AlugEasy: consulte resultados por mês, veja extratos completos e acompanhe o histórico" className="block h-auto w-full" />
          </div>
        </div>
      </section>
    </Entrada>
  )
}
