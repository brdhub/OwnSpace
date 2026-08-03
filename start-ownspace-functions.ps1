function Install-OwnSpaceDependencies {
  Stop-OwnSpaceServer
  Invoke-NpmCommand -Arguments @("ci") -Description "Installing or updating dependencies (internet required)..."
}
