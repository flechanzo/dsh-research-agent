[CmdletBinding()]
param(
 [Parameter(Mandatory)][ValidateSet('Install','Update','Uninstall','Rollback')][string]$Action,
 [string]$InstallDir,
 [string]$DshHome,
 [string]$Profile,
 [string]$PackagePath,
 [string]$Transaction,
 [switch]$DryRun
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$projectRoot=Split-Path -Parent $PSScriptRoot
$pluginName='dsh-research-agent'
function Read-Json([string]$Path) { Get-Content -LiteralPath $Path -Raw -Encoding utf8 | ConvertFrom-Json -AsHashtable }
function Get-FileHashOrNull([string]$Path) { if(Test-Path -LiteralPath $Path){ (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash }else{ $null } }
function Invoke-DesktopCli([string[]]$Arguments) {
 $savedHome=$env:DSH_HOME
 try { $env:DSH_HOME=$DshHome; & $script:cli @Arguments; if($LASTEXITCODE -ne 0){throw "Desktop CLI failed (exit $LASTEXITCODE). See transaction log."} }
 finally { $env:DSH_HOME=$savedHome }
}
$hosts=@(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'DeepSeek Harness.exe' -and $_.CommandLine -match 'dsh-desktop-host[\\/]lib[\\/]index.js' })
if(-not $InstallDir){
 $locations=@($hosts | ForEach-Object { Split-Path -Parent $_.ExecutablePath } | Sort-Object -Unique)
 if($locations.Count -ne 1){throw 'Cannot identify one running official Electron Desktop. Supply -InstallDir and -DshHome -Profile explicitly.'}
 $InstallDir=$locations[0]
}
$InstallDir=[IO.Path]::GetFullPath($InstallDir)
$script:cli=Join-Path $InstallDir 'resources\runtime\cli\bin\dsh.cmd'
if(-not(Test-Path -LiteralPath $script:cli)){throw 'This installation has no supported Electron Desktop CLI. Tauri and other distributions require a separate adapter.'}
if(-not $DshHome -or -not $Profile){
 $matchesHost=@($hosts | Where-Object { (Split-Path -Parent $_.ExecutablePath) -eq $InstallDir })
 if($matchesHost.Count -ne 1){throw 'Cannot identify the active profile. Supply -DshHome and -Profile explicitly.'}
 $argv=@([regex]::Matches($matchesHost[0].CommandLine,'"([^"]*)"|(\S+)') | ForEach-Object {if($_.Groups[1].Success){$_.Groups[1].Value}else{$_.Groups[2].Value}})
 $profileCandidates=@($argv | Where-Object { [IO.Path]::IsPathRooted($_) -and (Test-Path -LiteralPath (Join-Path $_ 'cordis.yml')) -and (Split-Path -Leaf (Split-Path -Parent $_)) -eq 'profiles' })
 if($profileCandidates.Count -ne 1){throw 'Host arguments do not identify one profile directory. Supply -DshHome and -Profile.'}
 if(-not $DshHome){$DshHome=Split-Path -Parent (Split-Path -Parent $profileCandidates[0])}
 if(-not $Profile){$Profile=Split-Path -Leaf $profileCandidates[0]}
}
if($Profile -notmatch '^[A-Za-z0-9][A-Za-z0-9_-]*$'){throw 'Profile must be a simple profile name.'}
$DshHome=[IO.Path]::GetFullPath($DshHome)
$profileDir=Join-Path $DshHome "profiles\$Profile"
$manifestPath=Join-Path $profileDir 'package.json'
if(-not(Test-Path -LiteralPath $manifestPath)){throw "Profile does not exist: $profileDir"}
$version=(& $script:cli --version | Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $version -ne '0.2.1-rc.3'){throw "Unsupported DSH version: $version. Tested target is exactly 0.2.1-rc.3."}
$before=Read-Json $manifestPath
$previousSpec=($before['dependencies'] ?? @{})[$pluginName]
if($Action -eq 'Rollback'){
 if(-not $Transaction){throw 'Rollback requires -Transaction with an existing transaction.json path; it never restores a whole profile.'}
 $record=Read-Json $Transaction
 if($record.profileDir -ne $profileDir){throw 'Rollback transaction belongs to another profile.'}
 if($record.previousSpec){$PackagePath="$pluginName@$($record.previousSpec)";$Action='Update'}else{$Action='Uninstall'}
}
if($Action -in @('Install','Update')){
 if(-not $PackagePath){$candidate=Get-ChildItem -LiteralPath (Join-Path $projectRoot 'dist') -Filter 'dsh-research-agent-*.tgz' | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1;if(-not $candidate){throw 'No release tarball. Run pnpm run pack first.'};$PackagePath=$candidate.FullName}
 if(-not $PackagePath.StartsWith("$pluginName@")){$PackagePath=(Resolve-Path -LiteralPath $PackagePath).Path}
}
Write-Output "Target: $InstallDir | DSH $version | $profileDir | Action=$Action"
if($DryRun){Write-Output "Dry run: package=$PackagePath; no profile mutation";return}
if($Action -eq 'Uninstall' -and -not $previousSpec){Write-Output 'Plugin is already absent; data preserved.';return}
$backupRoot=Join-Path 'D:\dsh-migration-backup' ('plugin-'+(Get-Date -Format 'yyyyMMdd-HHmmss-fff')+'-'+[Guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Path $backupRoot | Out-Null
$hashes=@()
foreach($name in @('package.json','cordis.yml','cordis.patch.yml','pnpm-lock.yaml','pnpm-workspace.yaml','.env')){
 $source=Join-Path $profileDir $name
 if(Test-Path -LiteralPath $source){$target=Join-Path $backupRoot $name;Copy-Item -LiteralPath $source -Destination $target;$hash=Get-FileHashOrNull $source;if($hash -ne (Get-FileHashOrNull $target)){throw "Backup verification failed: $name"};$hashes+=@{file=$name;sha256=$hash}}
}
$patchHash=Get-FileHashOrNull (Join-Path $profileDir 'cordis.patch.yml')
$transactionPath=Join-Path $backupRoot 'transaction.json'
$transactionRecord=@{action=$Action;profileDir=$profileDir;dshHome=$DshHome;profile=$Profile;installDir=$InstallDir;version=$version;previousSpec=$previousSpec;package=$PackagePath;backup=$hashes;status='started';createdAt=(Get-Date).ToString('o')}
$transactionRecord | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $transactionPath -Encoding utf8
Start-Transcript -Path (Join-Path $backupRoot 'operation.log') | Out-Null
try {
 if($Action -eq 'Uninstall'){Invoke-DesktopCli -Arguments @('plugin','--profile',$Profile,'remove',$pluginName)}
 else{Invoke-DesktopCli -Arguments @('plugin','--profile',$Profile,'add',$PackagePath,'--ignore-scripts')}
 $after=Read-Json $manifestPath
 $enabled=@($after.dsh.profile.bundles) -contains $pluginName
 if($Action -eq 'Uninstall' -and (($after['dependencies'] ?? @{}).ContainsKey($pluginName) -or $enabled)){throw 'Removal did not remove the plugin bundle.'}
 if($Action -ne 'Uninstall' -and (-not $after.dependencies.ContainsKey($pluginName) -or -not $enabled)){throw 'Installed package was not enabled as a bundle.'}
 if($patchHash -ne (Get-FileHashOrNull (Join-Path $profileDir 'cordis.patch.yml'))){throw 'User patch changed during installation. Backup retained; no automatic overwrite performed.'}
 $transactionRecord.status='completed';$transactionRecord.resultSpec=($after['dependencies'] ?? @{})[$pluginName]
 Write-Output "Completed. Transaction: $transactionPath"
 Write-Output 'Research state and historical Sessions were not modified. Reload the Desktop host through its supported UI if it requests a restart.'
} catch { $transactionRecord.status='failed';$transactionRecord.error=$_.Exception.Message;throw }
finally {$transactionRecord | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $transactionPath -Encoding utf8;Stop-Transcript | Out-Null}
