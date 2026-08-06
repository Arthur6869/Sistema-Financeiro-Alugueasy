# PROMPT — Gerador de Planilhas de Prestação de Contas + Pipeline de PDFs

> **Como usar este arquivo:** cole-o (ou referencie-o) como prompt inicial de uma sessão de
> desenvolvimento com IA neste repositório. Ele contém TODO o contexto necessário: fluxo desejado,
> formatos de planilha já em uso, tabela de taxas, regras de negócio, padrões do projeto e
> critérios de aceite. Leia também `AGENTS.md` e `documentação.md` antes de codificar.

---

## 1. Objetivo

Construir um pipeline de prestação de contas em **3 etapas**, com aprovação humana no meio:

```
ETAPA 1 (sistema)          ETAPA 2 (humano)             ETAPA 3 (sistema)
─────────────────          ────────────────             ─────────────────
Gerar planilha XLSX   →    Analista confere,       →    Upload da planilha aprovada
de prestação com           ajusta se preciso e          + planilha de custos (já
reservas, hóspedes         APROVA manualmente           existente no fluxo atual)
e taxas calculadas                                      → sistema gera os PDFs de
pela API Amenitiz                                       prestação de contas por
                                                        apartamento/proprietário
```

**Princípio central:** o PDF final NUNCA é gerado direto do banco — ele é gerado a partir da
**planilha aprovada** pelo analista. A planilha é o contrato de aprovação. Os custos vêm da
tabela `custos`, alimentada pela planilha de custos que o analista já monta manualmente e
importa pelo fluxo existente (`/importar` → `POST /api/import`).

---

## 2. Contexto do sistema existente

- **Framework:** Next.js 16.2.1, App Router (nunca Pages Router). Dashboard principal em `/`.
- **Banco:** Supabase PostgreSQL — projeto `rlkmljeatapayiroggrp`, região `sa-east-1`.
- **Roles (semântica INVERTIDA do padrão):** `analista` = operador com CRUD total;
  `admin` = somente leitura; `proprietario` = só o portal `/proprietario`.
- **Auth de rotas de API:** SEMPRE via `requireAnalista()` de `lib/api-auth.ts` (não duplicar
  bloco getUser/role). Leituras que ignoram RLS usam `createAdminClient()` de
  `lib/supabase/admin` (só após autorização verificada).
- **Leituras grandes:** SEMPRE `fetchAllRows()` de `lib/supabase-fetch-all.ts` — o PostgREST
  tem cap `db-max-rows` que `.limit(N)` NÃO contorna.
- **Excel:** exportação com **ExcelJS** (padrão das planilhas de conferência), importação/parse
  com **SheetJS (xlsx)** (padrão do `/api/import`).
- **PDF:** `@react-pdf/renderer` — componente existente `components/pdf/prestacao-contas-pdf.tsx`
  renderizado por `app/api/prestacao-contas-pdf/route.tsx`.
- **Toasts:** sonner. **Auditoria:** `registrarAuditoria()` de `lib/audit.ts` (tabela `audit_log`).
- **Middleware:** o projeto usa `proxy.ts` (Next 16). NUNCA criar `middleware.ts` paralelo.
- **Deploy:** manual via `npx vercel --prod` (sem git integration). Plano Hobby (cron nativo 1x/dia;
  crons reais rodam via pg_cron no Supabase).

### Arquivos de referência obrigatória (ler antes de codificar)

| Arquivo | O que copiar dele |
|---|---|
| `app/api/exportar-diarias-xlsx/route.ts` | Padrão de auth, layout ExcelJS, cores, overrides mensais, fallback diárias, notas de auditoria |
| `app/api/prestacao-contas-pdf/route.tsx` | Cálculo de repasse, proration de reservas, props do componente PDF |
| `components/pdf/prestacao-contas-pdf.tsx` | Componente visual do PDF (reutilizar, não recriar) |
| `app/api/import/route.ts` + `lib/xlsx-parser.ts` | Padrão de parse de planilha, resolução de empreendimento por nome de aba |
| `lib/sync-amenitiz-core.ts` | Regras TRANSFERENCIAS_ANUNCIO, APELIDOS_APARTAMENTO, cálculo de valor líquido |

---

## 3. Dados disponíveis no banco

### `amenitiz_reservas` (fonte da planilha de prestação — sync a cada 5 min via pg_cron)

Campos relevantes por reserva:

