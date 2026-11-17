'use client'

import {
  BarChart3, Building2, Check, ClipboardCheck, Download, FileCheck2, FileText, Home, Lock,
  Mail, MailCheck, Plus, RefreshCw, Sparkles, Upload, type LucideIcon,
} from 'lucide-react'
import { formatCurrency } from '@/lib/constants'
import { EXEMPLO, administracaoExemplo, repasseExemplo } from '@/components/landing/exemplo-extrato'

/*
 * Prévias do painel colorido — uma por portal, mostrando o que a pessoa
 * encontra depois de entrar. Tudo ILUSTRATIVO: nada aqui vem do banco.
 *
 * São decorativas (aria-hidden): o conteúdo "de verdade" está nas listas
 * abaixo de cada prévia. O estado final já vem no HTML; quem esconde e anima
 * é use-login-motion.ts, lendo `data-viz` e `data-count`.
 */

/* ── Equipe interna ────────────────────────────────────────────────── */

const KPIS = [
  { label: 'Faturamento', valor: 148, prefixo: 'R$ ', sufixo: 'k', delta: '▲ 12%' },
  { label: 'Lucro líquido', valor: 94, prefixo: 'R$ ', sufixo: 'k', delta: '▲ 8%' },
  { label: 'Margem', valor: 63, prefixo: '', sufixo: '%', delta: '▲ 2pp' },
]

// [faturamento, lucro] em % da altura do gráfico
const BARRAS = [
  [62, 38], [84, 55], [71, 44], [96, 63], [55, 30], [88, 57],
  [67, 41], [76, 47], [100, 66], [92, 60], [48, 27],
]

const RECURSOS_INTERNO = [
  'Dashboard com KPIs em tempo real',
  'Importação de planilhas Excel',
  'Sincronização com Amenitiz',
  'Relatório analítico 6 meses',
  'Controle por empreendimento',
]

/**
 * `perfil` só muda a prévia: no Admin as ações ficam apagadas e aparece o
 * selo "Somente leitura". O acesso real é decidido pela conta, no servidor.
 */
export function VisualInterno({ perfil }: { perfil: 'analista' | 'admin' }) {
  return (
    <div className="lg-viz" data-viz="interno" data-perfil={perfil}>
      <div className="lg-float">
        <div className="lg-glass lg-tilt" aria-hidden="true">
          <div className="lg-viz-head">
            <span><BarChart3 size={13} /> Dashboard</span>
            <span className="lg-ilustra">Prévia ilustrativa</span>
          </div>

          <div className="lg-kpis">
            {KPIS.map(k => (
              <div key={k.label}>
                <small>{k.label}</small>
                <b data-count={k.valor} data-prefix={k.prefixo} data-suffix={k.sufixo} data-formato="kpi">
                  {`${k.prefixo}${k.valor}${k.sufixo}`}
                </b>
                <i>{k.delta}</i>
              </div>
            ))}
          </div>

          <div className="lg-vbars">
            {BARRAS.map(([fat, luc], i) => (
              <span key={i}>
                <i className="lg-vbar" style={{ height: `${fat}%` }} />
                <i className="lg-vbar is-luc" style={{ height: `${luc}%` }} />
              </span>
            ))}
          </div>

          <div className="lg-acoes">
            <span className="lg-acao"><Upload size={13} /> Importar</span>
            <span className="lg-acao"><Plus size={13} /> Lançar custo</span>
            <span className="lg-acao"><RefreshCw size={13} /> Sincronizar</span>
            <span className="lg-somente"><Lock size={12} /> Somente leitura</span>
          </div>
        </div>
      </div>

      <ul className="lg-extra">
        {RECURSOS_INTERNO.map(r => (
          <li key={r}><Check size={14} aria-hidden="true" />{r}</li>
        ))}
      </ul>
    </div>
  )
}

/* ── Proprietário ──────────────────────────────────────────────────── */

const RECURSOS_PROPRIETARIO: { icon: LucideIcon; label: string }[] = [
  { icon: FileText, label: 'Prestação de contas mensal' },
  { icon: Home, label: 'Extrato do seu apartamento' },
  { icon: Download, label: 'Download de relatórios PDF' },
  { icon: BarChart3, label: 'Indicadores financeiros' },
]

