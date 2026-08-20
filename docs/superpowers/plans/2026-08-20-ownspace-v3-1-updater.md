# OwnSpace v3.1 Updater Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship OwnSpace v3.1 with a prompted GitHub Release updater and a one-click offline updater that preserve local data and roll back failed upgrades.

**Architecture:** PowerShell entry points share a single update helper that validates release manifests and archives, backs up protected state, replaces only packaged program files, runs migrations/builds, health-checks the result, and restores the old program and database on failure. Online startup discovery only downloads fixed `brdhub/OwnSpace` Release assets; the offline bundle carries the same assets locally. Release packaging and the existing share package consume one managed-file definition.

**Tech Stack:** PowerShell 5.1, Pester, GitHub Releases REST API, Windows `System.IO.Compression`, SHA-256, Node.js 22/npm, Next.js, SQLite/Drizzle.

**Spec:** `docs/superpowers/specs/2026-08-20-ownspace-v3-1-updater-design.md`

## Global Constraints

- Version is `3.1.0`; release tag is `v3.1.0`.
- Only fixed repository `brdhub/OwnSpace` draft-free, prerelease-free Releases are eligible.
- No new npm dependencies, installer framework, background service, or silent forced update.
- `data/**`, `.env.local`, `backups/**`, `node_modules/**`, `.next-build/**`, `.next-dev/**`, `.git/**`, and logs are never packaged or replaced.
- Online failure or user skip must continue normal startup.
- Upgrade success requires a healthy `http://localhost:3000`; otherwise restore both old code and old database.
- PowerShell recursive copy, move, or deletion must first resolve and validate every path under the intended application, temporary, or backup root.
- All updater tests use temporary fixtures and fake Release responses; they never access GitHub or the real `data` directory.

---

### Task 1: Centralize the release file contract

**Files:**
- Create: `ownspace-release-files.ps1`
- Create: `test/ownspace-release-files.Tests.ps1`
- Modify: `make-share-package.ps1`

**Interfaces:**
- Produces: `Get-OwnSpaceManagedDirectories`, `Get-OwnSpaceManagedFiles`, `Get-OwnSpaceProtectedNames`, and `Copy-OwnSpaceManagedFiles -SourceRoot -DestinationRoot`.
- Consumes: Existing share-package file and directory lists.

- [x] **Step 1: Write failing contract tests**

```powershell
$root = Split-Path -Parent $PSScriptRoot
. (Join-Path $root "ownspace-release-files.ps1")

Describe "OwnSpace release file contract" {
  It "keeps user state out of managed paths" {
    $managed = @((Get-OwnSpaceManagedDirectories) + (Get-OwnSpaceManagedFiles))
    $managed | Should Not Contain "data"
    $managed | Should Not Contain ".env.local"
    $managed | Should Not Contain "backups"
    $managed | Should Not Contain "node_modules"
  }

  It "copies required updater and application files" {
    $source = Join-Path $TestDrive "source"
    $target = Join-Path $TestDrive "target"
    New-Item -ItemType Directory -Path (Join-Path $source "src") -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $source "src/app.ts") -Value "app"
    foreach ($file in Get-OwnSpaceManagedFiles) {
      New-Item -ItemType File -Path (Join-Path $source $file) -Force | Out-Null
    }
    Copy-OwnSpaceManagedFiles -SourceRoot $source -DestinationRoot $target
    Test-Path -LiteralPath (Join-Path $target "src/app.ts") | Should Be $true
    Test-Path -LiteralPath (Join-Path $target "ownspace-release-files.ps1") | Should Be $true
  }
}
```

- [x] **Step 2: Run the test and verify the helper is missing**

Run: `powershell.exe -NoProfile -Command "Invoke-Pester test/ownspace-release-files.Tests.ps1"`

Expected: FAIL because `ownspace-release-files.ps1` does not exist.

- [x] **Step 3: Implement one managed-file definition**

