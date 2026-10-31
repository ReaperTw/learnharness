$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$sourceRoot = $root
$runtime = Join-Path $env:LOCALAPPDATA 'AZA-Local-Development\learnharness'
$sourceMarker = Join-Path $runtime '.aza-source-root'
if ($root -eq $runtime -and (Test-Path -LiteralPath $sourceMarker)) {
    $sourceRoot = (Get-Content -LiteralPath $sourceMarker -Raw).Trim()
}
$syncRoot = Join-Path $env:SystemDrive 'Drivesync'
if ($sourceRoot.StartsWith("$syncRoot\", [StringComparison]::OrdinalIgnoreCase)) {
    $root = $runtime
}
$next = Join-Path $root 'node_modules\next\dist\bin\next'
$electron = Join-Path $root 'node_modules\electron\cli.js'
$logs = Join-Path $env:LOCALAPPDATA 'LearnHarness\launcher'
$server = $null
$mutex = New-Object System.Threading.Mutex($false, 'Local\LearnHarness.DesktopLauncher')
$locked = $false
try {
    $node = (Get-Command node -ErrorAction Stop).Source
    if (!(Test-Path $next) -or !(Test-Path $electron)) {
        throw "Dependencies are missing. Run npm ci in $root first, outside the synced source folder."
    }
    $admissionDeadline = (Get-Date).AddSeconds(120)
    while (!$locked -and (Get-Date) -lt $admissionDeadline) {
        try { $locked = $mutex.WaitOne(300) } catch [System.Threading.AbandonedMutexException] { $locked = $true }
        if (!$locked) {
            $existing = Get-Process electron -ErrorAction SilentlyContinue | Where-Object {
                $_.Path -eq (Join-Path $root 'node_modules\electron\dist\electron.exe') -and $_.MainWindowHandle -ne 0
            } | Select-Object -First 1
            if ($existing) {
                $shell = New-Object -ComObject WScript.Shell
                $null = $shell.AppActivate($existing.Id)
                exit 0
            }
        }
    }
    if (!$locked) { throw 'Another LearnHarness launcher is still starting. Please try again shortly.' }
    New-Item -ItemType Directory -Force -Path $logs | Out-Null
    if ($sourceRoot -ne $root) {
        if (!(Test-Path -LiteralPath (Join-Path $sourceRoot 'package.json'))) {
            throw "The synced source folder is unavailable: $sourceRoot"
        }
        # Mirror code only. Excluded runtime state is never purged or overwritten.
        & robocopy.exe $sourceRoot $root /MIR /XJ /XD node_modules .next .git data /XF .git .aza-source-root auth.json '*credentials.json*' tsconfig.tsbuildinfo /R:1 /W:1 /NFL /NDL /NP /NJH /NJS | Out-Null
        if ($LASTEXITCODE -ge 8) { throw "Could not refresh the local runtime from $sourceRoot (robocopy $LASTEXITCODE)." }
        Set-Content -LiteralPath $sourceMarker -Value $sourceRoot -Encoding UTF8
        $env:LH_DATA_DIR = Join-Path $sourceRoot 'data'
        $env:LH_AUTH_FILE = Join-Path $sourceRoot 'auth.json'
    }
    $url = $null
    $lockFile = Join-Path $root '.next\dev\lock'
    if (Test-Path $lockFile) {
        try {
            # Next holds this file open for deletion; readers must permit that sharing.
            $stream = [System.IO.File]::Open($lockFile, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, ([System.IO.FileShare]::ReadWrite -bor [System.IO.FileShare]::Delete))
            $reader = New-Object System.IO.StreamReader($stream)
            try { $metadata = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
            $process = Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$metadata.pid)"
            $entry = Join-Path $root 'node_modules\next\dist\server\lib\start-server.js'
            if ($process -and $process.CommandLine.Contains($entry) -and $metadata.port -gt 0 -and $metadata.port -le 65535) {
                $url = "http://127.0.0.1:$($metadata.port)"
            }
        } catch { # A stale or partially written lock is left for Next.js to handle.
        }
    }
    if (!$url) {
        $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, 0)
        $listener.Start()
        $port = $listener.LocalEndpoint.Port
        $listener.Stop()
        $url = "http://127.0.0.1:$port"
        $server = Start-Process -FilePath $node -ArgumentList @("`"$next`"", 'dev', '--hostname', '127.0.0.1', '--port', "$port") -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs 'server.log') -RedirectStandardError (Join-Path $logs 'server-error.log')
    }
    $ready = $false
    $deadline = (Get-Date).AddSeconds(120)
    while ((Get-Date) -lt $deadline) {
        if ($server) {
            $server.Refresh()
            if ($server.HasExited) { throw "The local server stopped. See $logs\server-error.log" }
        }
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri "$url/" -TimeoutSec 5
            if ($response.StatusCode -eq 200) { $ready = $true; break }
        } catch { }
        Start-Sleep -Milliseconds 300
    }
    if (!$ready) { throw "The application did not become ready at $url. See $logs\server.log" }
    $env:LH_DEV_URL = $url
    Set-Location $root
    & $node $electron $root
    if ($LASTEXITCODE -ne 0) { throw "The desktop app exited with code $LASTEXITCODE." }
} catch {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'LearnHarness', 'OK', 'Error') | Out-Null
    exit 1
} finally {
    if ($locked) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
    # Only stop a server this launcher created, never a borrowed development server.
    if ($server) {
        $server.Refresh()
        if (!$server.HasExited) { & taskkill.exe /PID $server.Id /T /F 2>$null | Out-Null }
    }
}
