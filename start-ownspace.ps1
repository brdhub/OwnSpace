$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = "http://localhost:3000"
$projectNodeRoot = "C:\Users\brddd\tools\node-v22.22.3-win-x64"
$projectNodeExe = Join-Path $projectNodeRoot "node.exe"
$projectNpmCmd = Join-Path $projectNodeRoot "npm.cmd"

function Test-OwnSpaceServer {
  try {
    Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Invoke-NpmCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,
    [Parameter(Mandatory = $true)]
    [string]$Description
  )

  Write-Host $Description -ForegroundColor Cyan
  & $projectNpmCmd @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Description failed. npm exit code: $LASTEXITCODE"
  }
}

function Test-OwnSpaceBuildRequired {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BuildIdPath
  )

  if (-not (Test-Path -LiteralPath $BuildIdPath)) {
    return $true
  }

  $buildTime = (Get-Item -LiteralPath $BuildIdPath).LastWriteTimeUtc
  $sourceDirectories = @("src", "public")
  $buildFiles = @(
    "next.config.ts",
    "package.json",
    "package-lock.json",
    "postcss.config.mjs",
    "tailwind.config.ts",
    "tsconfig.json"
  )

  foreach ($directory in $sourceDirectories) {
    $path = Join-Path $projectRoot $directory
    if (
      (Test-Path -LiteralPath $path) -and
      (Get-ChildItem -LiteralPath $path -Recurse -File | Where-Object { $_.LastWriteTimeUtc -gt $buildTime } | Select-Object -First 1)
    ) {
      return $true
    }
  }

  foreach ($file in $buildFiles) {
    $path = Join-Path $projectRoot $file
    if ((Test-Path -LiteralPath $path) -and (Get-Item -LiteralPath $path).LastWriteTimeUtc -gt $buildTime) {
      return $true
    }
  }

  return $false
}

function Stop-OwnSpaceServer {
  $connection = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $connection) {
    return
  }

  $serverProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($connection.OwningProcess)"
  if (-not $serverProcess.CommandLine -or -not $serverProcess.CommandLine.Contains($projectRoot)) {
    throw "Port 3000 is occupied by another program. Close it before starting OwnSpace."
  }

  Write-Host "Stopping the previous OwnSpace server..." -ForegroundColor Cyan
  & taskkill.exe /PID $connection.OwningProcess /T /F | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "The previous OwnSpace server could not be stopped."
  }
}

. (Join-Path $projectRoot "start-ownspace-functions.ps1")

Set-Location -LiteralPath $projectRoot

if (-not (Test-Path -LiteralPath $projectNodeExe) -or -not (Test-Path -LiteralPath $projectNpmCmd)) {
  Write-Host "OwnSpace cannot find its project Node.js runtime at $projectNodeRoot." -ForegroundColor Yellow
  Write-Host "Extract Node.js 22 LTS there, then double-click start-ownspace.cmd again." -ForegroundColor Yellow
  Read-Host "Press Enter to exit"
  exit 1
}

$env:Path = "$projectNodeRoot;$env:Path"

try {
  $nodeModulesPath = Join-Path $projectRoot "node_modules"
  $packageLockPath = Join-Path $projectRoot "package-lock.json"
  $installedLockPath = Join-Path $nodeModulesPath ".package-lock.json"
  $dependenciesNeedInstall =
    -not (Test-Path -LiteralPath $nodeModulesPath) -or
    (
      (Test-Path -LiteralPath $packageLockPath) -and
      (
        -not (Test-Path -LiteralPath $installedLockPath) -or
        (Get-Item -LiteralPath $packageLockPath).LastWriteTimeUtc -gt (Get-Item -LiteralPath $installedLockPath).LastWriteTimeUtc
      )
    )

  if ($dependenciesNeedInstall) {
    Install-OwnSpaceDependencies
  }

  Invoke-NpmCommand -Arguments @("run", "db:migrate") -Description "Checking the database schema..."
  Invoke-NpmCommand -Arguments @("run", "db:init") -Description "Initializing system defaults..."

  $buildIdPath = Join-Path $projectRoot ".next-build\BUILD_ID"
  if (Test-OwnSpaceBuildRequired -BuildIdPath $buildIdPath) {
    Stop-OwnSpaceServer
    Invoke-NpmCommand -Arguments @("run", "build") -Description "Updates detected: rebuilding OwnSpace (this may take a few minutes)..."
  }
} catch {
  Write-Host "`nOwnSpace setup failed: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Review the error above, close any OwnSpace development server if mentioned, then try again." -ForegroundColor Yellow
  Read-Host "Press Enter to exit"
  exit 1
}

if (-not (Test-OwnSpaceServer)) {
  $startCommand = "`$env:Path = `"$projectNodeRoot;`$env:Path`"; Set-Location -LiteralPath `"$projectRoot`"; & `"$projectNpmCmd`" run start"
  $encodedStartCommand = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($startCommand))
  Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-EncodedCommand", $encodedStartCommand) -WorkingDirectory $projectRoot

  Write-Host "OwnSpace is starting..." -ForegroundColor Cyan
  for ($attempt = 0; $attempt -lt 90; $attempt++) {
    if (Test-OwnSpaceServer) {
      break
    }
    Start-Sleep -Seconds 1
  }
}

Start-Process $url


