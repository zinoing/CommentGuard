# Build shared packages before starting services
Write-Host "Generating Prisma client..."
pnpm --filter @commentguard/db db:generate
Write-Host "Building @commentguard/db..."
pnpm --filter @commentguard/db build

Start-Process powershell -ArgumentList "-NoExit", "-Command",
  "cd $PSScriptRoot; pnpm dev"

Start-Process powershell -ArgumentList "-NoExit", "-Command",
  "cd $PSScriptRoot\services\risk-classifier; uvicorn app.main:app --reload --port 8001"

Start-Process powershell -ArgumentList "-NoExit", "-Command",
  "cd $PSScriptRoot\services\bff-api; pnpm dev"
