docker compose down
if (Test-Path "backend/data/prelegal.db") { Remove-Item "backend/data/prelegal.db" -Force -Confirm:$false }
