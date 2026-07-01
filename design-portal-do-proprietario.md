# Design do Portal do Proprietário — AlugEasy

> Documento de referência para agentes de design, IA e desenvolvedores que trabalharão no Portal do Proprietário. Contém contexto completo de produto, personas, padrões visuais e fluxos de UX.

---

## 1. Visão Geral do Produto

### O que é o AlugEasy

O **AlugEasy** é um sistema de gestão financeira para locação de curta temporada. A empresa administra apartamentos em empreendimentos de alto padrão (ex: Metropolitan, Cullinan) e os disponibiliza em plataformas como Booking.com, Airbnb e canais diretos. O sistema cuida de toda a operação financeira: importação de planilhas, lançamento de custos, cálculo de faturamento e repasse aos proprietários.

### O que é o Portal do Proprietário

O **Portal do Proprietário** (`/proprietario`) é a camada externa do sistema voltada para os donos dos imóveis. É um painel de **visibilidade financeira** — os proprietários não operam o sistema, apenas visualizam os resultados da gestão feita pela equipe AlugEasy.

**O Portal oferece:**
- Dashboard com KPIs do mês selecionado
- Extrato detalhado por apartamento (faturamento, custos, lucro, repasse)
- Histórico dos últimos 12 meses com gráfico de evolução
- Monitoramento de reservas em tempo real (Supabase Realtime)
- Download de PDF de prestação de contas

**O Portal NÃO permite:**
- Editar qualquer dado
- Ver informações de outros proprietários
- Ver custos de categorias não repassáveis (ex: comissões internas)
- Acessar o sistema financeiro interno (`/`)

---

## 2. Público-Alvo e Personas

### Contexto do Usuário

Os proprietários são **investidores de imóveis em locação** que terceirizaram a operação para a AlugEasy. Eles querem acompanhar a rentabilidade dos seus imóveis sem precisar entender os detalhes operacionais. O perfil é:

- Não são técnicos em sistemas
- Acessam principalmente via smartphone
- Verificam o portal 1–2 vezes por semana
- A principal dúvida é sempre: "quanto vou receber esse mês?"
- Confiam na AlugEasy para a operação, mas querem transparência nos números

### Persona 1: Proprietário Individual

- **Perfil:** 1–3 apartamentos na AlugEasy
- **Objetivo:** Monitorar ocupação e faturamento de forma simples
- **Comportamento:** Acessa via celular, confere o repasse estimado, lê o extrato mensal que chega por email
- **Frustração:** Não entende termos técnicos; quer ver "meu dinheiro" de forma clara

### Persona 2: Micro-empreendedor

- **Perfil:** 5–10 apartamentos em 2–3 empreendimentos
- **Objetivo:** Comparar desempenho entre imóveis
- **Comportamento:** Acessa pelo computador, compara meses, baixa PDFs para o contador
- **Frustração:** Quer visão consolidada e granular ao mesmo tempo

### Persona 3: Proprietário Preferencial

- **Perfil:** Cliente antigo com relacionamento próximo com a AlugEasy
- **Objetivo:** Ter acesso self-service para não precisar ligar para a equipe
- **Comportamento:** Compartilha login com contador, acessa extrato com regularidade
- **Frustração:** Quer dados precisos e não quer ligar para confirmar valores

---

## 3. Arquitetura de Rotas

```
app/(proprietario)/
├── layout.tsx                    ← Wrapper com header, nav, auth guard
└── proprietario/
    ├── page.tsx                  ← /proprietario — Dashboard principal
    ├── bem-vindo/
    │   └── page.tsx              ← /proprietario/bem-vindo — First-time experience
    ├── extrato/
    │   └── page.tsx              ← /proprietario/extrato?mes=&ano= — Extrato detalhado
    └── historico/
        └── page.tsx              ← /proprietario/historico — Histórico 12 meses
```

**Acesso controlado por:**
- `proxy.ts` (middleware): redireciona proprietário para `/proprietario` no login
- Layout Server Component: valida `role === 'proprietario'` em toda rota do portal
- RLS Supabase: garante isolamento de dados no banco

---

## 4. Design Visual

### 4.1 Identidade da Marca AlugEasy

