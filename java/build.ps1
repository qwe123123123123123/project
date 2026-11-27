param([string]$Destination = 'build/nextplay-java.jar', [string]$Jdk = $env:JAVA_HOME)

$ErrorActionPreference = 'Stop'
$project = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$destinationPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Destination)
$classes = Join-Path $project ('build/java-classes-' + [Guid]::NewGuid().ToString('N'))
$catalog = Join-Path $classes 'catalog.tsv'
$web = Join-Path $classes 'web'
$javac = if ($Jdk) { Join-Path $Jdk 'bin/javac.exe' } else { 'javac' }
$jar = if ($Jdk) { Join-Path $Jdk 'bin/jar.exe' } else { 'jar' }

New-Item -ItemType Directory -Force -Path $classes, $web, (Split-Path $destinationPath) | Out-Null
& node (Join-Path $project 'scripts/export-java-catalog.mjs') $catalog
if ($LASTEXITCODE -ne 0) { throw 'Catalog export failed' }
Copy-Item (Join-Path $project 'dist/*') -Destination $web -Recurse -Force
$sources = Get-ChildItem (Join-Path $PSScriptRoot 'src/nextplay') -Filter '*.java' |
    Select-Object -ExpandProperty FullName
& $javac -source 21 -target 21 -encoding UTF-8 -d $classes $sources
if ($LASTEXITCODE -ne 0) { throw 'Java compilation failed' }
& $jar --create --file $destinationPath --main-class nextplay.NextplayServer -C $classes .
if ($LASTEXITCODE -ne 0) { throw 'JAR packaging failed' }
Write-Output $destinationPath
