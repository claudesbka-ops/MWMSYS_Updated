param(
    [string]$TestsDir = (Join-Path $PSScriptRoot '')
)

Write-Host "Running MWMSYS Mobile Test Suite..." -ForegroundColor Cyan
Write-Host "Tests directory: $TestsDir" -ForegroundColor DarkGray

$passed = 0
$failed = 0
$results = @()

# Pick up numbered test YAMLs in this folder (01-...14-...). Skip partials,
# sync/, and the config.yaml helper.
$files = Get-ChildItem -Path $TestsDir -Filter '*.yaml' -File |
    Where-Object { $_.Name -match '^\d{2}-' } |
    Sort-Object Name

if (-not $files) {
    Write-Host "No test YAMLs found in $TestsDir" -ForegroundColor Yellow
    exit 1
}

foreach ($file in $files) {
    Write-Host ""
    Write-Host "==> Running $($file.Name)..." -ForegroundColor Yellow
    $output = & maestro test $file.FullName 2>&1 | Out-String
    $exit = $LASTEXITCODE

    $ok = ($exit -eq 0) -or ($output -match 'Flow Completed|1/1 Flow|PASSED')
    if ($ok) {
        $passed++
        $status = 'PASS'
        Write-Host "PASSED: $($file.Name)" -ForegroundColor Green
    } else {
        $failed++
        $status = 'FAIL'
        Write-Host "FAILED: $($file.Name)" -ForegroundColor Red
        Write-Host $output.Substring(0, [Math]::Min(2000, $output.Length)) -ForegroundColor DarkGray
    }

    $results += [PSCustomObject]@{ Name = $file.Name; Status = $status }
}

Write-Host ""
Write-Host "==============================" -ForegroundColor Cyan
Write-Host "MOBILE TEST RESULTS" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
$results | Format-Table -AutoSize | Out-String | Write-Host
Write-Host ("Passed: {0}" -f $passed) -ForegroundColor Green
Write-Host ("Failed: {0}" -f $failed) -ForegroundColor Red
Write-Host ("Total:  {0}" -f ($passed + $failed))

if ($failed -gt 0) { exit 1 } else { exit 0 }
