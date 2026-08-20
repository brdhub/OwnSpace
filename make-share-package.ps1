$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputDirectory = Join-Path $projectRoot "dist"
$archivePath = Join-Path $outputDirectory "OwnSpace-share-$timestamp.zip"
$temporaryRoot = Join-Path $projectRoot ".share-package-$([guid]::NewGuid().ToString('N'))"
$packageRoot = Join-Path $temporaryRoot "OwnSpace"

. (Join-Path $projectRoot "ownspace-release-files.ps1")

try {
  New-Item -ItemType Directory -Path $packageRoot -Force | Out-Null
  New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

  Copy-OwnSpaceManagedFiles -SourceRoot $projectRoot -DestinationRoot $packageRoot

  Compress-Archive -LiteralPath $packageRoot -DestinationPath $archivePath -CompressionLevel Optimal

  Write-Host "`nShare package created:" -ForegroundColor Green
  Write-Host $archivePath
  Write-Host "`nThe archive excludes data, node_modules, build caches, logs, and Git files." -ForegroundColor Cyan
} catch {
  Write-Host "`nFailed to create the share package: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
} finally {
  if (Test-Path -LiteralPath $temporaryRoot) {
    Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
  }
}

Read-Host "Press Enter to exit"
