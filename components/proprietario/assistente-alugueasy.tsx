'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { MessageCircle, X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'

/* ────────────────────────────────────────────────────────────────
   ALU — Assistente virtual do Portal do Proprietário

   • Tour guiado: destaca elementos marcados com [data-tour] no
     dashboard e explica cada um em sequência.
   • Ajuda rápida: painel estilo chat com respostas prontas para
     as dúvidas mais comuns do proprietário.
   • 100% client-side — nenhum acesso a banco ou API.

   Avatar: coloque a arte da ALU em `public/alu-avatar.png`.
   Se o arquivo não existir, o componente usa o fallback (ícone).
   ──────────────────────────────────────────────────────────────── */

/** Avatar da ALU com fallback automático quando a imagem não existe. */
function AluAvatar({ size, fallback }: { size: number; fallback: React.ReactNode }) {
  const [erro, setErro] = useState(false)
  if (erro) return <>{fallback}</>
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/alu-avatar.png"
      alt="ALU — Assistente AlugEasy"
      width={size}
      height={size}
      onError={() => setErro(true)}
      style={{
        width: size, height: size, borderRadius: '50%',
        objectFit: 'cover', objectPosition: 'center',
        display: 'block', background: '#0f1a2e',
      }}
    />
  )
}

type TourStep = {
  /** Seletor(es) [data-tour] separados por vírgula. Vazio = card central. */
  target?: string
  titulo: string
  texto: string
}

type TourConfig = {
  steps: TourStep[]
  /** Página seguinte do tour encadeado — oferecida no último passo. */
  proxima?: { rota: string; label: string }
}

