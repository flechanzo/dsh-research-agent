[CmdletBinding()]
param([string]$InstallDir='F:\deepseek',[int]$Port=53736)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$isolated=Join-Path $root '.isolated'
New-Item -ItemType Directory -Path $isolated -Force | Out-Null
$env:DSH_HOME=Join-Path $isolated 'home'
Get-ChildItem Env: | Where-Object Name -Match 'API_KEY|TOKEN|SECRET|PASSWORD' | ForEach-Object {Remove-Item -LiteralPath ('Env:'+ $_.Name)}
$mock=(Get-Content (Join-Path $root 'tests/support/mock.patch.yml') -Raw).Replace('__RESEARCH_MOCK__',((Join-Path $root 'tests/support/mock.mjs') -replace '\\','/'))
$overlay=Join-Path $isolated 'mock.patch.yml'
Set-Content -LiteralPath $overlay -Value $mock -Encoding utf8
& (Join-Path $InstallDir 'resources/runtime/cli/bin/dsh.cmd') web --patch $overlay --patch (Join-Path $root 'tests/support/browse-picker.patch.yml') --host 127.0.0.1 --port $Port --no-open 2>&1 | ForEach-Object {
 $line="$_"
 if($line -match ('http://127\.0\.0\.1:'+ $Port +'[^\s]*')){Set-Content -LiteralPath (Join-Path $isolated 'url.txt') -Value $Matches[0] -NoNewline}
 Add-Content -LiteralPath (Join-Path $isolated 'host.log') -Value $line
}
