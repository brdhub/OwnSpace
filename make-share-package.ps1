$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputDirectory = Join-Path $projectRoot "dist"
$archivePath = Join-Path $outputDirectory "OwnSpace-share-$timestamp.zip"
$temporaryRoot = Join-Path $projectRoot ".share-package-$([guid]::NewGuid().ToString('N'))"
$packageRoot = Join-Path $temporaryRoot "OwnSpace"

$directories = @("drizzle", "public", "scripts", "src")
$files = @(
  "drizzle.config.ts",
  "eslint.config.mjs",
  "next-env.d.ts",
  "next.config.ts",
  "package-lock.json",
  "package.json",
  "postcss.config.mjs",
  "README.md",
  "start-ownspace.cmd",
  "start-ownspace.ps1",
  "tailwind.config.ts",
  "tsconfig.json"
)

try {
  New-Item -ItemType Directory -Path $packageRoot -Force | Out-Null
  New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

  foreach ($directory in $directories) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $directory) -Destination $packageRoot -Recurse
  }

  foreach ($file in $files) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $file) -Destination $packageRoot
  }

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
