# Start Chrome with Remote Debugging
# This script forcefully closes Chrome and launches it with CDP enabled

Write-Host "Closing all Chrome processes..." -ForegroundColor Yellow

# Kill all Chrome processes more aggressively
Get-Process chrome -ErrorAction SilentlyContinue | ForEach-Object {
    try {
        Stop-Process -Id $_.Id -Force -ErrorAction Stop
        Write-Host "  Killed Chrome process $($_.Id)" -ForegroundColor Gray
    } catch {
        Write-Host "  Could not kill process $($_.Id): $_" -ForegroundColor Red
    }
}

# Wait for processes to fully terminate
Write-Host "Waiting for Chrome to fully close..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Double-check - kill any remaining processes
$remaining = Get-Process chrome -ErrorAction SilentlyContinue
if ($remaining) {
    Write-Host "  Force killing remaining processes..." -ForegroundColor Yellow
    $remaining | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Verify Chrome is closed
$stillRunning = Get-Process chrome -ErrorAction SilentlyContinue
if ($stillRunning) {
    Write-Host "`nWARNING: Chrome processes are still running:" -ForegroundColor Red
    $stillRunning | ForEach-Object { Write-Host "  PID: $($_.Id)" -ForegroundColor Red }
    Write-Host "`nPlease close Chrome manually and try again." -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Chrome is closed" -ForegroundColor Green

# Launch Chrome with remote debugging
$chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
Write-Host "`nLaunching Chrome with remote debugging on port 9222..." -ForegroundColor Yellow

try {
    $process = Start-Process -FilePath $chromePath -ArgumentList "--remote-debugging-port=9222" -PassThru -ErrorAction Stop
    Write-Host "✓ Chrome launched (PID: $($process.Id))" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to launch Chrome: $_" -ForegroundColor Red
    exit 1
}

# Wait for Chrome to start
Write-Host "Waiting for Chrome to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 4

# Check if port 9222 is listening
Write-Host "`nChecking if port 9222 is listening..." -ForegroundColor Yellow
try {
    $connection = Test-NetConnection -ComputerName localhost -Port 9222 -InformationLevel Quiet -WarningAction SilentlyContinue -ErrorAction Stop
    if ($connection) {
        Write-Host "✓ Port 9222 is listening!" -ForegroundColor Green
        Write-Host "`nNext steps:" -ForegroundColor Cyan
        Write-Host "1. Open http://localhost:9222/json in your browser" -ForegroundColor White
        Write-Host "2. Copy the 'webSocketDebuggerUrl' value" -ForegroundColor White
        Write-Host "3. Paste it into Cursor's CDP Connection URL field" -ForegroundColor White
    } else {
        Write-Host "✗ Port 9222 is not listening" -ForegroundColor Red
        Write-Host "`nTroubleshooting:" -ForegroundColor Yellow
        Write-Host "- Chrome may not have started with the remote debugging flag" -ForegroundColor White
        Write-Host "- Check if Chrome is actually running" -ForegroundColor White
        $manualCmd = "Start-Process '$chromePath' -ArgumentList '--remote-debugging-port=9222','--user-data-dir=$debugProfile'"
        Write-Host "- Try manually: $manualCmd" -ForegroundColor White
    }
} catch {
    Write-Host "✗ Could not check port: $_" -ForegroundColor Red
}

Write-Host "`nDone!" -ForegroundColor Green
