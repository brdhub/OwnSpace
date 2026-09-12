$projectRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $projectRoot "ownspace-release-files.ps1")
. (Join-Path $projectRoot "ownspace-update-functions.ps1")

function New-TestOwnSpaceUpdatePackage {
  param([string]$Root)

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $sourceRoot = Join-Path $Root "payload"
  $payloadRoot = Join-Path $sourceRoot "OwnSpace"
  foreach ($directory in Get-OwnSpaceManagedDirectories) {
    New-Item -ItemType Directory -Path (Join-Path $payloadRoot $directory) -Force | Out-Null
  }
  foreach ($file in Get-OwnSpaceManagedFiles) {
    New-Item -ItemType File -Path (Join-Path $payloadRoot $file) -Force | Out-Null
  }
  Set-Content -LiteralPath (Join-Path $payloadRoot "package.json") -Value '{"name":"ownspace","version":"3.1.0"}'
  Set-Content -LiteralPath (Join-Path $payloadRoot "package-lock.json") -Value '{"name":"ownspace","version":"3.1.0"}'
  Set-Content -LiteralPath (Join-Path $payloadRoot "start-ownspace.ps1") -Value "new-start"
  Set-Content -LiteralPath (Join-Path $payloadRoot "ownspace-update-functions.ps1") -Value "new-updater"
  Set-Content -LiteralPath (Join-Path $payloadRoot "src/version.txt") -Value "new-code"
  $archive = Join-Path $Root "OwnSpace-v3.1.0-update.zip"
  [IO.Compression.ZipFile]::CreateFromDirectory($sourceRoot, $archive)
  $sha256 = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
  $manifest = Join-Path $Root "OwnSpace-v3.1.0-manifest.json"
  $json = [ordered]@{
    schemaVersion = 1
    version = "3.1.0"
    minimumUpdaterVersion = "3.1.0"
    archive = "OwnSpace-v3.1.0-update.zip"
    sha256 = $sha256
    publishedAt = "2026-08-20T00:00:00Z"
  } | ConvertTo-Json -Compress
  [IO.File]::WriteAllText($manifest, $json, [Text.UTF8Encoding]::new($false))
  return [pscustomobject]@{ Manifest=$manifest; Archive=$archive }
}

function New-TestOwnSpaceApplication {
  param([string]$Root)

  New-Item -ItemType Directory -Path (Join-Path $Root "data/resume-assets"), (Join-Path $Root "src") -Force | Out-Null
  Set-Content -LiteralPath (Join-Path $Root "data/ownspace.db") -Value "old-db"
  Set-Content -LiteralPath (Join-Path $Root "data/resume-assets/resume.pdf") -Value "old-pdf"
  Set-Content -LiteralPath (Join-Path $Root ".env.local") -Value "DEEPSEEK_API_KEY=fixture-secret"
  Set-Content -LiteralPath (Join-Path $Root "src/version.txt") -Value "old-code"
  Set-Content -LiteralPath (Join-Path $Root "package.json") -Value '{"name":"ownspace","version":"2.3.0"}'
  Set-Content -LiteralPath (Join-Path $Root "package-lock.json") -Value '{"name":"ownspace","version":"2.3.0"}'
  Set-Content -LiteralPath (Join-Path $Root "start-ownspace.ps1") -Value "old-start"
}

