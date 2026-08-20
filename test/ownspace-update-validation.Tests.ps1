$projectRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $projectRoot "ownspace-release-files.ps1")
. (Join-Path $projectRoot "ownspace-update-functions.ps1")

Describe "OwnSpace update validation" {
  It "only accepts a strictly newer semantic version" {
    Test-OwnSpaceUpdateAvailable -Current "3.1.0" -Candidate "3.1.1" | Should Be $true
    Test-OwnSpaceUpdateAvailable -Current "3.1.0" -Candidate "3.1.0" | Should Be $false
    Test-OwnSpaceUpdateAvailable -Current "3.1.0" -Candidate "3.0.9" | Should Be $false
    { ConvertTo-OwnSpaceVersion "release-latest" } | Should Throw
  }

  It "reads the exact manifest contract" {
    $path = Join-Path $TestDrive "OwnSpace-v3.1.1-manifest.json"
    $manifestJson = '{"schemaVersion":1,"version":"3.1.1","minimumUpdaterVersion":"3.1.0","archive":"OwnSpace-v3.1.1-update.zip","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","publishedAt":"2026-08-20T00:00:00Z"}'
    [IO.File]::WriteAllText($path, $manifestJson, [Text.UTF8Encoding]::new($false))

    $manifest = Read-OwnSpaceUpdateManifest -Path $path

    $manifest.version | Should Be "3.1.1"
    $manifest.archive | Should Be "OwnSpace-v3.1.1-update.zip"
  }

  It "rejects a manifest with an extra field or wrong archive name" {
    $extraPath = Join-Path $TestDrive "extra.json"
    $wrongPath = Join-Path $TestDrive "wrong.json"
    [IO.File]::WriteAllText($extraPath, '{"schemaVersion":1,"version":"3.1.1","minimumUpdaterVersion":"3.1.0","archive":"OwnSpace-v3.1.1-update.zip","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","publishedAt":"2026-08-20T00:00:00Z","url":"https://example.com"}')
    [IO.File]::WriteAllText($wrongPath, '{"schemaVersion":1,"version":"3.1.1","minimumUpdaterVersion":"3.1.0","archive":"payload.zip","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","publishedAt":"2026-08-20T00:00:00Z"}')

    { Read-OwnSpaceUpdateManifest -Path $extraPath } | Should Throw
    { Read-OwnSpaceUpdateManifest -Path $wrongPath } | Should Throw
  }

  It "rejects protected and traversal archive entries" {
    { Test-OwnSpaceArchiveEntry -EntryName "../data/ownspace.db" } | Should Throw
    { Test-OwnSpaceArchiveEntry -EntryName "data/ownspace.db" } | Should Throw
    { Test-OwnSpaceArchiveEntry -EntryName "OwnSpace/.env.local" } | Should Throw
    { Test-OwnSpaceArchiveEntry -EntryName "OwnSpace/src/app/page.tsx" } | Should Not Throw
  }

  It "keeps resolved child paths inside the intended root" {
    $root = Join-Path $TestDrive "root"
    New-Item -ItemType Directory -Path $root | Out-Null

    (Assert-OwnSpaceChildPath -Root $root -Path (Join-Path $root "child/file.txt")) | Should Match "child"
    { Assert-OwnSpaceChildPath -Root $root -Path (Join-Path $root "../outside.txt") } | Should Throw
  }

  It "selects the three exact assets from an official release" {
    $release = [pscustomobject]@{
      draft = $false
      prerelease = $false
      tag_name = "v3.1.1"
      assets = @(
        [pscustomobject]@{ name="OwnSpace-v3.1.1-manifest.json"; size=512; browser_download_url="https://github.com/brdhub/OwnSpace/releases/download/v3.1.1/OwnSpace-v3.1.1-manifest.json" },
        [pscustomobject]@{ name="OwnSpace-v3.1.1-update.zip"; size=1024; browser_download_url="https://github.com/brdhub/OwnSpace/releases/download/v3.1.1/OwnSpace-v3.1.1-update.zip" },
        [pscustomobject]@{ name="OwnSpace-v3.1.1-update.sha256"; size=96; browser_download_url="https://github.com/brdhub/OwnSpace/releases/download/v3.1.1/OwnSpace-v3.1.1-update.sha256" }
      )
    }

    $selected = Select-OwnSpaceReleaseAssets -Release $release

    $selected.Version | Should Be "3.1.1"
    $selected.Manifest.name | Should Be "OwnSpace-v3.1.1-manifest.json"
    $selected.Archive.name | Should Be "OwnSpace-v3.1.1-update.zip"
    $selected.Checksum.name | Should Be "OwnSpace-v3.1.1-update.sha256"
  }

  It "rejects prereleases and assets outside the fixed GitHub repository" {
    $release = [pscustomobject]@{
      draft = $false
      prerelease = $true
      tag_name = "v3.1.1"
      assets = @()
    }
    { Select-OwnSpaceReleaseAssets -Release $release } | Should Throw

    $release.prerelease = $false
    $release.assets = @(
      [pscustomobject]@{ name="OwnSpace-v3.1.1-manifest.json"; size=512; browser_download_url="https://evil.example/manifest.json" },
      [pscustomobject]@{ name="OwnSpace-v3.1.1-update.zip"; size=1024; browser_download_url="https://evil.example/update.zip" },
      [pscustomobject]@{ name="OwnSpace-v3.1.1-update.sha256"; size=96; browser_download_url="https://evil.example/update.sha256" }
    )
    { Select-OwnSpaceReleaseAssets -Release $release } | Should Throw
  }

  It "allows only HTTPS GitHub asset redirect hosts" {
    Test-OwnSpaceAllowedDownloadUri -Uri ([uri]"https://github.com/brdhub/OwnSpace/releases/download/v3.1.1/update.zip") | Should Be $true
    Test-OwnSpaceAllowedDownloadUri -Uri ([uri]"https://objects.githubusercontent.com/release-asset/file") | Should Be $true
    Test-OwnSpaceAllowedDownloadUri -Uri ([uri]"https://release-assets.githubusercontent.com/github-production-release-asset/file") | Should Be $true
    { Test-OwnSpaceAllowedDownloadUri -Uri ([uri]"http://github.com/file") } | Should Throw
    { Test-OwnSpaceAllowedDownloadUri -Uri ([uri]"https://evil.example/file") } | Should Throw
  }

  It "accepts a complete archive whose hash matches the manifest" {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $payload = Join-Path $TestDrive "valid-payload/OwnSpace"
    New-Item -ItemType Directory -Path $payload -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $payload "package.json") -Value '{"name":"ownspace","version":"3.1.1"}'
    Set-Content -LiteralPath (Join-Path $payload "start-ownspace.ps1") -Value "start"
    Set-Content -LiteralPath (Join-Path $payload "ownspace-update-functions.ps1") -Value "update"
    $archive = Join-Path $TestDrive "valid.zip"
    [IO.Compression.ZipFile]::CreateFromDirectory((Split-Path -Parent $payload), $archive)
    $manifest = [pscustomobject]@{ sha256=(Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant() }

    Test-OwnSpaceUpdateArchive -Manifest $manifest -ArchivePath $archive | Should Be $true
  }

  It "rejects an archive whose hash differs from the manifest" {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $payload = Join-Path $TestDrive "wrong-hash/OwnSpace"
    New-Item -ItemType Directory -Path $payload -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $payload "package.json") -Value '{}'
    $archive = Join-Path $TestDrive "wrong-hash.zip"
    [IO.Compression.ZipFile]::CreateFromDirectory((Split-Path -Parent $payload), $archive)
    $manifest = [pscustomobject]@{ sha256=('a' * 64) }

    { Test-OwnSpaceUpdateArchive -Manifest $manifest -ArchivePath $archive } | Should Throw "OwnSpace update archive checksum does not match the manifest."
  }
}
