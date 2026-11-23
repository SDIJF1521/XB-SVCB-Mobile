<#
.SYNOPSIS
    下载并展开构建 APK 所需的 Android SDK 组件。

.DESCRIPTION
    只获取 platforms;android-35 与 build-tools;35.0.0 两个官方压缩包，
    不安装 Android Studio，也不需要 Gradle。下载脚本为 Node 实现，
    避免 Windows PowerShell 的 TLS 兼容问题。

.EXAMPLE
    pwsh -File tools/prepare-sdk.ps1
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$ToolsDir = $PSScriptRoot
$SdkDir = Join-Path $ToolsDir 'android-sdk'
$CacheDir = Join-Path $ToolsDir '.cache'
$PlatformDir = Join-Path $SdkDir 'platforms\android-35'
$BuildToolsDir = Join-Path $SdkDir 'build-tools\35.0.0'

if ((Test-Path (Join-Path $PlatformDir 'android.jar')) -and (Test-Path (Join-Path $BuildToolsDir 'aapt2.exe'))) {
    Write-Host 'Android SDK 已就绪，无需重复下载。' -ForegroundColor Green
    exit 0
}

Write-Host '下载 Android platform 与 build-tools…' -ForegroundColor Cyan
& node (Join-Path $ToolsDir 'download-sdk.js')
if ($LASTEXITCODE -ne 0) {
    throw 'SDK 下载失败。'
}

$ExtractDir = Join-Path $ToolsDir '.extract'
if (Test-Path $ExtractDir) {
    Remove-Item $ExtractDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $ExtractDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $SdkDir 'platforms') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $SdkDir 'build-tools') | Out-Null

Write-Host '展开 platform…' -ForegroundColor Cyan
$platformZip = Join-Path $CacheDir 'platform-35_r02.zip'
Expand-Archive -Path $platformZip -DestinationPath (Join-Path $ExtractDir 'platform') -Force
$platformSource = Get-ChildItem (Join-Path $ExtractDir 'platform') -Directory |
    Where-Object { Test-Path (Join-Path $_.FullName 'android.jar') } |
    Select-Object -First 1
if (-not $platformSource) {
    throw 'platform 压缩包结构异常：找不到 android.jar。'
}
if (Test-Path $PlatformDir) {
    Remove-Item $PlatformDir -Recurse -Force
}
Move-Item $platformSource.FullName $PlatformDir

Write-Host '展开 build-tools…' -ForegroundColor Cyan
$buildToolsZip = Join-Path $CacheDir 'build-tools_r35_windows.zip'
Expand-Archive -Path $buildToolsZip -DestinationPath (Join-Path $ExtractDir 'build-tools') -Force
$buildToolsSource = Get-ChildItem (Join-Path $ExtractDir 'build-tools') -Directory |
    Where-Object { Test-Path (Join-Path $_.FullName 'aapt2.exe') } |
    Select-Object -First 1
if (-not $buildToolsSource) {
    throw 'build-tools 压缩包结构异常：找不到 aapt2.exe。'
}
if (Test-Path $BuildToolsDir) {
    Remove-Item $BuildToolsDir -Recurse -Force
}
Move-Item $buildToolsSource.FullName $BuildToolsDir

Remove-Item $ExtractDir -Recurse -Force

Write-Host 'SDK 准备完成：' -ForegroundColor Green
Write-Host "  platform:   $PlatformDir"
Write-Host "  build-tools: $BuildToolsDir"
