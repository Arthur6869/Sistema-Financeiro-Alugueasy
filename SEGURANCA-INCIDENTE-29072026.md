# Incidente de segurança — 29/07/2026

Auditoria completa feita em 29/07/2026 após a invasão relatada. Este documento
registra o que aconteceu, o que foi corrigido e o que ainda depende de ação
manual no painel do Supabase / GitHub.

---

## 1. O que aconteceu

Uma conta não autorizada obteve acesso total ao sistema financeiro.

| | |
|---|---|
| E-mail | `righettiroberto90@gmail.com` |
| Nome declarado | Roberto Righetti |
| ID | `a2d53655-6c7f-479b-8d54-53aebab130b3` |
| Papel obtido | `analista` — CRUD total sobre todos os dados financeiros |
| Conta criada | 29/07/2026 00:05:53 BRT |
| E-mail confirmado | 00:05:53 BRT (190 ms depois — cadastro automatizado) |
| Primeiro login | 29/07/2026 01:23:51 BRT |
| Vínculos de imóvel | nenhum |
| Janela de acesso | ~1h20 |

> **Atenção:** esta mesma conta já havia sido criada e **apagada em 28/07**. A
> recriação em 29/07 ocorreu *depois* de `disable_signup=true` estar aplicado —
> ou seja, **por um caminho diferente do signup público**. Ver seção 4.0: o vetor
> mais provável é um Personal Access Token `sbp_` da Management API que ficou
> vivo. Enquanto ele não for revogado, o incidente pode se repetir.

### Causa raiz (do primeiro acesso, em 28/07)

O trigger `handle_new_user()` (migration 002) inseria `role = 'analista'` — o
papel de **acesso total** — para toda conta nova do Supabase Auth. O endpoint
`/auth/v1/signup` fica habilitado por padrão e é acessível por qualquer um com a
chave anônima, que é pública por design.

Resultado: um `POST /auth/v1/signup` bastava para nascer com CRUD completo sobre
todos os dados financeiros. Não houve quebra de criptografia, roubo de senha nem
exploração de bug — **o sistema entregava o privilégio**.

### O que NÃO foi o vetor (verificado)

- **`.env.local` nunca foi commitado** — confirmado em todo o histórico do git.
- **A chave `service_role` legada que ficou no histórico está revogada** —
  testada contra a API, responde `401`. Ela havia sido commitada em 26 entradas
  de permissão do `.claude/settings.json` e foi removida no commit `6c04e63`; a
  rotação para o formato `sb_secret_` invalidou a antiga.
- **Nenhuma conta interna existente foi usada.** Os últimos logins de
  `alugueasy.analista@` (27/07 16:24), `alugueasy.nikolass@` (07/05) e
  `alugueasy.alexandre@` (25/05) são todos anteriores à criação da conta
  invasora — não houve sequestro de sessão de um analista legítimo.
- **A RLS não vazou nada para a chave anônima.** Onze tabelas testadas sem
  sessão: `profiles`, `apartamentos`, `diarias`, `custos`, `amenitiz_reservas`,
  `proprietario_apartamentos`, `audit_log`, `importacoes`, `amenitiz_syncs`,
  `categorias_repassaveis`, `ingest_status` — todas retornaram 0 linhas.

### Sobre os e-mails do teste de recuperação de senha

Os endereços usados no teste (`admin@`, `arthur@`, `nikolas@`,
`leonardo@alugueasy.com.br`) **não existem no sistema**. Todas as contas reais
usam `@gmail.com`. Os disparos caíram em contas inexistentes — nada vazou e não
há ninguém a avisar.

### Sobre a recomendação de "mover a chave pública para server-side"

Não procede. A `sb_publishable_` (antiga anon key) é **pública por design** — ela
identifica o projeto, não autoriza nada. Quem protege os dados é a RLS, e ela
passou no teste acima. Reescrever a arquitetura para escondê-la não traria ganho
de segurança.

---

## 2. Correções aplicadas no código

| Arquivo | Correção |
|---|---|
| `supabase/migrations/034_signup_fail_closed.sql` | Trigger passa a criar `role = 'pendente'` (sem acesso a nada). **Já aplicada em produção.** |
| `proxy.ts` | Fail-closed: conta sem papel válido tem a sessão encerrada e é devolvida ao login. **Já em produção.** |
| `supabase/migrations/035_blindagem_pos_incidente.sql` | Blindagem completa — ver seção 3. **Pendente de aplicação.** |
| `app/api/relatorio-desempenho-pdf/route.tsx` | **Corrige IDOR.** A rota só checava autenticação e montava o relatório com o admin client (que ignora RLS), expondo faturamento, custos, nome do proprietário e taxa de repasse de **toda a carteira** para qualquer sessão válida — inclusive a de um proprietário. Agora exige `admin`/`analista`. |
| `next.config.ts` | Headers de segurança: CSP com `frame-ancestors 'none'`, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `poweredByHeader: false` e `Cache-Control: no-store` em todas as rotas `/api`. |
| `lib/internal-key.ts` (novo) | Comparação de segredo em tempo constante (`timingSafeEqual`) e fail-closed. O `===` anterior vazava o prefixo correto pelo tempo de resposta. |
| `app/api/enviar-extrato-email`, `agente-fechamento`, `exportar-diarias-xlsx`, `amenitiz-sync-cron` | Passam a usar o verificador acima. |

