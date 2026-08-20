param(
  [string]$ApplicationRoot,
  [switch]$NoRun,
  [switch]$NoPause
)

$ErrorActionPreference = "Stop"
$offlineRoot = $PSScriptRoot
. (Join-Path $offlineRoot "ownspace-release-files.ps1")
. (Join-Path $offlineRoot "ownspace-update-functions.ps1")

function Resolve-OwnSpaceApplicationRoot {
  param([Parameter(Mandatory = $true)][string]$CandidateRoot)

  $resolved = [IO.Path]::GetFullPath($CandidateRoot)
  if (-not (Test-Path -LiteralPath $resolved -PathType Container)) {
    throw "The selected directory is not an OwnSpace installation."
  }
  $packagePath = Join-Path $resolved "package.json"
  $launcherPath = Join-Path $resolved "start-ownspace.cmd"
  if (-not (Test-Path -LiteralPath $packagePath -PathType Leaf) -or -not (Test-Path -LiteralPath $launcherPath -PathType Leaf)) {
    throw "The selected directory is not an OwnSpace installation."
  }
  try {
    $package = Get-Content -LiteralPath $packagePath -Raw -Encoding UTF8 | ConvertFrom-Json
  } catch {
    throw "The selected directory is not an OwnSpace installation."
  }
  if ([string]$package.name -ne "ownspace") {
    throw "The selected directory is not an OwnSpace installation."
  }
  return $resolved
}

function Select-OwnSpaceApplicationRoot {
  Add-Type -AssemblyName System.Windows.Forms
  $dialog = [Windows.Forms.FolderBrowserDialog]::new()
  $dialog.Description = "Select the folder where OwnSpace is installed."
  $dialog.ShowNewFolderButton = $false
  try {
    if ($dialog.ShowDialog() -ne [Windows.Forms.DialogResult]::OK) {
      throw "OwnSpace offline update was cancelled."
    }
    return Resolve-OwnSpaceApplicationRoot -CandidateRoot $dialog.SelectedPath
  } finally {
    $dialog.Dispose()
  }
}

function Get-OwnSpaceOfflineAssets {
  param([Parameter(Mandatory = $true)][string]$BundleRoot)

  $manifestFiles = @(Get-ChildItem -LiteralPath $BundleRoot -Filter "OwnSpace-v*-manifest.json" -File)
  if ($manifestFiles.Count -ne 1) {
    throw "The offline updater must contain exactly one OwnSpace manifest."
  }
  $manifest = Read-OwnSpaceUpdateManifest -Path $manifestFiles[0].FullName
  $archivePath = Join-Path $BundleRoot ([string]$manifest.archive)
  $checksumName = "OwnSpace-v$($manifest.version)-update.sha256"
  $checksumPath = Join-Path $BundleRoot $checksumName
  if (-not (Test-Path -LiteralPath $archivePath -PathType Leaf) -or -not (Test-Path -LiteralPath $checksumPath -PathType Leaf)) {
    throw "The offline updater is missing its archive or checksum."
  }
  $checksum = (Get-Content -LiteralPath $checksumPath -Raw -Encoding UTF8).Trim()
  if ($checksum -cnotmatch '^([0-9a-f]{64})  ([^\r\n]+)$') {
    throw "The offline updater checksum file is invalid."
  }
  if ($Matches[1] -cne [string]$manifest.sha256 -or $Matches[2] -cne [string]$manifest.archive) {
    throw "The offline updater checksums do not agree."
  }
  Test-OwnSpaceUpdateArchive -Manifest $manifest -ArchivePath $archivePath | Out-Null
  return [pscustomobject]@{ Manifest=$manifestFiles[0].FullName; Archive=$archivePath; Version=[string]$manifest.version }
}

function Invoke-OwnSpaceOfflineUpdate {
  param(
    [string]$RequestedApplicationRoot,
    [Parameter(Mandatory = $true)][string]$BundleRoot
  )

  if ($RequestedApplicationRoot) {
    $targetRoot = Resolve-OwnSpaceApplicationRoot -CandidateRoot $RequestedApplicationRoot
  } else {
    try {
      $targetRoot = Resolve-OwnSpaceApplicationRoot -CandidateRoot $BundleRoot
    } catch {
      $targetRoot = Select-OwnSpaceApplicationRoot
    }
  }

  $assets = Get-OwnSpaceOfflineAssets -BundleRoot $BundleRoot
  $installedVersion = Get-OwnSpaceInstalledVersion -ApplicationRoot $targetRoot
  if (-not (Test-OwnSpaceUpdateAvailable -Current $installedVersion -Candidate $assets.Version)) {
    throw "The offline update must be newer than the installed OwnSpace version."
  }
  $runtime = Find-OwnSpaceNodeRuntime -ApplicationRoot $targetRoot
  $env:Path = "$(Split-Path -Parent $runtime.Node);$env:Path"
  Invoke-OwnSpaceUpdatePackage -ApplicationRoot $targetRoot -ManifestPath $assets.Manifest -ArchivePath $assets.Archive -Source offline
}

if (-not $NoRun) {
  try {
    Invoke-OwnSpaceOfflineUpdate -RequestedApplicationRoot $ApplicationRoot -BundleRoot $offlineRoot
    Write-Host "`nOwnSpace was updated and the existing data was preserved." -ForegroundColor Green
  } catch {
    Write-Host "`nOwnSpace offline update failed: $($_.Exception.Message)" -ForegroundColor Red
    if (-not $NoPause) {
      Read-Host "Press Enter to exit"
    }
    exit 1
  }
  if (-not $NoPause) {
    Read-Host "Press Enter to exit"
  }
}
