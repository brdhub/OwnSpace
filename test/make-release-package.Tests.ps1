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

  It "upgrades a v2.3 fixture with final artifacts and preserves its data" {
    $output = Join-Path $TestDrive "rehearsal-dist"
    $application = Join-Path $TestDrive "old-application"
    New-Item -ItemType Directory -Path (Join-Path $application "data/resume-assets"), (Join-Path $application "src") -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $application "data/ownspace.db") -Value "old-db"
    Set-Content -LiteralPath (Join-Path $application "data/resume-assets/resume.pdf") -Value "old-pdf"
    Set-Content -LiteralPath (Join-Path $application ".env.local") -Value "DEEPSEEK_API_KEY=fixture-secret"
    Set-Content -LiteralPath (Join-Path $application "src/version.txt") -Value "old-code"
    Set-Content -LiteralPath (Join-Path $application "package.json") -Value '{"name":"ownspace","version":"2.3.0"}'
    Set-Content -LiteralPath (Join-Path $application "package-lock.json") -Value '{"name":"ownspace","version":"2.3.0"}'
    New-Item -ItemType File -Path (Join-Path $application "start-ownspace.cmd") | Out-Null
    Mock Stop-OwnSpaceServerForUpdate {}
    Mock Invoke-OwnSpacePostInstall {}
    Mock Invoke-OwnSpaceRollbackStart {}
    $artifacts = New-OwnSpaceReleaseArtifacts -ProjectRoot $projectRoot -OutputDirectory $output -PublishedAt ([datetime]"2026-08-20T00:00:00Z")

    Invoke-OwnSpaceUpdatePackage -ApplicationRoot $application -ManifestPath $artifacts.Manifest -ArchivePath $artifacts.Archive -Source offline

    (Get-Content -LiteralPath (Join-Path $application "data/ownspace.db") -Raw).Trim() | Should Be "old-db"
    (Get-Content -LiteralPath (Join-Path $application "data/resume-assets/resume.pdf") -Raw).Trim() | Should Be "old-pdf"
    (Get-Content -LiteralPath (Join-Path $application ".env.local") -Raw).Trim() | Should Be "DEEPSEEK_API_KEY=fixture-secret"
    ((Get-Content -LiteralPath (Join-Path $application "package.json") -Raw | ConvertFrom-Json).version) | Should Be "3.1.0"
  }
}
