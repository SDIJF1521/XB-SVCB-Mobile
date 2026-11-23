<#
.SYNOPSIS
    构建 XB-SVCB 移动端 APK（无需 Gradle / Android Studio）。

.DESCRIPTION
    先构建移动端 Vue 页面，再用 Android SDK 的 aapt2、javac、d8 与 apksigner
    打包签名。SDK 位于 tools/android-sdk，由 tools/prepare-sdk.ps1 获取。

.PARAMETER SkipWeb
    跳过前端构建，直接使用 web/dist 现有产物。

.EXAMPLE
    pwsh -File build-apk.ps1
#>
[CmdletBinding()]
param(
    [switch]$SkipWeb
)

$ErrorActionPreference = 'Stop'

$Root = $PSScriptRoot
$AndroidDir = Join-Path $Root 'android'
$WebDir = Join-Path $Root 'web'
$SdkDir = Join-Path $Root 'tools\android-sdk'
$BuildTools = Join-Path $SdkDir 'build-tools\35.0.0'
$AndroidJar = Join-Path $SdkDir 'platforms\android-35\android.jar'
$BuildDir = Join-Path $Root 'build'
$DistDir = Join-Path $Root 'dist'
$KeystoreDir = Join-Path $Root '.keystore'
$Keystore = Join-Path $KeystoreDir 'xbsvcb-mobile.jks'
$KeystorePass = 'xb-svcb-mobile'
$KeyAlias = 'xbsvcb'
$VersionName = '0.1.2'
$VersionCode = 1
$MinSdk = 29
$TargetSdk = 34
$AppFileName = "XB-SVCB-Mobile-$VersionName.apk"

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Assert-Path {
    param([string]$Path, [string]$Hint)
    if (-not (Test-Path $Path)) {
        throw "缺少 $Path。$Hint"
    }
}

function Invoke-Native {
    param([string]$File, [string[]]$Arguments)
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "命令失败（exit $LASTEXITCODE）：$File"
    }
}

Assert-Path $AndroidJar '请先运行 pwsh -File tools/prepare-sdk.ps1 准备 Android SDK。'
Assert-Path (Join-Path $BuildTools 'aapt2.exe') 'Android build-tools 不完整。'

# 独立项目使用自己的前端依赖，不再复用桌面端 web/node_modules。
$WebModules = Join-Path $WebDir 'node_modules'
if (-not (Test-Path $WebModules)) {
    throw '缺少前端依赖：请先进入 web 目录执行 npm install。'
}

if (-not $SkipWeb) {
    Write-Step '构建移动端页面'
    Push-Location $WebDir
    try {
        Invoke-Native 'node' @('build.mjs')
    } finally {
        Pop-Location
    }
    Invoke-Native 'node' @((Join-Path $Root 'tools\postbuild.js'))
} else {
    Write-Step '跳过前端构建（使用现有 dist）'
}

Assert-Path (Join-Path $WebDir 'dist\index.html') '前端产物不存在，请先执行前端构建。'

