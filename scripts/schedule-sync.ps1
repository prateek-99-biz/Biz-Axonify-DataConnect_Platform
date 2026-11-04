<#
  Sets up (or removes) a nightly refresh in Windows Task Scheduler.

  npm run sync:schedule                      every day at midnight, on this computer's clock
  npm run sync:schedule -- -Time 02:30       a different time
  npm run sync:schedule -- -Morning          also a weekday check at 09:00 that opens the Google sign-in when it has expired
  npm run sync:schedule -- -Morning -MorningTime 08:30
  npm run sync:schedule -- -Remove           take both away again

  The scheduled run never opens a browser. It uses the Google sign-in already on this computer, so it works for as long as that
  sign-in lasts. When the sign-in has expired it fails and writes why to logs\sync.log; the dashboard then shows a "data is N
  days old" banner, and running npm run sync:now in the morning fixes it. It runs while you are signed in to Windows, and if the
  computer was off at that time it runs when it is next switched on.

  The morning check (-Morning) is the only run that may open a browser. If the sign-in is still valid it refreshes quietly in a
  window that closes by itself; if it has expired, the Google page opens, you approve once, and the refresh carries on.
#>
param(
  [string]$Time = "00:00",
  [switch]$Morning,
  [string]$MorningTime = "09:00",
  [switch]$Remove
)

$ErrorActionPreference = "Stop"
$name = "Biz Customer Intelligence - nightly data refresh"
$morningName = "Biz Customer Intelligence - morning sign-in check"
$root = Split-Path $PSScriptRoot -Parent

if ($Remove) {
  foreach ($n in @($name, $morningName)) {
    if (Get-ScheduledTask -TaskName $n -ErrorAction SilentlyContinue) {
      Unregister-ScheduledTask -TaskName $n -Confirm:$false
      Write-Host "Removed: $n" -ForegroundColor Green
    } else {
      Write-Host "Not set up, nothing to remove: $n" -ForegroundColor Yellow
    }
  }
  exit 0
}

foreach ($t in @($Time, $MorningTime)) {
  if ($t -notmatch '^([01]\d|2[0-3]):[0-5]\d$') {
    Write-Host "Write times as HH:MM on a 24 hour clock, for example 00:00 or 02:30." -ForegroundColor Red
    exit 1
  }
}

$log = Join-Path $root "logs\sync.log"
$script = Join-Path $PSScriptRoot "sync-now.ps1"
$arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`" -NoLogin -LogFile `"$log`""

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arguments -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 15)

Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings `
  -Description "Refreshes the Biz Customer Intelligence dashboard data from Axonify." -Force | Out-Null

if ($Morning) {
  $morningArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$script`" -LogFile `"$log`""
  $morningAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $morningArgs -WorkingDirectory $root
  $morningTrigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday, Tuesday, Wednesday, Thursday, Friday -At $MorningTime
  Register-ScheduledTask -TaskName $morningName -Action $morningAction -Trigger $morningTrigger -Settings $settings `
    -Description "Refreshes the dashboard data, opening the Google sign-in first if it has expired." -Force | Out-Null
  Write-Host "Also set up: a weekday check at $MorningTime that opens the Google sign-in only when it has expired." -ForegroundColor Green
}

Write-Host "Done. The data will refresh every day at $Time on this computer's clock." -ForegroundColor Green
Write-Host "Each run is logged to $log"
Write-Host "Test it now with: Start-ScheduledTask -TaskName '$name'"
Write-Host "Take both away with: npm run sync:schedule -- -Remove"