```powershell
function Get-OwnSpaceManagedDirectories { @("drizzle", "public", "scripts", "src") }
function Get-OwnSpaceManagedFiles {
  @(
    "drizzle.config.ts", "eslint.config.mjs", "next-env.d.ts", "next.config.ts",
    "package-lock.json", "package.json", "postcss.config.mjs", "README.md",
    "start-ownspace.cmd", "start-ownspace-functions.ps1", "start-ownspace.ps1",
    "ownspace-release-files.ps1",
    "tailwind.config.ts", "tsconfig.json", "项目工程约束.md"
  )
}
function Get-OwnSpaceProtectedNames {
  @("data", ".env.local", "backups", "node_modules", ".next-build", ".next-dev", ".git")
}
function Copy-OwnSpaceManagedFiles {
  param([string]$SourceRoot, [string]$DestinationRoot)
  New-Item -ItemType Directory -Path $DestinationRoot -Force | Out-Null
  foreach ($directory in Get-OwnSpaceManagedDirectories) {
    Copy-Item -LiteralPath (Join-Path $SourceRoot $directory) -Destination $DestinationRoot -Recurse
  }
  foreach ($file in Get-OwnSpaceManagedFiles) {
    Copy-Item -LiteralPath (Join-Path $SourceRoot $file) -Destination $DestinationRoot
  }
}
```

Update `make-share-package.ps1` to dot-source the helper and replace its private arrays/copy loops with `Copy-OwnSpaceManagedFiles`.

- [x] **Step 4: Run release contract and existing launcher tests**

Run: `powershell.exe -NoProfile -Command "Invoke-Pester test/ownspace-release-files.Tests.ps1,test/start-ownspace.Tests.ps1"`

Expected: all tests PASS and a generated share package still excludes protected names.

- [x] **Step 5: Commit the release contract**

```bash
git add ownspace-release-files.ps1 make-share-package.ps1 test/ownspace-release-files.Tests.ps1
git commit -m "refactor: centralize OwnSpace release files"
```

### Task 2: Validate versions, manifests, GitHub assets, and archives

**Files:**
- Modify: `ownspace-release-files.ps1`
- Create: `ownspace-update-functions.ps1`
- Create: `test/ownspace-update-validation.Tests.ps1`

**Interfaces:**
- Produces: `ConvertTo-OwnSpaceVersion`, `Test-OwnSpaceUpdateAvailable`, `Read-OwnSpaceUpdateManifest`, `Select-OwnSpaceReleaseAssets`, `Test-OwnSpaceUpdateArchive`, and `Assert-OwnSpaceChildPath`.
- Consumes: `Get-OwnSpaceProtectedNames` from Task 1.

- [ ] **Step 1: Write failing validation tests**

```powershell
$root = Split-Path -Parent $PSScriptRoot
. (Join-Path $root "ownspace-release-files.ps1")
. (Join-Path $root "ownspace-update-functions.ps1")

Describe "OwnSpace update validation" {
  It "only accepts a strictly newer semantic version" {
    Test-OwnSpaceUpdateAvailable -Current "3.1.0" -Candidate "3.1.1" | Should Be $true
    Test-OwnSpaceUpdateAvailable -Current "3.1.0" -Candidate "3.1.0" | Should Be $false
    { ConvertTo-OwnSpaceVersion "release-latest" } | Should Throw
  }

  It "requires the exact manifest contract" {
    $path = Join-Path $TestDrive "manifest.json"
    '{"schemaVersion":1,"version":"3.1.1","minimumUpdaterVersion":"3.1.0","archive":"OwnSpace-v3.1.1-update.zip","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","publishedAt":"2026-08-20T00:00:00Z"}' | Set-Content $path
    (Read-OwnSpaceUpdateManifest $path).version | Should Be "3.1.1"
  }

  It "rejects protected and traversal archive entries" {
    { Test-OwnSpaceArchiveEntry "../data/ownspace.db" } | Should Throw
    { Test-OwnSpaceArchiveEntry "data/ownspace.db" } | Should Throw
    { Test-OwnSpaceArchiveEntry "src/app/page.tsx" } | Should Not Throw
  }

  It "selects exact assets and rejects drafts or prereleases" {
    $release = [pscustomobject]@{ draft=$false; prerelease=$false; tag_name="v3.1.1"; assets=@(
      [pscustomobject]@{ name="OwnSpace-v3.1.1-manifest.json"; browser_download_url="https://github.com/brdhub/OwnSpace/releases/download/v3.1.1/OwnSpace-v3.1.1-manifest.json" },
      [pscustomobject]@{ name="OwnSpace-v3.1.1-update.zip"; browser_download_url="https://github.com/brdhub/OwnSpace/releases/download/v3.1.1/OwnSpace-v3.1.1-update.zip" },
      [pscustomobject]@{ name="OwnSpace-v3.1.1-update.sha256"; browser_download_url="https://github.com/brdhub/OwnSpace/releases/download/v3.1.1/OwnSpace-v3.1.1-update.sha256" }
    ) }
    (Select-OwnSpaceReleaseAssets $release).Count | Should Be 3
  }
}
```

