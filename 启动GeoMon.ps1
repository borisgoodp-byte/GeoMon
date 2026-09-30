# GeoMon 平台一键启动（便携 MariaDB + 生产构建的应用服务）
# 用法：右键“使用 PowerShell 运行”，或在终端执行  powershell -File 启动GeoMon.ps1

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$app  = Join-Path $root 'kimi-agent-platform\app'

# 1) 数据库：3306 未监听时才启动
if (-not (Test-NetConnection 127.0.0.1 -Port 3306 -WarningAction SilentlyContinue).TcpTestSucceeded) {
    Start-Process -FilePath (Join-Path $root 'mariadb\bin\mariadbd.exe') `
        -ArgumentList '--datadir="D:/Devin专属/GeoMon平台/mariadb-data"','--port=3306','--console','--character-set-server=utf8mb4','--collation-server=utf8mb4_unicode_ci' `
        -WindowStyle Hidden
    Write-Host 'MariaDB 已启动 (127.0.0.1:3306)'
    Start-Sleep 3
} else {
    Write-Host 'MariaDB 已在运行'
}

# 2) 应用：3000 未监听时才启动（需先 npm run build 产出 dist\boot.js）
if (-not (Test-NetConnection 127.0.0.1 -Port 3000 -WarningAction SilentlyContinue).TcpTestSucceeded) {
    Start-Process -FilePath 'node' -ArgumentList 'dist\boot.js' -WorkingDirectory $app `
        -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $root 'app.log') `
        -RedirectStandardError  (Join-Path $root 'app.err.log')
    Write-Host '应用已启动  http://localhost:3000/'
} else {
    Write-Host '应用已在运行  http://localhost:3000/'
}

# 3) 打开浏览器
Start-Process 'http://localhost:3000/'