A AlugEasy posiciona-se como uma empresa profissional e confiável na gestão de imóveis de alto padrão. O visual do portal reflete isso: **sóbrio, limpo, financeiro** — sem elementos lúdicos. A paleta combina azul navy (seriedade, confiança) com verde (crescimento, resultado positivo).

O proprietário deve sentir que está acessando um **produto premium**, não uma planilha online.

### 4.2 Paleta de Cores

#### Cores Primárias de Marca

| Nome | Hex | Uso |
|------|-----|-----|
| Primary Navy | `#193660` | Links, ícones, nav ativo, toasts, BottomNav ativo |
| Dark Navy | `#0f1a2e` | Textos principais, headings, card headers |
| Secondary Navy | `#0c447c` | Ícones em backgrounds claros, hover states |

#### Cores Semânticas

| Semântica | Hex | Uso |
|-----------|-----|-----|
| Lucro / Positivo | `#15803d`, `#166534` | Valores de lucro, repasse ao proprietário, CTAs |
| Custo / Negativo | `#dc2626` | Custos, alertas de despesas |
| Alerta / Novo | `#d97706` | Novas reservas em realtime, warnings de configuração |
| Neutro / Muted | `#94a3b8`, `#5a6a82` | Subtítulos, labels de tabela, texto secundário |

#### Backgrounds e Superfícies

| Elemento | Hex | Uso |
|----------|-----|-----|
| Page background | `#f8f6f1` | Background geral das páginas |
| Card / Panel | `#ffffff` | Superfície de cards e painéis |
| Header/Footer | `#ffffff` | Header sticky e footer |
| Row hover | `#f8f6f1` | Hover em linhas clicáveis da tabela |
| Border | `#e7e9ee` | Bordas de cards, dividers, inputs |
| Info BG | `#f0fdf4` | Backgrounds de estado "ok" |
| Warning BG | `#fffbeb` | Background de alertas (custos não importados) |
| Error BG | `#fef2f2` | Background de estado de erro |

#### Cores dos KPI Cards (Top Border)

| KPI | Border Top | Icon BG | Semântica |
|-----|-----------|---------|-----------|
| Faturamento | `#0f2647` (navy) | `#e6f1fb` | Receita bruta |
| Custos | `#dc2626` (red) | `#fef2f2` | Despesas repassáveis |
| Lucro | `#15803d` (green) | `#eaf3de` | Resultado |
| Repasse | `#d97706` (amber) | `#faeeda` | Valor ao proprietário |

#### Cores de Plataformas de Reserva

| Plataforma | BG Badge | Text Badge |
|-----------|----------|------------|
| AlugEasy | `#e6f1fb` | `#0c447c` |
| Booking.com | `#e8f0fe` | `#1a56db` |
| Airbnb | `#ffe4e6` | `#be123c` |
| Expedia | `#fef3c7` | `#92400e` |

### 4.3 Tipografia

#### Fontes Carregadas

```css
/* Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&display=swap');
```

- **DM Sans** — fonte principal de UI: labels, valores, botões, tabelas
- **Instrument Serif** — fonte editorial: títulos de página, saudação de boas-vindas
- **Inter** — fonte fallback (configurada no root layout)

#### Hierarquia Tipográfica

| Elemento | Fonte | Tamanho | Peso | Cor |
|----------|-------|---------|------|-----|
| Page heading principal | Instrument Serif | 28px | 400 | `#0f1a2e` |
| Nome de boas-vindas | Instrument Serif | 36px | 400 | `#0f1a2e` |
| Panel / Card title | DM Sans | 15px | 600 | `#0f1a2e` |
| KPI label (uppercase) | DM Sans | 10.5px | 700 | `#94a3b8` |
| KPI value | DM Sans | 22px | 700 | `#0f1a2e` |
| Table header | DM Sans | 10.5px | 700 | `#94a3b8` |
| Table cell | DM Sans | 13–14px | 400 | `#0f1a2e` |
| Subtítulo / descritivo | DM Sans | 13–14px | 400 | `#5a6a82` |
| Caption / footer | DM Sans | 11–12px | 500 | `#94a3b8` |
| Valor monetário destaque | DM Sans | 19px | 700 | `#14532d` |

### 4.4 Espaçamento e Bordas

