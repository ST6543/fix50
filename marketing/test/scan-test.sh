#!/bin/bash
# Test harness: POST elke testafbeelding naar de live scan-invoice functie.
# Payload via temp-file (Windows ARG_MAX).
set -u
root="$(cd ../.. && pwd)"
SUPABASE_URL=$(grep -E '^SUPABASE_URL=' "$root/.env" | cut -d= -f2-)
TOKEN=$(cat /tmp/fix50_token)
for f in invoices/*.jpg invoices/*.png; do
  [ -f "$f" ] || continue
  case "$(file -b "$f")" in *JPEG*|*PNG*) ;; *) continue ;; esac
  python - "$f" <<'PY' > payload.json
import base64, json, sys
data = base64.b64encode(open(sys.argv[1], 'rb').read()).decode()
json.dump({'image_base64': data, 'mime': 'image/jpeg'}, sys.stdout)
PY
  # PNG's krijgen mime image/png
  case "$f" in *.png) python - <<'PY' > payload.json
import base64, json, sys
data = base64.b64encode(open('invoices/' + [f for f in __import__('os').listdir('invoices') if f.endswith('.png')][0], 'rb').read()).decode()
json.dump({'image_base64': data, 'mime': 'image/png'}, sys.stdout)
PY
  ;;
  esac
  START=$(date +%s)
  echo "=== $f ==="
  curl -s -X POST "$SUPABASE_URL/functions/v1/scan-invoice" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    --max-time 60 \
    --data-binary @payload.json | python -c "import sys,json
try:
  d=json.load(sys.stdin)
except Exception as e:
  print('PARSE_FOUT:',e); sys.exit()
print(json.dumps(d,indent=1,ensure_ascii=False)[:1500])"
  echo "duur: $(( $(date +%s) - START ))s"
done
