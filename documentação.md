# 📄 Documentação de Arquitetura e Dados: Sistema Financeiro Alugueasy

## 1. Visão Geral do Projeto
**Objetivo:** Automatizar a ingestão, o armazenamento estruturado e a visualização do histórico financeiro (Faturamento, Custos e Lucro) da empresa. O projeto substitui o controle manual em planilhas isoladas por um pipeline de dados centralizado e escalável.
**Área Responsável:** Análise de Dados.
**Stack Tecnológico:**
* **Origem dos Dados:** Planilhas financeiras (CSV/XLSX).
* **Processamento/ETL:** Anthropic Claude (via automação de prompts/integração).
* **Armazenamento (Backend):** Supabase (PostgreSQL).
* **Frontend/Visualização:** Ferramentas de Business Intelligence (Power BI ou Looker Studio).

---

## 2. Arquitetura do Sistema
O sistema segue uma arquitetura moderna de dados dividida em três camadas principais: Ingestão, Armazenamento e Visualização.

1.  **Camada de Ingestão (ETL com IA):** Os dados brutos das planilhas são submetidos ao Claude, que atua como o motor de transformação. Ele valida os formatos, converte texto em tipos numéricos adequados e gera as instruções (SQL `INSERT` ou via API) para gravar os dados.
2.  **Camada de Armazenamento (Supabase):** O banco de dados relacional (PostgreSQL) recebe os dados limpos. Esta camada garante a integridade referencial, evita duplicidades e aplica regras de segurança (Row Level Security - RLS).
3.  **Camada de Visualização (Frontend/BI):** Ferramentas de análise de dados conectam-se diretamente ao Supabase via protocolo PostgreSQL para ler os dados e renderizar painéis interativos para a tomada de decisão da diretoria.

---

## 3. Modelagem de Banco de Dados (Schema)
Os dados financeiros serão consolidados em uma tabela centralizada para facilitar consultas analíticas e agregações de tempo.

**Tabela:** `historico_financeiro`

| Coluna | Tipo (PostgreSQL) | Restrições | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | Primary Key, Auto | Identificador único do registro. |
| `data_competencia` | `date` | Not Null | Data de referência do faturamento/custo (ex: 1º dia do mês). |
| `categoria` | `text` | Not Null | Classificação (ex: Faturamento, Custo Fixo, Custo Variável). |
| `descricao` | `text` | Opcional | Detalhamento da origem da receita ou despesa. |
| `valor_faturamento` | `numeric(15,2)` | Default 0.00 | Receita bruta gerada. |
| `valor_custo` | `numeric(15,2)` | Default 0.00 | Despesas associadas ao período/item. |
| `lucro_liquido` | `numeric(15,2)` | Calculado | `valor_faturamento - valor_custo`. |
| `criado_em` | `timestamp` | Default `now()` | Data e hora da ingestão no sistema. |

---

## 4. Pipeline de Ingestão de Dados (SOP)
Procedimento Operacional Padrão para a atualização mensal dos dados:

1.  **Extração:** O analista exporta os dados do mês vigente da planilha original.
2.  **Prompting:** O analista acessa a integração do Claude conectada ao Supabase e envia o prompt padronizado contendo o schema da tabela `historico_financeiro` e os dados brutos.
3.  **Validação:** O Claude estrutura as queries SQL. O analista revisa se os valores monetários estão com ponto flutuante correto (formato americano para o banco de dados).
4.  **Carga:** A query é executada no Supabase (via console ou integração direta do Claude).
5.  **Auditoria:** Uma validação rápida é feita no *Table Editor* do Supabase para garantir que o total de linhas e valores batem com a planilha matriz.

---

## 5. Estrutura de Frontend (Dashboards de BI)
A interface de consumo dos dados não será um sistema web tradicional, mas sim Dashboards dinâmicos construídos em plataformas de BI (Power BI ou Looker Studio), conectadas ao Supabase com credenciais de leitura (Read-Only).

A interface será estruturada nos seguintes blocos visuais:

* **Cabeçalho e Filtros:** Seletores de Ano, Mês e Categoria de Custo/Faturamento.
* **Scorecards (KPIs de Destaque):**
    * Faturamento Bruto Total (Mês atual vs. Mês anterior).
    * Custo Total Operacional.
    * Lucro Líquido Realizado.
    * Margem de Lucro Percentual.
* **Visualizações Gráficas:**
    * **Evolução Temporal:** Gráfico de linhas/colunas combinadas (Faturamento x Custos x Lucro ao longo do ano).
    * **Distribuição:** Gráfico de cascata (Waterfall) demonstrando as deduções do faturamento até chegar ao lucro líquido.
    * **Composição:** Gráfico de rosca categorizando os tipos de custos mais ofensores.
* **Tabela Analítica:** Uma matriz detalhada na parte inferior do painel para drill-down e auditoria das transações individuais por competência.

---

## 6. Governança e Segurança
Lidando com dados financeiros reais da empresa, as seguintes travas de segurança são obrigatórias:

* **Row Level Security (RLS):** Ativado na tabela `historico_financeiro`. Políticas estritas garantirão que chaves de API públicas (anon key) não tenham acesso de leitura ou escrita.
* **Credenciais de BI:** A ferramenta de visualização (Power BI/Looker) utilizará um usuário dedicado no banco de dados com permissões exclusivas de `SELECT`, impedindo qualquer alteração acidental via frontend.
* **Backups:** Manutenção da rotina de backups automáticos nativos do Supabase (Point-in-Time Recovery, se disponível no plano) e arquivamento das planilhas originais.

---

SEMPRE ATUALIZAR A DOCUMENTAÇÃO QUANDO HOUVER MUDANÇAS NO SISTEMA.