**Grid de espaçamento (Tailwind):**
- Gaps internos de cards: `16px` (gap-4) a `24px` (gap-6)
- Padding de painéis: `18–24px`
- Padding de página: `24px` horizontal, `24px` vertical
- Extra padding mobile bottom: `96px` (para BottomNav)

**Border radius:**
- Elementos pequenos (badges, inputs): `6–8px`
- Cards/painéis: `12–16px`
- Painéis maiores: `18px`
- Card da página de boas-vindas: `24px`

**Bordas:**
- Padrão: `1px solid #e7e9ee`
- Destaque (warning): `3px left solid #b45309`
- Cards KPI: `3–4px top solid` (cor semântica por KPI)

### 4.5 Sombras e Elevação

O portal usa **elevação mínima** — sem box-shadow excessivo. Separação visual é feita por:
- Backgrounds diferentes (branco vs `#f8f6f1`)
- Bordas `#e7e9ee`
- `divide-y` (Tailwind) entre linhas de tabela

Quando há sombra, é sutil: `shadow-sm` (Tailwind).

### 4.6 Ícones

Biblioteca: **Lucide React** (consistente com o sistema interno)

Ícones em uso no portal:

| Ícone | Contexto |
|-------|----------|
| `TrendingUp` | Faturamento, gráficos positivos |
| `Receipt` | Custos |
| `Wallet` | Repasse ao proprietário |
| `Clock` | Sincronização, empty states |
| `BarChart2` | Histórico, evolução |
| `FileText` | Extrato, PDF |
| `Download` | Baixar PDF |
| `History` | Histórico |
| `AlertCircle`, `AlertTriangle` | Warnings |
| `Home` | Imóvel, BottomNav |
| `LogOut` | Logout |
| `CalendarDays` | Reservas por mês |
| `ChevronDown`, `ChevronRight` | Accordion, navegação |
| `RefreshCw` | Sync button |
| `X` | Dismiss nova reserva |

Tamanhos padrão:
- Ícones em KPI cards: `18–20px`
- Ícones em botões: `13–15px`
- Ícones em BottomNav: `20px`
- Ícones em badges: `11–13px`

---

## 5. Layout e Estrutura de Página

### 5.1 Layout Wrapper (`layout.tsx`)

Todo o portal usa um layout fixo com 3 zonas:

```
┌─────────────────────────────────────────────────────┐
│  HEADER (sticky, h-14 mobile / h-16 desktop)        │
│  [Logo + "Portal do Proprietário"] [Nav] [Nome+Out] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  MAIN (max-w-5xl, mx-auto, px-6, py-6)             │
│  [Conteúdo da página]                               │
│                                                     │
│                                                     │
├─────────────────────────────────────────────────────┤
│  FOOTER (desktop only)                              │
│  "AlugEasy © 2026 — Portal do Proprietário"         │
└─────────────────────────────────────────────────────┘
│  BOTTOM NAV (mobile only, fixed)                    │
│  [Home] [Extrato] [Histórico]                       │
└─────────────────────────────────────────────────────┘
```

**Header:**
- `bg-white`, `border-b border-#e7e9ee`, `sticky top-0 z-40`
- Logo AlugEasy à esquerda + rótulo "Portal do Proprietário" (hidden em mobile)
- Navegação central (desktop only): Início | Extrato | Histórico
- Nome completo do usuário + LogoutButton à direita

**BottomNav (mobile):**
- `fixed bottom-0`, `bg-white`, `border-t`
- Respeita `safe-area-inset-bottom` (notch iPhone)
- Ícone + label curto (Home, Extrato, Histórico)
- Ativo: cor `#193660`, fundo `#193660/10`
- Inativo: cor `#9ca3af`

### 5.2 Dashboard Principal (`/proprietario`)