- [ ] **Step 2: Run validation tests and verify missing functions fail**

Run: `powershell.exe -NoProfile -Command "Invoke-Pester test/ownspace-update-validation.Tests.ps1"`

Expected: FAIL with unresolved updater validation functions.

- [ ] **Step 3: Implement strict parsers and path guards**

```powershell
Set-StrictMode -Version Latest
$script:OwnSpaceRepository = "brdhub/OwnSpace"
$script:OwnSpaceUpdaterVersion = "3.1.0"
$script:OwnSpaceMaxManifestBytes = 32768
$script:OwnSpaceMaxArchiveBytes = 268435456
$script:OwnSpaceMaxExpandedBytes = 536870912
$script:OwnSpaceMaxArchiveEntries = 20000

function ConvertTo-OwnSpaceVersion([string]$Value) {
  if ($Value -notmatch '^v?(\d+)\.(\d+)\.(\d+)$') { throw "Invalid OwnSpace version: $Value" }
  [version]::new([int]$Matches[1], [int]$Matches[2], [int]$Matches[3])
}
function Test-OwnSpaceUpdateAvailable([string]$Current, [string]$Candidate) {
  (ConvertTo-OwnSpaceVersion $Candidate) -gt (ConvertTo-OwnSpaceVersion $Current)
}
function Assert-OwnSpaceChildPath([string]$Root, [string]$Path) {
  $resolvedRoot = [IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
  $resolvedPath = [IO.Path]::GetFullPath($Path)
  if (-not $resolvedPath.StartsWith($resolvedRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Path leaves the allowed root: $Path"
  }
  $resolvedPath
}
function Test-OwnSpaceArchiveEntry([string]$EntryName) {
  $normalized = $EntryName.Replace('/', '\')
  if ([IO.Path]::IsPathRooted($normalized) -or $normalized.Split('\') -contains '..') { throw "Unsafe archive path" }
  $top = $normalized.Split('\')[0]
  if ((Get-OwnSpaceProtectedNames) -contains $top) { throw "Archive contains protected path: $top" }
  $true
}
```

Implement manifest property/type checks, exact filename checks, SHA-256 syntax, GitHub host/repository URL checks, ZIP entry count/size checks, and archive hash verification with `Get-FileHash -Algorithm SHA256`.

Add `ownspace-update-functions.ps1` to `Get-OwnSpaceManagedFiles` only after the helper exists, keeping the share package valid at every commit.

- [ ] **Step 4: Run validation tests**

Run: `powershell.exe -NoProfile -Command "Invoke-Pester test/ownspace-update-validation.Tests.ps1"`

Expected: all validation tests PASS.

- [ ] **Step 5: Commit validation helpers**

```bash
git add ownspace-release-files.ps1 ownspace-update-functions.ps1 test/ownspace-update-validation.Tests.ps1
git commit -m "feat: validate OwnSpace update packages"
```

### Task 3: Implement backup, installation, health check, and rollback

**Files:**
- Modify: `ownspace-update-functions.ps1`
- Create: `test/ownspace-update-transaction.Tests.ps1`

**Interfaces:**
- Produces: `New-OwnSpaceUpdateBackup`, `Install-OwnSpaceArchive`, `Restore-OwnSpaceUpdateBackup`, `Invoke-OwnSpaceUpdatePackage`, `Enter-OwnSpaceUpdateLock`, and `Exit-OwnSpaceUpdateLock`.
- Consumes: Task 2 manifest/archive validation and path guards; existing `Stop-OwnSpaceServer` and npm invocation are injected as named commands that Pester can mock.