Describe "OwnSpace transactional update" {
  BeforeEach {
    $script:applicationRoot = Join-Path $TestDrive ([guid]::NewGuid().ToString("N"))
    New-TestOwnSpaceApplication -Root $script:applicationRoot
    $script:updatePackage = New-TestOwnSpaceUpdatePackage -Root (Join-Path $TestDrive ([guid]::NewGuid().ToString("N")))
    Mock Stop-OwnSpaceServerForUpdate {}
    Mock Invoke-OwnSpacePostInstall {}
    Mock Invoke-OwnSpaceRollbackStart {}
  }

  It "preserves protected state after a successful update" {
    Invoke-OwnSpaceUpdatePackage -ApplicationRoot $script:applicationRoot -ManifestPath $script:updatePackage.Manifest -ArchivePath $script:updatePackage.Archive -Source offline

    (Get-Content -LiteralPath (Join-Path $script:applicationRoot "data/ownspace.db") -Raw).Trim() | Should Be "old-db"
    (Get-Content -LiteralPath (Join-Path $script:applicationRoot "data/resume-assets/resume.pdf") -Raw).Trim() | Should Be "old-pdf"
    (Get-Content -LiteralPath (Join-Path $script:applicationRoot ".env.local") -Raw).Trim() | Should Be "DEEPSEEK_API_KEY=fixture-secret"
    (Get-Content -LiteralPath (Join-Path $script:applicationRoot "src/version.txt") -Raw).Trim() | Should Be "new-code"
    ((Get-Content -LiteralPath (Join-Path $script:applicationRoot "package.json") -Raw | ConvertFrom-Json).version) | Should Be "3.1.0"
  }

  It "restores code and data when post-install fails" {
    Mock Invoke-OwnSpacePostInstall {
      Set-Content -LiteralPath (Join-Path $script:applicationRoot "data/ownspace.db") -Value "migrated-db"
      throw "build failed"
    }

    { Invoke-OwnSpaceUpdatePackage -ApplicationRoot $script:applicationRoot -ManifestPath $script:updatePackage.Manifest -ArchivePath $script:updatePackage.Archive -Source offline } | Should Throw "build failed"

    (Get-Content -LiteralPath (Join-Path $script:applicationRoot "data/ownspace.db") -Raw).Trim() | Should Be "old-db"
    (Get-Content -LiteralPath (Join-Path $script:applicationRoot "src/version.txt") -Raw).Trim() | Should Be "old-code"
    ((Get-Content -LiteralPath (Join-Path $script:applicationRoot "package.json") -Raw | ConvertFrom-Json).version) | Should Be "2.3.0"
    Assert-MockCalled Invoke-OwnSpaceRollbackStart 1
  }

  It "rejects a concurrent update lock and releases it for the next run" {
    $first = Enter-OwnSpaceUpdateLock -ApplicationRoot $script:applicationRoot
    try {
      { Enter-OwnSpaceUpdateLock -ApplicationRoot $script:applicationRoot } | Should Throw "Another OwnSpace update is already running."
    } finally {
      Exit-OwnSpaceUpdateLock -Lock $first
    }

    $second = Enter-OwnSpaceUpdateLock -ApplicationRoot $script:applicationRoot
    $second | Should Not BeNullOrEmpty
    Exit-OwnSpaceUpdateLock -Lock $second
  }

  It "retains only the three newest backup directories" {
    $backupContainer = Join-Path $script:applicationRoot "backups"
    New-Item -ItemType Directory -Path $backupContainer -Force | Out-Null
    for ($index = 1; $index -le 5; $index += 1) {
      $path = Join-Path $backupContainer "backup-$index"
      New-Item -ItemType Directory -Path $path | Out-Null
      (Get-Item -LiteralPath $path).LastWriteTimeUtc = [datetime]"2026-08-$($index.ToString('00'))T00:00:00Z"
    }

    Remove-OldOwnSpaceBackups -ApplicationRoot $script:applicationRoot -Keep 3

    $remaining = @(Get-ChildItem -LiteralPath $backupContainer -Directory | Sort-Object Name | Select-Object -ExpandProperty Name)
    ($remaining -join ",") | Should Be "backup-3,backup-4,backup-5"
  }

  It "refuses to clean an unrelated temporary directory" {
    { Remove-OwnSpaceTemporaryPath -Path $TestDrive } | Should Throw "Refusing to remove an unexpected temporary directory."
    Test-Path -LiteralPath $TestDrive | Should Be $true
  }
}
