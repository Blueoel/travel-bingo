param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet("up", "down", "logs", "status")]
  [string]$Action
)

$ErrorActionPreference = "Stop"

$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
$dockerPath = if ($dockerCommand) {
  $dockerCommand.Source
}
else {
  $perUserDocker = Join-Path $env:LOCALAPPDATA "Programs\DockerDesktop\resources\bin\docker.exe"
  $machineDocker = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"

  if (Test-Path $perUserDocker) {
    $perUserDocker
  }
  elseif (Test-Path $machineDocker) {
    $machineDocker
  }
  else {
    throw "Docker CLI was not found. Install and start Docker Desktop."
  }
}

switch ($Action) {
  "up" {
    & $dockerPath compose -f compose.dev.yml up -d --wait postgres redis minio
    if ($LASTEXITCODE -eq 0) {
      & $dockerPath compose -f compose.dev.yml run --rm minio-init
    }
  }
  "down" {
    & $dockerPath compose -f compose.dev.yml down
  }
  "logs" {
    & $dockerPath compose -f compose.dev.yml logs -f
  }
  "status" {
    & $dockerPath compose -f compose.dev.yml ps
  }
}

exit $LASTEXITCODE
