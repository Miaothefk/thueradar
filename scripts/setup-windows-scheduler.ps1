param(
  [ValidateSet("Manual", "Scheduled")]
  [string]$Mode = "Scheduled"
)

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repo

$envFile = Join-Path $repo ".env.local"
if (-not (Test-Path $envFile)) {
  throw "Missing .env.local in the project directory."
}

Get-Content $envFile | Where-Object { $_ -match "^\s*[A-Za-z_][A-Za-z0-9_]*=" } | ForEach-Object {
  $name, $value = $_ -split "=", 2
  [Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim().Trim('"'), "Process")
}

if (-not $env:DATABASE_URL) {
  throw "DATABASE_URL is not configured in .env.local."
}

$env:NODE_OPTIONS = "--use-system-ca"
$env:SOURCE_ACCESS_APPROVED = "1"
$env:SYNC_TIMEZONE = "Asia/Ho_Chi_Minh"
$env:SYNC_SCHEDULE_HOUR = "2"

if ($Mode -eq "Scheduled") {
  $scriptPath = Join-Path $PSScriptRoot "setup-windows-scheduler.ps1"
  $action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -Mode Manual" `
    -WorkingDirectory $repo
  $trigger = New-ScheduledTaskTrigger -Daily -At "02:00"
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable
  $principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERDOMAIN\$env:USERNAME `
    -LogonType Interactive `
    -RunLevel Highest

  $existing = Get-ScheduledTask -TaskName "ThueRadar Daily Legal Sync" -ErrorAction SilentlyContinue
  if ($existing) {
    Unregister-ScheduledTask -TaskName "ThueRadar Daily Legal Sync" -Confirm:$false
  }
  Register-ScheduledTask `
    -TaskName "ThueRadar Daily Legal Sync" `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -ErrorAction Stop | Out-Null
  Write-Host "Created ThueRadar Daily Legal Sync at 02:00."
} else {
  & node --use-system-ca scripts/sync-worker.mjs --manual
  if ($LASTEXITCODE -ne 0) {
    throw "Sync worker failed. Check JSON logs and SchedulerRun."
  }
  Write-Host "Sync worker completed. Check SchedulerRun.status = COMPLETED."
}
