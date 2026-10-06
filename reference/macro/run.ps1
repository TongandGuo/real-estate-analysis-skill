param(
 [ValidateSet("build","validate","test","ingest")][string]$Action="build",
 [string]$Batch,
 [string]$NodeExe="$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe",
 [string]$NodeModules="$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules"
)
$ErrorActionPreference="Stop"
$projectRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
if(!(Test-Path -LiteralPath $NodeExe)){throw "Node不可用：先通过load_workspace_dependencies获取运行时，使用-NodeExe和-NodeModules指定。"}
if($Action -ne "build"){
 $nodeArgs=@((Join-Path $PSScriptRoot 'core.mjs'),$Action)
 if($Action -eq "ingest"){
  if(!$Batch){throw "ingest需要-Batch绝对路径"}
  $nodeArgs+=[IO.Path]::GetFullPath($Batch)
 }
 & $NodeExe @nodeArgs
 if($LASTEXITCODE -ne 0){throw "数据校验或入库失败"}
 exit 0
}
if(!(Test-Path -LiteralPath (Join-Path $NodeModules '@oai\artifact-tool'))){throw "artifact-tool运行时不可用"}
$runtimePath=Join-Path $projectRoot 'Output\macro\.runtime'
New-Item -ItemType Directory -Force -Path $runtimePath | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'core.mjs') -Destination (Join-Path $runtimePath 'core.mjs')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'build.mjs') -Destination (Join-Path $runtimePath 'build.mjs')
$linkPath=Join-Path $runtimePath 'node_modules'
if(!(Test-Path -LiteralPath $linkPath)){New-Item -ItemType Junction -Path $linkPath -Target $NodeModules | Out-Null}
$previousRoot=$env:REAL_ESTATE_PROJECT_ROOT
try{
 $env:REAL_ESTATE_PROJECT_ROOT=$projectRoot
 & $NodeExe (Join-Path $runtimePath 'build.mjs')
 if($LASTEXITCODE -ne 0){throw "工作簿生成失败；原始观测已保留"}
}finally{$env:REAL_ESTATE_PROJECT_ROOT=$previousRoot}
