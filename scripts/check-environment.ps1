$ErrorActionPreference = "Stop"

$requiredNodeMajor = 24
$requiredPnpmMajor = 11
$failed = $false

function Write-Check {
  param(
    [string]$Name,
    [bool]$Passed,
    [string]$Detail
  )

  if ($Passed) {
    Write-Host "[OK]   $Name - $Detail" -ForegroundColor Green
  }
  else {
    Write-Host "[FAIL] $Name - $Detail" -ForegroundColor Red
    $script:failed = $true
  }
}

function Write-OptionalCheck {
  param(
    [string]$Name,
    [bool]$Passed,
    [string]$Detail
  )

  if ($Passed) {
    Write-Host "[OK]   $Name - $Detail" -ForegroundColor Green
  }
  else {
    Write-Host "[INFO] $Name - $Detail" -ForegroundColor Yellow
  }
}

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) {
  $nodeVersion = (& node --version).Trim()
  $nodeMajor = [int]($nodeVersion -replace "^v", "").Split(".")[0]
  Write-Check "Node.js" ($nodeMajor -eq $requiredNodeMajor) "$nodeVersion (required major: $requiredNodeMajor)"
}
else {
  Write-Check "Node.js" $false "node was not found in PATH"
}

$pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
if ($pnpmCommand) {
  $pnpmVersion = (& pnpm --version).Trim()
  $pnpmMajor = [int]$pnpmVersion.Split(".")[0]
  Write-Check "pnpm" ($pnpmMajor -eq $requiredPnpmMajor) "$pnpmVersion (required major: $requiredPnpmMajor)"
}
else {
  Write-Check "pnpm" $false "pnpm was not found in PATH"
}

$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
$perUserDocker = Join-Path $env:LOCALAPPDATA "Programs\DockerDesktop\resources\bin\docker.exe"
$machineDocker = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
$dockerPath = if ($dockerCommand) {
  $dockerCommand.Source
}
elseif (Test-Path $perUserDocker) {
  $perUserDocker
}
elseif (Test-Path $machineDocker) {
  $machineDocker
}
else {
  $null
}

if ($dockerPath) {
  $dockerVersion = (& $dockerPath --version).Trim()
  $dockerReady = $false
  try {
    & $dockerPath info *> $null
    $dockerReady = $LASTEXITCODE -eq 0
  }
  catch {
    $dockerReady = $false
  }

  Write-OptionalCheck "Docker CLI" $true $dockerVersion
  Write-OptionalCheck "Docker engine" $dockerReady $(if ($dockerReady) { "ready" } else { "not running" })
}
else {
  Write-OptionalCheck "Docker" $false "not installed; install Docker Desktop before running pnpm infra:up"
}

Write-Check "Dependencies" (Test-Path "node_modules") $(if (Test-Path "node_modules") { "installed" } else { "run pnpm install" })
Write-Check "Environment template" (Test-Path ".env.example") ".env.example"

if (Test-Path ".env") {
  Write-OptionalCheck "Local environment" $true ".env exists"
}
else {
  Write-OptionalCheck "Local environment" $false "copy .env.example to .env and fill provider keys when required"
}

if ($failed) {
  exit 1
}

Write-Host ""
Write-Host "Required development tools are ready." -ForegroundColor Green
