'use client'

import {
  Building2,
  Home as HomeIcon,
  FileSpreadsheet,
  Calculator,
  FileCheck2,
  ChevronRight,
  Check,
} from 'lucide-react'
import { formatCurrency } from '@/lib/constants'
import { EXEMPLO, administracaoExemplo, lucroExemplo, repasseExemplo } from './exemplo-extrato'

const STEPS = [
  {
    numero: '01',
    icon: Building2,
    rotulo: 'Cadastro',
    titulo: 'Seu imóvel faz parte de um empreendimento',
    desc: 'Cada apartamento administrado pela AlugEasy está vinculado a um empreendimento (prédio ou condomínio). Isso organiza tudo por localização e facilita o controle individual de cada unidade.',
  },
  {
    numero: '02',
    icon: HomeIcon,
    rotulo: 'Contrato',
    titulo: 'Cada apartamento tem um modelo de contrato',
    desc: 'Definimos junto com você se o imóvel opera em Administração (você recebe repasse sobre o lucro ou faturamento) ou Sublocação (a AlugEasy aluga o imóvel diretamente de você por um valor fixo). O modelo já fica configurado no seu cadastro.',
  },
  {
    numero: '03',
    icon: FileSpreadsheet,
    rotulo: 'Lançamentos',
    titulo: 'Lançamos as diárias e os custos todo mês',
    desc: 'Toda reserva feita (direto ou via plataformas como Booking e Airbnb, sincronizadas automaticamente pelo Amenitiz) gera uma diária. Despesas como limpeza, manutenção e taxas de plataforma são lançadas como custos do período.',
  },
  {
    numero: '04',
    icon: Calculator,
    rotulo: 'Cálculo',
    titulo: 'O sistema calcula seu repasse automaticamente',
    desc: 'Com base na taxa de repasse combinada com você (um percentual sobre o lucro ou sobre o faturamento bruto), o sistema calcula exatamente quanto você recebe naquele mês — sem cálculo manual e sem margem de erro.',
  },
  {
    numero: '05',
    icon: FileCheck2,
    rotulo: 'Entrega',
    titulo: 'Você recebe a prestação de contas em PDF',
    desc: 'Todo mês, um relatório detalhado é gerado mostrando receita bruta, custos discriminados por categoria, lucro líquido e o valor exato do seu repasse — tudo disponível no seu Portal do Proprietário.',
  },
]

const lucro = lucroExemplo
const administracao = administracaoExemplo
const repasse = repasseExemplo

/**
 * "Como funciona": as cinco etapas rolam à esquerda enquanto o extrato de
 * exemplo, à direita, é preenchido etapa por etapa. Cada bloco do extrato
 * carrega `data-st` com o número da etapa que o acende, e cada valor carrega
 * `data-count` para a contagem — quem lê isso é use-landing-motion.ts.
 * Sem animação (movimento reduzido, sem JS) o extrato já aparece completo.
 */
export function ComoFuncionaSection() {
  return (
    <section id="como-funciona" className="lp-cf">
      <div className="lp-wrap">
        <header className="lp-head">
          <span className="lp-tag" data-reveal>Como funciona</span>
          <h2 className="lp-h2" data-split>
            Entenda a gestão do <em>seu imóvel</em>
          </h2>
          <p className="lp-lead" data-reveal>
            Do cadastro do apartamento até o relatório que cai no seu portal todo mês — veja
            exatamente como a AlugEasy administra seu imóvel e calcula o seu repasse.
          </p>
        </header>

        <div className="lp-cf-grid">
          <div className="lp-steps">
            <div className="lp-rail" aria-hidden="true">
              <div className="lp-rail-fill" />
            </div>
            <ol>
              {STEPS.map(step => (
                <li key={step.numero} className="lp-step">
                  <span className="lp-step-node" aria-hidden="true">{step.numero}</span>
                  <span className="lp-step-kicker">
                    <step.icon size={14} aria-hidden="true" />
                    {step.rotulo}
                  </span>
                  <h3>{step.titulo}</h3>
                  <p>{step.desc}</p>
                </li>
              ))}
            </ol>
          </div>

          <aside className="lp-statement" aria-label="Exemplo ilustrativo de prestação de contas">
            <div className="lp-st-head">
              <span className="lp-st-kicker">Prestação de contas</span>
              <span className="lp-st-badge">Exemplo ilustrativo</span>
            </div>
            <h3 className="lp-st-title">Da reserva ao seu repasse, sem cálculo manual</h3>

            <div className="lp-st-unit" data-st="1">
              <Building2 size={15} aria-hidden="true" />
              <span>Empreendimento</span>
              <ChevronRight size={13} aria-hidden="true" />
              <HomeIcon size={15} aria-hidden="true" />
              <strong>Apartamento 202</strong>
            </div>

            <div className="lp-st-contract" data-st="2">
              <div className="lp-st-seg">
                <span className="is-on">Administração</span>
                <span>Sublocação</span>
              </div>
              <small>Taxa de {EXEMPLO.taxaAdm}% sobre o lucro</small>
            </div>

            <div className="lp-st-rows">
              <div className="lp-st-row" data-st="3">
                <span>
                  Receita das reservas
                  <small>Booking, Airbnb e reservas diretas</small>
                </span>
                <span className="lp-st-val" data-count={EXEMPLO.receita}>
                  {formatCurrency(EXEMPLO.receita)}
                </span>
              </div>
              <div className="lp-st-row" data-st="3">
                <span>
                  (−) Custos do mês
                  <small>Limpeza, manutenção e taxas de plataforma</small>
                </span>
                <span className="lp-st-val is-neg" data-count={EXEMPLO.custos} data-prefix="− ">
                  {`− ${formatCurrency(EXEMPLO.custos)}`}
                </span>
              </div>
              <div className="lp-st-row" data-st="4">
                <span>(=) Lucro líquido</span>
                <span className="lp-st-val" data-count={lucro}>
                  {formatCurrency(lucro)}
                </span>
              </div>
              <div className="lp-st-row" data-st="4">
                <span>
                  (−) Administração AlugEasy
                  <small>{EXEMPLO.taxaAdm}% sobre o lucro</small>
                </span>
                <span className="lp-st-val is-neg" data-count={administracao} data-prefix="− ">
                  {`− ${formatCurrency(administracao)}`}
                </span>
              </div>
            </div>

            <div className="lp-st-total" data-st="4">
              <span>Seu repasse</span>
              <strong data-count={repasse}>{formatCurrency(repasse)}</strong>
            </div>

            <div className="lp-st-pdf" data-st="5">
              <span className="lp-st-pdf-ico">
                <FileCheck2 size={16} aria-hidden="true" />
              </span>
              <span>
                <b>Prestação de contas em PDF</b>
                <small>Veja na prática no seu portal</small>
              </span>
              <Check size={17} className="lp-st-pdf-ok" aria-hidden="true" />
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}
