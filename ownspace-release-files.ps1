function Get-OwnSpaceManagedDirectories {
  @("drizzle", "public", "scripts", "src")
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
    "tailwind.config.ts",
    "tsconfig.json",
    "项目工程约束.md"
  )
}

function Get-OwnSpaceProtectedNames {
  @("data", ".env.local", "backups", "node_modules", ".next-build", ".next-dev", ".git")
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
