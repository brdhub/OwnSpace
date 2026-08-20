function Get-OwnSpaceManagedDirectories {
  @("drizzle", "public", "scripts", "src")
}

function Get-OwnSpaceEngineeringConstraintsFileName {
  [string]::Concat([char]39033, [char]30446, [char]24037, [char]31243, [char]32422, [char]26463, ".md")
}

function Get-OwnSpaceManagedFiles {
  @(
    "drizzle.config.ts",
    "eslint.config.mjs",
    "next-env.d.ts",
    "next.config.ts",
    "package-lock.json",
    "package.json",
    "postcss.config.mjs",
    "README.md",
    "start-ownspace.cmd",
    "start-ownspace-functions.ps1",
    "start-ownspace.ps1",
    "ownspace-release-files.ps1",
    "ownspace-update-functions.ps1",
    "offline-update-ownspace.cmd",
    "offline-update-ownspace.ps1",
    "tailwind.config.ts",
    "tsconfig.json",
    (Get-OwnSpaceEngineeringConstraintsFileName)
  )
}

function Get-OwnSpaceProtectedNames {
  @("data", ".env.local", "backups", "node_modules", ".next-build", ".next-dev", ".git", ".ownspace-update.lock")
}

function Copy-OwnSpaceManagedFiles {
  param(
    [Parameter(Mandatory = $true)]
    [string]$SourceRoot,
    [Parameter(Mandatory = $true)]
    [string]$DestinationRoot
  )

  New-Item -ItemType Directory -Path $DestinationRoot -Force | Out-Null
  foreach ($directory in Get-OwnSpaceManagedDirectories) {
    Copy-Item -LiteralPath (Join-Path $SourceRoot $directory) -Destination $DestinationRoot -Recurse
  }
  foreach ($file in Get-OwnSpaceManagedFiles) {
    Copy-Item -LiteralPath (Join-Path $SourceRoot $file) -Destination $DestinationRoot
  }
}