| Campo | Conteúdo |
|---|---|
| `booking_id` | ID único da reserva na Amenitiz (chave para round-trip da planilha) |
| `apartamento_id` | FK real para `apartamentos` (pode ser NULL = sem vínculo → fica FORA da prestação) |
| `nome_hospede` | `"Nome Sobrenome — telefone"` (montado no sync) |
| `email_hospede`, `phone_hospede` | contatos do hóspede |
| `checkin`, `checkout` | datas ISO `YYYY-MM-DD` |
| `status` | canceladas = `cancelled`/`canceled`/`no_show` → SEMPRE excluídas de valores |
| `plataforma_normalizada` | contém `booking`, `airbnb` ou é tratado como `alugueasy` |
| `valor_bruto` | valor cheio da reserva |
| `taxa_aplicada` | taxa de plataforma aplicada no sync (fração, ex.: 0.16) |
| `valor_liquido` | **já líquido da taxa de plataforma** — NÃO reaplicar taxa |
| `mes_competencia`, `ano_competencia` | mês/ano do CHECK-IN |
| `individual_room_name` | unidade real (anúncios conjuntos preservam a unidade aqui) |

### Outras tabelas

- `apartamentos`: `numero`, `empreendimento_id`, `tipo_gestao` (`'adm'|'sub'`), `taxa_repasse`
  (percentual), `tipo_repasse` (`'lucro'|'faturamento'`), `nome_proprietario`, `modelo_contrato`
  (`'administracao'|'sublocacao'`).
- `empreendimentos`: `nome` (ESSENCE, EASY, CULLINAN, ATHOS, NOBILE, FUSION, MERCURE,
  METROPOLITAN, RAMADA, BRISAS, VISION, LINK, ASA SUL, AMAZE).
- `custos`: `apartamento_id`, `mes`, `ano`, `tipo_gestao`, `categoria`, `valor`, `origem`
  (`'manual'|'importacao'`) — alimentada pela planilha de custos manual via `/api/import`.
- `diarias`: fallback para apartamentos sem reserva Amenitiz no mês (lançamentos manuais).
- `importacoes`: log de uploads — `status` é `'concluido'` ou `'erro'` (NUNCA `'sucesso'`);
  campo de tipo chama `tipo` (NUNCA `tipo_planilha`).
- `proprietario_apartamentos`: vínculo proprietário↔apartamento (RLS do portal).

---

## 4. Tabela de taxas (fonte da verdade)

### 4.1 Taxas de plataforma (aplicadas NO SYNC — `valor_liquido` já vem líquido)

| Plataforma | Taxa | Empreendimentos |
|---|---|---|
| Booking.com | **16%** | ESSENCE, METROPOLITAN, CULLINAN, BRISAS, MERCURE*, ASA SUL |
| Booking.com | **13%** | EASY, ATHOS, NOBILE, FUSION, RAMADA, VISION, AMAZE, LINK |
| Airbnb | **0%** | todos |
| AlugEasy / reserva manual (source manual/amenitiz) | **10%** | todos |
| Source desconhecido | **0%** + warning no log | — |

\* Exceção: **MERCURE apt 1419 → 13%** (não 16%).

> ⚠️ Como `valor_liquido` já é líquido, a planilha de prestação deve EXIBIR bruto, taxa e
> líquido como colunas informativas — jamais recalcular o líquido aplicando taxa de novo.

### 4.2 Taxa de administração AlugEasy

- **18%** (`TAXA_ALUGUEASY = 0.18`) sobre o subtotal de faturamento líquido de cada apartamento.
- É a comissão cobrada DO PROPRIETÁRIO — separada e posterior às taxas de plataforma.

### 4.3 Repasse ao proprietário (cálculo do PDF)

```
receitaTotal   = Σ valor_liquido das reservas válidas (ou diárias, se fallback)
custosTotal    = Σ custos do apartamento no mês (tabela custos)
lucroLiquido   = receitaTotal − custosTotal
baseCalculo    = tipo_repasse === 'faturamento' ? receitaTotal : lucroLiquido
valorRepasse   = baseCalculo × (taxa_repasse / 100)
valorLiquidoProprietario = lucroLiquido − valorRepasse
```

---

## 5. Formatos de planilha já em uso (manter compatibilidade visual)

### 5.1 Planilha de conferência de diárias (`GET /api/exportar-diarias-xlsx?mes&ano&tipo=adm|sub`)

Uma aba por empreendimento + aba `RESULTADO {TIPO} MES`. Layout por aba:

