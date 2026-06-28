# 自动探测本机 SQL Server 实例并启用 TCP/IP
$sqlBase = 'HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server'
$found = $false

foreach ($ver in @('MSSQL16', 'MSSQL15', 'MSSQL14')) {
    foreach ($inst in @('MSSQLSERVER', 'SQLEXPRESS')) {
        $tcpKey = "$sqlBase\$ver.$inst\MSSQLServer\SuperSocketNetLib\Tcp"
        if (Test-Path $tcpKey) {
            Write-Host "发现实例: $ver.$inst" -ForegroundColor Green
            Get-ChildItem $tcpKey | ForEach-Object {
                Set-ItemProperty -Path $_.PSPath -Name 'Enabled' -Value 1
                Write-Host "  TCP enabled for: $($_.PSChildName)"
            }
            Set-ItemProperty -Path "$tcpKey\IPAll" -Name 'TcpPort' -Value '1433'
            Set-ItemProperty -Path "$tcpKey\IPAll" -Name 'TcpDynamicPorts' -Value ''
            Write-Host "  IPAll TcpPort = 1433, DynamicPorts cleared"

            $svcName = if ($inst -eq 'SQLEXPRESS') { 'MSSQL$SQLEXPRESS' } else { 'MSSQLSERVER' }
            Write-Host "正在重启服务: $svcName ..."
            Restart-Service $svcName -Force
            Start-Sleep -Seconds 5
            Get-Service $svcName | Select-Object Name, Status
            $found = $true
            break
        }
    }
    if ($found) { break }
}

if (-not $found) {
    Write-Host "未自动检测到 SQL Server 注册表项，请按部署指南中手动方式操作。" -ForegroundColor Yellow
}

Write-Host "`n=== 验证端口 ==="
netstat -an | Select-String '1433'
