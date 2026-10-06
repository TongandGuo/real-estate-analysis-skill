param(
 [ValidateSet('Build','Verify','Ingest')][string]$Action='Build',
 [string]$Batch='',
 [string]$Python=''
)
$ErrorActionPreference='Stop'
if(-not $Python){$Python=Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'}
if(-not(Test-Path -LiteralPath $Python)){throw 'Python runtime missing. Supply -Python.'}
$script=Join-Path $PSScriptRoot 'registry.py'
switch($Action){
 'Build' { & $Python $script build }
 'Verify' { & $Python $script verify }
 'Ingest' {
  if(-not $Batch){throw 'Supply -Batch path for Ingest'}
  & $Python $script ingest --batch $Batch
  if($LASTEXITCODE -eq 0){ & $Python $script build }
 }
}
if($LASTEXITCODE -ne 0){throw "Micro workflow failed: $LASTEXITCODE"}
