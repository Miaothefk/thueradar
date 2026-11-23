param(
  [ValidateSet("Manual", "Scheduled")]
  [string]$Mode = "Scheduled"
)

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repo

$envFile = Join-Path $repo ".env.local"
if (-not (Test-Path $envFile)) {
  throw "Không tìm thấy .env.local trong thư mục dự án."
}

Get-Content $envFile | Where-Object { $_ -match "^\s*[A-Za-z_][A-Za-z0-9_]*=" } | ForEach-Object {
  $name, $value = $_ -split "=", 2
  [Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim().Trim('"'), "Process")
}

if (-not $env:DATABASE_URL) {
  throw "DATABASE_URL chưa được cấu hình trong .env.local."
}

$env:NODE_OPTIONS = "--use-system-ca"
$env:SOURCE_ACCESS_APPROVED = "1"
$env:SYNC_TIMEZONE = "Asia/Ho_Chi_Minh"
$env:SYNC_SCHEDULE_HOUR = "2"

$argument = if ($Mode -eq "Manual") { "--manual" } else { "--scheduled" }
$command = "cd /d `"$repo`" && node --use-system-ca scripts/sync-worker.mjs $argument"

if ($Mode -eq "Scheduled") {
  schtasks /Create /TN "ThueRadar Daily Legal Sync" /TR "cmd.exe /d /c `"$command`"" /SC DAILY /ST 02:00 /F
  if ($LASTEXITCODE -ne 0) {
    throw "Không thể tạo Windows Task Scheduler. Hãy chạy PowerShell bằng quyền Administrator."
  }
  Write-Host "Đã tạo lịch chạy ThueRadar vào 02:00 giờ máy mỗi ngày."
} else {
  & node --use-system-ca scripts/sync-worker.mjs --manual
  if ($LASTEXITCODE -ne 0) {
    throw "Worker đồng bộ thất bại. Kiểm tra log JSON và SchedulerRun."
  }
  Write-Host "Worker đồng bộ hoàn tất. Kiểm tra SchedulerRun.status = COMPLETED."
}