- [ ] **Step 1: Write failing successful-upgrade and rollback tests**

```powershell
Describe "OwnSpace transactional update" {
  BeforeEach {
    $app = Join-Path $TestDrive "OwnSpace"
    New-Item -ItemType Directory -Path "$app/data/resume-assets","$app/src" -Force | Out-Null
    Set-Content "$app/data/ownspace.db" "old-db"
    Set-Content "$app/data/resume-assets/resume.pdf" "pdf"
    Set-Content "$app/.env.local" "DEEPSEEK_API_KEY=secret"
    Set-Content "$app/src/version.txt" "old-code"
    Set-Content "$app/package.json" '{"name":"ownspace","version":"2.3.0"}'
  }

  It "preserves protected state after a successful update" {
    Mock Invoke-OwnSpacePostInstall { return $true }
    Invoke-OwnSpaceUpdatePackage -ApplicationRoot $app -ManifestPath $script:manifest -ArchivePath $script:archive -Source offline
    Get-Content "$app/data/ownspace.db" | Should Be "old-db"
    Get-Content "$app/data/resume-assets/resume.pdf" | Should Be "pdf"
    Get-Content "$app/.env.local" | Should Be "DEEPSEEK_API_KEY=secret"
    Get-Content "$app/src/version.txt" | Should Be "new-code"
  }

  It "restores code and data when post-install fails" {
    Mock Invoke-OwnSpacePostInstall { Set-Content "$app/data/ownspace.db" "migrated"; throw "build failed" }
    { Invoke-OwnSpaceUpdatePackage -ApplicationRoot $app -ManifestPath $script:manifest -ArchivePath $script:archive -Source offline } | Should Throw
    Get-Content "$app/data/ownspace.db" | Should Be "old-db"
    Get-Content "$app/src/version.txt" | Should Be "old-code"
  }
}
```

The fixture helper creates a valid ZIP and manifest using `Compress-Archive` and `Get-FileHash`; keep all fixture paths inside `$TestDrive`.

- [ ] **Step 2: Run transaction tests and verify the orchestrator is missing**

Run: `powershell.exe -NoProfile -Command "Invoke-Pester test/ownspace-update-transaction.Tests.ps1"`

Expected: FAIL because `Invoke-OwnSpaceUpdatePackage` is undefined.

- [ ] **Step 3: Implement the transaction boundary**

```powershell
function Invoke-OwnSpaceUpdatePackage {
  param([string]$ApplicationRoot, [string]$ManifestPath, [string]$ArchivePath, [ValidateSet('online','offline')][string]$Source)
  $lock = Enter-OwnSpaceUpdateLock -ApplicationRoot $ApplicationRoot
  $backup = $null
  try {
    $manifest = Read-OwnSpaceUpdateManifest $ManifestPath
    Test-OwnSpaceUpdateArchive -Manifest $manifest -ArchivePath $ArchivePath
    $staging = Expand-OwnSpaceUpdateArchive -ArchivePath $ArchivePath
    Stop-OwnSpaceServer -ProjectRoot $ApplicationRoot
    $backup = New-OwnSpaceUpdateBackup -ApplicationRoot $ApplicationRoot -CurrentVersion (Get-OwnSpaceInstalledVersion $ApplicationRoot)
    Install-OwnSpaceArchive -ApplicationRoot $ApplicationRoot -StagingRoot $staging -Backup $backup
    Invoke-OwnSpacePostInstall -ApplicationRoot $ApplicationRoot -PreviousLockHash $backup.LockHash
    Write-OwnSpaceUpdateResult -ApplicationRoot $ApplicationRoot -Version $manifest.version -Source $Source
    Remove-OldOwnSpaceBackups -ApplicationRoot $ApplicationRoot -Keep 3
  } catch {
    if ($backup) {
      Stop-OwnSpaceServer -ProjectRoot $ApplicationRoot
      Restore-OwnSpaceUpdateBackup -ApplicationRoot $ApplicationRoot -BackupRoot $backup.Root
      Invoke-OwnSpaceRollbackStart -ApplicationRoot $ApplicationRoot
    }
    throw
  } finally {
    Exit-OwnSpaceUpdateLock -Lock $lock
    Remove-OwnSpaceValidatedTemporaryPath -Path $staging
  }
}
```

