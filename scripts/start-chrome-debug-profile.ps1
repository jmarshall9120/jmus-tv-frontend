# Start Chrome with Remote Debugging - Using Your Profile
# This bypasses the profile picker by specifying which profile to use

param(
    [string]$ProfileName = "Default"
)

Write-Host "Closing all Chrome processes..." -ForegroundColor Yellow
Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

$chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
$userDataDir = "$env:LOCALAPPDATA\Google\Chrome\User Data"

Write-Host ""
Write-Host "Launching Chrome with:" -ForegroundColor Cyan
Write-Host "  Profile: $ProfileName" -ForegroundColor White
Write-Host "  Remote Debugging Port: 9222" -ForegroundColor White
Write-Host "  User Data: $userDataDir" -ForegroundColor White

# Launch Chrome with specific profile and remote debugging
# Note: Use the folder name (Default, Profile 2, etc.), not the display name
$args = @(
    "--remote-debugging-port=9222",
    "--user-data-dir=$userDataDir",
    "--profile-directory=$ProfileName"
)

try {
    $process = Start-Process -FilePath $chromePath -ArgumentList $args -PassThru -ErrorAction Stop
    Write-Host ""
    Write-Host "Chrome launched (PID: $($process.Id))" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "Failed to launch Chrome: $_" -ForegroundColor Red
    exit 1
}

Write-Host "Waiting for Chrome to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 6

# Check port
Write-Host ""
Write-Host "Checking port 9222..." -ForegroundColor Yellow
$portOk = $false
try {
    $result = Test-NetConnection -ComputerName localhost -Port 9222 -InformationLevel Quiet -WarningAction SilentlyContinue -ErrorAction Stop
    $portOk = $result
}
catch {
    Write-Host "Could not check port: $_" -ForegroundColor Red
}

if ($portOk) {
    Write-Host "Port 9222 is listening!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Open http://localhost:9222/json in your browser" -ForegroundColor White
    Write-Host "2. Copy the webSocketDebuggerUrl value" -ForegroundColor White
    Write-Host "3. Paste it into Cursor CDP Connection URL field" -ForegroundColor White
}
else {
    Write-Host "Port 9222 is not listening" -ForegroundColor Red
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
