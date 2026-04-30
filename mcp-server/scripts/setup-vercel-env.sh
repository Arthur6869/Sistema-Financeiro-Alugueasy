#!/bin/bash
# Configura variáveis de ambiente na Vercel para produção.
# Execute após instalar: npm i -g vercel && vercel login
#
# USO (a partir da raiz do projeto):
#   bash mcp-server/scripts/setup-vercel-env.sh

set -e

# Tenta carregar .env.local da raiz do projeto
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [ -f "$ROOT_DIR/.env.local" ]; then
  # shellcheck disable=SC1091
  set -a
  source "$ROOT_DIR/.env.local"
  set +a
  echo "✅ .env.local carregado de $ROOT_DIR"
else
  echo "❌ .env.local não encontrado em $ROOT_DIR"
  exit 1
fi

echo ""
echo "Configurando variáveis na Vercel (produção)..."
echo "Projeto Vercel: $(vercel project ls 2>/dev/null | head -2 | tail -1 || echo 'verificar com: vercel project ls')"
echo ""

vars=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
  "AMENITIZ_ACCESS_TOKEN"
  "AMENITIZ_BASE_URL"
  "AMENITIZ_HOTEL_UUID"
  "ALUGUEASY_INTERNAL_API_KEY"
)

for var in "${vars[@]}"; do
  value="${!var}"
  if [ -z "$value" ]; then
    echo "⚠️  $var não encontrado no .env.local — pulando"
    continue
  fi
  echo "$value" | vercel env add "$var" production --yes 2>/dev/null \
    && echo "✅ $var configurado" \
    || echo "⚠️  $var — erro ao configurar (pode já existir, verifique no dashboard)"
done

echo ""
echo "✅ Concluído! Para fazer deploy em produção:"
echo "   vercel deploy --prod"
