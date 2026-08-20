$projectRoot = Split-Path -Parent $PSScriptRoot
$helperPath = Join-Path $projectRoot "ownspace-release-files.ps1"

Describe "OwnSpace release file contract" {
  It "keeps user state out of managed paths" {
    . $helperPath
    $managed = @((Get-OwnSpaceManagedDirectories) + (Get-OwnSpaceManagedFiles))

    ($managed -contains "data") | Should Be $false
    ($managed -contains ".env.local") | Should Be $false
    ($managed -contains "backups") | Should Be $false
    ($managed -contains "node_modules") | Should Be $false
  }

  It "copies required application files without protected state" {
    . $helperPath
    $source = Join-Path $TestDrive "source"
    $target = Join-Path $TestDrive "target"
    New-Item -ItemType Directory -Path (Join-Path $source "src") -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $source "src/app.ts") -Value "app"
    foreach ($directory in Get-OwnSpaceManagedDirectories) {
      New-Item -ItemType Directory -Path (Join-Path $source $directory) -Force | Out-Null
    }
    foreach ($file in Get-OwnSpaceManagedFiles) {
      New-Item -ItemType File -Path (Join-Path $source $file) -Force | Out-Null
    }
    New-Item -ItemType Directory -Path (Join-Path $source "data") -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $source "data/ownspace.db") -Value "private"

    Copy-OwnSpaceManagedFiles -SourceRoot $source -DestinationRoot $target

    Test-Path -LiteralPath (Join-Path $target "src/app.ts") | Should Be $true
    Test-Path -LiteralPath (Join-Path $target "ownspace-release-files.ps1") | Should Be $true
    Test-Path -LiteralPath (Join-Path $target "data") | Should Be $false
  }
}
