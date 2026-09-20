# Builds the API image and smoke-tests it against the local dev Postgres (localhost:5433).
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot\..

docker build -f apps/api/Dockerfile -t welya-api:test . *> .dapi.log
"api-build=$LASTEXITCODE"
Select-String -Path .dapi.log -Pattern "ERROR|error TS" | Select-Object -First 5

docker rm -f welya-api-test *> $null
docker run -d --name welya-api-test -p 4100:4000 `
    -e DATABASE_URL="postgres://welya:welya@host.docker.internal:5433/welya" `
    -e JWT_SECRET="welya-dev-secret-please-change-0f3a9c1d7e5b4a2c" `
    -e CORS_ORIGIN="http://localhost:8181" -e APP_URL="http://localhost:8181" `
    -e REMINDER_SCHEDULER_ENABLED=false welya-api:test *> $null
Start-Sleep -Seconds 10

"health: " + (curl.exe -sS http://localhost:4100/health)
$body = '{"email":"nadia.putri@student.univ.ac.id","password":"welya123"}'
"login: " + (curl.exe -sS -o NUL -w '%{http_code}' -X POST http://localhost:4100/api/auth/login -H 'Content-Type: application/json' --data-raw $body)
docker ps --filter name=welya-api-test --format "state: {{.Status}}"
docker logs welya-api-test 2>&1 | Select-String -Pattern "migrations applied|listening|Error" | Select-Object -First 4
Remove-Item .dapi.log -ErrorAction SilentlyContinue
