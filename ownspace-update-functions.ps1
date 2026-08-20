Set-StrictMode -Version Latest

$script:OwnSpaceRepository = "brdhub/OwnSpace"
$script:OwnSpaceUpdaterVersion = "3.1.0"
$script:OwnSpaceMaxManifestBytes = 32768
$script:OwnSpaceMaxChecksumBytes = 4096
$script:OwnSpaceMaxArchiveBytes = 268435456
$script:OwnSpaceMaxExpandedBytes = 536870912
$script:OwnSpaceMaxArchiveEntries = 20000

function ConvertTo-OwnSpaceVersion {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Value
  )

  if ($Value -notmatch '^v?(\d+)\.(\d+)\.(\d+)$') {
    throw "Invalid OwnSpace version: $Value"
  }
  return [version]::new([int]$Matches[1], [int]$Matches[2], [int]$Matches[3])
}

function Test-OwnSpaceUpdateAvailable {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Current,
    [Parameter(Mandatory = $true)]
    [string]$Candidate
  )

  return (ConvertTo-OwnSpaceVersion $Candidate) -gt (ConvertTo-OwnSpaceVersion $Current)
}

function Assert-OwnSpaceChildPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Root,
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $resolvedRoot = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
  $resolvedPath = [IO.Path]::GetFullPath($Path)
  if (-not $resolvedPath.StartsWith($resolvedRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Path leaves the allowed root: $Path"
  }
  return $resolvedPath
}

function Read-OwnSpaceUpdateManifest {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $file = Get-Item -LiteralPath $Path -ErrorAction Stop
  if ($file.Length -gt $script:OwnSpaceMaxManifestBytes) {
    throw "OwnSpace update manifest is too large."
  }
  try {
    $manifest = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
  } catch {
    throw "OwnSpace update manifest is not valid JSON."
  }

  $requiredProperties = @("archive", "minimumUpdaterVersion", "publishedAt", "schemaVersion", "sha256", "version")
  $actualProperties = @($manifest.PSObject.Properties.Name | Sort-Object)
  if (@(Compare-Object -ReferenceObject $requiredProperties -DifferenceObject $actualProperties).Count -ne 0) {
    throw "OwnSpace update manifest has an unexpected schema."
  }
  if ($manifest.schemaVersion -ne 1) {
    throw "Unsupported OwnSpace update manifest version."
  }

  $version = ConvertTo-OwnSpaceVersion ([string]$manifest.version)
  $minimumUpdaterVersion = ConvertTo-OwnSpaceVersion ([string]$manifest.minimumUpdaterVersion)
  if ($minimumUpdaterVersion -gt (ConvertTo-OwnSpaceVersion $script:OwnSpaceUpdaterVersion)) {
    throw "This update requires a newer OwnSpace updater."
  }
  $normalizedVersion = $version.ToString(3)
  if ([string]$manifest.archive -ne "OwnSpace-v$normalizedVersion-update.zip") {
    throw "OwnSpace update archive name does not match its version."
  }
  if ([string]$manifest.sha256 -cnotmatch '^[0-9a-f]{64}$') {
    throw "OwnSpace update manifest contains an invalid SHA-256."
  }
  $publishedAt = [DateTimeOffset]::MinValue
  if (-not [DateTimeOffset]::TryParse([string]$manifest.publishedAt, [ref]$publishedAt)) {
    throw "OwnSpace update manifest contains an invalid publication time."
  }
  return $manifest
}

