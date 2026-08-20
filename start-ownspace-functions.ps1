$ownSpaceHelperRoot = $PSScriptRoot
if (-not (Get-Command Get-OwnSpaceManagedFiles -ErrorAction SilentlyContinue)) {
  . (Join-Path $ownSpaceHelperRoot "ownspace-release-files.ps1")
}
if (-not (Get-Command Test-OwnSpaceUpdateAvailable -ErrorAction SilentlyContinue)) {
  . (Join-Path $ownSpaceHelperRoot "ownspace-update-functions.ps1")
}

function Install-OwnSpaceDependencies {
  Stop-OwnSpaceServer
  Invoke-NpmCommand -Arguments @("ci") -Description "Installing or updating dependencies (internet required)..."
}

function Get-OwnSpaceLatestRelease {
  $headers = @{ Accept="application/vnd.github+json"; "User-Agent"="OwnSpace-Updater/$script:OwnSpaceUpdaterVersion" }
  $response = Invoke-WebRequest -Uri "https://api.github.com/repos/brdhub/OwnSpace/releases/latest" -Headers $headers -UseBasicParsing -TimeoutSec 4
  $responseBytes = [Text.Encoding]::UTF8.GetByteCount([string]$response.Content)
  if ($responseBytes -le 0 -or $responseBytes -gt 1048576) {
    throw "GitHub returned an invalid OwnSpace Release response size."
  }
  try {
    $release = $response.Content | ConvertFrom-Json
  } catch {
    throw "GitHub returned invalid OwnSpace Release metadata."
  }
  $selected = Select-OwnSpaceReleaseAssets -Release $release
  return [pscustomobject]@{
    Version = $selected.Version
    Manifest = $selected.Manifest
    Archive = $selected.Archive
    Checksum = $selected.Checksum
  }
}

