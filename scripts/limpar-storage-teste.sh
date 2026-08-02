#!/usr/bin/env bash
# Apaga ficheiros de teste do Storage do Supabase via Storage API.
#
# Porquê este script: storage.objects não tem NENHUMA política RLS de DELETE (nem para
# anon, nem para authenticated/staff) — só o service_role (que ignora RLS) consegue
# apagar. DELETE por SQL direto também não funciona: o Supabase bloqueia isso por
# trigger ("Use a Storage API instead"), porque apagaria a linha sem apagar o blob real,
# deixando-o órfão.
#
# Requer SUPABASE_SERVICE_ROLE_KEY no ambiente — nunca commitar, nunca usar no cliente
# (browser/app), só para correr este script à mão a partir do teu terminal.
# Encontra-se em: Dashboard Supabase → Project Settings → API → service_role key.
#
# Uso:
#   SUPABASE_SERVICE_ROLE_KEY=xxx ./scripts/limpar-storage-teste.sh <bucket> <caminho1> [caminho2 ...]
#
# Exemplo:
#   SUPABASE_SERVICE_ROLE_KEY=xxx ./scripts/limpar-storage-teste.sh documents \
#     consents/e509d306-a070-4dc7-aa84-6a286fef0716/signed_1785649803333.pdf
#
#   SUPABASE_SERVICE_ROLE_KEY=xxx ./scripts/limpar-storage-teste.sh patient-diary \
#     teste-diario-contaminado-01/abc-teste.jpg teste-diario-contaminado-01/def-teste.jpg

set -euo pipefail

SUPABASE_URL="https://nxfnzzcuqzxmzsihbrtp.supabase.co"

if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "Erro: define SUPABASE_SERVICE_ROLE_KEY no ambiente antes de correr este script." >&2
  echo "(Dashboard Supabase → Project Settings → API → service_role key)" >&2
  exit 1
fi

if [ "$#" -lt 2 ]; then
  echo "Uso: $0 <bucket> <caminho1> [caminho2 ...]" >&2
  exit 1
fi

BUCKET="$1"
shift

prefixes_json=$(printf '"%s",' "$@")
prefixes_json="[${prefixes_json%,}]"

resposta=$(curl -s -w "\n%{http_code}" -X DELETE \
  "${SUPABASE_URL}/storage/v1/object/${BUCKET}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"prefixes\": ${prefixes_json}}")

corpo=$(echo "$resposta" | sed '$d')
estado=$(echo "$resposta" | tail -n1)

echo "$corpo"
if [ "$estado" -ge 200 ] && [ "$estado" -lt 300 ]; then
  echo "OK — HTTP $estado"
else
  echo "Falhou — HTTP $estado" >&2
  exit 1
fi