```
┌──────────────────────────────────────────────────────┐
│  Título + Seletor mês/ano                           │
├───────────┬───────────┬───────────┬──────────────────┤
│ Fat.      │ Custos    │ Lucro     │ Repasse          │
│ KPI card  │ KPI card  │ KPI card  │ KPI card         │
├──────────────────────────────────────────────────────┤
│  Evolução dos últimos 6 meses (LineChart)            │
│  [Faturamento] [Lucro] [Repasse]                     │
├──────────────────────────────────────────────────────┤
│  Reservas de [Mês] [badge N]  Total: R$ X            │
│  [Mini-cards por plataforma]                         │
│  [Tabela de reservas]                               │
├──────────────────────────────────────────────────────┤
│  div#novas-reservas-portal  ← React Portal           │
│  [Chegaram agora] (Realtime)                         │
├──────────────────────────────────────────────────────┤
│  Atalhos rápidos (3 cols)                            │
│  [Ver extrato] [Baixar PDF] [Histórico]              │
└──────────────────────────────────────────────────────┘
```

### 5.3 Extrato (`/proprietario/extrato`)

```
┌──────────────────────────────────────────────────────┐
│  "Extrato — Maio 2026"  [Seletor mês]                │
│  Demonstrativo completo...                           │
├──────────────────────────────────────────────────────┤
│  [Fat. Total] [Custos Totais] [Lucro Total]          │
│  (3 KPI summary cards)                              │
├──────────────────────────────────────────────────────┤
│  CARD: Apt 117 — Cullinan       [Badge Administração]│
│  ─────────────────────────────────────────────────  │
│  Faturamento           R$ 8.000,00                  │
│  Custos (▼)            R$ 2.000,00                  │
│    └ Limpeza            R$ 1.200,00                 │
│    └ Manutenção           R$ 800,00                 │
│  Lucro                 R$ 6.000,00                  │
│  Taxa de repasse       15% sobre Lucro Líquido      │
│  ════════════════════════════════════════           │
│  Seu repasse          R$ 5.100,00  (verde bold)     │
│                                  [Baixar PDF ↓]     │
├──────────────────────────────────────────────────────┤
│  [CARD: próximo apartamento...]                     │
└──────────────────────────────────────────────────────┘
```

### 5.4 Histórico (`/proprietario/historico`)

```
┌──────────────────────────────────────────────────────┐
│  "Repasse mensal"  (TrendingUp)                      │
│  [BarChart — últimos 12 meses, cor #15803d]          │
├──────────────────────────────────────────────────────┤
│  "Resumo mensal"  (Calendar)                         │
│  Mês | Status | Fat. | Custos | Lucro | Repasse | Val│
│  ─────────────────────────────────────────────────  │
│  Mai/26 [Disponível ●] R$ 8k  R$ 2k  R$ 6k  R$ 5.1k│
│  Abr/26 [Disponível ●] ...                          │
│  Mar/26 [Em andamento ○] —    —     —     —         │
│  ...                                                │
└──────────────────────────────────────────────────────┘
```

---

## 6. Componentes de UI

### 6.1 KPI Card

O padrão de KPI card usado no dashboard e extrato:

```
┌─────────────────────────────────┐  ← 3-4px top border (cor semântica)
│  [Icon BG]    LABEL (caps)      │
│  [Ícone]      R$ 12.500,00      │  ← valor grande, bold
│               +8% vs mês ant.   │  ← variação (opcional)
└─────────────────────────────────┘
```

- Background: `#ffffff`
- Border: `1px #e7e9ee` + top accent
- Border radius: `12px`
- Icon BG: círculo `32–36px`, cor semântica clara
- Label: `10.5px`, `font-weight 700`, uppercase, `#94a3b8`
- Valor: `22px`, `font-weight 700`, `#0f1a2e`

### 6.2 Badges de Status

| Status | Cores |
|--------|-------|
| Disponível / Fechado | BG `#f0fdf4`, text `#166534` (verde) |
| Em andamento | BG `#f1f5f9`, text `#475569` (slate) |
| Sem dados | BG `#f1f5f9`, text `#94a3b8` (muted) |
| Administração | BG `#eff6ff`, text `#1d4ed8` (blue) |
| Sublocação | BG `#fffbeb`, text `#92400e` (amber) |
| NOVO (realtime) | BG `#fef3c7`, text `#d97706` |

### 6.3 MonthYearFilter

Dropdowns para mês e ano. Altera os `searchParams` da URL (push sem reload completo).

- Posição: canto superior direito do header de cada página
- Estilo: `border #e7e9ee`, `bg-white`, `text-sm`, `rounded-md`
- Meses: Janeiro a Dezembro (array localizado)
- Anos: ano anterior, atual, próximo

