#!/bin/sh
# Runs from nginx's /docker-entrypoint.d before nginx starts.
# Writes the API URL from the environment into /config.js so the same image works everywhere.
set -eu
API_URL="${VITE_API_URL:-http://localhost:4000}"
# Keep the value a safe JS string literal
ESCAPED=$(printf '%s' "$API_URL" | sed 's/\\/\\\\/g; s/"/\\"/g')
cat > /usr/share/nginx/html/config.js <<EOF
window.__WELYA_CONFIG__ = { apiUrl: "$ESCAPED" };
EOF
echo "welya-web: API URL set to $API_URL"