```
Linha 1:  "JUN/2026 - ADM - ESSENCE"                 (título, bold, cor header)
Linha 2:  101   |   | 204   |   | 301   |   |        (números dos apts — colunas ÍMPARES;
                                                      pares são espaçadores de largura 3;
                                                      última coluna = rótulos, largura 18)
Linhas 3..N:  um VALOR por reserva, por coluna       (mín. 12 linhas, dinâmico, nunca trunca)
Subtotal:     =SUM(coluna)                           (bold, fundo EBF3FB, borda superior)
(vazia)
booking:      Σ por plataforma                       (fonte azul FF0070C0)
airbnb:       Σ por plataforma                       (fonte laranja FFFF6B35)
alugueasy:    Σ por plataforma                       (fonte verde FF00B050)
Taxa AlugEasy 18%: =subtotal*0.18                    (fonte roxa FF7030A0)
(vazia)
TOTAL:  Σ subtotais do empreendimento                (fundo header 1F3864, fonte branca)
FAT     total do empreendimento                      (rótulo verde)
LUC     FAT − custos do empreendimento               (rótulo laranja; valor vermelho se negativo)
```

Aba `RESULTADO`: FAT (fundo C6EFCE) e LUC (fundo FFF2CC) por empreendimento, TOTAL FAT /
TOTAL LUC, e **notas de auditoria** em cinza (competência, taxas, canceladas excluídas,
sem-vínculo, overrides aplicados).

Paleta: header `1F3864`, subtotal `EBF3FB`, FAT `C6EFCE`, LUC `FFF2CC`, zero `FFCCCCCC`.
Formato numérico `#,##0.00`. Nome do arquivo: `CONFERENCIA_DIARIAS_{TIPO}_{MES}_{ANO}.xlsx`.

### 5.2 Planilha de custos (manual, importada via `/api/import`)

Uma aba por empreendimento; colunas por unidade; o parser lê o subtotal por unidade
(linha imediatamente acima de `TOTAL:`) e valida Σ unidades ≈ total da aba (tolerância R$ 0,05).
Abas `RESULTADO`/`RESUMO` são ignoradas. **Este fluxo NÃO muda** — a planilha de custos continua
sendo feita manualmente pelo analista e importada como `custos_adm`/`custos_sub`.

### 5.3 Planilha de diárias (importada)

Aba `RESULTADO` com FAT por empreendimento. Matching de nome case-insensitive e parcial
(ex.: "BRISAS DO LAGO" → BRISAS).

---

## 6. MÓDULO 1 — Gerador da Planilha de Prestação (novo)

### Rota

`GET /api/exportar-prestacao-xlsx?mes={1-12}&ano={YYYY}&tipo=adm|sub`
Auth: `requireAnalista()` + aceitar `x-alugueasy-internal-key` (mesmo padrão da conferência).

### Diferença para a conferência existente

A conferência mostra só valores. A **planilha de prestação** mostra a reserva completa,
**com o nome de cada hóspede**, pronta para o analista conferir e aprovar.

### Layout proposto