### 6.4 SyncButton (Atualizar Dados)

4 estados visuais:

| Estado | BG | Border | Text | Ícone |
|--------|----|----|------|-------|
| Idle | `#fff` | `#e7e9ee` | `#0f1a2e` "Atualizar dados" | RefreshCw |
| Loading | `#f8fafc` | `#e7e9ee` | `#64748b` "Sincronizando…" | RefreshCw (spin) |
| OK | `#f0fdf4` | `#86efac` | `#166534` "N reservas carregadas" | ✓ |
| Error | `#fef2f2` | `#fca5a5` | `#b91c1c` "Erro ao sincronizar" | AlertCircle |

### 6.5 Toast de Realtime

Aparece `fixed bottom-right` quando chega nova reserva:

```
┌─────────────────────────────────────────┐
│  ✓  Nova reserva recebida               │
│     dados atualizando…                  │
└─────────────────────────────────────────┘
```

- BG: `#0f2647` (navy escuro)
- Text: `#ffffff`
- Border radius: `10px`
- Duração: 8 segundos, some automaticamente

### 6.6 ItemNovaReserva (Realtime)

Card para cada nova reserva que chega em tempo real:

```
┌─────────────────────────────────────────┐  ← bg #fffbf2
│  [NOVO]  Easy 117                   [X] │
│  J. S.***     Check-in: 03/06          │
│  Booking.com        R$ 1.200,00        │
└─────────────────────────────────────────┘
```

- Background: `#fffbf2` (amber muito claro)
- Badge NOVO: `#fef3c7` / `#d97706`
- Nome hóspede mascarado: apenas inicial + sobrenome truncado

### 6.7 Warning Box (Custos Não Importados)

```
┌──┬──────────────────────────────────────────────────┐
│  │  ⚠ Os custos deste mês ainda não foram          │
│  │  lançados pela equipe AlugEasy. O lucro e o     │
│  │  repasse exibidos podem ser ajustados...        │
└──┴──────────────────────────────────────────────────┘
```

- BG: `#fffbeb`
- Border: `1px #fde68a`, `3px left solid #b45309`
- Ícone: AlertTriangle `#d97706`
- Text: `14px`, `#92400e`

### 6.8 Empty States

Padrão visual para telas sem dados:

```
         🕐
   Nenhuma diária em Maio 2026
   A sincronização foi realizada, mas seus imóveis
   não registraram receita neste mês.
```

- Ícone: `48–64px`, cor `#d1d5db`
- Título: `DM Sans 16px`, `font-weight 600`, `#374151`
- Descrição: `DM Sans 14px`, `#6b7280`, `max-width 360px`
- Centralizado vertical e horizontal no container

---

## 7. Gráficos (Recharts)

### 7.1 Gráfico de Evolução (LineChart) — Dashboard

3 séries de linha:

| Série | Cor |
|-------|-----|
| Faturamento | `#193660` (navy) |
| Lucro | `#22c55e` (green) |
| Repasse | `#f59e0b` (amber) |

- Eixo Y: notação "R$ Xk" para valores acima de 1000
- Tooltip: valores em BRL com 2 casas
- CartesianGrid: `strokeDasharray` pontilhado
- Responsive: usa `ResponsiveContainer`

### 7.2 Gráfico de Repasse (BarChart) — Histórico

- 1 série: valor de repasse ao proprietário
- Cor das barras: `#15803d` (verde)
- `maxBarSize: 34px`
- Border radius barras: `6px` (top)
- Altura: `180px`
- Eixo X: labels "Jan/26", "Fev/26" etc.
- Empty state: texto centralizado "Nenhum repasse registrado ainda"

---

## 8. Responsividade

### Breakpoints Usados

- **Mobile:** `< 768px` (md)
- **Desktop:** `≥ 768px`

### Adaptações Chave

| Elemento | Mobile | Desktop |
|----------|--------|---------|
| Navegação | BottomNav fixo (64px + safe area) | Nav horizontal no header |
| KPI Cards | 2 colunas | 4 colunas |
| Tabela Histórico | Cards `HistoricoCardsMobile` | Tabela com linhas clicáveis |
| Tabela Reservas | Scroll horizontal | Tabela completa |
| Heading | Instrument Serif 22px | 28px |
| Padding página | `px-4 py-4` | `px-6 py-6` |
| Footer | Oculto | Visível |
| PDF Button | Ação fixa no bottom | Inline no card |

