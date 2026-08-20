$projectRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $projectRoot "ownspace-release-files.ps1")
. (Join-Path $projectRoot "make-release-package.ps1") -NoRun

function Get-TestZipEntries {
  param([string]$Path)

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [IO.Compression.ZipFile]::OpenRead($Path)
  try {
    return @($zip.Entries | ForEach-Object { $_.FullName.Replace('\', '/') })
  } finally {
    $zip.Dispose()
  }
}

Describe "OwnSpace release artifacts" {
  It "creates matching online and offline assets without user state" {
    $fixture = Join-Path $TestDrive "project"
    $output = Join-Path $TestDrive "dist"
    foreach ($directory in Get-OwnSpaceManagedDirectories) {
      New-Item -ItemType Directory -Path (Join-Path $fixture $directory) -Force | Out-Null
    }
    foreach ($file in Get-OwnSpaceManagedFiles) {
      New-Item -ItemType File -Path (Join-Path $fixture $file) -Force | Out-Null
    }
    New-Item -ItemType Directory -Path (Join-Path $fixture "data"), (Join-Path $fixture "node_modules") | Out-Null
    Set-Content -LiteralPath (Join-Path $fixture "data/ownspace.db") -Value "private"
    Set-Content -LiteralPath (Join-Path $fixture ".env.local") -Value "SECRET=value"
    [IO.File]::WriteAllText((Join-Path $fixture "package.json"), '{"name":"ownspace","version":"3.1.0"}')

    $result = New-OwnSpaceReleaseArtifacts -ProjectRoot $fixture -OutputDirectory $output -PublishedAt ([datetime]"2026-08-20T00:00:00Z")

    Test-Path -LiteralPath $result.Archive | Should Be $true
    Test-Path -LiteralPath $result.Checksum | Should Be $true
    Test-Path -LiteralPath $result.Manifest | Should Be $true
    Test-Path -LiteralPath $result.OfflineArchive | Should Be $true
    (Get-FileHash -LiteralPath $result.Archive -Algorithm SHA256).Hash.ToLowerInvariant() | Should Be $result.Sha256
    ((Get-Content -LiteralPath $result.Manifest -Raw | ConvertFrom-Json).version) | Should Be "3.1.0"
    $entries = Get-TestZipEntries -Path $result.Archive
    ($entries -join "`n") | Should Not Match '(^|/)(data|node_modules|backups|\.env\.local)(/|$)'
    ($entries -join "`n") | Should Match 'OwnSpace/package.json'
    $offlineEntries = Get-TestZipEntries -Path $result.OfflineArchive
    ($offlineEntries -join "`n") | Should Match 'OwnSpace-v3.1.0-update.zip'
    ($offlineEntries -join "`n") | Should Match 'offline-update-ownspace.ps1'
  }
}
