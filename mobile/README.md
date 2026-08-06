# AlugEasy — aplicativo mobile

App em React Native (Expo) que usa **o mesmo Supabase do sistema web**. Não há
backend novo: o app fala direto com o banco, e a RLS decide o que cada pessoa vê.

## Como rodar no seu celular (custo zero)

1. Instale o app **Expo Go** no celular (Play Store ou App Store — gratuito).
2. No computador, dentro desta pasta:

   ```bash
   npm install     # só na primeira vez
   npm start
   ```

3. Um QR code aparece no terminal. Escaneie com a câmera (iPhone) ou pelo próprio
   Expo Go (Android). O app abre no celular e recarrega sozinho a cada alteração
   que você salvar no código.

O computador e o celular precisam estar na **mesma rede Wi-Fi**. Se a empresa
bloquear isso, rode `npx expo start --tunnel`.

## Configuração

Copie `.env.example` para `.env`. Só entram ali valores públicos:

| variável | o que é |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | endereço do projeto Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | chave publicável (pública por desenho — não autoriza nada sozinha) |
| `EXPO_PUBLIC_API_BASE_URL` | sistema web, usado para baixar PDFs |

> **Nunca** coloque aqui a `service_role` nem a chave interna da API. Tudo que
> tem o prefixo `EXPO_PUBLIC_` fica embutido no aplicativo e pode ser lido por
> qualquer pessoa que baixe o APK.

## Estrutura

```
src/
  app/                 telas (o arquivo vira a rota, igual ao App Router do Next)
    _layout.tsx        provedor de autenticação + navegação
    index.tsx          decide o destino conforme o papel do usuário
    login.tsx          login único (equipe e proprietário)
    proprietario.tsx   portal do dono do imóvel
    equipe.tsx         painel da equipe interna
  lib/
    supabase.ts        cliente + sessão criptografada no aparelho
    auth.tsx           contexto de autenticação e papéis
  constants/tema.ts    cores e formatação
```

## Como a segurança funciona aqui

O app **não** decide quem vê o quê — quem decide é o banco.

- A sessão fica no **SecureStore** (Keychain no iOS, Keystore no Android),
  criptografada pelo sistema operacional. Como o limite é de 2048 bytes por
  valor e a sessão passa disso, ela é gravada em pedaços — ver `lib/supabase.ts`.
- As consultas **não filtram por id do usuário no cliente**. A RLS já limita as
  linhas: um proprietário só enxerga os imóveis vinculados a ele, e uma conta
  suspensa (`profiles.ativo = false`) não enxerga nada. Isso vale desde as
  migrations 036 e 037.
- Não existe cadastro no app. Contas são criadas pela equipe em `/usuarios` no
  sistema web. O auto-cadastro público está desligado no Supabase.
- Papel `pendente` — como toda conta nova nasce — não recebe acesso a nada e é
  devolvido ao login.

## Distribuição

| caminho | custo | observação |
|---|---|---|
| Expo Go | grátis | ideal para desenvolver e demonstrar |
| APK direto (Android) | grátis | manda o arquivo para a equipe instalar |
| Google Play | US$ 25, uma vez | necessário para publicar na loja |
| App Store / TestFlight | US$ 99 por ano | único caminho para iPhone fora do Expo Go |
