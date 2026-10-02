@echo off
setlocal

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Please install Node.js first.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Please install Node.js first.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing dependencies...
  call npm ci
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

set "KNITSCAPE_LAUNCHER=%~f0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$text = [IO.File]::ReadAllText($env:KNITSCAPE_LAUNCHER); & ([scriptblock]::Create(($text -split '(?m)^# PowerShell\r?$', 2)[1]))"
if errorlevel 1 (
  pause
  exit /b 1
)
exit /b 0

# PowerShell
$ErrorActionPreference = 'Stop'
$url = 'http://127.0.0.1:5173/index.html'
$server = $null
$locked = $false
$exitCode = 0
$mutex = New-Object Threading.Mutex($false, 'Local\KnitScape-Vite-127.0.0.1-5173')

function Test-Ready {
    $response = $null
    $reader = $null
    try {
        $request = [Net.HttpWebRequest]::Create($url)
        $request.Proxy = $null
        $request.AllowAutoRedirect = $false
        $request.Timeout = 1000
        $request.ReadWriteTimeout = 1000
        $response = $request.GetResponse()
        $reader = New-Object IO.StreamReader($response.GetResponseStream())
        $html = $reader.ReadToEnd()
        return ([int]$response.StatusCode -eq 200 -and
            $html -match '<title>\s*knitscape\s*</title>' -and
            $html -match '/@vite/client')
    } catch {
        return $false
    } finally {
        if ($reader) { $reader.Dispose() }
        if ($response) { $response.Dispose() }
    }
}

function Test-PortInUse {
    $client = New-Object Net.Sockets.TcpClient
    try { return $client.ConnectAsync('127.0.0.1', 5173).Wait(500) }
    catch { return $false }
    finally { $client.Dispose() }
}

try {
    # Serialize double-clicks while the first launcher is starting Vite.
    try { $locked = $mutex.WaitOne(35000) }
    catch [Threading.AbandonedMutexException] { $locked = $true }
    if (-not $locked) { throw 'Another KnitScape launcher is still waiting for port 5173. Please retry.' }

    if (Test-Ready) {
        Write-Host 'Reusing the existing KnitScape/Vite server on port 5173.'
    } else {
        if (Test-PortInUse) {
            throw 'Port 5173 is occupied but does not serve a ready KnitScape/Vite page. Close that service and retry.'
        }
        Write-Host 'Starting Vite; waiting for http://127.0.0.1:5173/index.html ...'
        $info = New-Object Diagnostics.ProcessStartInfo
        $info.FileName = $env:ComSpec
        $info.Arguments = '/d /s /c "npm run dev -- --host 127.0.0.1 --port 5173 --strictPort"'
        $info.UseShellExecute = $false
        $server = [Diagnostics.Process]::Start($info)
        $deadline = [DateTime]::UtcNow.AddSeconds(30)
        while ($true) {
            if ($server.HasExited) { throw "Vite exited before becoming ready (exit code $($server.ExitCode)). See the npm error above." }
            if (Test-Ready) { break }
            if ([DateTime]::UtcNow -ge $deadline) { throw 'Vite did not become ready on port 5173 within 30 seconds. Check the npm output above.' }
            Start-Sleep -Milliseconds 250
        }
    }
    Write-Host "KnitScape is ready. Opening $url"
    Start-Process -FilePath $url
} catch {
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    if ($server -and -not $server.HasExited) {
        & taskkill.exe /PID $server.Id /T /F 2>&1 | Out-Null
    }
    $exitCode = 1
} finally {
    if ($locked) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}

# Keep the original command window attached to Vite, without blocking later launches.
if ($exitCode -eq 0 -and $server) {
    $server.WaitForExit()
    $exitCode = $server.ExitCode
}
exit $exitCode
