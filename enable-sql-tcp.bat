@echo off
setlocal enabledelayedexpansion
echo === 启用 SQL Server TCP/IP 协议 ===
echo.
echo 请右键此文件 -> "以管理员身份运行"
echo 按任意键继续...
pause >nul

echo.
echo [1/3] 正在探测本机 SQL Server 实例...

set FOUND=0
for %%V in (MSSQL16 MSSQL15 MSSQL14) do (
    for %%I in (MSSQLSERVER SQLEXPRESS) do (
        set "KEY=HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\%%V.%%I\MSSQLServer\SuperSocketNetLib\Tcp"
        powershell -Command "if (Test-Path '!KEY!') { Write-Host '  发现实例: %%V.%%I'; exit 0 } else { exit 1 }" >nul 2>&1
        if !errorlevel! equ 0 (
            set "INST_KEY=!KEY!"
            set "SVC_NAME=%%I"
            if "%%I"=="MSSQLSERVER" set "SVC_NAME=MSSQLSERVER"
            if "%%I"=="SQLEXPRESS" set "SVC_NAME=MSSQL$SQLEXPRESS"
            set FOUND=1
            goto :found
        )
    )
)
:found

if %FOUND%==0 (
    echo   未自动检测到 SQL Server 注册表项。
    echo   请按部署指南中「手动方式」操作，或用 PowerShell 执行 enable-tcp.ps1。
    echo.
    pause
    exit /b 1
)

echo.
echo [2/3] 正在启用 TCP/IP 并设置端口 1433...
powershell -Command "$key='%INST_KEY%'; Get-ChildItem $key | ForEach-Object { Set-ItemProperty -Path $_.PSPath -Name 'Enabled' -Value 1; Write-Host ('  TCP enabled for: ' + $_.PSChildName) }; Set-ItemProperty -Path '$key\IPAll' -Name 'TcpPort' -Value '1433'; Set-ItemProperty -Path '$key\IPAll' -Name 'TcpDynamicPorts' -Value ''; Write-Host '  IPAll TcpPort = 1433, DynamicPorts cleared'"

echo.
echo [3/3] 正在重启 SQL Server 服务 (%SVC_NAME%)...
sc stop "%SVC_NAME%" >nul 2>&1
timeout /t 3 /nobreak >nul
sc start "%SVC_NAME%" >nul 2>&1
timeout /t 3 /nobreak >nul

echo.
echo === 验证端口 ===
netstat -an | findstr ":1433"
echo.
if %errorlevel% neq 0 (
    echo 【警告】1433 端口未出现在监听列表中。
    echo 请检查：1^) Windows 防火墙是否放行 1433  2^) SQL Server Browser 服务是否已启动
)
echo.
echo === 完成！请重新启动后端服务 ===
pause
endlocal
