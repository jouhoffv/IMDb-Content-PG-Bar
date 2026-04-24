$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$manifestPath = Join-Path $root "manifest.json"
$manifest = Get-Content -Raw $manifestPath | ConvertFrom-Json
$version = $manifest.version
$name = "imdb-content-pg-bar-v$version"
$distDir = Join-Path $root "dist"
$zipPath = Join-Path $distDir "$name.zip"
$stageDir = Join-Path $distDir $name

$runtimeFiles = @(
  "manifest.json",
  "background.js",
  "content-script.js",
  "content.css",
  "popup.html",
  "popup.js",
  "popup.css",
  "options.html",
  "options.js",
  "options.css",
  "assets/logos/imdb_banner.png",
  "assets/logos/imdb_banner_48.png",
  "assets/logos/imdb_banner_96.png",
  "assets/logos/imdb_banner_128.png"
)

if (Test-Path $stageDir) {
  Remove-Item -LiteralPath $stageDir -Recurse -Force
}

if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

New-Item -ItemType Directory -Path $stageDir -Force | Out-Null

foreach ($relativePath in $runtimeFiles) {
  $sourcePath = Join-Path $root $relativePath
  if (!(Test-Path $sourcePath)) {
    throw "Missing runtime file: $relativePath"
  }

  $targetPath = Join-Path $stageDir $relativePath
  $targetDir = Split-Path -Parent $targetPath
  New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
  Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force
}

New-Item -ItemType Directory -Path $distDir -Force | Out-Null
Compress-Archive -Path (Join-Path $stageDir "*") -DestinationPath $zipPath -CompressionLevel Optimal

Write-Output "Created $zipPath"