const TOURS: Record<string, TourConfig> = {
  /* ───────── Início (dashboard) ───────── */
  '/proprietario': {
    proxima: { rota: '/proprietario/extrato', label: 'Continuar: Rentabilidade' },
    steps: [
      {
        titulo: 'Bem-vindo ao seu portal! 👋',
        texto:
          'Eu sou a ALU, sua assistente AlugEasy. Em poucos passos vou te mostrar onde encontrar cada informação do seu imóvel. Use "Próximo" e "Voltar" no seu ritmo.',
      },
      {
        target: '[data-tour="periodo"]',
        titulo: 'Filtro de período',
        texto:
          'Aqui você escolhe o mês e o ano que quer consultar. O botão de sincronizar atualiza as reservas na hora. O período escolhido acompanha você em todas as abas.',
      },
      {
        target: '[data-tour="kpis"]',
        titulo: 'Seus indicadores',
        texto:
          'O resumo financeiro do período: faturamento das hospedagens, custos do imóvel e lucro líquido. No mês atual, os valores sobem ao vivo conforme novas reservas chegam.',
      },
      {
        target: '[data-tour="repasse"]',
        titulo: 'Seu repasse 💰',
        texto:
          'O número mais importante do painel: o valor líquido que você recebe no mês, já com a taxa de gestão da AlugEasy descontada.',
      },
      {
        target: '[data-tour="evolucao"]',
        titulo: 'Evolução dos últimos 6 meses',
        texto:
          'Este gráfico compara faturamento e repasse mês a mês, para você acompanhar a tendência dos seus imóveis ao longo do tempo.',
      },
      {
        target: '[data-tour="ocupacao"]',
        titulo: 'Mapa de ocupação',
        texto:
          'Veja os dias ocupados de cada imóvel no mês e o detalhe de cada reserva: plataforma (Airbnb, Booking...), hóspede, datas e valor líquido.',
      },
      {
        target: '[data-tour="atalhos"]',
        titulo: 'Acesso rápido',
        texto:
          'Atalhos para a rentabilidade completa do mês, o download do PDF de prestação de contas e o histórico dos últimos 12 meses.',
      },
      {
        target: '[data-tour="navegacao"], [data-tour="navegacao-mobile"]',
        titulo: 'Navegação',
        texto:
          'Use o menu para alternar entre Início, Rentabilidade e Histórico. O período selecionado acompanha você entre as abas.',
      },
      {
        titulo: 'Início concluído! ✅',
        texto:
          'Você já conhece o painel principal. Quer continuar o tour na página de Rentabilidade, onde fica a prestação de contas detalhada de cada apartamento?',
      },
    ],
  },

  /* ───────── Rentabilidade (rota /proprietario/extrato) ───────── */
  '/proprietario/extrato': {
    proxima: { rota: '/proprietario/historico', label: 'Continuar: Histórico' },
    steps: [
      {
        titulo: 'Rentabilidade — prestação de contas 📄',
        texto:
          'Esta página é o demonstrativo completo do período: cada apartamento tem um cartão com faturamento, custos detalhados, lucro e o cálculo do seu repasse.',
      },
      {
        target: '[data-tour="ext-periodo"]',
        titulo: 'Escolha o período',
        texto:
          'Selecione o mês e o ano que deseja consultar. Escolhendo "Todos os meses", você vê o acumulado do ano inteiro.',
      },
      {
        target: '[data-tour="ext-card-head"]',
        titulo: 'Identificação do imóvel',
        texto:
          'Cada cartão mostra o apartamento, o empreendimento e o modelo de contrato do imóvel: Administração ou Sublocação.',
      },
      {
        target: '[data-tour="ext-faturamento"]',
        titulo: 'Faturamento',
        texto:
          'O total de receita gerada pelas hospedagens deste imóvel no período selecionado.',
      },
      {
        target: '[data-tour="ext-custos"]',
        titulo: 'Custos detalhados',
        texto:
          'O total de despesas do período. Logo abaixo, cada linha com "↳" mostra uma categoria: limpeza, manutenção, insumos e outras. Se ainda não houver custos lançados, aparece um aviso e os valores ficam como estimativa.',
      },
      {
        target: '[data-tour="ext-lucro"]',
        titulo: 'Lucro',
        texto:
          'Faturamento menos os custos do período — o resultado do imóvel antes da taxa de gestão.',
      },
      {
        target: '[data-tour="ext-taxa"]',
        titulo: 'Taxa AlugEasy',
        texto:
          'O percentual de gestão previsto no seu contrato. A própria linha mostra a taxa e sobre o que ela é aplicada: lucro ou faturamento.',
      },
      {
        target: '[data-tour="ext-repasse"]',
        titulo: 'Seu repasse 💰',
        texto:
          'O valor final que fica com você no período, depois de todos os descontos. Se os custos ainda não foram lançados, aparece o selo "Estimado" — o valor pode ser ajustado depois.',
      },
      {
        target: '[data-tour="ext-pdf"]',
        titulo: 'Baixar PDF',
        texto:
          'Gera a prestação de contas oficial do mês em PDF — pronta para enviar ao contador ou guardar no seu arquivo pessoal.',
      },
      {
        titulo: 'Rentabilidade concluída! ✅',
        texto:
          'Agora só falta o Histórico, onde você acompanha a evolução dos seus imóveis nos últimos 12 meses. Vamos lá?',
      },
    ],
  },

  /* ───────── Histórico ───────── */
  '/proprietario/historico': {
    steps: [
      {
        titulo: 'Histórico — últimos 12 meses 📅',
        texto:
          'Aqui você acompanha a evolução dos seus imóveis: quanto faturou, gastou e recebeu em cada um dos últimos 12 meses.',
      },
      {
        target: '[data-tour="his-grafico"]',
        titulo: 'Carteira mensal',
        texto:
          'A evolução do valor recebido mês a mês. Passe o mouse (ou o dedo) sobre as barras para ver o valor exato de cada mês.',
      },
      {
        target: '[data-tour="his-tabela"]',
        titulo: 'Resumo detalhado',
        texto:
          'Cada linha é um mês: faturamento, custos, lucro, taxa AlugEasy e "Seu valor". O selo "Em andamento" marca o mês atual e "Sem dados" indica períodos sem lançamentos. As linhas com dados são clicáveis — toque em um mês para abrir a rentabilidade completa daquele período.',
      },
      {
        titulo: 'Tour completo! 🎉',
        texto:
          'Você conheceu tudo: Início, Rentabilidade e Histórico. Se precisar de mim, é só tocar no botão com a minha foto no canto da tela. Boa gestão! 🏠',
      },
    ],
  },
}

