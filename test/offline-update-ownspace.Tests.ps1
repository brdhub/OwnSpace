$projectRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $projectRoot "offline-update-ownspace.ps1") -NoRun

Describe "Offline OwnSpace updater" {
  It "accepts an OwnSpace application directory" {
    [IO.File]::WriteAllText((Join-Path $TestDrive "package.json"), '{"name":"ownspace","version":"2.3.0"}')
    New-Item -ItemType File -Path (Join-Path $TestDrive "start-ownspace.cmd") | Out-Null

    $resolved = Resolve-OwnSpaceApplicationRoot -CandidateRoot $TestDrive

    $resolved | Should Be ([IO.Path]::GetFullPath($TestDrive))
  }

  It "rejects an unrelated directory" {
    $unrelated = Join-Path $TestDrive "unrelated"
    New-Item -ItemType Directory -Path $unrelated | Out-Null
    { Resolve-OwnSpaceApplicationRoot -CandidateRoot $unrelated } | Should Throw "The selected directory is not an OwnSpace installation."
  }
}
