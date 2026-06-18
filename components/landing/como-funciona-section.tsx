'use client'

import {
  Building2,
  Home as HomeIcon,
  FileSpreadsheet,
  Calculator,
  FileCheck2,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react'

const STEPS = [
  {
    numero: '01',
    icon: Building2,
    titulo: 'Seu imóvel faz parte de um empreendimento',
    desc: 'Cada apartamento administrado pela AlugEasy está vinculado a um empreendimento (prédio ou condomínio). Isso organiza tudo por localização e facilita o controle individual de cada unidade.',
  },
  {
    numero: '02',
    icon: HomeIcon,
    titulo: 'Cada apartamento tem um modelo de contrato',
    desc: 'Definimos junto com você se o imóvel opera em Administração (você recebe repasse sobre o lucro ou faturamento) ou Sublocação (a AlugEasy aluga o imóvel diretamente de você por um valor fixo). O modelo já fica configurado no seu cadastro.',
  },
  {
    numero: '03',
    icon: FileSpreadsheet,
    titulo: 'Lançamos as diárias e os custos todo mês',
    desc: 'Toda reserva feita (direto ou via plataformas como Booking e Airbnb, sincronizadas automaticamente pelo Amenitiz) gera uma diária. Despesas como limpeza, manutenção e taxas de plataforma são lançadas como custos do período.',
  },
  {
    numero: '04',
    icon: Calculator,
    titulo: 'O sistema calcula seu repasse automaticamente',
    desc: 'Com base na taxa de repasse combinada com você (um percentual sobre o lucro ou sobre o faturamento bruto), o sistema calcula exatamente quanto você recebe naquele mês — sem cálculo manual e sem margem de erro.',
  },
  {
    numero: '05',
    icon: FileCheck2,
    titulo: 'Você recebe a prestação de contas em PDF',
    desc: 'Todo mês, um relatório detalhado é gerado mostrando receita bruta, custos discriminados por categoria, lucro líquido e o valor exato do seu repasse — tudo disponível no seu Portal do Proprietário.',
  },
]

export function ComoFuncionaSection() {
  return (
    <section id="como-funciona" style={{ padding: '72px 5%', background: '#fff' }}>
      <style>{`
        .cf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: start; }
        .cf-step { display: flex; gap: 16px; padding: 20px 0; border-top: 1px solid #f1f5f9; }
        .cf-step:first-child { border-top: none; padding-top: 0; }
        .cf-num {
          font-family: 'Instrument Serif', Georgia, serif; font-size: 32px; font-weight: 400;
          color: #cbd5e1; flex-shrink: 0; width: 48px; line-height: 1;
        }
        .cf-icon-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
        .cf-summary-card {
          background: #0f2647; border-radius: 20px; padding: 32px 28px;
          position: sticky; top: 100px;
        }
        .cf-summary-item { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 14px; }
        .cf-summary-item:last-child { margin-bottom: 0; }
        @media (max-width: 900px) {
          .cf-grid { grid-template-columns: 1fr; gap: 32px; }
          .cf-summary-card { position: static; }
        }
      `}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 48 }}>
          <span className="section-tag">Como funciona</span>
          <h2 className="section-title">Entenda a gestão do seu imóvel</h2>
          <p style={{ fontSize: 15, color: '#5a6a82', maxWidth: 560 }}>
            Do cadastro do apartamento até o relatório que cai no seu portal todo mês — veja
            exatamente como a AlugEasy administra seu imóvel e calcula o seu repasse.
          </p>
        </div>

        <div className="cf-grid">
          <div>
            {STEPS.map(step => (
              <div key={step.numero} className="cf-step">
                <span className="cf-num">{step.numero}</span>
                <div>
                  <div className="cf-icon-row">
                    <step.icon size={18} color="#193660" />
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: '#0f1a2e' }}>{step.titulo}</h3>
                  </div>
                  <p style={{ fontSize: 13, color: '#5a6a82', lineHeight: 1.65 }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="cf-summary-card">
            <span
              style={{
                display: 'inline-block', background: 'rgba(255,255,255,.12)', color: 'rgba(255,255,255,.7)',
                fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                padding: '4px 10px', borderRadius: 100, marginBottom: 16,
              }}
            >
              Em resumo
            </span>
            <h3 style={{ fontFamily: '"Instrument Serif",Georgia,serif', fontSize: 22, fontWeight: 400, color: '#fff', marginBottom: 18, lineHeight: 1.3 }}>
              Da reserva ao seu repasse, sem cálculo manual
            </h3>

            {[
              'Cada reserva (própria ou via Booking/Airbnb) é registrada automaticamente como diária',
              'Custos do mês (limpeza, manutenção, taxas) são lançados por categoria',
              'O sistema calcula o lucro líquido e aplica a taxa de repasse combinada com você',
              'Você recebe o PDF da prestação de contas todo mês no seu portal',
            ].map(item => (
              <div key={item} className="cf-summary-item">
                <CheckCircle2 size={16} color="#4ade80" style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}

            <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>Veja na prática no seu portal</span>
              <ArrowRight size={13} color="rgba(255,255,255,.5)" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