Uma aba por **empreendimento**; dentro da aba, um **bloco por apartamento**:

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ ESSENCE — APT 204  (ADM · Proprietário: Fulano · Repasse: 20% sobre lucro)               │  ← faixa header
├────────────┬──────────────┬────────────┬────────────┬────────┬──────────┬───────┬────────┤
│ Booking ID │ Hóspede      │ Check-in   │ Check-out  │ Noites │ Platafor.│ Bruto │ Líquido│
├────────────┼──────────────┼────────────┼────────────┼────────┼──────────┼───────┼────────┤
│ ABC123     │ Maria Silva  │ 03/06/2026 │ 07/06/2026 │ 4      │ Booking  │ 1.000 │ 840,00 │
│ ...        │ ...          │ ...        │ ...        │ ...    │ ...      │ ...   │ ...    │
├────────────┴──────────────┴────────────┴────────────┴────────┴──────────┼───────┼────────┤
│ SUBTOTAL FATURAMENTO (=SUM das linhas do bloco)                          │  Σ    │  Σ     │
│ Taxa AlugEasy 18% (=subtotal líquido × 0,18)                             │       │  ...   │
└──────────────────────────────────────────────────────────────────────────────────────────┘
(coluna Taxa % opcional entre Bruto e Líquido — exibir taxa_aplicada da reserva)
```

No fim de cada aba: TOTAL do empreendimento. Aba final `RESUMO`: FAT por empreendimento +
totais gerais + notas de auditoria (mesmo padrão da conferência).

### Aba oculta `META` (obrigatória — viabiliza o round-trip do Módulo 2)

Aba `state: 'hidden'` (ExcelJS) com uma linha por reserva:

```
booking_id | apartamento_id | empreendimento | numero_apt | tipo_gestao | valor_liquido | mes | ano | tipo | gerado_em | hash
```

- `hash`: SHA-256 do conjunto ordenado de `booking_id:valor_liquido` — permite detectar no
  upload se valores visíveis foram editados sem atualizar a META (ver validações do Módulo 2).
- Linha 1 da META: metadados do arquivo (`mes`, `ano`, `tipo`, timestamp de geração, versão do layout).

### Regras de negócio (idênticas à conferência — copiar, não reinventar)

1. **Competência por CHECK-IN no mês, valor INTEGRAL** — espelha a listagem da Amenitiz de 01
   ao último dia (decisão do usuário em 08/07/2026; NÃO usar rateio por noite aqui).
2. Canceladas/no-show (`cancelled|canceled|no_show`) fora.
3. Cruzamento por **FK `apartamento_id`** (números repetem entre empreendimentos). FK nula fora.
4. Aplicar `OVERRIDES_GESTAO_MENSAL` (extrair a constante do route da conferência para
   `lib/overrides-gestao.ts` e importar nos dois lugares — não duplicar).
5. Fallback: apt do tipo sem nenhuma reserva no mês → tabela `diarias` (linhas com hóspede
   "Lançamento manual", plataforma `alugueasy`).
6. Ordenação: apartamentos por número (sort numérico), reservas por check-in.

Nome do arquivo: `PRESTACAO_{TIPO}_{MES}_{ANO}.xlsx`.

### UI

Botão "Gerar planilha de prestação" na página `/prestacao-contas` (ou nova página
`/prestacoes`), com seletor mês/ano/tipo — seguir o padrão dos botões de exportação existentes.

---

## 7. MÓDULO 2 — Upload da planilha aprovada (novo)

### Rota

`POST /api/prestacoes/aprovar` — FormData: `file` (.xlsx), `mes`, `ano`, `tipo`.
Auth: `requireAnalista()`. Parse com SheetJS (padrão do `/api/import`).

### Fluxo

1. Ler aba `META`. Se ausente → erro claro: "Arquivo não foi gerado pelo sistema — gere a
   planilha pelo Módulo 1".
2. Validar `mes/ano/tipo` da META contra os parâmetros do upload.
3. Recalcular o hash a partir das linhas visíveis e comparar com o hash da META:
   - **Iguais** → planilha aprovada sem alterações.
   - **Diferentes** → o analista editou valores. Isso é PERMITIDO (a aprovação manual existe
     exatamente para ajustes), mas o sistema deve listar as divergências (booking_id, valor
     original × valor editado) e pedir confirmação explícita antes de gravar.
4. Validar consistência: booking_ids existentes em `amenitiz_reservas`, apartamento_id válido,
   Σ dos blocos = subtotais declarados (tolerância R$ 0,05 — mesmo padrão do import de custos).
5. Gravar snapshot em nova tabela `prestacoes` (ver migration §9) com os valores DA PLANILHA
   (não do banco) — é o dado aprovado que alimenta o PDF.
6. `registrarAuditoria()` com resumo (quantas reservas, total, divergências aceitas).
7. Registrar em `importacoes`? NÃO — usar a nova tabela `prestacoes`; `importacoes.tipo` tem
   CHECK constraint com 4 valores fixos e não deve ser alterada.

### Pré-condição de custos

Antes de permitir a aprovação, verificar se existem registros em `custos` para (mes, ano,
tipo_gestao). Se não houver, avisar: "Planilha de custos de {MES}/{ANO} ({TIPO}) ainda não
importada — os PDFs sairão sem custos. Continuar?" (bloquear silenciosamente, não).

---

## 8. MÓDULO 3 — Geração dos PDFs de prestação de contas (novo)

### Rota

`POST /api/prestacoes/gerar-pdfs` — body: `{ prestacao_id }` (ou `mes/ano/tipo`).
Auth: `requireAnalista()`.

### Comportamento

1. Carregar o snapshot aprovado de `prestacoes`/`prestacao_itens`.
2. Para cada apartamento com faturamento no snapshot (ou custo no mês):
   - Receita = Σ valores aprovados do apartamento (DA PLANILHA, não de `amenitiz_reservas`).
   - Custos = tabela `custos` (mes, ano, apartamento) — detalhados por categoria.
   - Cálculo de repasse conforme §4.3 (copiar de `app/api/prestacao-contas-pdf/route.tsx`).
   - Lista de reservas do PDF = itens aprovados (hóspede, check-in/out, noites, plataforma, valor).
   - Renderizar com o componente existente `PrestacaoContasPdf` — adicionar no rodapé:
     "Baseado na prestação aprovada em {data} por {analista}".
3. Saída: um ZIP com todos os PDFs (`Prestacao_{Emp}_Apt-{N}_{Mes}-{Ano}.pdf` — mesmo slug
   atual) ou geração individual por apartamento. Implementar as duas opções na UI.
4. Atualizar `prestacoes.status` → `'pdf_gerado'` + auditoria.

> Nota: manter a rota atual `GET /api/prestacao-contas-pdf` intocada (é usada pelo portal do
> proprietário com dados ao vivo/proration). O novo fluxo é paralelo: PDF "oficial" só a partir
> de planilha aprovada.

---

## 9. Migration necessária (`supabase/migrations/0XX_prestacoes.sql`)

```sql
create table prestacoes (
  id uuid primary key default gen_random_uuid(),
  mes integer not null check (mes between 1 and 12),
  ano integer not null check (ano between 2000 and 2100),
  tipo_gestao text not null check (tipo_gestao in ('adm','sub')),
  status text not null default 'aprovada' check (status in ('aprovada','pdf_gerado')),
  nome_arquivo text not null,
  hash_planilha text not null,
  divergencias jsonb,              -- lista de edições manuais aceitas no upload
  total_faturamento numeric not null,
  aprovado_por uuid references auth.users(id),
  aprovado_em timestamptz not null default now(),
  unique (mes, ano, tipo_gestao)   -- re-aprovar substitui (delete + insert, auditado)
);