export function VisualProprietario() {
  return (
    <div className="lg-viz" data-viz="proprietario">
      <div className="lg-float">
        <div className="lg-glass lg-tilt" aria-hidden="true">
          <div className="lg-viz-head">
            <span><FileText size={13} /> Prestação de contas</span>
            <span className="lg-ilustra">Exemplo ilustrativo</span>
          </div>

          <div className="lg-ext-row lg-ext-linha">
            <span>Receita das reservas</span>
            <b data-count={EXEMPLO.receita}>{formatCurrency(EXEMPLO.receita)}</b>
          </div>
          <div className="lg-ext-row lg-ext-linha">
            <span>(−) Custos do mês</span>
            <b className="is-neg" data-count={EXEMPLO.custos} data-prefix="− ">
              {`− ${formatCurrency(EXEMPLO.custos)}`}
            </b>
          </div>
          <div className="lg-ext-row lg-ext-linha">
            <span>(−) Administração AlugEasy</span>
            <b className="is-neg" data-count={administracaoExemplo} data-prefix="− ">
              {`− ${formatCurrency(administracaoExemplo)}`}
            </b>
          </div>

          <div className="lg-ext-total lg-ext-linha">
            <span>Seu repasse</span>
            <strong data-count={repasseExemplo}>{formatCurrency(repasseExemplo)}</strong>
          </div>

          <div className="lg-ext-pdf lg-ext-linha">
            <span className="lg-ext-ico"><FileCheck2 size={16} /></span>
            <span>
              <b>Prestação de contas em PDF</b>
              <small>Todo mês, no seu portal</small>
            </span>
            <Download size={16} />
          </div>
        </div>
      </div>

      <ul className="lg-extra">
        {RECURSOS_PROPRIETARIO.map(r => (
          <li key={r.label}><r.icon size={15} aria-hidden="true" />{r.label}</li>
        ))}
      </ul>
    </div>
  )
}

/* ── Equipe de limpeza ─────────────────────────────────────────────── */

export const PASSOS_LIMPEZA: { icon: LucideIcon; label: string }[] = [
  { icon: Building2, label: 'Escolha o imóvel' },
  { icon: ClipboardCheck, label: 'Marque o checklist' },
  { icon: Sparkles, label: 'Finalize a limpeza' },
  { icon: Mail, label: 'A AlugEasy é avisada' },
]

const CHECKLIST = [
  { area: 'Cozinha', item: 'bancada, pia e fogão' },
  { area: 'Banheiro', item: 'box, espelho e toalhas' },
  { area: 'Quarto', item: 'roupa de cama trocada' },
  { area: 'Sala', item: 'piso e sofá' },
  { area: 'Geral', item: 'lixo retirado' },
]

/** A demonstração percorre as quatro etapas em sequência e recomeça. */
export function VisualOperacional() {
  return (
    <div className="lg-viz" data-viz="operacional">
      <div className="lg-float">
        <div className="lg-glass lg-tilt" aria-hidden="true">
          <div className="lg-viz-head">
            <span><Building2 size={13} /> Apartamento 202</span>
            <span><b className="lg-feitos">{CHECKLIST.length}</b>&nbsp;de {CHECKLIST.length}</span>
          </div>
          <div className="lg-prog"><i className="lg-prog-fill" /></div>

          <div className="lg-check-wrap">
            <ul className="lg-check">
              {CHECKLIST.map(c => (
                <li key={c.area} className="lg-check-item">
                  <span className="lg-box">
                    <svg viewBox="0 0 16 16" fill="none">
                      <path
                        className="lg-tick" d="M3.5 8.5l3 3 6-7"
                        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="lg-check-txt"><b>{c.area}</b><span>{c.item}</span></span>
                </li>
              ))}
            </ul>

            <div className="lg-fim">
              <span className="lg-fim-btn"><Sparkles size={13} /> Finalizar limpeza</span>
              <span className="lg-fim-ok"><MailCheck size={14} /> AlugEasy avisada</span>
            </div>
          </div>
        </div>
      </div>

      <ol className="lg-passos">
        {PASSOS_LIMPEZA.map(p => (
          <li key={p.label} className="lg-passo">
            <p.icon size={16} aria-hidden="true" />
            {p.label}
          </li>
        ))}
      </ol>
    </div>
  )
}
