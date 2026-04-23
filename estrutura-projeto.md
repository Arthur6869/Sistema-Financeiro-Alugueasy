# Estrutura do Projeto — AlugEasy

## **Visão Geral**
O **AlugEasy** é um sistema de gestão financeira para imóveis de aluguel de curta duração. Ele automatiza o processo de importação de dados financeiros, sincronização com plataformas externas (como Amenitiz), e geração de relatórios financeiros. O sistema é baseado em **Next.js** com **App Router**, utilizando **Supabase** como banco de dados e **React** para a interface do usuário.

---

## **Tecnologias Utilizadas**

| Camada | Tecnologia | Versão | Finalidade |
|--------|------------|--------|------------|
| **Framework** | Next.js + App Router | 16.2.1 | Renderização no servidor, rotas e APIs |
| **Linguagem** | TypeScript | 5.x | Tipagem estática e qualidade de código |
| **Banco de Dados** | Supabase (PostgreSQL 17) | Cloud | Armazenamento relacional de dados |
| **Autenticação** | Supabase Auth | Cloud | Autenticação baseada em JWT |
| **Estilização** | Tailwind CSS | v4 | Framework CSS utilitário |
| **Componentes UI** | shadcn/ui | v4 | Componentes acessíveis pré-construídos |
| **Gráficos** | Recharts | 3.8.1 | Visualização de dados financeiros |
| **Manipulação de Excel** | SheetJS (xlsx) | 0.18.5 | Importação/exportação de planilhas |
| **Geração de PDFs** | @react-pdf/renderer | Latest | Renderização de PDFs no servidor |
| **Ícones** | Lucide React | 1.7.0 | Biblioteca de ícones SVG |
| **Formulários** | React Hook Form + Zod | 7.72.0 / 4.3.6 | Gerenciamento e validação de formulários |

---

## **Estrutura de Diretórios**

```
Sistema-Financeiro-Alugueasy/
├── app/
│   ├── (auth)/login/               # Página de login
│   ├── (dashboard)/*               # Todas as páginas protegidas (ex.: custos, diárias, relatórios)
│   ├── api/                        # Rotas de API (ex.: importação, sincronização)
│   ├── globals.css                 # Estilos globais
│   └── layout.tsx                  # Layout principal
├── components/
│   ├── layout/app-sidebar.tsx      # Barra lateral de navegação
│   ├── charts/                     # Componentes de gráficos
│   ├── modals/                     # Modais para criação/edição
│   ├── shared/                     # Componentes compartilhados (ex.: botões)
│   └── ui/                         # Componentes de interface (ex.: tabelas, botões)
├── lib/
│   ├── constants.ts                # Constantes globais
│   ├── amenitiz.ts                 # Integração com a API Amenitiz
│   └── supabase/{client,server}.ts # Configuração do cliente Supabase
├── hooks/use-mobile.ts             # Hook para detectar dispositivos móveis
├── supabase/migrations/            # Arquivos de migração do banco de dados
├── proxy.ts                        # Middleware de autenticação
├── documentação.md                 # Documentação técnica
├── AGENTS.md                       # Regras para agentes de IA
└── README.md                       # Guia de início rápido
```

---

## **Banco de Dados**

### **Tabelas Principais**
1. **`profiles`:** Informações dos usuários (nome, função: `admin` ou `analista`).
2. **`empreendimentos`:** Lista de empreendimentos (ex.: prédios ou grupos de imóveis).
3. **`apartamentos`:** Detalhes dos apartamentos, vinculados a empreendimentos.
4. **`custos`:** Custos operacionais por apartamento, categorizados por mês, ano e tipo de gestão (`adm` ou `sub`).
5. **`diarias`:** Receita de diárias por apartamento, categorizadas por data e tipo de gestão.
6. **`importacoes`:** Histórico de importações de planilhas (custos e diárias).
7. **`amenitiz_syncs` e `amenitiz_reservas`:** Dados sincronizados da plataforma Amenitiz.

### **Políticas de Segurança**
- **RLS (Row Level Security):** Restrições de acesso baseadas no papel do usuário.
  - **Leitura:** Todos os usuários autenticados.
  - **Escrita:** Apenas usuários com função `admin`.

---

## **Fluxo de Dados**

### **Importação de Planilhas**
1. O usuário faz upload de uma planilha no frontend.
2. A planilha é enviada para a rota `/api/import` via `FormData`.
3. A API processa a planilha usando o **SheetJS** e insere os dados no banco de dados.
4. Antes de inserir, a API remove registros duplicados para o mesmo mês/ano/tipo de gestão.