type Faq = { id: string; pergunta: string; resposta: string[] }

const FAQS: Faq[] = [
  {
    id: 'indicadores',
    pergunta: 'O que significa cada indicador?',
    resposta: [
      '• Faturamento — total de receita das hospedagens no período. No mês atual, atualiza ao vivo conforme novas reservas chegam.',
      '• Custos — despesas do imóvel no período, como limpeza, manutenção e insumos.',
      '• Lucro líquido — faturamento menos os custos.',
      '• Seu repasse — o valor que você recebe, já descontada a taxa de gestão da AlugEasy.',
    ],
  },
  {
    id: 'repasse',
    pergunta: 'Como é calculado o meu repasse?',
    resposta: [
      'Sobre o resultado do mês (lucro ou faturamento, conforme o seu contrato) é aplicada a taxa de gestão da AlugEasy. O que sobra é o seu repasse.',
      'O card verde do painel mostra o valor do mês, e a aba Rentabilidade detalha o cálculo completo, custo por custo.',
    ],
  },
  {
    id: 'outro-mes',
    pergunta: 'Como consultar outro mês?',
    resposta: [
      'Use o seletor de mês e ano no canto superior direito da tela.',
      'O período escolhido acompanha você nas abas Início, Rentabilidade e Histórico — não precisa selecionar de novo.',
    ],
  },
  {
    id: 'pdf',
    pergunta: 'Como baixar o PDF da prestação de contas?',
    resposta: [
      'Abra a aba Rentabilidade, escolha o mês desejado e toque em "Baixar PDF" no cartão do apartamento.',
      'O arquivo é a prestação de contas completa do mês — pronto para o contador ou para o seu arquivo pessoal.',
    ],
  },
  {
    id: 'extrato-linhas',
    pergunta: 'O que significa cada linha da Rentabilidade?',
    resposta: [
      '• Faturamento — receita das hospedagens do imóvel no período.',
      '• Custos — total de despesas; as linhas com "↳" detalham cada categoria (limpeza, manutenção, insumos...).',
      '• Lucro — faturamento menos os custos.',
      '• Taxa AlugEasy — o percentual de gestão do seu contrato, aplicado sobre o lucro ou o faturamento.',
      '• Seu repasse — o valor final que fica com você. Quando os custos ainda não foram lançados, ele aparece como "Estimado".',
    ],
  },
  {
    id: 'historico-pagina',
    pergunta: 'Como uso a página Histórico?',
    resposta: [
      'A página Histórico mostra a evolução dos últimos 12 meses: um gráfico com o repasse mês a mês e uma tabela com faturamento, custos, lucro e "Seu valor" de cada mês.',
      'As linhas com dados são clicáveis — toque em um mês para abrir a rentabilidade completa daquele período. O selo "Em andamento" marca o mês atual.',
    ],
  },
  {
    id: 'gestao-modelo',
    pergunta: 'O que é Administração e Sublocação?',
    resposta: [
      'É o modelo de contrato do seu imóvel com a AlugEasy — ele aparece no cartão de cada apartamento na aba Rentabilidade.',
      'O modelo define como a taxa de gestão é aplicada no cálculo do seu repasse, conforme o seu contrato.',
    ],
  },
  {
    id: 'ocupacao',
    pergunta: 'O que mostra o painel de ocupação?',
    resposta: [
      'Cada imóvel tem uma grade com os dias do mês: os dias ocupados aparecem preenchidos.',
      'Logo abaixo você vê as reservas do período com plataforma (Airbnb, Booking...), hóspede, datas e valor líquido.',
    ],
  },
  {
    id: 'tempo-real',
    pergunta: 'Os dados são em tempo real?',
    resposta: [
      'No mês corrente, sim: as reservas sincronizam automaticamente a cada poucos minutos e o selo "atualizado há X min" mostra quando foi a última atualização.',
      'Meses anteriores exibem os valores fechados da prestação de contas.',
    ],
  },
  {
    id: 'contato',
    pergunta: 'Falar com a AlugEasy',
    resposta: [
      'Para qualquer assunto que eu não consiga resolver, escreva para alugueasy@gmail.com que a equipe te responde. 😊',
    ],
  },
]

