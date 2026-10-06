param(
 [ValidateSet('Build','Refresh')][string]$Action='Build',
 [string]$Python='',
 [string]$AsOf=(Get-Date -Format 'yyyy-MM-dd'),
 [string]$Batch=''
)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
if(-not $Python){$Python=Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'}
if(-not(Test-Path -LiteralPath $Python)){throw 'Python runtime missing. Supply -Python with Python 3 and openpyxl installed.'}
$env:PYTHONIOENCODING='utf-8'
if($Batch){
 & $Python (Join-Path $PSScriptRoot 'refresh.py') --batch $Batch --as-of $AsOf
 if($LASTEXITCODE -ne 0){throw "Import failed: $LASTEXITCODE"};return
}
if($Action -eq 'Build'){
 & $Python (Join-Path $PSScriptRoot 'build.py')
 if($LASTEXITCODE -ne 0){throw "Build failed: $LASTEXITCODE"};return
}
$incoming=Join-Path $root ('Output/trends/.incoming/'+(Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
New-Item -ItemType Directory -Path $incoming -Force | Out-Null
$year=([datetime]$AsOf).Year
$sources=@(
 @{id='greix';file='greix.json';url="https://api.greixx.net/api-v1/cities/metrics/?lng=en&cities=1,10,2&prop_types=3&inflation=false&data_index=true&per_year=false&from_year=2015&to_year=$year&from_quarter=1&to_quarter=4"},
 @{id='ecb';file='de_rates.csv';url='https://data-api.ecb.europa.eu/service/data/MIR/M.DE.B.A2C.A.R.A.2250.EUR.N?format=csvdata&startPeriod=2015-01'},
 @{id='pmms';file='us_rates.xlsx';url='https://www.freddiemac.com/pmms/docs/historicalweeklydata.xlsx'}
)
$manifest=foreach($source in $sources){
 try{Invoke-WebRequest -Uri $source.url -OutFile (Join-Path $incoming $source.file) -TimeoutSec 50;$source.status='downloaded'}
 catch{$source.status='download_failed';$source.error=$_.Exception.Message}
 $source
}
ConvertTo-Json -InputObject @($manifest) -Depth 5 | Set-Content -LiteralPath (Join-Path $incoming 'manifest.json') -Encoding utf8
& $Python (Join-Path $PSScriptRoot 'refresh.py') --incoming $incoming --as-of $AsOf
$exit=$LASTEXITCODE
if($exit -eq 0){
 # Cleanup is confined to this run's verified directory; failed runs retain evidence.
 $resolved=[IO.Path]::GetFullPath($incoming)
 $allowed=[IO.Path]::GetFullPath((Join-Path $root 'Output/trends/.incoming'))+[IO.Path]::DirectorySeparatorChar
 if(-not $resolved.StartsWith($allowed,[StringComparison]::OrdinalIgnoreCase)){throw 'Unsafe cleanup target'}
 Get-ChildItem -LiteralPath $resolved -File | ForEach-Object {Remove-Item -LiteralPath $_.FullName}
 Remove-Item -LiteralPath $resolved
}else{throw "Refresh failed or partly failed ($exit). See Output/trends/refresh_log.jsonl; old values retained for failed sources."}
