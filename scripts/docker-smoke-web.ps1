# Smoke-tests the web image: runtime API URL injection, SPA fallback, health, caching headers.
$ErrorActionPreference = "Continue"
docker rm -f welya-web-test *> $null
docker run -d --name welya-web-test -p 8181:80 -e VITE_API_URL="https://api.example.test" welya-web:test *> $null
Start-Sleep -Seconds 4
"config.js: " + (curl.exe -sS http://localhost:8181/config.js)
"index: " + (curl.exe -sS -o NUL -w '%{http_code}' http://localhost:8181/)
"spa /settings/integrations: " + (curl.exe -sS -o NUL -w '%{http_code}' http://localhost:8181/settings/integrations)
"healthz: " + (curl.exe -sS http://localhost:8181/healthz)
"index has config script: " + ((curl.exe -sS http://localhost:8181/) -match 'src="/config.js"')
$asset = ((curl.exe -sS http://localhost:8181/) | Select-String -Pattern '/assets/index-[^"]+\.js' -AllMatches).Matches[0].Value
"asset cache-control: " + (curl.exe -sSI "http://localhost:8181$asset" | Select-String -Pattern "Cache-Control").Line.Trim()
docker ps --filter name=welya-web-test --format "state: {{.Status}}"