### **Sincronização com Amenitiz**
1. O botão de sincronização (`AmenitizSyncButton`) chama a rota `/api/amenitiz-sync`.
2. A API busca dados de três endpoints da Amenitiz (`checkin`, `created`, `updated`) para garantir que todas as reservas sejam capturadas.
3. As reservas são filtradas e consolidadas por `booking_id` para evitar duplicatas.
4. Os dados são armazenados no banco de dados e exibidos no frontend.

### **Geração de Relatórios**
1. O usuário acessa a página `/relatorio`.
2. Os dados de custos e receitas são carregados do banco de dados.
3. Gráficos e tabelas são gerados usando **Recharts** e componentes personalizados.

---

## **Rotas**

### **Rotas Públicas**
- **`/login`:** Página de login para autenticação.

### **Rotas Protegidas**
- **`/`:** Dashboard principal com KPIs e gráficos.
- **`/empreendimentos`:** Listagem e detalhes dos empreendimentos.
- **`/custos`:** Tabela de custos operacionais.
- **`/diarias`:** Tabela de receitas de diárias.
- **`/relatorio`:** Relatórios financeiros com gráficos e tabelas.
- **`/importar`:** Página para upload de planilhas e histórico de importações.
- **`/usuarios`:** Gerenciamento de usuários (apenas para administradores).

### **Rotas de API**
- **`/api/import`:** Processa o upload de planilhas.
- **`/api/amenitiz-sync`:** Sincroniza dados com a API Amenitiz.
- **`/api/clear`:** Remove dados financeiros de um período específico.
- **`/api/prestacao-contas-pdf`:** Gera PDFs de prestação de contas.

---

## **Componentes**

### **Componentes de Layout**
- **`AppSidebar`:** Barra lateral de navegação com itens de menu baseados no papel do usuário.

### **Componentes de Gráficos**
- **`DashboardCharts`:** Gráficos de barras para receitas e lucros.
- **`RelatorioLineChart`:** Gráficos de linha para análise de receitas, custos e lucros ao longo do tempo.

### **Componentes Compartilhados**
- **`AmenitizSyncButton`:** Botão para sincronizar dados com a API Amenitiz.
- **`MonthYearFilter`:** Filtros de mês e ano para tabelas e gráficos.
- **`DeleteButton`:** Botão para exclusão de dados com confirmação.

### **Componentes de Modal**
- **`CriarEmpreendimentoModal`:** Modal para criar novos empreendimentos.
- **`CriarApartamentoModal`:** Modal para criar novos apartamentos.

---

## **Problemas Conhecidos**

1. **Falta de apartamentos cadastrados:**
   - O erro "Nenhum apartamento cadastrado" pode ocorrer devido à ausência de dados no banco de dados ou falhas na sincronização com a API Amenitiz.

2. **Falta de validação de dados:**
   - Algumas funções não validam os dados retornados da API ou do banco de dados.

3. **Problemas de desempenho:**
   - Falta de paginação em tabelas grandes.
   - Processamento de grandes arquivos Excel em memória.

4. **Segurança:**
   - Vulnerabilidade de injeção de `search_path` no banco de dados.
   - Falta de logs de auditoria detalhados.

---

## **Melhorias Sugeridas**

1. **Banco de Dados:**
   - Adicionar restrições `UNIQUE` para evitar duplicação de dados.
   - Corrigir a vulnerabilidade de `search_path` no gatilho de criação de usuários.

2. **Frontend:**
   - Melhorar a exibição de mensagens de erro no frontend.
   - Implementar paginação e virtualização para tabelas grandes.

3. **Backend:**
   - Adicionar validação de dados nas respostas da API.
   - Implementar logs detalhados para facilitar o diagnóstico de problemas.

4. **Testes:**
   - Unit tests para lógica de importação e sincronização.
   - E2E tests para fluxos críticos (ex.: importação → dashboard).

5. **Documentação:**
   - Documentação detalhada para APIs e componentes.
   - Storybook para os componentes de UI.

---

## **Conclusão**
O sistema **AlugEasy** é uma solução robusta para gestão financeira de imóveis de aluguel de curta duração. Ele utiliza tecnologias modernas e boas práticas de desenvolvimento, mas ainda há espaço para melhorias em termos de validação de dados, desempenho, segurança e cobertura de testes. Com as melhorias sugeridas, o sistema estará mais preparado para escalar e atender a um número maior de usuários e dados.