$ErrorActionPreference = 'Stop'
$extensions = @('.ts', '.tsx', '.json', '.css', '.html', '.md', '.d.ts')
$files = Get-ChildItem -Path . -Recurse -File | Where-Object {
    $_.FullName -notmatch '[\\/](node_modules|dist|\.git)[\\/]' -and
    ($extensions -contains $_.Extension -or $_.Name -eq '.editorconfig')
}
$invalid = @()
$utf8 = New-Object System.Text.UTF8Encoding($false, $true)
foreach ($file in $files) {
    try {
        [void]$utf8.GetString([System.IO.File]::ReadAllBytes($file.FullName))
    }
    catch {
        $invalid += $file.FullName
    }
}
if ($invalid.Count -gt 0) {
    Write-Host 'These files are not valid UTF-8:' -ForegroundColor Red
    $invalid | ForEach-Object { Write-Host " - $_" }
    exit 1
}
Write-Host "OK: $($files.Count) source/documentation files are valid UTF-8." -ForegroundColor Green
