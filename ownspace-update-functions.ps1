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

function Test-OwnSpaceAllowedDownloadUri {
  param([Parameter(Mandatory = $true)][uri]$Uri)

  $allowedHosts = @("github.com", "api.github.com", "objects.githubusercontent.com", "github-releases.githubusercontent.com")
  if ($Uri.Scheme -ne "https" -or $allowedHosts -notcontains $Uri.Host.ToLowerInvariant()) {
    throw "OwnSpace update download was redirected outside trusted GitHub hosts."
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

function Get-OwnSpaceInstalledVersion {
  param([Parameter(Mandatory = $true)][string]$ApplicationRoot)

  $packagePath = Join-Path $ApplicationRoot "package.json"
  $package = Get-Content -LiteralPath $packagePath -Raw -Encoding UTF8 | ConvertFrom-Json
  if ([string]$package.name -ne "ownspace") {
    throw "The selected directory is not an OwnSpace installation."
  }
  return (ConvertTo-OwnSpaceVersion ([string]$package.version)).ToString(3)
}

function Enter-OwnSpaceUpdateLock {
  param([Parameter(Mandatory = $true)][string]$ApplicationRoot)

  $root = [IO.Path]::GetFullPath($ApplicationRoot)
  $lockPath = Assert-OwnSpaceChildPath -Root $root -Path (Join-Path $root ".ownspace-update.lock")
  try {
    $stream = [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    $stream.SetLength(0)
    $writer = [IO.StreamWriter]::new($stream, [Text.UTF8Encoding]::new($false), 1024, $true)
    $writer.Write("pid=$PID`nstartedAt=$([DateTimeOffset]::UtcNow.ToString('o'))")
    $writer.Dispose()
    $stream.Flush()
    return [pscustomobject]@{ Path=$lockPath; Stream=$stream; Root=$root }
  } catch {
    throw "Another OwnSpace update is already running."
  }
}

function Exit-OwnSpaceUpdateLock {
  param([Parameter(Mandatory = $true)][object]$Lock)

  if ($Lock.Stream) {
    $Lock.Stream.Dispose()
  }
  $lockPath = Assert-OwnSpaceChildPath -Root $Lock.Root -Path $Lock.Path
  if (Test-Path -LiteralPath $lockPath) {
    Remove-Item -LiteralPath $lockPath -Force
  }
}

function Expand-OwnSpaceUpdateArchive {
  param([Parameter(Mandatory = $true)][string]$ArchivePath)

  $temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) ("ownspace-update-" + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $temporaryRoot | Out-Null
  try {
    Expand-Archive -LiteralPath $ArchivePath -DestinationPath $temporaryRoot
    $payloadRoot = Join-Path $temporaryRoot "OwnSpace"
    if (-not (Test-Path -LiteralPath $payloadRoot -PathType Container)) {
      throw "OwnSpace update archive is missing its application root."
    }
    return [pscustomobject]@{ Root=$temporaryRoot; Payload=$payloadRoot }
  } catch {
    Remove-OwnSpaceTemporaryPath -Path $temporaryRoot
    throw
  }
}

function Remove-OwnSpaceTemporaryPath {
  param([Parameter(Mandatory = $true)][string]$Path)

  $temporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  $validated = Assert-OwnSpaceChildPath -Root $temporaryRoot -Path $Path
  if ((Split-Path -Leaf $validated) -notlike "ownspace-update-*") {
    throw "Refusing to remove an unexpected temporary directory."
  }
  if (Test-Path -LiteralPath $validated) {
    Remove-Item -LiteralPath $validated -Recurse -Force
  }
}

function Get-OwnSpaceFileHashOrNull {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    return $null
  }
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function New-OwnSpaceUpdateBackup {
  param(
    [Parameter(Mandatory = $true)][string]$ApplicationRoot,
    [Parameter(Mandatory = $true)][string]$CurrentVersion
  )

  $backupContainer = Join-Path $ApplicationRoot "backups"
  New-Item -ItemType Directory -Path $backupContainer -Force | Out-Null
  $backupName = "{0}-v{1}-{2}" -f (Get-Date -Format "yyyyMMdd-HHmmss"), $CurrentVersion, ([guid]::NewGuid().ToString("N").Substring(0, 8))
  $backupRoot = Assert-OwnSpaceChildPath -Root $backupContainer -Path (Join-Path $backupContainer $backupName)
  $programRoot = Join-Path $backupRoot "program"
  New-Item -ItemType Directory -Path $programRoot -Force | Out-Null

  foreach ($directory in Get-OwnSpaceManagedDirectories) {
    $source = Join-Path $ApplicationRoot $directory
    if (Test-Path -LiteralPath $source -PathType Container) {
      Copy-Item -LiteralPath $source -Destination $programRoot -Recurse
    }
  }
  foreach ($file in Get-OwnSpaceManagedFiles) {
    $source = Join-Path $ApplicationRoot $file
    if (Test-Path -LiteralPath $source -PathType Leaf) {
      Copy-Item -LiteralPath $source -Destination $programRoot
    }
  }
  $dataPath = Join-Path $ApplicationRoot "data"
  if (Test-Path -LiteralPath $dataPath -PathType Container) {
    Copy-Item -LiteralPath $dataPath -Destination $backupRoot -Recurse
  }
  $environmentPath = Join-Path $ApplicationRoot ".env.local"
  if (Test-Path -LiteralPath $environmentPath -PathType Leaf) {
    Copy-Item -LiteralPath $environmentPath -Destination $backupRoot
  }

  $lockHash = Get-OwnSpaceFileHashOrNull -Path (Join-Path $ApplicationRoot "package-lock.json")
  $metadata = [ordered]@{
    version = $CurrentVersion
    createdAt = [DateTimeOffset]::UtcNow.ToString("o")
    hadData = (Test-Path -LiteralPath $dataPath -PathType Container)
    hadEnvironment = (Test-Path -LiteralPath $environmentPath -PathType Leaf)
    lockHash = $lockHash
  }
  [IO.File]::WriteAllText((Join-Path $backupRoot "backup.json"), ($metadata | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
  return [pscustomobject]@{ Root=$backupRoot; Program=$programRoot; LockHash=$lockHash }
}

function Remove-OwnSpaceManagedProgram {
  param([Parameter(Mandatory = $true)][string]$ApplicationRoot)

  foreach ($directory in Get-OwnSpaceManagedDirectories) {
    $target = Assert-OwnSpaceChildPath -Root $ApplicationRoot -Path (Join-Path $ApplicationRoot $directory)
    if (Test-Path -LiteralPath $target) {
      Remove-Item -LiteralPath $target -Recurse -Force
    }
  }
  foreach ($file in Get-OwnSpaceManagedFiles) {
    $target = Assert-OwnSpaceChildPath -Root $ApplicationRoot -Path (Join-Path $ApplicationRoot $file)
    if (Test-Path -LiteralPath $target) {
      Remove-Item -LiteralPath $target -Force
    }
  }
}

function Install-OwnSpaceArchive {
  param(
    [Parameter(Mandatory = $true)][string]$ApplicationRoot,
    [Parameter(Mandatory = $true)][string]$StagingRoot
  )

  foreach ($directory in Get-OwnSpaceManagedDirectories) {
    $source = Join-Path $StagingRoot $directory
    if (-not (Test-Path -LiteralPath $source -PathType Container)) {
      throw "OwnSpace update is missing directory: $directory"
    }
  }
  foreach ($file in Get-OwnSpaceManagedFiles) {
    $source = Join-Path $StagingRoot $file
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
      throw "OwnSpace update is missing file: $file"
    }
  }

  Remove-OwnSpaceManagedProgram -ApplicationRoot $ApplicationRoot
  foreach ($directory in Get-OwnSpaceManagedDirectories) {
    Copy-Item -LiteralPath (Join-Path $StagingRoot $directory) -Destination $ApplicationRoot -Recurse
  }
  foreach ($file in Get-OwnSpaceManagedFiles) {
    Copy-Item -LiteralPath (Join-Path $StagingRoot $file) -Destination $ApplicationRoot
  }
}

function Restore-OwnSpaceUpdateBackup {
  param(
    [Parameter(Mandatory = $true)][string]$ApplicationRoot,
    [Parameter(Mandatory = $true)][string]$BackupRoot
  )

  $backupContainer = Join-Path $ApplicationRoot "backups"
  $validatedBackup = Assert-OwnSpaceChildPath -Root $backupContainer -Path $BackupRoot
  $metadata = Get-Content -LiteralPath (Join-Path $validatedBackup "backup.json") -Raw -Encoding UTF8 | ConvertFrom-Json
  Remove-OwnSpaceManagedProgram -ApplicationRoot $ApplicationRoot

  $programRoot = Join-Path $validatedBackup "program"
  foreach ($item in Get-ChildItem -LiteralPath $programRoot -Force) {
    Copy-Item -LiteralPath $item.FullName -Destination $ApplicationRoot -Recurse
  }

  $dataTarget = Assert-OwnSpaceChildPath -Root $ApplicationRoot -Path (Join-Path $ApplicationRoot "data")
  if (Test-Path -LiteralPath $dataTarget) {
    Remove-Item -LiteralPath $dataTarget -Recurse -Force
  }
  if ($metadata.hadData) {
    Copy-Item -LiteralPath (Join-Path $validatedBackup "data") -Destination $ApplicationRoot -Recurse
  }

  $environmentTarget = Assert-OwnSpaceChildPath -Root $ApplicationRoot -Path (Join-Path $ApplicationRoot ".env.local")
  if (Test-Path -LiteralPath $environmentTarget) {
    Remove-Item -LiteralPath $environmentTarget -Force
  }
  if ($metadata.hadEnvironment) {
    Copy-Item -LiteralPath (Join-Path $validatedBackup ".env.local") -Destination $ApplicationRoot
  }
}

function Stop-OwnSpaceServerForUpdate {
  param([Parameter(Mandatory = $true)][string]$ApplicationRoot)

  $connection = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $connection) {
    return
  }
  $serverProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($connection.OwningProcess)"
  if (-not $serverProcess.CommandLine -or -not $serverProcess.CommandLine.Contains([IO.Path]::GetFullPath($ApplicationRoot))) {
    throw "Port 3000 is occupied by another program."
  }
  & taskkill.exe /PID $connection.OwningProcess /T /F | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "The previous OwnSpace server could not be stopped."
  }
}

function Invoke-OwnSpaceNpmForUpdate {
  param(
    [Parameter(Mandatory = $true)][string]$ApplicationRoot,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  $npm = (Get-Command npm.cmd -ErrorAction Stop).Source
  Push-Location $ApplicationRoot
  try {
    & $npm @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "npm $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
    }
  } finally {
    Pop-Location
  }
}

function Start-OwnSpaceServerForUpdate {
  param([Parameter(Mandatory = $true)][string]$ApplicationRoot)

  $npm = (Get-Command npm.cmd -ErrorAction Stop).Source
  $command = "Set-Location -LiteralPath `"$ApplicationRoot`"; & `"$npm`" run start"
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
  Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", $encoded) -WorkingDirectory $ApplicationRoot -WindowStyle Hidden | Out-Null
}

function Wait-OwnSpaceHealthForUpdate {
  param([int]$Attempts = 90)

  for ($attempt = 0; $attempt -lt $Attempts; $attempt += 1) {
    try {
      Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 2 | Out-Null
      return $true
    } catch {
      Start-Sleep -Seconds 1
    }
  }
  throw "OwnSpace did not become healthy after the update."
}

function Invoke-OwnSpacePostInstall {
  param(
    [Parameter(Mandatory = $true)][string]$ApplicationRoot,
    [AllowNull()][string]$PreviousLockHash
  )

  $currentLockHash = Get-OwnSpaceFileHashOrNull -Path (Join-Path $ApplicationRoot "package-lock.json")
  if (-not (Test-Path -LiteralPath (Join-Path $ApplicationRoot "node_modules")) -or $currentLockHash -ne $PreviousLockHash) {
    Invoke-OwnSpaceNpmForUpdate -ApplicationRoot $ApplicationRoot -Arguments @("ci")
  }
  Invoke-OwnSpaceNpmForUpdate -ApplicationRoot $ApplicationRoot -Arguments @("run", "db:migrate")
  Invoke-OwnSpaceNpmForUpdate -ApplicationRoot $ApplicationRoot -Arguments @("run", "db:init")
  Invoke-OwnSpaceNpmForUpdate -ApplicationRoot $ApplicationRoot -Arguments @("run", "build")
  Start-OwnSpaceServerForUpdate -ApplicationRoot $ApplicationRoot
  Wait-OwnSpaceHealthForUpdate | Out-Null
}

function Invoke-OwnSpaceRollbackStart {
  param([Parameter(Mandatory = $true)][string]$ApplicationRoot)

  Invoke-OwnSpaceNpmForUpdate -ApplicationRoot $ApplicationRoot -Arguments @("ci")
  Invoke-OwnSpaceNpmForUpdate -ApplicationRoot $ApplicationRoot -Arguments @("run", "build")
  Start-OwnSpaceServerForUpdate -ApplicationRoot $ApplicationRoot
  Wait-OwnSpaceHealthForUpdate | Out-Null
}

function Write-OwnSpaceUpdateResult {
  param(
    [Parameter(Mandatory = $true)][string]$ApplicationRoot,
    [Parameter(Mandatory = $true)][string]$Version,
    [Parameter(Mandatory = $true)][ValidateSet("online", "offline")][string]$Source
  )

  $backupContainer = Join-Path $ApplicationRoot "backups"
  New-Item -ItemType Directory -Path $backupContainer -Force | Out-Null
  $result = [ordered]@{ version=$Version; source=$Source; completedAt=[DateTimeOffset]::UtcNow.ToString("o") }
  [IO.File]::WriteAllText((Join-Path $backupContainer "last-update.json"), ($result | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
}

function Remove-OldOwnSpaceBackups {
  param(
    [Parameter(Mandatory = $true)][string]$ApplicationRoot,
    [int]$Keep = 3
  )

  $backupContainer = Join-Path $ApplicationRoot "backups"
  if (-not (Test-Path -LiteralPath $backupContainer -PathType Container)) {
    return
  }
  $oldBackups = @(Get-ChildItem -LiteralPath $backupContainer -Directory | Sort-Object LastWriteTimeUtc -Descending | Select-Object -Skip $Keep)
  foreach ($backup in $oldBackups) {
    $validated = Assert-OwnSpaceChildPath -Root $backupContainer -Path $backup.FullName
    Remove-Item -LiteralPath $validated -Recurse -Force
  }
}

function Invoke-OwnSpaceUpdatePackage {
  param(
    [Parameter(Mandatory = $true)][string]$ApplicationRoot,
    [Parameter(Mandatory = $true)][string]$ManifestPath,
    [Parameter(Mandatory = $true)][string]$ArchivePath,
    [Parameter(Mandatory = $true)][ValidateSet("online", "offline")][string]$Source
  )

  $lock = $null
  $staging = $null
  $backup = $null
  try {
    $lock = Enter-OwnSpaceUpdateLock -ApplicationRoot $ApplicationRoot
    $currentVersion = Get-OwnSpaceInstalledVersion -ApplicationRoot $ApplicationRoot
    $manifest = Read-OwnSpaceUpdateManifest -Path $ManifestPath
    if (-not (Test-OwnSpaceUpdateAvailable -Current $currentVersion -Candidate ([string]$manifest.version))) {
      throw "OwnSpace update version must be newer than the installed version."
    }
    Test-OwnSpaceUpdateArchive -Manifest $manifest -ArchivePath $ArchivePath | Out-Null
    $staging = Expand-OwnSpaceUpdateArchive -ArchivePath $ArchivePath
    Stop-OwnSpaceServerForUpdate -ApplicationRoot $ApplicationRoot
    $backup = New-OwnSpaceUpdateBackup -ApplicationRoot $ApplicationRoot -CurrentVersion $currentVersion
    Install-OwnSpaceArchive -ApplicationRoot $ApplicationRoot -StagingRoot $staging.Payload
    Invoke-OwnSpacePostInstall -ApplicationRoot $ApplicationRoot -PreviousLockHash $backup.LockHash
    Write-OwnSpaceUpdateResult -ApplicationRoot $ApplicationRoot -Version ([string]$manifest.version) -Source $Source
    Remove-OldOwnSpaceBackups -ApplicationRoot $ApplicationRoot -Keep 3
  } catch {
    $originalError = $_
    if ($backup) {
      try {
        Stop-OwnSpaceServerForUpdate -ApplicationRoot $ApplicationRoot
        Restore-OwnSpaceUpdateBackup -ApplicationRoot $ApplicationRoot -BackupRoot $backup.Root
        Invoke-OwnSpaceRollbackStart -ApplicationRoot $ApplicationRoot
      } catch {
        throw "OwnSpace update failed: $($originalError.Exception.Message) Rollback also failed: $($_.Exception.Message) Backup: $($backup.Root)"
      }
    }
    throw $originalError
  } finally {
    if ($staging) {
      Remove-OwnSpaceTemporaryPath -Path $staging.Root
    }
    if ($lock) {
      Exit-OwnSpaceUpdateLock -Lock $lock
    }
  }
}