`New-OwnSpaceUpdateBackup` stores `data`, `.env.local`, overwritten program files, a list of newly created targets, the old lockfile hash, and `backup.json`. `Restore-OwnSpaceUpdateBackup` validates roots, removes only targets listed as newly created, restores old program files, replaces current `data` with the backed-up copy, and restores or removes `.env.local` according to the manifest.

`Invoke-OwnSpacePostInstall` runs `npm ci` only if needed, then `db:migrate`, `db:init`, `build`, starts OwnSpace, and polls the health URL. It treats any nonzero command or health timeout as failure.

- [ ] **Step 4: Add lock, retention, and failure-phase tests**

Add cases that assert a second lock is rejected; dependency, migration, build, and health failures each restore old code/data; only the three newest successful backup directories are retained; and cleanup refuses a path outside `$ApplicationRoot\backups`.

- [ ] **Step 5: Run validation and transaction tests**

Run: `powershell.exe -NoProfile -Command "Invoke-Pester test/ownspace-update-validation.Tests.ps1,test/ownspace-update-transaction.Tests.ps1"`

Expected: all tests PASS with no file created outside `$TestDrive`.

- [ ] **Step 6: Commit the transactional engine**

```bash
git add ownspace-update-functions.ps1 test/ownspace-update-transaction.Tests.ps1
git commit -m "feat: add transactional OwnSpace updater"
```

### Task 4: Add Node discovery and prompted GitHub updates to startup

**Files:**
- Modify: `start-ownspace-functions.ps1`
- Modify: `start-ownspace.ps1`
- Modify: `test/start-ownspace.Tests.ps1`
- Modify: `项目工程约束.md`

**Interfaces:**
- Produces: `Find-OwnSpaceNodeRuntime -ApplicationRoot`, `Get-OwnSpaceLatestRelease`, `Receive-OwnSpaceReleaseAssets`, and `Invoke-OwnSpaceStartupUpdate`.
- Consumes: Task 2 asset selection and Task 3 `Invoke-OwnSpaceUpdatePackage`.

- [ ] **Step 1: Write failing Node discovery and startup fallback tests**

```powershell
Describe "OwnSpace startup update" {
  It "prefers a bundled runtime over the system runtime" {
    New-Item -ItemType File -Path "$TestDrive/.runtime/node.exe","$TestDrive/.runtime/npm.cmd" -Force | Out-Null
    (Find-OwnSpaceNodeRuntime -ApplicationRoot $TestDrive).Source | Should Be "bundled"
  }

  It "continues startup when GitHub is unavailable" {
    Mock Get-OwnSpaceLatestRelease { throw "offline" }
    Mock Invoke-OwnSpaceNormalStartup {}
    Invoke-OwnSpaceStartupUpdate -ApplicationRoot $TestDrive -CurrentVersion "3.1.0"
    Assert-MockCalled Invoke-OwnSpaceNormalStartup 1
    Assert-MockCalled Invoke-OwnSpaceUpdatePackage 0
  }

  It "does not update when the user skips" {
    Mock Get-OwnSpaceLatestRelease { $script:newRelease }
    Mock Read-Host { "N" }
    Invoke-OwnSpaceStartupUpdate -ApplicationRoot $TestDrive -CurrentVersion "3.1.0"
    Assert-MockCalled Invoke-OwnSpaceUpdatePackage 0
  }
}
```

- [ ] **Step 2: Run launcher tests and verify the new functions fail**

Run: `powershell.exe -NoProfile -Command "Invoke-Pester test/start-ownspace.Tests.ps1"`

Expected: FAIL on missing runtime/update functions.

- [ ] **Step 3: Implement compatible Node.js discovery**

