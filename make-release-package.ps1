param(
  [string]$OutputDirectory,
  [switch]$NoRun,
  [switch]$NoPause
)

$ErrorActionPreference = "Stop"
$releaseProjectRoot = $PSScriptRoot
. (Join-Path $releaseProjectRoot "ownspace-release-files.ps1")
. (Join-Path $releaseProjectRoot "ownspace-update-functions.ps1")

function New-OwnSpaceReleaseArtifacts {
  param(
    [Parameter(Mandatory = $true)][string]$ProjectRoot,
    [Parameter(Mandatory = $true)][string]$OutputDirectory,
    [Parameter(Mandatory = $true)][datetime]$PublishedAt
  )

  $package = Get-Content -LiteralPath (Join-Path $ProjectRoot "package.json") -Raw -Encoding UTF8 | ConvertFrom-Json
  if ([string]$package.name -ne "ownspace") {
    throw "Release packaging requires an OwnSpace project root."
  }
  $version = (ConvertTo-OwnSpaceVersion ([string]$package.version)).ToString(3)
  New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
  $resolvedOutput = [IO.Path]::GetFullPath($OutputDirectory)

  $archiveName = "OwnSpace-v$version-update.zip"
  $checksumName = "OwnSpace-v$version-update.sha256"
  $manifestName = "OwnSpace-v$version-manifest.json"
  $offlineName = "OwnSpace-v$version-offline-updater.zip"
  $archivePath = Join-Path $resolvedOutput $archiveName
  $checksumPath = Join-Path $resolvedOutput $checksumName
  $manifestPath = Join-Path $resolvedOutput $manifestName
  $offlinePath = Join-Path $resolvedOutput $offlineName
  foreach ($path in @($archivePath, $checksumPath, $manifestPath, $offlinePath)) {
    if (Test-Path -LiteralPath $path) {
      Remove-Item -LiteralPath $path -Force
    }
  }

  $temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) ("ownspace-update-release-" + [guid]::NewGuid().ToString("N"))
  $packageRoot = Join-Path $temporaryRoot "OwnSpace"
  $offlineRoot = Join-Path $temporaryRoot "offline"
  try {
    New-Item -ItemType Directory -Path $packageRoot, $offlineRoot -Force | Out-Null
    Copy-OwnSpaceManagedFiles -SourceRoot $ProjectRoot -DestinationRoot $packageRoot
    Compress-Archive -LiteralPath $packageRoot -DestinationPath $archivePath -CompressionLevel Optimal
    $sha256 = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()

    $manifest = [ordered]@{
      schemaVersion = 1
      version = $version
      minimumUpdaterVersion = "3.1.0"
      archive = $archiveName
      sha256 = $sha256
      publishedAt = $PublishedAt.ToUniversalTime().ToString("o")
    }
    [IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Compress), [Text.UTF8Encoding]::new($false))
    [IO.File]::WriteAllText($checksumPath, "$sha256  $archiveName`n", [Text.UTF8Encoding]::new($false))

    $upgradeCommandName = [string]::Concat([char]21319, [char]32423, " OwnSpace.cmd")
    Copy-Item -LiteralPath (Join-Path $ProjectRoot "offline-update-ownspace.cmd") -Destination (Join-Path $offlineRoot $upgradeCommandName)
    foreach ($file in @("offline-update-ownspace.ps1", "ownspace-update-functions.ps1", "ownspace-release-files.ps1")) {
      Copy-Item -LiteralPath (Join-Path $ProjectRoot $file) -Destination $offlineRoot
    }
    Copy-Item -LiteralPath $archivePath, $checksumPath, $manifestPath -Destination $offlineRoot
    Compress-Archive -Path (Join-Path $offlineRoot "*") -DestinationPath $offlinePath -CompressionLevel Optimal

    return [pscustomobject]@{
      Version = $version
      Archive = $archivePath
      Checksum = $checksumPath
      Manifest = $manifestPath
      OfflineArchive = $offlinePath
      Sha256 = $sha256
    }
  } finally {
    if (Test-Path -LiteralPath $temporaryRoot) {
      Remove-OwnSpaceTemporaryPath -Path $temporaryRoot
    }
  }
}

if (-not $NoRun) {
  if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path $releaseProjectRoot "dist"
  }
  try {
    $result = New-OwnSpaceReleaseArtifacts -ProjectRoot $releaseProjectRoot -OutputDirectory $OutputDirectory -PublishedAt ([DateTime]::UtcNow)
    Write-Host "`nOwnSpace v$($result.Version) Release assets created:" -ForegroundColor Green
    Write-Host $result.Archive
    Write-Host $result.Checksum
    Write-Host $result.Manifest
    Write-Host $result.OfflineArchive
  } catch {
    Write-Host "`nFailed to create OwnSpace Release assets: $($_.Exception.Message)" -ForegroundColor Red
    if (-not $NoPause) {
      Read-Host "Press Enter to exit"
    }
    exit 1
  }
  if (-not $NoPause) {
    Read-Host "Press Enter to exit"
  }
}