function Receive-OwnSpaceReleaseFile {
  param(
    [Parameter(Mandatory = $true)][object]$Asset,
    [Parameter(Mandatory = $true)][string]$Destination,
    [Parameter(Mandatory = $true)][long]$MaximumBytes
  )

  Add-Type -AssemblyName System.Net.Http
  $handler = [Net.Http.HttpClientHandler]::new()
  $handler.AllowAutoRedirect = $false
  $client = [Net.Http.HttpClient]::new($handler)
  $client.Timeout = [TimeSpan]::FromSeconds(30)
  $client.DefaultRequestHeaders.UserAgent.ParseAdd("OwnSpace-Updater/$script:OwnSpaceUpdaterVersion")
  $currentUri = [uri]$Asset.browser_download_url
  try {
    for ($redirect = 0; $redirect -le 5; $redirect += 1) {
      Test-OwnSpaceAllowedDownloadUri -Uri $currentUri | Out-Null
      $response = $client.GetAsync($currentUri, [Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
      try {
        $status = [int]$response.StatusCode
        if ($status -in @(301, 302, 303, 307, 308)) {
          if (-not $response.Headers.Location) {
            throw "GitHub returned an update redirect without a destination."
          }
          $currentUri = [uri]::new($currentUri, $response.Headers.Location)
          continue
        }
        if (-not $response.IsSuccessStatusCode) {
          throw "GitHub update download failed with HTTP $status."
        }
        $contentLength = $response.Content.Headers.ContentLength
        if ($contentLength -and ($contentLength -le 0 -or $contentLength -gt $MaximumBytes)) {
          throw "Downloaded OwnSpace Release asset has an invalid size."
        }

        $inputStream = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
        $outputStream = [IO.File]::Open($Destination, [IO.FileMode]::Create, [IO.FileAccess]::Write, [IO.FileShare]::None)
        try {
          $buffer = New-Object byte[] 81920
          [long]$totalBytes = 0
          while (($read = $inputStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
            $totalBytes += $read
            if ($totalBytes -gt $MaximumBytes) {
              throw "Downloaded OwnSpace Release asset exceeds the size limit."
            }
            $outputStream.Write($buffer, 0, $read)
          }
          if ($totalBytes -le 0) {
            throw "Downloaded OwnSpace Release asset is empty."
          }
        } finally {
          $outputStream.Dispose()
          $inputStream.Dispose()
        }
        return
      } finally {
        $response.Dispose()
      }
    }
    throw "GitHub update download exceeded the redirect limit."
  } catch {
    if (Test-Path -LiteralPath $Destination) {
      Remove-Item -LiteralPath $Destination -Force
    }
    throw
  } finally {
    $client.Dispose()
    $handler.Dispose()
  }
}

function Receive-OwnSpaceReleaseAssets {
  param([Parameter(Mandatory = $true)][object]$Release)

  $temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) ("ownspace-update-" + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $temporaryRoot | Out-Null
  try {
    $manifestPath = Join-Path $temporaryRoot ([string]$Release.Manifest.name)
    $archivePath = Join-Path $temporaryRoot ([string]$Release.Archive.name)
    $checksumPath = Join-Path $temporaryRoot ([string]$Release.Checksum.name)
    Receive-OwnSpaceReleaseFile -Asset $Release.Manifest -Destination $manifestPath -MaximumBytes $script:OwnSpaceMaxManifestBytes
    Receive-OwnSpaceReleaseFile -Asset $Release.Checksum -Destination $checksumPath -MaximumBytes $script:OwnSpaceMaxChecksumBytes
    Receive-OwnSpaceReleaseFile -Asset $Release.Archive -Destination $archivePath -MaximumBytes $script:OwnSpaceMaxArchiveBytes

    $manifest = Read-OwnSpaceUpdateManifest -Path $manifestPath
    if ([string]$manifest.version -ne [string]$Release.Version) {
      throw "Downloaded OwnSpace manifest version does not match the Release."
    }
    $checksum = (Get-Content -LiteralPath $checksumPath -Raw -Encoding UTF8).Trim()
    if ($checksum -cnotmatch '^([0-9a-f]{64})  ([^\r\n]+)$') {
      throw "Downloaded OwnSpace checksum file is invalid."
    }
    if ($Matches[1] -cne [string]$manifest.sha256 -or $Matches[2] -cne [string]$manifest.archive) {
      throw "OwnSpace Release checksums do not agree."
    }
    Test-OwnSpaceUpdateArchive -Manifest $manifest -ArchivePath $archivePath | Out-Null
    return [pscustomobject]@{ Root=$temporaryRoot; Manifest=$manifestPath; Archive=$archivePath }
  } catch {
    Remove-OwnSpaceTemporaryPath -Path $temporaryRoot
    throw
  }
}

function Invoke-OwnSpaceStartupUpdate {
  param(
    [Parameter(Mandatory = $true)][string]$ApplicationRoot,
    [Parameter(Mandatory = $true)][string]$CurrentVersion
  )

  try {
    $release = Get-OwnSpaceLatestRelease
  } catch {
    Write-Host "Unable to check GitHub for updates; starting the current OwnSpace version." -ForegroundColor DarkYellow
    return "continue"
  }
  if (-not (Test-OwnSpaceUpdateAvailable -Current $CurrentVersion -Candidate $release.Version)) {
    return "continue"
  }
  $answer = Read-Host "OwnSpace v$($release.Version) is available. Your data will be backed up first. Update now? [y/N]"
  if ($answer -notmatch '^(?i:y|yes)$') {
    return "continue"
  }

  $assets = $null
  try {
    $assets = Receive-OwnSpaceReleaseAssets -Release $release
    Invoke-OwnSpaceUpdatePackage -ApplicationRoot $ApplicationRoot -ManifestPath $assets.Manifest -ArchivePath $assets.Archive -Source online
    return "updated"
  } finally {
    if ($assets) {
      Remove-OwnSpaceTemporaryPath -Path $assets.Root
    }
  }
}
