$helperPath = Join-Path (Split-Path -Parent $PSScriptRoot) "start-ownspace-functions.ps1"
function Stop-OwnSpaceServer {}
function Invoke-NpmCommand {}
. $helperPath

Describe "Install-OwnSpaceDependencies" {
  It "stops the running OwnSpace server before npm replaces native modules" {
    $script:callOrder = @()
    Mock Stop-OwnSpaceServer { $script:callOrder += "stop" }
    Mock Invoke-NpmCommand { $script:callOrder += "install" }

    Install-OwnSpaceDependencies

    ($script:callOrder -join ",") | Should Be "stop,install"
    Assert-MockCalled Invoke-NpmCommand 1
  }
}

Describe "OwnSpace Node runtime discovery" {
  It "accepts the supported Node version ranges" {
    Test-OwnSpaceSupportedNodeVersion "v20.16.0" | Should Be $true
    Test-OwnSpaceSupportedNodeVersion "v20.15.9" | Should Be $false
    Test-OwnSpaceSupportedNodeVersion "v21.9.0" | Should Be $false
    Test-OwnSpaceSupportedNodeVersion "v22.3.0" | Should Be $true
    Test-OwnSpaceSupportedNodeVersion "v24.0.0" | Should Be $true
  }

  It "prefers a bundled compatible runtime" {
    $runtimeRoot = Join-Path $TestDrive ".runtime"
    New-Item -ItemType Directory -Path $runtimeRoot | Out-Null
    New-Item -ItemType File -Path (Join-Path $runtimeRoot "node.exe") | Out-Null
    Set-Content -LiteralPath (Join-Path $runtimeRoot "npm.cmd") -Value "@exit /b 0"
    Mock Get-OwnSpaceNodeVersion { "v22.22.3" }

    $runtime = Find-OwnSpaceNodeRuntime -ApplicationRoot $TestDrive

    $runtime.Source | Should Be "bundled"
    $runtime.Node | Should Be (Join-Path $runtimeRoot "node.exe")
  }

  It "skips a supported Node runtime when its paired npm cannot start" {
    $originalNvmHome = $env:NVM_HOME
    $originalPath = $env:Path
    $applicationRoot = Join-Path $TestDrive "broken-pair"
    $bundledRoot = Join-Path $applicationRoot ".runtime"
    $nvmHome = Join-Path $TestDrive "nvm"
    $workingRoot = Join-Path $nvmHome "v24.16.0"
    New-Item -ItemType Directory -Path $bundledRoot, $workingRoot -Force | Out-Null
    New-Item -ItemType File -Path (Join-Path $bundledRoot "node.exe"), (Join-Path $workingRoot "node.exe") | Out-Null
    Set-Content -LiteralPath (Join-Path $bundledRoot "npm.cmd") -Value "@exit /b 7"
    Set-Content -LiteralPath (Join-Path $workingRoot "npm.cmd") -Value "@exit /b 0"
    $env:NVM_HOME = $nvmHome
    $env:Path = $TestDrive
    Mock Get-OwnSpaceNodeVersion { "v24.16.0" }

    try {
      $runtime = Find-OwnSpaceNodeRuntime -ApplicationRoot $applicationRoot

      $runtime.Source | Should Be "nvm"
      $runtime.Node | Should Be (Join-Path $workingRoot "node.exe")
      $runtime.Npm | Should Be (Join-Path $workingRoot "npm.cmd")
    } finally {
      $env:NVM_HOME = $originalNvmHome
      $env:Path = $originalPath
    }
  }

  It "uses an installed NVM runtime when the active Node version is incompatible" {
    $originalNvmHome = $env:NVM_HOME
    $originalPath = $env:Path
    $nvmHome = Join-Path $TestDrive "nvm"
    $runtimeRoot = Join-Path $nvmHome "v22.22.3"
    New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
    New-Item -ItemType File -Path (Join-Path $runtimeRoot "node.exe") | Out-Null
    Set-Content -LiteralPath (Join-Path $runtimeRoot "npm.cmd") -Value "@exit /b 0"
    $env:NVM_HOME = $nvmHome
    $env:Path = $TestDrive
    Mock Get-OwnSpaceNodeVersion {
      param($NodePath)
      if ($NodePath -eq (Join-Path $runtimeRoot "node.exe")) { return "v22.22.3" }
      return "v16.20.2"
    }

    try {
      $runtime = Find-OwnSpaceNodeRuntime -ApplicationRoot $TestDrive

      $runtime.Source | Should Be "nvm"
      $runtime.Node | Should Be (Join-Path $runtimeRoot "node.exe")
    } finally {
      $env:NVM_HOME = $originalNvmHome
      $env:Path = $originalPath
    }
  }
}

Describe "OwnSpace startup update" {
  It "continues startup when GitHub is unavailable" {
    Mock Get-OwnSpaceLatestRelease { throw "offline" }

    $result = Invoke-OwnSpaceStartupUpdate -ApplicationRoot $TestDrive -CurrentVersion "3.1.0"

    $result | Should Be "continue"
  }

  It "continues without downloading when the user skips" {
    Mock Get-OwnSpaceLatestRelease { [pscustomobject]@{ Version="3.2.0" } }
    Mock Read-Host { "N" }
    Mock Receive-OwnSpaceReleaseAssets { throw "must not download" }

    $result = Invoke-OwnSpaceStartupUpdate -ApplicationRoot $TestDrive -CurrentVersion "3.1.0"

    $result | Should Be "continue"
  }

  It "installs a confirmed newer release" {
    $script:updateInvoked = $false
    Mock Get-OwnSpaceLatestRelease { [pscustomobject]@{ Version="3.2.0" } }
    Mock Read-Host { "y" }
    Mock Receive-OwnSpaceReleaseAssets { [pscustomobject]@{ Manifest="manifest.json"; Archive="update.zip"; Root=$TestDrive } }
    Mock Invoke-OwnSpaceUpdatePackage { $script:updateInvoked = $true }
    Mock Remove-OwnSpaceTemporaryPath {}

    $result = Invoke-OwnSpaceStartupUpdate -ApplicationRoot $TestDrive -CurrentVersion "3.1.0"

    $result | Should Be "updated"
    $script:updateInvoked | Should Be $true
  }
}