```powershell
function Find-OwnSpaceNodeRuntime([string]$ApplicationRoot) {
  $candidates = @(
    @{ Source="bundled"; Node=(Join-Path $ApplicationRoot ".runtime/node.exe"); Npm=(Join-Path $ApplicationRoot ".runtime/npm.cmd") },
    @{ Source="path"; Node=(Get-Command node.exe -ErrorAction SilentlyContinue).Source; Npm=(Get-Command npm.cmd -ErrorAction SilentlyContinue).Source },
    @{ Source="system"; Node="$env:ProgramFiles\nodejs\node.exe"; Npm="$env:ProgramFiles\nodejs\npm.cmd" }
  )
  foreach ($candidate in $candidates) {
    if ($candidate.Node -and $candidate.Npm -and (Test-Path $candidate.Node) -and (Test-Path $candidate.Npm)) {
      $version = & $candidate.Node --version
      if (Test-OwnSpaceSupportedNodeVersion $version) { return [pscustomobject]$candidate }
    }
  }
  throw "OwnSpace requires Node.js 22 LTS."
}
```

Accept Node `20.16.0 <= x < 21.0.0` or `x >= 22.3.0`, matching `package.json#engines`. Remove the developer-specific `C:\Users\brddd\tools\...` path from `start-ownspace.ps1`.

- [ ] **Step 4: Implement GitHub discovery, prompt, and fail-open startup**

Use `https://api.github.com/repos/brdhub/OwnSpace/releases/latest`, `Invoke-RestMethod -TimeoutSec 4`, fixed `OwnSpace-Updater/3.1.0` User-Agent, JSON/asset count limits, and Task 2 exact asset selection. Download selected assets to a GUID temporary directory with `Invoke-WebRequest`; validate their final hosts against `github.com`, `api.github.com`, `objects.githubusercontent.com`, and `github-releases.githubusercontent.com` before Task 3 invocation.

```powershell
try {
  $release = Get-OwnSpaceLatestRelease
  if (Test-OwnSpaceUpdateAvailable -Current $currentVersion -Candidate $release.Version) {
    $answer = Read-Host "发现 OwnSpace v$($release.Version)。数据会先备份，立即升级？[y/N]"
    if ($answer -match '^(y|yes)$') {
      $assets = Receive-OwnSpaceReleaseAssets -Release $release
      Invoke-OwnSpaceUpdatePackage -ApplicationRoot $projectRoot -ManifestPath $assets.Manifest -ArchivePath $assets.Archive -Source online
      exit 0
    }
  }
} catch {
  Write-Host "暂时无法检查更新，将继续启动当前版本。" -ForegroundColor DarkYellow
}
Invoke-OwnSpaceNormalStartup
```

Register this fixed, read-only, user-confirmed GitHub Release metadata/asset access as an explicit external-call exception in `项目工程约束.md`.

- [ ] **Step 5: Run startup tests**

Run: `powershell.exe -NoProfile -Command "Invoke-Pester test/start-ownspace.Tests.ps1,test/ownspace-update-validation.Tests.ps1"`

Expected: all tests PASS; mocks prove no real network request occurs.

- [ ] **Step 6: Commit startup update support**

```bash
git add start-ownspace.ps1 start-ownspace-functions.ps1 test/start-ownspace.Tests.ps1 项目工程约束.md
git commit -m "feat: prompt for GitHub updates on startup"
```

### Task 5: Add the one-click offline updater

**Files:**
- Modify: `ownspace-release-files.ps1`
- Create: `offline-update-ownspace.cmd`
- Create: `offline-update-ownspace.ps1`
- Create: `test/offline-update-ownspace.Tests.ps1`

**Interfaces:**
- Produces: `Resolve-OwnSpaceApplicationRoot -CandidateRoot` and an offline `.cmd` entry point.
- Consumes: Task 2 validation and Task 3 shared update engine.

- [ ] **Step 1: Write failing application-root tests**

```powershell
Describe "Offline OwnSpace updater" {
  It "accepts an OwnSpace application directory" {
    Set-Content "$TestDrive/package.json" '{"name":"ownspace","version":"2.3.0"}'
    New-Item "$TestDrive/start-ownspace.cmd" -ItemType File | Out-Null
    Resolve-OwnSpaceApplicationRoot -CandidateRoot $TestDrive | Should Be ([IO.Path]::GetFullPath($TestDrive))
  }

  It "rejects an unrelated directory" {
    { Resolve-OwnSpaceApplicationRoot -CandidateRoot $TestDrive } | Should Throw
  }
}
```

- [ ] **Step 2: Run the offline tests and verify the resolver is missing**