Write-Step '准备构建目录'
if (Test-Path $BuildDir) {
    Remove-Item $BuildDir -Recurse -Force
}
$AssetsDir = Join-Path $BuildDir 'assets'
$WwwDir = Join-Path $AssetsDir 'www'
$ResFlatDir = Join-Path $BuildDir 'res'
$GenDir = Join-Path $BuildDir 'gen'
$ClassesDir = Join-Path $BuildDir 'classes'
$DexDir = Join-Path $BuildDir 'dex'
foreach ($dir in @($WwwDir, $ResFlatDir, $GenDir, $ClassesDir, $DexDir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
}
Copy-Item (Join-Path $WebDir 'dist\*') $WwwDir -Recurse -Force

Write-Step '编译资源（aapt2 compile）'
Invoke-Native (Join-Path $BuildTools 'aapt2.exe') @(
    'compile', '--dir', (Join-Path $AndroidDir 'res'), '-o', $ResFlatDir
)
$flatFiles = @(Get-ChildItem $ResFlatDir -Recurse -Filter *.flat | ForEach-Object { $_.FullName })
if ($flatFiles.Count -eq 0) {
    throw '没有找到编译后的资源文件。'
}

Write-Step '链接资源与清单（aapt2 link）'
$unsignedApk = Join-Path $BuildDir 'unsigned.apk'
$linkArgs = @(
    'link',
    '-o', $unsignedApk,
    '-I', $AndroidJar,
    '--manifest', (Join-Path $AndroidDir 'AndroidManifest.xml'),
    '--java', $GenDir,
    '--min-sdk-version', "$MinSdk",
    '--target-sdk-version', "$TargetSdk",
    '--version-code', "$VersionCode",
    '--version-name', $VersionName,
    '--auto-add-overlay'
)
foreach ($flat in $flatFiles) {
    $linkArgs += '-R'
    $linkArgs += $flat
}
Invoke-Native (Join-Path $BuildTools 'aapt2.exe') $linkArgs

Write-Step '编译 Java 源码'
$sources = @()
$sources += @(Get-ChildItem (Join-Path $AndroidDir 'java') -Recurse -Filter *.java | ForEach-Object { $_.FullName })
$sources += @(Get-ChildItem $GenDir -Recurse -Filter *.java | ForEach-Object { $_.FullName })
$javac = (Get-Command javac.exe -ErrorAction Stop).Source
Invoke-Native $javac (@(
    '-encoding', 'UTF-8',
    '-source', '8',
    '-target', '8',
    '-Xlint:-options',
    '-classpath', $AndroidJar,
    '-d', $ClassesDir
) + $sources)

Write-Step '转换为 DEX（d8）'
$classFiles = @(Get-ChildItem $ClassesDir -Recurse -Filter *.class | ForEach-Object { $_.FullName })
$java = (Get-Command java.exe -ErrorAction Stop).Source
$d8Jar = Join-Path $BuildTools 'lib\d8.jar'
Invoke-Native $java (@(
    '-cp', $d8Jar,
    'com.android.tools.r8.D8',
    '--min-api', "$MinSdk",
    '--lib', $AndroidJar,
    '--output', $DexDir
) + $classFiles)

Write-Step '写入 classes.dex 与页面资源'
# aapt2 在 Windows 上会把 -A 资源目录里的分隔符写成反斜杠，WebView 的
# AssetManager 只认正斜杠，因此这里手工把 assets 以 POSIX 路径写入 APK。
$apkWithDex = Join-Path $BuildDir 'app-with-dex.apk'
Copy-Item $unsignedApk $apkWithDex -Force
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::Open($apkWithDex, [System.IO.Compression.ZipArchiveMode]::Update)
try {
    $dexPath = Join-Path $DexDir 'classes.dex'
    $entry = $archive.CreateEntry('classes.dex', [System.IO.Compression.CompressionLevel]::Optimal)
    $entryStream = $entry.Open()
    try {
        $fileStream = [System.IO.File]::OpenRead($dexPath)
        try {
            $fileStream.CopyTo($entryStream)
        } finally {
            $fileStream.Dispose()
        }
    } finally {
        $entryStream.Dispose()
    }

    $assetRoot = (Resolve-Path $AssetsDir).Path
    foreach ($file in Get-ChildItem $AssetsDir -Recurse -File) {
        $relative = $file.FullName.Substring($assetRoot.Length + 1).Replace('\', '/')
        $entryName = "assets/$relative"
        $assetEntry = $archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
        $assetStream = $assetEntry.Open()
        try {
            $sourceStream = [System.IO.File]::OpenRead($file.FullName)
            try {
                $sourceStream.CopyTo($assetStream)
            } finally {
                $sourceStream.Dispose()
            }
        } finally {
            $assetStream.Dispose()
        }
    }
} finally {
    $archive.Dispose()
}

Write-Step '对齐（zipalign）'
$alignedApk = Join-Path $BuildDir 'app-aligned.apk'
Invoke-Native (Join-Path $BuildTools 'zipalign.exe') @('-p', '-f', '4', $apkWithDex, $alignedApk)

Write-Step '准备签名密钥'
if (-not (Test-Path $Keystore)) {
    New-Item -ItemType Directory -Force -Path $KeystoreDir | Out-Null
    $keytool = (Get-Command keytool.exe -ErrorAction Stop).Source
    Invoke-Native $keytool @(
        '-genkeypair',
        '-keystore', $Keystore,
        '-storepass', $KeystorePass,
        '-keypass', $KeystorePass,
        '-alias', $KeyAlias,
        '-keyalg', 'RSA',
        '-keysize', '2048',
        '-validity', '10000',
        '-dname', 'CN=XB-SVCB Mobile, OU=XB-SVCB, O=XB-SVCB, L=Local, ST=Local, C=CN'
    )
    Write-Host '已生成本地签名密钥（.keystore，仅用于侧载安装）。'
} else {
    Write-Host '复用已有签名密钥。'
}

Write-Step '签名 APK'
New-Item -ItemType Directory -Force -Path $DistDir | Out-Null
$finalApk = Join-Path $DistDir $AppFileName
$apksignerJar = Join-Path $BuildTools 'lib\apksigner.jar'
Invoke-Native $java @(
    '-jar', $apksignerJar,
    'sign',
    '--ks', $Keystore,
    '--ks-pass', "pass:$KeystorePass",
    '--key-pass', "pass:$KeystorePass",
    '--ks-key-alias', $KeyAlias,
    '--min-sdk-version', "$MinSdk",
    '--v1-signing-enabled', 'true',
    '--v2-signing-enabled', 'true',
    '--v3-signing-enabled', 'true',
    '--out', $finalApk,
    $alignedApk
)

Write-Step '校验签名'
Invoke-Native $java @('-jar', $apksignerJar, 'verify', '--print-certs', $finalApk)

$size = [Math]::Round((Get-Item $finalApk).Length / 1MB, 2)
$hash = (Get-FileHash $finalApk -Algorithm SHA256).Hash
Write-Host ''
Write-Host "APK: $finalApk" -ForegroundColor Green
Write-Host "大小: $size MB"
Write-Host "SHA-256: $hash"
