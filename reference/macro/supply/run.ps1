param(
  [ValidateSet('Refresh','Build','Validate','Ingest','Test')][string]$Action='Refresh',
  [string]$Batch,
  [string]$NodeExe="$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
)
$ErrorActionPreference='Stop'
if(!(Test-Path -LiteralPath $NodeExe)){throw "Node 不可用：$NodeExe"}
$argsForNode=@((Join-Path $PSScriptRoot 'update.mjs'),$Action.ToLowerInvariant())
if($Action -eq 'Ingest'){
  if(!$Batch){throw 'Ingest 需要 -Batch 路径'}
  $argsForNode += [IO.Path]::GetFullPath($Batch)
}
& $NodeExe @argsForNode
if($LASTEXITCODE -ne 0){throw "柏林挂牌供给 $Action 失败，旧数据已保留"}