### Verificado e já correto (não precisou mudar)

- As 24 rotas `/api` têm guarda de autenticação — o `matcher` do `proxy.ts`
  exclui `/api`, então cada rota se defende sozinha, e todas defendem.
- `/api/prestacao-contas-pdf` já checa posse do apartamento antes de gerar.
- `/api/proprietario-apartamentos` (GET) aceita `proprietario_id` arbitrário na
  query, mas usa o client de sessão e a RLS de `proprietario_apartamentos`
  restringe a `proprietario_id = auth.uid()` — não é explorável.
- `/api/sync-local` (GET) retorna `501` em produção.

---

## 3. O que a migration 035 fecha

Aplicar em: **Supabase Dashboard → projeto `rlkmljeatapayiroggrp` → SQL Editor**.
Rode a PARTE 0 antes (inventário do "antes") e guarde o resultado.

A estratégia é usar policies `AS RESTRICTIVE`: elas entram em **AND** com todas
as policies permissivas existentes. Só conseguem *reduzir* acesso — nunca quebram
uma leitura que hoje funciona, e não dependem de conhecer o nome de cada policy
legada que possa estar aberta demais.

1. **Trigger anti-escalonamento em `profiles`** — ninguém muda o próprio papel,
   e só interno muda o papel de outra pessoa. Fecha a pergunta "e se alguém
   conseguir um UPDATE em profiles?" mesmo que uma policy permissiva escape.
2. **RLS habilitada em toda tabela do schema `public`** — inclusive tabelas
   futuras criadas sem RLS.
3. **Escrita nas 11 tabelas financeiras exige `is_interno()`** — restritivo. Um
   proprietário não escreve em `diarias`, `custos`, `apartamentos` etc. por
   nenhum caminho.
4. **`profiles`: cada um lê só o próprio perfil** (ou interno lê todos). Sem
   isso, um proprietário logado enumera nome e papel de todo mundo — inclusive
   descobre quais contas são analista, que é o alvo do próximo ataque.
5. **`audit_log` imutável** para sessões de usuário — escrita exclusiva do
   service role. O log continua confiável mesmo se uma conta interna cair.
6. **Realtime publica apenas `amenitiz_reservas`** — era a preocupação legítima
   do relatório recebido. Cada tabela na publication é um fluxo ao vivo de
   INSERT/UPDATE/DELETE; publicar o que não é usado só amplia a superfície.
7. **Papel `anon` sem nenhum privilégio de tabela** — trava de baixo nível
   abaixo da RLS. Seguro aqui porque nenhuma página pública lê tabela: `/home`,
   `/login` e `/login-proprietario` só chamam `auth.signInWithPassword`.

A migration termina com 8 queries de verificação (`V1` a `V8`) que provam o
estado final.

---

---

## 3.1 Vazamento de leitura entre proprietários — achado na verificação da 035

A 035 foi aplicada em produção em 29/07/2026 e verificada com **sessão real
simulada** (`SET LOCAL ROLE authenticated` + `request.jwt.claims`). O teste
revelou um problema que nenhuma leitura de código tinha mostrado:

| tabela | total | visível a UM proprietário |
|---|---:|---:|
| `apartamentos` | 75 | **75** |
| `empreendimentos` | 14 | **14** |
| `diarias` | 415 | **415** |
| `custos` | 1372 | **1372** |
| `importacoes` | 104 | **104** |
| `amenitiz_reservas` | 6579 | 48 ✅ |

**Qualquer proprietário logado no portal lia o faturamento, os custos e as
condições comerciais (`tipo_gestao`, `taxa_repasse`, `nome_proprietario`) de
todos os outros.** Não era preciso invadir nada — bastava ter conta legítima.

### Causa

As policies `<tabela>_write_authenticated` são `FOR ALL`, e **`FOR ALL` inclui
SELECT**. A migration 023 removeu as `<tabela>_select_all` e criou o isolamento
correto, mas deixou essas de pé. Como policies permissivas se somam por `OR`, o
`USING (true)` delas anulava silenciosamente todo o trabalho da 023:

```
apartamentos    → apartamentos_write_authenticated     USING (true)
empreendimentos → empreendimentos_write_authenticated  USING (true)
diarias         → diarias_write_authenticated          USING (auth.role() = 'authenticated')
custos          → custos_write_authenticated           USING (auth.role() = 'authenticated')
importacoes     → importacoes_write_authenticated      USING (auth.role() = 'authenticated')
```