Run: `powershell.exe -NoProfile -Command "Invoke-Pester test/offline-update-ownspace.Tests.ps1"`

Expected: FAIL on missing offline updater.

- [ ] **Step 3: Implement the offline entry**

`offline-update-ownspace.cmd` only launches the adjacent PowerShell script:

```bat
@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0offline-update-ownspace.ps1"
pause
```

`offline-update-ownspace.ps1` locates adjacent manifest/archive files, accepts its own directory when it contains a valid old OwnSpace installation, otherwise shows a `System.Windows.Forms.FolderBrowserDialog`, validates `package.json#name === "ownspace"` plus `start-ownspace.cmd`, then calls:

```powershell
Invoke-OwnSpaceUpdatePackage `
  -ApplicationRoot $applicationRoot `
  -ManifestPath $manifestPath `
  -ArchivePath $archivePath `
  -Source offline
```

Reject target versions less than or equal to the installed version before any backup or replacement.

Add both offline updater files to `Get-OwnSpaceManagedFiles` after creating them.

- [ ] **Step 4: Run offline and transaction tests**

Run: `powershell.exe -NoProfile -Command "Invoke-Pester test/offline-update-ownspace.Tests.ps1,test/ownspace-update-transaction.Tests.ps1"`

Expected: all tests PASS without displaying a real folder dialog.

- [ ] **Step 5: Commit the offline updater**

```bash
git add ownspace-release-files.ps1 offline-update-ownspace.cmd offline-update-ownspace.ps1 test/offline-update-ownspace.Tests.ps1
git commit -m "feat: add one-click offline updater"
```

### Task 6: Generate online and offline Release artifacts

**Files:**
- Create: `make-release-package.cmd`
- Create: `make-release-package.ps1`
- Create: `test/make-release-package.Tests.ps1`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `New-OwnSpaceReleaseArtifacts -ProjectRoot -OutputDirectory -PublishedAt`, update ZIP/hash/manifest/offline ZIP.
- Consumes: Task 1 managed files and Task 5 offline entry.

- [ ] **Step 1: Write a failing packaging test**

```powershell
Describe "OwnSpace release artifacts" {
  It "creates matching online and offline assets without user state" {
    $result = New-OwnSpaceReleaseArtifacts -ProjectRoot $script:fixture -OutputDirectory $TestDrive -PublishedAt ([datetime]"2026-08-20T00:00:00Z")
    Test-Path $result.Archive | Should Be $true
    Test-Path $result.Checksum | Should Be $true
    Test-Path $result.Manifest | Should Be $true
    Test-Path $result.OfflineArchive | Should Be $true
    (Get-FileHash $result.Archive -Algorithm SHA256).Hash.ToLowerInvariant() | Should Be $result.Sha256
    $entries = Read-TestZipEntries $result.Archive
    $entries -join "`n" | Should Not Match '(^|/)(data|node_modules|backups|\.env\.local)(/|$)'
  }
}
```

- [ ] **Step 2: Run the packaging test and verify the function is missing**

Run: `powershell.exe -NoProfile -Command "Invoke-Pester test/make-release-package.Tests.ps1"`

Expected: FAIL on missing release packager.

- [ ] **Step 3: Implement deterministic artifact generation**

Read and validate `package.json#version`, copy managed files into a temporary `OwnSpace` root, create `OwnSpace-v<version>-update.zip`, calculate SHA-256, write the exact manifest contract with UTF-8 without BOM, write the checksum file as `<hash>  <archive-name>`, then create the offline ZIP containing:

```text
升级 OwnSpace.cmd
offline-update-ownspace.ps1
ownspace-update-functions.ps1
ownspace-release-files.ps1
OwnSpace-v<version>-update.zip
OwnSpace-v<version>-update.sha256
OwnSpace-v<version>-manifest.json
```

Always use a GUID temporary directory and validated cleanup. Add generated `dist/` artifacts to `.gitignore` if not already ignored.

- [ ] **Step 4: Run release and share packaging tests**

Run: `powershell.exe -NoProfile -Command "Invoke-Pester test/make-release-package.Tests.ps1,test/ownspace-release-files.Tests.ps1"`

