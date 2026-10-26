[CmdletBinding()]
param([string]$InstallDir,[string]$DshHome,[string]$Profile,[string]$PackagePath,[string]$Transaction,[switch]$DryRun)
& (Join-Path $PSScriptRoot 'scripts\manage-plugin.ps1') -Action Install @PSBoundParameters