### Touch-Friendly

- Altura mínima de botão: `44px` (padrão iOS)
- Espaço mínimo entre elementos interativos: `8px`
- Tamanho mínimo de texto: `14px` (mobile)
- `safe-area-inset-bottom` sempre respeitado no BottomNav

---

## 9. Padrões de Interação

### Navegação entre Páginas

- Todos os links usam `Next/Link` (client-side navigation)
- `usePathname()` para detectar rota ativa (BottomNav, nav header)
- Seletor de mês/ano altera `searchParams` via `router.push()`
- Linhas da tabela histórico: `role="button"`, `tabIndex={0}`, suporte teclado (Enter/Space)

### Feedback de Ações

- **Sync**: 3 estados visuais + reset automático (5–6s)
- **Realtime**: Toast efêmero 8s + seção "Chegaram agora" persistente
- **Download PDF**: link `href` direto para API route (abre nova aba)
- **Logout**: `supabase.auth.signOut()` → `router.push('/login')`

### Accordion de Custos

No card de extrato por apartamento:
- Click na linha "Custos" expande/colapsa lista de categorias
- Chevron rotaciona 180° quando aberto
- Animação: `transition-all duration-200`

### Debounce Realtime

Quando nova reserva chega via Supabase:
1. Toast imediato (visual instantâneo)
2. Debounce 1.5s
3. `router.refresh()` (recarrega dados Server Component)
4. Agrupa rajadas de eventos para não fazer N refreshes seguidos

---

## 10. Estados Especiais

### Histórico em Construção (< 2 meses de dados)

Quando o proprietário tem menos de 2 meses de dados, o gráfico de evolução não é exibido:

```
  ⏰ Histórico em construção
  O gráfico de evolução fica disponível depois de 2 meses
  de operação contínua.

  [████████░░░░░░░░░░░]  1 de 2 meses necessários
```

- Progress bar: `width = (mesesComDados / 2) * 100%`
- Cor: `#15803d`

### Proprietário com Apartamento Inativo (`ativo = false`)

Se o vínculo em `proprietario_apartamentos` estiver inativo:
- Apartamento não aparece nas queries (filtrado por `ativo = true`)
- Se todos os apartamentos estiverem inativos: empty state na página principal
- Sem mensagem de erro — apenas "sem dados"

### Categorias Repassáveis Não Configuradas

Se a tabela `categorias_repassaveis` estiver vazia (padrão ao criar novo proprietário):
- Card de Custos no dashboard mostra badge de alerta `#b45309`
- Texto: "Sem categorias configuradas"
- Custos exibidos: R$ 0,00
- Lucro = Faturamento (sem dedução de custos)

---

## 11. Fluxos de Dados Principais

### Cálculo do Repasse ao Proprietário

```
Faturamento (diárias do mês)
    - Custos (categorias repassáveis)
    = Lucro Líquido
    
Base de Cálculo:
  se tipo_repasse = 'lucro'        → base = Lucro Líquido
  se tipo_repasse = 'faturamento'  → base = Faturamento

Taxa da AlugEasy = base × (taxa_repasse / 100)

Repasse ao Proprietário = Lucro Líquido - Taxa da AlugEasy
```

**Exemplo:**
```
Faturamento: R$ 10.000
Custos: R$ 3.000
Lucro: R$ 7.000
taxa_repasse: 15% sobre lucro
Taxa AlugEasy: R$ 7.000 × 0,15 = R$ 1.050
Seu repasse: R$ 7.000 − R$ 1.050 = R$ 5.950
```

### Prioridade de Fonte de Receita

1. **Diárias** (tabela `diarias` — importadas via XLSX): fonte primária
2. **Reservas Amenitiz** (`amenitiz_reservas`): fallback quando não há diárias importadas

O sistema usa `usarDiarias: boolean` para indicar qual fonte foi usada.

### Realtime de Reservas

