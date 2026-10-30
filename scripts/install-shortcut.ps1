$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$programs = [Environment]::GetFolderPath('Programs')
$path = Join-Path $programs 'LearnHarness 繁體中文.lnk'
$node = (Get-Command node -ErrorAction Stop).Source
& $node (Join-Path $root 'node_modules\electron\cli.js') (Join-Path $PSScriptRoot 'install-shortcut.cjs') $path
if ($LASTEXITCODE -ne 0) { throw 'Could not install the Start menu shortcut.' }
