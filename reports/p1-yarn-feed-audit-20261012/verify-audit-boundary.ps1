$ErrorActionPreference = 'Stop'
$auditRoot = $PSScriptRoot
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $auditRoot '..\..'))
Push-Location -LiteralPath $projectRoot
try {
    $expectedHead = '7ababf264d495f6b96d4d66652c529424938ac4d'
    $branch = (git branch --show-current).Trim()
    $head = (git rev-parse HEAD).Trim()
    $tag = (git describe --tags --exact-match HEAD).Trim()
    if ($branch -ne 'main' -or $head -ne $expectedHead -or $tag -ne 'baseline-trusted-yarn-length') {
        throw 'Baseline or branch changed. Stop without restoring anything.'
    }
    $status = @(git status --short)
    $trackedChanges = @(git diff --name-only HEAD)
    $stagedChanges = @(git diff --cached --name-only)
    $diffStat = @(git diff --stat)
    $diffCheck = @(git diff --check 2>&1)
    $diffCheckExit = $LASTEXITCODE
    $before = Get-Content -LiteralPath (Join-Path $auditRoot 'protected-before.json') -Raw | ConvertFrom-Json
    $mismatches = @()
    foreach ($entry in $before) {
        $absolute = Join-Path $projectRoot $entry.path
        if (-not (Test-Path -LiteralPath $absolute -PathType Leaf)) {
            $mismatches += [PSCustomObject]@{ path = $entry.path; reason = 'missing' }
        } elseif ((Get-FileHash -LiteralPath $absolute -Algorithm SHA256).Hash -ne $entry.sha256) {
            $mismatches += [PSCustomObject]@{ path = $entry.path; reason = 'hash changed' }
        }
    }
    $result = [PSCustomObject]@{
        branch = $branch; head = $head; tag = $tag; protectedFiles = @($before).Count
        protectedMismatches = $mismatches; trackedChanges = $trackedChanges
        stagedChanges = $stagedChanges; diffCheckExit = $diffCheckExit
        diffStat = $diffStat; status = $status
        pass = ($mismatches.Count -eq 0 -and $trackedChanges.Count -eq 0 -and $stagedChanges.Count -eq 0 -and $diffCheckExit -eq 0)
    }
    $result | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $auditRoot 'final-boundary-check.json') -Encoding UTF8
    $status | Set-Content -LiteralPath (Join-Path $auditRoot 'status-after.txt') -Encoding UTF8
    $diffStat | Set-Content -LiteralPath (Join-Path $auditRoot 'diff-stat-after.txt') -Encoding UTF8
    $diffCheck | Set-Content -LiteralPath (Join-Path $auditRoot 'diff-check.log') -Encoding UTF8
    $diffCheckExit | Set-Content -LiteralPath (Join-Path $auditRoot 'diff-check-exit.txt') -Encoding UTF8
    $result | ConvertTo-Json -Depth 10
    if (-not $result.pass) { throw 'Audit boundary verification failed. No user files were restored or removed.' }
} finally { Pop-Location }