```
Supabase postgres_changes (INSERT em amenitiz_reservas)
    → RLS avalia: apartamento_id ∈ apartamentos do proprietário?
    → Se sim: entrega evento para o cliente
    → RealtimeReservas.tsx recebe evento
    → Deduplicação via seenIds (Set)
    → Toast + seção "Chegaram agora"
    → Debounce 1.5s → router.refresh()
```

---

## 12. Regras de Design (Não Quebrar)

Estas decisões foram confirmadas e não devem ser alteradas:

1. **"Seu repasse" é sempre o que o proprietário recebe** — lucro menos a taxa da AlugEasy. Nunca mostrar a taxa bruta como sendo o repasse.

2. **Custos só aparecem se a categoria está em `categorias_repassaveis`** — nunca exibir custos direto da tabela `custos`. Sempre usar a view `custos_proprietario`.

3. **Nome do hóspede é mascarado** — apenas inicial + sobrenome truncado. Nunca exibir nome completo no portal.

4. **Proprietário é read-only** — sem botões de editar, criar ou excluir qualquer dado financeiro.

5. **Isolamento por proprietário** — qualquer query deve filtrar por `proprietario_apartamentos` com `ativo = true`. Nunca trazer dados de apartamentos de outros proprietários.

6. **Paleta conservadora** — sem cores vibrantes, gradientes ou elementos decorativos excessivos. O portal é financeiro, não um app de gamificação.

7. **DM Sans para tudo, Instrument Serif só para headings/greeting** — não misturar fontes em elementos de tabela ou card.

8. **KPI "Seu Repasse" sempre em verde** — independentemente do valor, pois representa receita do proprietário.

---

## 13. Checklist para Novos Componentes no Portal

Ao criar qualquer novo componente para o portal do proprietário:

- [ ] Paleta de cores: usar apenas as definidas neste documento
- [ ] Tipografia: DM Sans para UI, Instrument Serif para headings
- [ ] Responsividade: testar mobile (< 768px) e desktop
- [ ] Touch: área clicável mínima de 44px
- [ ] Empty state: sempre ter um estado para "sem dados"
- [ ] Loading state: se há fetch assíncrono, mostrar skeleton ou spinner
- [ ] Segurança: dados de custos sempre via view `custos_proprietario`
- [ ] LGPD: nome de hóspede sempre mascarado
- [ ] Acessibilidade: elementos interativos com `role`, `tabIndex`, suporte teclado
- [ ] Ícones: apenas Lucide React
- [ ] Bordas: `#e7e9ee` como padrão
- [ ] Border radius: mínimo 8px, máximo 24px

---

## 14. Referências Técnicas

| Arquivo | Propósito |
|---------|-----------|
| `app/(proprietario)/layout.tsx` | Auth guard + estrutura visual base |
| `app/(proprietario)/proprietario/page.tsx` | Dashboard principal (381 linhas) |
| `app/(proprietario)/proprietario/extrato/page.tsx` | Extrato por apartamento (281 linhas) |
| `app/(proprietario)/proprietario/historico/page.tsx` | Histórico 12 meses (190 linhas) |
| `app/(proprietario)/proprietario/bem-vindo/page.tsx` | First-time experience (166 linhas) |
| `components/proprietario/realtime-reservas.tsx` | Supabase Realtime + React Portal |
| `components/proprietario/sync-button.tsx` | Botão sincronização com 4 estados |
| `components/proprietario/reservas-mes-panel.tsx` | Tabela de reservas do mês |
| `components/proprietario/extrato-apt-card.tsx` | Card por apartamento no extrato |
| `components/proprietario/evolucao-chart.tsx` | LineChart 3 séries (Recharts) |
| `components/proprietario/historico-chart.tsx` | BarChart repasse (Recharts) |
| `lib/calcular-kpis.ts` | Função central de KPIs (compartilhada com PDF) |
| `lib/enviar-extrato-core.ts` | Envio de email de extrato via Resend |
| `app/api/proprietario/sync/route.ts` | API de sincronização manual |
| `supabase/migrations/023_fix_rls_isolamento.sql` | RLS completo do portal |
| `supabase/migrations/025_realtime_amenitiz_reservas.sql` | Realtime + ingest_status |

---

*Última atualização: Julho 2026*