Expected: all tests PASS; ZIP/hash/manifest names match version `3.1.0`.

- [ ] **Step 5: Commit the release packager**

```bash
git add make-release-package.cmd make-release-package.ps1 test/make-release-package.Tests.ps1 .gitignore
git commit -m "build: generate OwnSpace release artifacts"
```

### Task 7: Release v3.1 documentation, versioning, and end-to-end verification

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/config/app-version.ts`
- Modify: `test/layout/app-version.test.ts`
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-08-20-ownspace-v3-1-updater.md`

**Interfaces:**
- Consumes: all updater and packaging entry points from Tasks 1–6.
- Produces: a documented v3.1 release candidate and checked plan completion state.

- [ ] **Step 1: Write the failing v3.1 release-history assertion**

```ts
assert.deepEqual(
  appReleases.map((release) => release.version),
  ["3.1", "2.3", "2.2", "2.1", "2.0"],
);
```

Run: `node.exe node_modules/tsx/dist/cli.mjs --test test/layout/app-version.test.ts`

Expected: FAIL because `3.1` is not yet first.

- [ ] **Step 2: Set version 3.1.0 and add release notes**

Run: `npm.cmd version 3.1.0 --no-git-tag-version`

Add `3.1` to `src/config/app-version.ts` with notes for startup GitHub prompts, one-click offline upgrades, protected local data, and automatic backup/rollback. Keep the release-history current-first invariant.

- [ ] **Step 3: Document installation, upgrades, recovery, and publishing**

Update README with exact user flows:

```text
Existing v2.3 user: extract the v3.1 offline updater, double-click “升级 OwnSpace.cmd”, select the old OwnSpace directory if asked.
v3.1 and later: double-click start-ownspace.cmd; choose y only when a newer official GitHub Release is shown.
Manual recovery: close OwnSpace, copy the selected backups/<timestamp>-v<version>/data directory back to data, then restore the matching program backup.
Publisher: run make-release-package.cmd, create a GitHub Release tagged v<package version>, upload all generated update/hash/manifest/offline assets.
```

Document that SHA-256 detects corruption but is not Authenticode signing, updates require HTTPS access to GitHub, and no user data or `.env.local` is included in release packages.

- [ ] **Step 4: Run all PowerShell tests**

Run: `powershell.exe -NoProfile -Command "Invoke-Pester test/*.Tests.ps1"`

Expected: all launcher, validation, transaction, offline, and packaging tests PASS.

- [ ] **Step 5: Run all TypeScript tests explicitly**

Run from PowerShell with Node 22 on PATH:

```powershell
$testFiles = @(rg --files src test | Where-Object { $_ -match '\.test\.ts$' })
node.exe node_modules\tsx\dist\cli.mjs --test @testFiles
```

Expected: all discovered tests PASS and the output reports more than zero tests.

- [ ] **Step 6: Run type, lint, build, and diff checks**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 7: Perform a v2.3-to-v3.1 temporary-copy rehearsal**

Create a temporary old-app fixture containing a v2.3 `package.json`, data marker, resume attachment marker, `.env.local`, and old code marker. Run the generated offline bundle against it with post-install commands pointed at fixture hooks. Verify:

```powershell
(Get-Content "$fixture/data/ownspace.db") | Should Be "old-db"
(Get-Content "$fixture/data/resume-assets/resume.pdf") | Should Be "old-pdf"
(Get-Content "$fixture/.env.local") | Should Be "DEEPSEEK_API_KEY=fixture-secret"
((Get-Content "$fixture/package.json" | ConvertFrom-Json).version) | Should Be "3.1.0"
```

Then force the health hook to fail and verify the same fixture returns to version `2.3.0` with all old markers restored.

- [ ] **Step 8: Generate and inspect final v3.1 artifacts**

Run: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./make-release-package.ps1 -NoPause`

Expected: `dist` contains the v3.1 update ZIP, checksum, manifest, and offline ZIP; archive inspection confirms no protected files.

- [ ] **Step 9: Mark completed checkboxes and commit the release candidate**

```bash
git add -A
git commit -m "release: add OwnSpace v3.1 safe updates"
```

Do not push or create a GitHub Release until the user explicitly requests publication.