create table prestacao_itens (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references prestacoes(id) on delete cascade,
  booking_id text,                 -- null para lançamentos manuais (fallback diárias)
  apartamento_id uuid not null references apartamentos(id),
  nome_hospede text,
  checkin date, checkout date, noites integer,
  plataforma text,
  valor_bruto numeric, valor_liquido numeric not null
);
-- RLS: leitura/escrita apenas analista (seguir padrão das migrations 014-016/028);
-- admin somente leitura; proprietario sem acesso direto (PDF chega via analista).
```

Aplicar no Supabase só com autorização explícita do usuário (padrão do projeto).

---

## 10. Regras e restrições do projeto (NÃO violar)

1. `importacoes.status` = `'concluido'|'erro'` (nunca `'sucesso'`); campo `tipo` (nunca `tipo_planilha`).
2. Server/API: `createClient()` de `@/lib/supabase/server` com `await`; Client Components:
   `@/lib/supabase/client` sem await. Admin: `createAdminClient()` só após autorização.
3. Roles: quem opera é **analista**; admin é read-only. Não inverter.
4. Next 16: middleware é `proxy.ts`. Rotas novas seguem App Router (`app/api/.../route.ts`).
5. Valores monetários: arredondar com `Math.round(v * 100) / 100`; formato Excel `#,##0.00`.
6. Nunca truncar dados (nem linhas de reserva na planilha, nem leituras — `fetchAllRows`).
7. Reaproveitar: `OVERRIDES_GESTAO_MENSAL`, paleta de cores, `MESES`/`MESES_ABREV` de
   `lib/constants`, componente `PrestacaoContasPdf`, `slugify` e `r2` existentes.
8. ESLint zerado e `next build` limpo antes de encerrar.
9. Deploy é manual — não tentar configurar CI/CD.

---

## 11. Critérios de aceite

- [ ] `GET /api/exportar-prestacao-xlsx?mes=6&ano=2026&tipo=adm` gera XLSX com todos os
      apartamentos ADM, nome de cada hóspede por reserva, bruto/taxa/líquido corretos e
      subtotais que batem com a conferência (`exportar-diarias-xlsx`) do mesmo período **ao centavo**.
- [ ] Aba META oculta presente e completa; hash íntegro.
- [ ] Upload da planilha sem edições → aprovação direta; com edições → lista de divergências
      e confirmação antes de gravar.
- [ ] Upload de arquivo sem META, ou de mês/tipo trocado → erro claro, nada gravado.
- [ ] PDFs gerados usam os valores DA PLANILHA aprovada (testar editando um valor e conferindo
      que o PDF reflete a edição), com custos da tabela `custos` e repasse conforme §4.3.
- [ ] ZIP com todos os PDFs baixa corretamente; nomes seguem o padrão de slug atual.
- [ ] Re-aprovação do mesmo mês substitui a anterior com registro em `audit_log`.
- [ ] Nada do fluxo existente quebra: conferência, import de custos, PDF ao vivo do portal.

## 12. Fora de escopo (não fazer sem pedido explícito)

- Envio automático dos PDFs por email (o fluxo Resend existente continua manual).
- Alterar o sync Amenitiz, o portal do proprietário ou o cálculo de KPIs.
- Corrigir globalmente o cadastro dos 7 apts com override de junho/2026 (decisão pendente do usuário).
- Assinatura digital ou versionamento de PDFs.
