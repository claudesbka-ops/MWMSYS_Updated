# Cross-platform sync runner. Executes each Maestro mobile flow first
# and only runs the corresponding Playwright check if the mobile half
# succeeded. Usage:  pwsh tests\mobile-tests\sync\run-sync.ps1
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
Set-Location $root

$pairs = @(
  @{ Name = 'sync-01-panic';    Mobile = 'tests/mobile-tests/sync/sync-01-panic-web.yaml';     Web = 'tests/tc-04-panic.spec.js'     },
  @{ Name = 'sync-02-document'; Mobile = 'tests/mobile-tests/sync/sync-02-document-web.yaml';  Web = 'tests/tc-03-documents.spec.js' },
  @{ Name = 'sync-03-dispute';  Mobile = 'tests/mobile-tests/sync/sync-03-dispute-web.yaml';   Web = 'tests/tc-05-disputes.spec.js'  }
)

$results = @()
foreach ($p in $pairs) {
  Write-Host ""
  Write-Host "=== $($p.Name) :: mobile ==="
  $mobileExit = (Start-Process -FilePath 'maestro' -ArgumentList @('test', $p.Mobile) -NoNewWindow -Wait -PassThru).ExitCode
  if ($mobileExit -ne 0) {
    Write-Host "[$($p.Name)] mobile failed (exit=$mobileExit) — skipping web half"
    $results += [PSCustomObject]@{ Name = $p.Name; Mobile = 'FAIL'; Web = 'SKIP' }
    continue
  }
  Write-Host "=== $($p.Name) :: web ==="
  $webExit = (Start-Process -FilePath 'npx' -ArgumentList @('playwright','test',$p.Web,'--reporter=line','--timeout=90000') -NoNewWindow -Wait -PassThru).ExitCode
  $webResult = if ($webExit -eq 0) { 'PASS' } else { 'FAIL' }
  $results += [PSCustomObject]@{ Name = $p.Name; Mobile = 'PASS'; Web = $webResult }
}

Write-Host ""
Write-Host "=== SYNC RESULTS ==="
$results | Format-Table -AutoSize
