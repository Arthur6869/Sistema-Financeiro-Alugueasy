/**
 * Conteúdo da ALU — textos idênticos aos de
 * `components/proprietario/assistente-alugueasy.tsx`.
 *
 * No site os passos apontam para seletores `[data-tour]`. Aqui apontam para um
 * `id` que as telas registram (ver `components/alu.tsx`): React Native não tem
 * DOM nem seletor CSS, então o alvo é medido pelo próprio componente.
 */

export type PassoTour = {
  /** id registrado pela tela. Ausente = cartão centralizado, sem destaque. */
  alvo?: string
  titulo: string
  texto: string
}

export type ConfigTour = {
  passos: PassoTour[]
  /** Próxima tela do tour encadeado, oferecida no último passo. */
  proxima?: { rota: string; label: string }
}

export const TOURS: Record<string, ConfigTour> = {
  '/proprietario': {
    proxima: { rota: '/rentabilidade', label: 'Continuar: Rentabilidade' },
    passos: [
      {
        titulo: 'Bem-vindo ao seu portal! 👋',
        texto: 'Eu sou a ALU, sua assistente AlugEasy. Em poucos passos vou te mostrar onde encontrar cada informação do seu imóvel. Use "Próximo" e "Voltar" no seu ritmo.',
      },
      {
        alvo: 'periodo',
        titulo: 'Filtro de período',
        texto: 'Aqui você escolhe o mês que quer consultar. O botão de atualizar busca as reservas na hora, direto da Amenitiz.',
      },
      {
        alvo: 'repasse',
        titulo: 'Seu repasse 💰',
        texto: 'O número mais importante do painel: o valor líquido que você recebe no mês, já com a taxa de gestão da AlugEasy descontada.',
      },
      {
        alvo: 'kpis',
        titulo: 'Seus indicadores',
        texto: 'O resumo financeiro do período: faturamento das hospedagens, custos do imóvel e lucro líquido. No mês atual, os valores sobem ao vivo conforme novas reservas chegam.',
      },
      {
        alvo: 'ocupacao',
        titulo: 'Mapa de ocupação',
        texto: 'Veja os dias ocupados de cada imóvel no mês e o detalhe de cada reserva: plataforma (Airbnb, Booking...), hóspede, datas e valor líquido.',
      },
      {
        alvo: 'evolucao',
        titulo: 'Evolução dos últimos 6 meses',
        texto: 'Este gráfico compara faturamento e repasse mês a mês, para você acompanhar a tendência dos seus imóveis ao longo do tempo.',
      },
      {
        alvo: 'navegacao',
        titulo: 'Navegação',
        texto: 'Use a barra de baixo para alternar entre Início, Rentabilidade e Histórico.',
      },
      {
        titulo: 'Início concluído! ✅',
        texto: 'Você já conhece o painel principal. Quer continuar o tour na página de Rentabilidade, onde fica a prestação de contas detalhada de cada apartamento?',
      },
    ],
  },

  '/rentabilidade': {
    proxima: { rota: '/historico', label: 'Continuar: Histórico' },
    passos: [
      {
        titulo: 'Rentabilidade — prestação de contas 📄',
        texto: 'Esta página é o demonstrativo completo do período: cada apartamento tem um cartão com faturamento, custos detalhados, lucro e o cálculo do seu repasse.',
      },
      {
        alvo: 'ext-periodo',
        titulo: 'Escolha o período',
        texto: 'Selecione o mês que deseja consultar. As setas avançam e voltam um mês por vez.',
      },
      {
        alvo: 'ext-total',
        titulo: 'Total do período',
        texto: 'A soma do que você recebe considerando todos os seus imóveis no mês escolhido.',
      },
      {
        alvo: 'ext-card',
        titulo: 'O cartão de cada imóvel',
        texto: 'Cada cartão mostra o apartamento, o empreendimento e o modelo de contrato: Administração ou Sublocação. Abaixo vem o cálculo linha a linha — faturamento, custos com "↳" detalhando cada categoria, lucro e a taxa AlugEasy.',
      },
      {
        alvo: 'ext-repasse',
        titulo: 'Seu repasse 💰',
        texto: 'O valor final que fica com você no período, depois de todos os descontos. Se os custos ainda não foram lançados, aparece o selo "Estimado" — o valor pode ser ajustado depois.',
      },
      {
        alvo: 'ext-pdf',
        titulo: 'Baixar PDF',
        texto: 'Gera a prestação de contas oficial do mês em PDF — pronta para enviar ao contador ou guardar no seu arquivo pessoal. O arquivo abre na tela de compartilhamento do celular.',
      },
      {
        titulo: 'Rentabilidade concluída! ✅',
        texto: 'Agora só falta o Histórico, onde você acompanha a evolução dos seus imóveis nos últimos 12 meses. Vamos lá?',
      },
    ],
  },

  '/historico': {
    passos: [
      {
        titulo: 'Histórico — últimos 12 meses 📅',
        texto: 'Aqui você acompanha a evolução dos seus imóveis: quanto faturou, gastou e recebeu em cada um dos últimos 12 meses.',
      },
      {
        alvo: 'his-grafico',
        titulo: 'Carteira mensal',
        texto: 'A evolução do valor recebido mês a mês. Cada barra é um mês dos últimos 12.',
      },
      {
        alvo: 'his-imovel',
        titulo: 'Desempenho por imóvel 🏠',
        texto: 'Aqui a análise é individual: escolha um dos seus imóveis para comparar faturamento (azul) e custos (vermelho) mês a mês. Em cima, os totais dos últimos 12 meses do imóvel selecionado.',
      },
      {
        alvo: 'his-tabela',
        titulo: 'Resumo detalhado',
        texto: 'Cada linha é um mês. O selo "Em andamento" marca o mês atual e "Sem dados" indica períodos sem lançamentos. As linhas com dados são clicáveis — toque em um mês para abrir a rentabilidade completa daquele período.',
      },
      {
        titulo: 'Tour completo! 🎉',
        texto: 'Você conheceu tudo: Início, Rentabilidade e Histórico. Se precisar de mim, é só tocar no botão com a minha foto no canto da tela. Boa gestão! 🏠',
      },
    ],
  },
}