A 035 já havia bloqueado a **escrita** nessas tabelas (verificado: proprietário
consegue afetar 0 linhas em `DELETE`/`UPDATE`, analista segue com 1372/415/75).
Faltava a leitura, que policy restritiva de escrita não alcança.

### Correção — `036_fecha_leitura_via_for_all.sql` (**pendente de aplicação**)

Troca cada `_write_authenticated` por policies de escrita explícitas por comando
exigindo `is_interno()`, devolvendo o SELECT ao controle das policies de
isolamento da 023. Cria também `empreendimentos_select` (o portal lê o nome via
join, então o proprietário precisa enxergar os empreendimentos onde tem imóvel
ativo) e `importacoes_select` restrita a interno (o portal não consulta essa
tabela — verificado no código).

---

## 4. Pendências — ação manual necessária

### 4.0 Revogar TODOS os Personal Access Tokens (`sbp_...`) — **PRIORIDADE MÁXIMA**

**Este é o vetor real da reincidência de 29/07.**

A conta `righettiroberto90@gmail.com` já havia sido **apagada em 28/07**. Ela foi
**recriada em 29/07 às 00:05** — depois de `disable_signup=true` já estar
aplicado. Um cadastro pelo endpoint público era impossível nesse momento.

O registro do incidente de 28/07 anota: *"dois tokens `sbp_...` foram colados no
chat e devem ser revogados (o 1º já foi)"*. Um `sbp_` é um **Personal Access
Token da Management API** — dá controle total do projeto: criar usuários
direto no Auth, religar o signup, ler e rotacionar chaves, alterar policies.
Isso explica exatamente o relato de que "a IA pegou o contexto antigo que tinha
as keys".

Enquanto o segundo token estiver vivo, **nenhuma das outras travas importa** —
quem o tiver pode desfazer todas elas.

**https://supabase.com/dashboard/account/tokens → revogar TODOS os tokens da
lista.** Depois gere um novo só se algum automatismo precisar, e nunca cole em
chat.

Vale também revisar **Organization → Team** e **Project → Settings → Integrations**
para conferir que nenhum membro ou integração desconhecida foi adicionado.

### 4.1 Remover a conta invasora — **URGENTE**

```bash
npx tsx scripts/temp-remover-invasor.ts
```

Encerra as sessões, salva um snapshot da conta como evidência em
`scripts/temp-evidencia-incidente-29072026.json`, apaga a conta do invasor **e**
a conta órfã `link@gmail.com` (existe em `auth.users` desde 18/06 sem `profile`),
e imprime o estado final das contas.

### 4.2 Tornar o repositório privado — **URGENTE**

`https://github.com/Arthur6869/Sistema-Financeiro-Alugueasy` responde `200` sem
autenticação. Todo o código, o schema, o desenho da RLS e os nomes das rotas
estão públicos — é o mapa completo do sistema para quem quiser atacar. O commit
`d9d4554` o tornou público de propósito.

**GitHub → Settings → General → Danger Zone → Change repository visibility →
Private.**

### 4.3 Painel do Supabase

| Onde | O quê | Por quê |
|---|---|---|
| Authentication → Sign In / Providers | Manter **"Allow new users to sign up" DESLIGADO** | É a trava real do vetor do incidente. Já está desligado — não reative. |
| Authentication → Rate Limits | Limitar **password recovery** e **token/sign-in** | Hoje o recovery pode ser disparado infinitamente contra qualquer e-mail. |
| Authentication → Multi-Factor | Ativar **MFA nas contas internas** (`alugueasy.analista@`, `alugueasy.nikolass@`, `alugueasy.alexandre@`) | Senha sozinha é o único fator para contas com CRUD total. |
| Settings → API Keys | Confirmar que as **legacy JWT keys estão desabilitadas** | A chave antiga está no histórico público do git. Já responde `401`, mas confirme que o toggle está desligado de vez. |
| Database → Backups | Confirmar PITR / backup diário | Uma conta com CRUD total teve 1h20 de acesso. |

### 4.4 Rotação recomendada

A `service_role` atual (`sb_secret_`) não vazou pelo git, mas o relato menciona
que uma IA teve as chaves em contexto. Rotacionar é barato:

**Settings → API Keys → gerar nova secret key** → atualizar `.env.local`, as
variáveis da Vercel e o segredo do `pg_cron` no Supabase Vault.

---

## 5. Limitação conhecida

O `audit_log` está **vazio** e só `/api/clear` escreve nele. Não existe rastro do
que a conta invasora fez durante 1h20 de acesso. Recomendo ampliar a escrita de
auditoria (via `lib/audit.ts`) para as rotas de escrita em `diarias`, `custos`,
`apartamentos` e `usuarios` — assim um próximo incidente é reconstituível.

Como não há log, vale uma conferência manual dos números de julho/2026 contra a
Amenitiz antes do fechamento do mês, para descartar adulteração.