function Test-OwnSpaceArchiveEntry {
  param(
    [Parameter(Mandatory = $true)]
    [string]$EntryName
  )

  if ([string]::IsNullOrWhiteSpace($EntryName) -or $EntryName.IndexOf([char]0) -ge 0) {
    throw "OwnSpace update archive contains an empty or invalid path."
  }
  $normalized = $EntryName.Replace('/', '\')
  if ([IO.Path]::IsPathRooted($normalized) -or $normalized -match '^[A-Za-z]:' -or ($normalized.Split('\') -contains '..')) {
    throw "OwnSpace update archive contains a path outside the application directory."
  }
  $segments = @($normalized.Split('\') | Where-Object { $_ -ne "" })
  if ($segments.Count -eq 0) {
    throw "OwnSpace update archive contains an invalid path."
  }
  if ($segments[0] -eq "OwnSpace") {
    $segments = @($segments | Select-Object -Skip 1)
  }
  if ($segments.Count -eq 0) {
    return $true
  }
  if ((Get-OwnSpaceProtectedNames) -contains $segments[0]) {
    throw "OwnSpace update archive contains protected path: $($segments[0])"
  }
  return $true
}

function Test-OwnSpaceReleaseAssetUrl {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Url,
    [Parameter(Mandatory = $true)]
    [string]$Tag,
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  $uri = $null
  if (-not [uri]::TryCreate($Url, [UriKind]::Absolute, [ref]$uri)) {
    throw "OwnSpace release asset has an invalid URL."
  }
  $expectedPath = "/$script:OwnSpaceRepository/releases/download/$Tag/$Name"
  if ($uri.Scheme -ne "https" -or $uri.Host -ne "github.com" -or $uri.AbsolutePath -cne $expectedPath) {
    throw "OwnSpace release asset is outside the trusted repository."
  }
  return $true
}

function Select-OwnSpaceReleaseAssets {
  param(
    [Parameter(Mandatory = $true)]
    [object]$Release
  )

  if ($Release.draft -ne $false -or $Release.prerelease -ne $false) {
    throw "OwnSpace only installs final GitHub Releases."
  }
  $version = (ConvertTo-OwnSpaceVersion ([string]$Release.tag_name)).ToString(3)
  $tag = "v$version"
  $names = @{
    Manifest = "OwnSpace-v$version-manifest.json"
    Archive = "OwnSpace-v$version-update.zip"
    Checksum = "OwnSpace-v$version-update.sha256"
  }
  $selected = @{}
  foreach ($kind in $names.Keys) {
    $matches = @($Release.assets | Where-Object { $_.name -ceq $names[$kind] })
    if ($matches.Count -ne 1) {
      throw "OwnSpace Release is missing the exact $kind asset."
    }
    $asset = $matches[0]
    Test-OwnSpaceReleaseAssetUrl -Url ([string]$asset.browser_download_url) -Tag $tag -Name $names[$kind] | Out-Null
    $limit = switch ($kind) {
      "Manifest" { $script:OwnSpaceMaxManifestBytes }
      "Checksum" { $script:OwnSpaceMaxChecksumBytes }
      default { $script:OwnSpaceMaxArchiveBytes }
    }
    if ([long]$asset.size -le 0 -or [long]$asset.size -gt $limit) {
      throw "OwnSpace Release $kind asset has an invalid size."
    }
    $selected[$kind] = $asset
  }
  return [pscustomobject]@{
    Version = $version
    Manifest = $selected.Manifest
    Archive = $selected.Archive
    Checksum = $selected.Checksum
  }
}

function Test-OwnSpaceUpdateArchive {
  param(
    [Parameter(Mandatory = $true)]
    [object]$Manifest,
    [Parameter(Mandatory = $true)]
    [string]$ArchivePath
  )

  $archiveFile = Get-Item -LiteralPath $ArchivePath -ErrorAction Stop
  if ($archiveFile.Length -le 0 -or $archiveFile.Length -gt $script:OwnSpaceMaxArchiveBytes) {
    throw "OwnSpace update archive has an invalid size."
  }
  $actualHash = (Get-FileHash -LiteralPath $archiveFile.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualHash -cne [string]$Manifest.sha256) {
    throw "OwnSpace update archive checksum does not match the manifest."
  }

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [IO.Compression.ZipFile]::OpenRead($archiveFile.FullName)
  try {
    if ($zip.Entries.Count -le 0 -or $zip.Entries.Count -gt $script:OwnSpaceMaxArchiveEntries) {
      throw "OwnSpace update archive contains an invalid number of files."
    }
    [long]$expandedBytes = 0
    $entryNames = @()
    foreach ($entry in $zip.Entries) {
      Test-OwnSpaceArchiveEntry -EntryName $entry.FullName | Out-Null
      $unixMode = ($entry.ExternalAttributes -shr 16) -band 0xF000
      if ($unixMode -eq 0xA000) {
        throw "OwnSpace update archive cannot contain symbolic links."
      }
      $expandedBytes += [long]$entry.Length
      if ($expandedBytes -gt $script:OwnSpaceMaxExpandedBytes) {
        throw "OwnSpace update archive expands beyond the safety limit."
      }
      $entryNames += $entry.FullName.Replace('\', '/')
    }
    foreach ($required in @("OwnSpace/package.json", "OwnSpace/start-ownspace.ps1", "OwnSpace/ownspace-update-functions.ps1")) {
      if ($entryNames -cnotcontains $required) {
        throw "OwnSpace update archive is missing $required."
      }
    }
  } finally {
    $zip.Dispose()
  }
  return $true
}
