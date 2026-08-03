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
