$ErrorActionPreference = "Stop"
$EnvFile = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $EnvFile)) {
  throw "Missing db/.env"
}

Get-Content $EnvFile | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) { return }
  $key, $value = $line.Split("=", 2)
  Set-Item -Path "Env:$($key.Trim())" -Value $value.Trim()
}

$pgctl = Join-Path $env:PGBIN "pg_ctl.exe"
& $pgctl -D $env:PGDATA stop
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Output "PostgreSQL stopped."
