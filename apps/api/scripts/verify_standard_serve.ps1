param(
    [int]$TimeoutSeconds = 30,
    [int]$MaxWorkingSetMiB = 1024,
    [string]$SnapshotRoot = ""
)

$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
if ([string]::IsNullOrWhiteSpace($SnapshotRoot)) {
    $SnapshotRoot = Join-Path $workspace 'data/chain_snapshots'
}
$SnapshotRoot = [System.IO.Path]::GetFullPath($SnapshotRoot)

$existing = Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    throw 'standard-serve probe requires 127.0.0.1:8000 to be free'
}

$tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$scratch = [System.IO.Path]::GetFullPath((Join-Path $tempRoot ("convexa-standard-serve-{0}" -f [guid]::NewGuid().ToString('N'))))
if (-not $scratch.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
    -not ([System.IO.Path]::GetFileName($scratch)).StartsWith('convexa-standard-serve-', [System.StringComparison]::Ordinal)) {
    throw 'standard-serve scratch path escaped the system temporary directory'
}
[void](New-Item -ItemType Directory -Path $scratch)
$process = $null

function Get-Descendants([int]$RootId) {
    $all = Get-CimInstance Win32_Process
    $ids = [System.Collections.Generic.HashSet[uint32]]::new()
    [void]$ids.Add([uint32]$RootId)
    do {
        $before = $ids.Count
        foreach ($item in $all) {
            if ($ids.Contains([uint32]$item.ParentProcessId)) {
                [void]$ids.Add([uint32]$item.ProcessId)
            }
        }
    } while ($ids.Count -gt $before)
    @($all | Where-Object { $ids.Contains([uint32]$_.ProcessId) })
}

try {
    $npx = (Get-Command npx.cmd).Source
    $start = [System.Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $npx
    $start.WorkingDirectory = $workspace
    $start.UseShellExecute = $false
    $start.Arguments = 'nx serve api'
    $start.Environment['APP_ENV'] = 'dev'
    $start.Environment['MASSIVE_API_KEY'] = 'standard-serve-local-probe'
    $start.Environment['HTTP_BIND'] = '127.0.0.1:8000'
    $start.Environment['CHAIN_SNAPSHOT_ENABLED'] = '1'
    $start.Environment['CHAIN_SNAPSHOT_STORE_PATH'] = $SnapshotRoot
    $start.Environment['SESSION_CHAIN_ARCHIVE_ENABLED'] = '0'
    $start.Environment['LIQUID_SESSION_ENSURE_ENABLED'] = '0'
    $start.Environment['SCAN_ENABLED'] = '0'
    $start.Environment['WARM_ENABLED'] = '0'
    $start.Environment['WARM_SYMBOLS'] = ''
    $start.Environment['LIQUID_SYMBOLS'] = ''
    $start.Environment['AUTH_STORE_PATH'] = Join-Path $scratch 'auth.sqlite3'
    $start.Environment['SCAN_STORE_PATH'] = Join-Path $scratch 'scan.sqlite3'
    $start.Environment['IV_STORE_PATH'] = Join-Path $scratch 'iv.json'

    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $start
    [void]$process.Start()
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    $peakMiB = 0.0
    $listenerCount = 0

    while ([DateTime]::UtcNow -lt $deadline) {
        if ($process.HasExited) {
            throw "standard serve exited before bind with code $($process.ExitCode)"
        }
        $tree = Get-Descendants $process.Id
        $workingSet = ($tree | Measure-Object WorkingSetSize -Sum).Sum
        $workingSetMiB = [math]::Round($workingSet / 1MB, 1)
        $peakMiB = [math]::Max($peakMiB, $workingSetMiB)
        if ($workingSetMiB -gt $MaxWorkingSetMiB) {
            throw "standard serve exceeded $MaxWorkingSetMiB MiB before bind (observed $workingSetMiB MiB)"
        }
        $listenerCount = (Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | Measure-Object).Count
        if ($listenerCount -eq 1) {
            break
        }
        Start-Sleep -Milliseconds 250
    }

    if ($listenerCount -ne 1) {
        throw "standard serve did not bind exactly once within $TimeoutSeconds seconds"
    }
    $apiChildren = @(Get-Descendants $process.Id | Where-Object Name -eq 'api-rust.exe')
    if ($apiChildren.Count -ne 1) {
        throw "standard serve created $($apiChildren.Count) API processes; expected exactly one"
    }
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 5
    if ($health.status -ne 'ok') {
        throw 'standard serve health response was not ok'
    }
    Start-Sleep -Seconds 3
    $listenerCount = (Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | Measure-Object).Count
    if ($listenerCount -ne 1 -or $process.HasExited) {
        throw 'standard serve did not remain healthy after bind'
    }
    $tree = Get-Descendants $process.Id
    $workingSetMiB = [math]::Round((($tree | Measure-Object WorkingSetSize -Sum).Sum) / 1MB, 1)
    $peakMiB = [math]::Max($peakMiB, $workingSetMiB)
    if ($workingSetMiB -gt $MaxWorkingSetMiB) {
        throw "standard serve exceeded $MaxWorkingSetMiB MiB after bind (observed $workingSetMiB MiB)"
    }
    Write-Output "PASS standard_serve listener_count=1 api_processes=1 peak_working_set_mib=$peakMiB"
}
finally {
    if ($null -ne $process -and -not $process.HasExited) {
        & taskkill.exe /PID $process.Id /T /F | Out-Null
        [void]$process.WaitForExit(5000)
    }
    Remove-Item -LiteralPath $scratch -Recurse -Force -ErrorAction SilentlyContinue
}