export type Faq = { id: string; pergunta: string; resposta: string[] }

export const FAQS: Faq[] = [
  {
    id: 'acesso',
    pergunta: 'Estou com dificuldade para entrar',
    resposta: [
      'Use o mesmo e-mail e a mesma senha do portal no computador — a conta é a mesma.',
      'Se aparecer "E-mail ou senha incorretos", confira se não há espaço sobrando no e-mail e se o teclado não trocou alguma letra maiúscula.',
      'Não existe cadastro pelo aplicativo: quem cria o acesso é a equipe AlugEasy. Se você ainda não recebeu uma senha, ou se aparecer que sua conta não tem acesso liberado, escreva para alugueasy@gmail.com. 😊',
    ],
  },
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
      'Use as setas ‹ e › ao lado do nome do mês, no alto da tela.',
      'Cada aba tem o seu próprio seletor, então dá para comparar períodos diferentes entre Início, Rentabilidade e Histórico.',
    ],
  },
  {
    id: 'pdf',
    pergunta: 'Como baixar o PDF da prestação de contas?',
    resposta: [
      'Abra a aba Rentabilidade, escolha o mês desejado e toque em "Baixar PDF" no cartão do apartamento.',
      'O arquivo abre na tela de compartilhamento do celular — de lá você pode salvar no aparelho, mandar por WhatsApp ou enviar por e-mail.',
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
      'A página Histórico mostra a evolução dos últimos 12 meses: um gráfico com o repasse mês a mês e uma tabela com o valor de cada mês.',
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
      'Cada imóvel tem uma grade com os dias do mês: os dias ocupados aparecem coloridos, na cor da plataforma da reserva.',
      'Logo abaixo você vê as reservas do período com plataforma (Airbnb, Booking...), hóspede, datas e valor líquido.',
    ],
  },
  {
    id: 'tempo-real',
    pergunta: 'Os dados são em tempo real?',
    resposta: [
      'No mês corrente, sim: as reservas sincronizam automaticamente a cada poucos minutos e o selo "Atualizado há X min" mostra quando foi a última vez.',
      'Se uma reserva nova chegar com o aplicativo aberto, ela aparece sozinha na seção "Chegaram agora", sem você precisar fazer nada.',
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

export const MSG_BOAS_VINDAS = {
  autor: 'alu' as const,
  linhas: [
    'Olá! Eu sou a ALU, sua assistente AlugEasy. 👋',
    'Como posso te ajudar hoje? Quer fazer um tour guiado pelas funções ou tirar uma dúvida rápida? É só escolher abaixo.',
  ],
}
