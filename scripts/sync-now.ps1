<#
  Refreshes the dashboard's data from Axonify.

  It checks the Google sign-in first. If the sign-in has expired it opens the Google page in your browser, waits for you to
  finish, then runs the sync. If the sync itself reports an expired sign-in it signs in once more and tries again.

  npm run sync:now                 refresh, signing in only if needed
  npm run sync:now -- -Login       always sign in first
  npm run sync:now -- -CheckOnly   only check that gcloud and the sign-in work; changes nothing
  npm run sync:now -- -NoLogin     never open a browser (used by the nightly schedule)
  -LogFile <path>                  also write everything this prints to a file
#>
param(
  [switch]$Login,
  [switch]$CheckOnly,
  [switch]$NoLogin,
  [string]$LogFile
)

$ErrorActionPreference = "Continue"
Set-Location (Split-Path $PSScriptRoot -Parent)

if ($LogFile) {
  New-Item -ItemType Directory -Force -Path (Split-Path $LogFile -Parent) | Out-Null
  Start-Transcript -Path $LogFile -Append | Out-Null
}

function Finish([int]$code) {
  if ($LogFile) { Stop-Transcript | Out-Null }
  exit $code
}

function Say([string]$text, [string]$colour = "Gray") { Write-Host $text -ForegroundColor $colour }

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
  Say "gcloud is not installed, or this window cannot find it." "Red"
  Say "Install the Google Cloud CLI from https://cloud.google.com/sdk/docs/install, then open a new window and try again." "Red"
  Finish 1
}

function Test-GoogleSignIn {
  & gcloud auth application-default print-access-token 2>$null | Out-Null
  return ($LASTEXITCODE -eq 0)
}

function Start-GoogleSignIn {
  Say "Opening the Google sign-in in your browser. Sign in with your Biz Group account, approve, then come back here." "Cyan"
  & gcloud auth application-default login
  return ($LASTEXITCODE -eq 0)
}

$signedIn = Test-GoogleSignIn

if ($CheckOnly) {
  if ($signedIn) { Say "OK: gcloud is installed and the Google sign-in works. Nothing was changed." "Green"; Finish 0 }
  Say "gcloud is installed, but the Google sign-in has expired. Run npm run sync:now to sign in and refresh." "Yellow"
  Finish 1
}

if ($Login -or -not $signedIn) {
  if ($NoLogin) {
    Say "The Google sign-in has expired and this run may not open a browser. Run npm run sync:now on this computer to sign in." "Red"
    Finish 1
  }
  if (-not (Start-GoogleSignIn)) { Say "The Google sign-in did not finish, so nothing was refreshed." "Red"; Finish 1 }
}

Say "Refreshing the data (about a minute)..." "Cyan"
npm run sync | Tee-Object -Variable output
$code = $LASTEXITCODE

# The sign-in can expire between the check and the sync, so a Google error gets one more try after signing in again.
if ($code -ne 0 -and -not $NoLogin -and ($output | Out-String) -match "credentials|invalid_rapt|invalid_grant|reauth") {
  Say "Google asked for a fresh sign-in." "Yellow"
  if (Start-GoogleSignIn) {
    npm run sync | Tee-Object -Variable output
    $code = $LASTEXITCODE
  }
}

if ($code -eq 0) { Say "Done. The dashboard now shows the new data." "Green" }
else { Say "The refresh did not finish. The message above says why; Data Reliability in the dashboard shows it too." "Red" }
Finish $code