type Msg = { autor: 'alu' | 'voce'; linhas: string[] }

const MSG_BOAS_VINDAS: Msg = {
  autor: 'alu',
  linhas: [
    'Olá! Eu sou a ALU, sua assistente AlugEasy. 👋',
    'Como posso te ajudar hoje? Quer fazer um tour guiado pelas funções ou tirar uma dúvida rápida? É só escolher abaixo.',
  ],
}

/** Retorna o primeiro elemento visível entre os seletores informados. */
function encontrarAlvo(seletores: string): HTMLElement | null {
  for (const sel of seletores.split(',')) {
    const els = document.querySelectorAll<HTMLElement>(sel.trim())
    for (const el of Array.from(els)) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) return el
    }
  }
  return null
}

const TOOLTIP_W = 330
const TOOLTIP_H = 250

type Rect = { top: number; left: number; width: number; height: number }

function AssistenteInner() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [aberto, setAberto] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([MSG_BOAS_VINDAS])
  const [tourAtivo, setTourAtivo] = useState(false)
  const [passos, setPassos] = useState<TourStep[]>([])
  const [proximaRota, setProximaRota] = useState<{ rota: string; label: string } | null>(null)
  const [passoIdx, setPassoIdx] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const msgsRef = useRef<HTMLDivElement>(null)
  const tourAutoIniciado = useRef(false)

  const noDashboard = pathname === '/proprietario'

  /* ── Primeira visita: abre o painel de boas-vindas ── */
  useEffect(() => {
    if (!noDashboard) return
    if (localStorage.getItem('alu_bemvindo_visto')) return
    localStorage.setItem('alu_bemvindo_visto', '1')
    const t = setTimeout(() => setAberto(true), 900)
    return () => clearTimeout(t)
  }, [noDashboard])

  const iniciarTour = useCallback(() => {
    const config = TOURS[pathname]
    if (!config) {
      // Página sem tour próprio — leva para o Início e retoma via ?tour=1
      setAberto(false)
      router.push('/proprietario?tour=1')
      return
    }
    const disponiveis = config.steps.filter(s => !s.target || encontrarAlvo(s.target))
    setPassos(disponiveis)
    setProximaRota(config.proxima ?? null)
    setPassoIdx(0)
    setAberto(false)
    setTourAtivo(true)
  }, [pathname, router])

  /* ── Trocou de página: libera novo auto-início ── */
  useEffect(() => {
    tourAutoIniciado.current = false
  }, [pathname])

  /* ── Chegou com ?tour=1 (tour encadeado): inicia e limpa a URL ── */
  useEffect(() => {
    if (!TOURS[pathname] || searchParams.get('tour') !== '1') return
    if (tourAutoIniciado.current) return
    tourAutoIniciado.current = true
    router.replace(pathname)
    // pequeno delay para a página assentar antes de medir os alvos
    const t = setTimeout(iniciarTour, 400)
    return () => clearTimeout(t)
  }, [pathname, searchParams, router, iniciarTour])

  /* ── Mede e acompanha o alvo do passo atual ── */
  useEffect(() => {
    if (!tourAtivo) return
    const passo = passos[passoIdx]
    const el = passo?.target ? encontrarAlvo(passo.target) : null
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    else window.scrollTo({ top: 0, behavior: 'smooth' })

    const medir = () => {
      if (!passo?.target) { setRect(null); return }
      const alvo = encontrarAlvo(passo.target)
      if (!alvo) { setRect(null); return }
      const r = alvo.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    medir()
    window.addEventListener('scroll', medir, true)
    window.addEventListener('resize', medir)
    const iv = window.setInterval(medir, 250)
    return () => {
      window.removeEventListener('scroll', medir, true)
      window.removeEventListener('resize', medir)
      window.clearInterval(iv)
    }
  }, [tourAtivo, passoIdx, passos])

  function encerrarTour(concluiu: boolean) {
    setTourAtivo(false)
    setRect(null)
    localStorage.setItem('alu_tour_visto', '1')
    if (concluiu) {
      setMsgs(m => [...m, {
        autor: 'alu',
        linhas: ['Tour concluído! 🎉 Se quiser rever, é só pedir de novo. Posso ajudar em mais alguma coisa?'],
      }])
      setAberto(true)
    }
  }

  /** Encerra o tour desta página e continua na próxima do encadeamento. */
  function continuarTour(rota: string) {
    setTourAtivo(false)
    setRect(null)
    localStorage.setItem('alu_tour_visto', '1')
    router.push(`${rota}?tour=1`)
  }

  function perguntar(faq: Faq) {
    setMsgs(m => [
      ...m,
      { autor: 'voce', linhas: [faq.pergunta] },
      { autor: 'alu', linhas: faq.resposta },
    ])
  }

  /* ── Autoscroll das mensagens ── */
  useEffect(() => {
    msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight, behavior: 'smooth' })
  }, [msgs, aberto])

  /* ── Posição do tooltip do tour ── */
  const passo = passos[passoIdx]
  const ultimo = passoIdx === passos.length - 1
  let tooltipStyle: React.CSSProperties = {}
  if (tourAtivo && typeof window !== 'undefined') {
    const isMobile = window.innerWidth < 640
    if (!rect) {
      tooltipStyle = { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }
    } else if (isMobile) {
      tooltipStyle = { left: 12, right: 12, bottom: 'calc(16px + env(safe-area-inset-bottom))' }
    } else {
      const left = Math.min(
        Math.max(rect.left + rect.width / 2 - TOOLTIP_W / 2, 16),
        window.innerWidth - TOOLTIP_W - 16,
      )
      let top = rect.top + rect.height + 14
      if (top + TOOLTIP_H > window.innerHeight - 16) top = rect.top - TOOLTIP_H - 14
      if (top < 16) top = 16
      tooltipStyle = { top, left, width: TOOLTIP_W }
    }
  }

  return (
    <>
      <style>{`
        .alu-fab {
          position: fixed; right: 18px; z-index: 60;
          bottom: calc(84px + env(safe-area-inset-bottom));
          width: 54px; height: 54px; border-radius: 50%;
          background: #15803d; color: #fff; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 6px 20px rgba(21,128,61,.35);
          transition: transform .15s, background .15s;
        }
        .alu-fab:hover { background: #166534; transform: translateY(-2px); }
        .alu-fab::after {
          content: ''; position: absolute; inset: -4px; border-radius: 50%;
          border: 2px solid rgba(21,128,61,.35);
          animation: alu-pulse 2.4s ease-out infinite;
          pointer-events: none;
        }
        @keyframes alu-pulse {
          0%   { transform: scale(.9); opacity: 1; }
          70%  { transform: scale(1.25); opacity: 0; }
          100% { transform: scale(1.25); opacity: 0; }
        }
        @media (min-width: 768px) {
          .alu-fab { bottom: 24px; right: 24px; }
        }

        .alu-panel {
          position: fixed; right: 16px; z-index: 70;
          bottom: calc(84px + env(safe-area-inset-bottom));
          width: min(370px, calc(100vw - 32px));
          max-height: min(600px, calc(100vh - 120px));
          background: #fff; border: 1px solid #e7e9ee; border-radius: 20px;
          box-shadow: 0 16px 48px rgba(15,26,46,.18);
          display: flex; flex-direction: column; overflow: hidden;
          font-family: 'DM Sans', system-ui, sans-serif;
          animation: alu-in .2s ease-out;
        }
        @keyframes alu-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (min-width: 768px) {
          .alu-panel { bottom: 92px; right: 24px; }
        }

        .alu-head {
          display: flex; align-items: center; gap: 10px;
          padding: 14px 16px; background: #0f1a2e; color: #fff; flex-shrink: 0;
        }
        .alu-avatar {
          width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
          background: #15803d; display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 700;
        }
        .alu-head-title { font-size: 14px; font-weight: 700; line-height: 1.2; }
        .alu-head-sub { font-size: 11px; color: rgba(255,255,255,.55); display: flex; align-items: center; gap: 4px; }
        .alu-head-sub::before {
          content: ''; width: 6px; height: 6px; border-radius: 50%;
          background: #4ade80; display: inline-block;
        }
        .alu-close {
          margin-left: auto; background: rgba(255,255,255,.1); border: none;
          color: #fff; width: 28px; height: 28px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
          transition: background .15s;
        }
        .alu-close:hover { background: rgba(255,255,255,.2); }

        .alu-msgs {
          flex: 1; overflow-y: auto; padding: 16px 14px;
          display: flex; flex-direction: column; gap: 10px;
          background: #f4f5f7; min-height: 120px;
        }
        .alu-msg { max-width: 88%; border-radius: 14px; padding: 10px 13px; font-size: 13px; line-height: 1.55; }
        .alu-msg p { margin: 0; }
        .alu-msg p + p { margin-top: 7px; }
        .alu-msg.de-alu {
          align-self: flex-start; background: #fff; color: #1f2b40;
          border: 1px solid #e7e9ee; border-bottom-left-radius: 4px;
        }
        .alu-msg.de-voce {
          align-self: flex-end; background: #193660; color: #fff;
          border-bottom-right-radius: 4px;
        }

        .alu-chips {
          flex-shrink: 0; border-top: 1px solid #eef0f3; background: #fff;
          padding: 10px 12px 12px; display: flex; flex-wrap: wrap; gap: 7px;
          max-height: 170px; overflow-y: auto;
        }
        .alu-chip {
          font-family: inherit; font-size: 12px; font-weight: 500;
          color: #193660; background: #fff; border: 1px solid #d5dbe4;
          border-radius: 100px; padding: 7px 13px; cursor: pointer;
          transition: all .15s;
        }
        .alu-chip:hover { border-color: #193660; background: #f8f6f1; }
        .alu-chip.destaque {
          display: inline-flex; align-items: center; gap: 6px;
          background: #15803d; border-color: #15803d; color: #fff; font-weight: 600;
        }
        .alu-chip.destaque:hover { background: #166534; }

        .alu-tooltip {
          position: fixed; z-index: 110;
          background: #fff; border: 1px solid #e7e9ee; border-radius: 16px;
          box-shadow: 0 16px 48px rgba(15,26,46,.25);
          padding: 18px 18px 14px;
          font-family: 'DM Sans', system-ui, sans-serif;
          animation: alu-in .2s ease-out;
        }
        .alu-tt-badge {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 10px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase;
          color: #166534; background: #f0fdf4; border: 1px solid #d1f0db;
          border-radius: 100px; padding: 3px 10px; margin-bottom: 10px;
        }
        .alu-tt-titulo { font-size: 15.5px; font-weight: 700; color: #0f1a2e; margin-bottom: 6px; }
        .alu-tt-texto { font-size: 13px; color: #5a6a82; line-height: 1.6; margin-bottom: 14px; }
        .alu-tt-foot { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .alu-tt-progresso { font-size: 11px; color: #94a3b8; margin-right: auto; }
        .alu-tt-btn {
          font-family: inherit; font-size: 12.5px; font-weight: 600;
          border-radius: 9px; padding: 8px 14px; cursor: pointer;
          display: inline-flex; align-items: center; gap: 4px; transition: all .15s;
        }
        .alu-tt-btn.sec { background: #fff; color: #5a6a82; border: 1px solid #e7e9ee; }
        .alu-tt-btn.sec:hover { border-color: #c3cbd8; color: #0f1a2e; }
        .alu-tt-btn.pri { background: #15803d; color: #fff; border: none; }
        .alu-tt-btn.pri:hover { background: #166534; }
        .alu-tt-pular {
          font-family: inherit; font-size: 11.5px; color: #94a3b8;
          background: none; border: none; cursor: pointer; text-decoration: underline;
          padding: 0; margin-top: 10px;
        }
        .alu-tt-pular:hover { color: #5a6a82; }
      `}</style>

      {/* ── Botão flutuante ── */}
      {!tourAtivo && !aberto && (
        <button
          className="alu-fab"
          onClick={() => setAberto(true)}
          aria-label="Abrir assistente ALU"
        >
          <AluAvatar size={54} fallback={<MessageCircle size={24} />} />
        </button>
      )}

      {/* ── Painel do assistente ── */}
      {aberto && !tourAtivo && (
        <div className="alu-panel" role="dialog" aria-label="Assistente AlugEasy">
          <div className="alu-head">
            <AluAvatar size={36} fallback={<div className="alu-avatar">A</div>} />
            <div>
              <div className="alu-head-title">ALU · Assistente AlugEasy</div>
              <div className="alu-head-sub">Responde na hora</div>
            </div>
            <button className="alu-close" onClick={() => setAberto(false)} aria-label="Fechar assistente">
              <X size={15} />
            </button>
          </div>

          <div className="alu-msgs" ref={msgsRef}>
            {msgs.map((m, i) => (
              <div key={i} className={`alu-msg ${m.autor === 'alu' ? 'de-alu' : 'de-voce'}`}>
                {m.linhas.map((l, j) => <p key={j}>{l}</p>)}
              </div>
            ))}
          </div>

          <div className="alu-chips">
            <button className="alu-chip destaque" onClick={iniciarTour}>
              <Sparkles size={13} />
              Fazer tour guiado
            </button>
            {FAQS.map(faq => (
              <button key={faq.id} className="alu-chip" onClick={() => perguntar(faq)}>
                {faq.pergunta}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Tour guiado ── */}
      {tourAtivo && passo && (
        <>
          {/* Bloqueia interação com a página durante o tour */}
          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} />

          {rect ? (
            <div
              style={{
                position: 'fixed',
                top: rect.top - 8,
                left: rect.left - 8,
                width: rect.width + 16,
                height: rect.height + 16,
                borderRadius: 14,
                boxShadow: '0 0 0 9999px rgba(15,26,46,.62), 0 0 0 3px rgba(74,222,128,.9)',
                zIndex: 100,
                pointerEvents: 'none',
                transition: 'all .25s ease',
              }}
            />
          ) : (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,26,46,.62)', zIndex: 100 }} />
          )}

          <div className="alu-tooltip" style={tooltipStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <AluAvatar size={26} fallback={null} />
              <div className="alu-tt-badge" style={{ marginBottom: 0 }}>
                <Sparkles size={10} />
                Tour guiado com a ALU
              </div>
            </div>
            <div className="alu-tt-titulo">{passo.titulo}</div>
            <div className="alu-tt-texto">{passo.texto}</div>
            <div className="alu-tt-foot">
              <span className="alu-tt-progresso">{passoIdx + 1} de {passos.length}</span>
              {passoIdx > 0 && (
                <button className="alu-tt-btn sec" onClick={() => setPassoIdx(i => i - 1)}>
                  <ChevronLeft size={13} />
                  Voltar
                </button>
              )}
              {ultimo ? (
                proximaRota ? (
                  <>
                    <button className="alu-tt-btn sec" onClick={() => encerrarTour(true)}>
                      Concluir
                    </button>
                    <button className="alu-tt-btn pri" onClick={() => continuarTour(proximaRota.rota)}>
                      {proximaRota.label}
                      <ChevronRight size={13} />
                    </button>
                  </>
                ) : (
                  <button className="alu-tt-btn pri" onClick={() => encerrarTour(true)}>
                    Concluir
                  </button>
                )
              ) : (
                <button className="alu-tt-btn pri" onClick={() => setPassoIdx(i => i + 1)}>
                  Próximo
                  <ChevronRight size={13} />
                </button>
              )}
            </div>
            {!ultimo && (
              <button className="alu-tt-pular" onClick={() => encerrarTour(false)}>
                Pular tour
              </button>
            )}
          </div>
        </>
      )}
    </>
  )
}

export function AssistenteAlugEasy() {
  return (
    <Suspense fallback={null}>
      <AssistenteInner />
    </Suspense>
  )
}
