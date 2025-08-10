# PowerShell script to check Windows dependencies for ideviceinstaller.exe
# Run this script on Windows to diagnose dependency issues

param(
    [string]$AppPath = ".",
    [switch]$Verbose
)

Write-Host "Checking Windows dependencies for Flippio iOS tools..." -ForegroundColor Green
Write-Host "Application directory: $AppPath" -ForegroundColor Cyan

# Check if ideviceinstaller.exe exists
$ideviceInstallerPath = Join-Path $AppPath "_up_\resources\libimobiledevice-windows\ideviceinstaller.exe"
if (-not (Test-Path $ideviceInstallerPath)) {
    $ideviceInstallerPath = Join-Path $AppPath "resources\libimobiledevice-windows\ideviceinstaller.exe"
}

if (-not (Test-Path $ideviceInstallerPath)) {
    Write-Host "ERROR: ideviceinstaller.exe not found in expected locations" -ForegroundColor Red
    exit 1
}

Write-Host "Found ideviceinstaller.exe at: $ideviceInstallerPath" -ForegroundColor Green

# Check if we can run dependency walker or use PowerShell alternatives
Write-Host "`nChecking for dependency analysis tools..." -ForegroundColor Yellow

# Method 1: Try to run the executable and capture the specific error
Write-Host "`nTesting ideviceinstaller execution..." -ForegroundColor Yellow
try {
    $process = Start-Process -FilePath $ideviceInstallerPath -ArgumentList "--help" -PassThru -WindowStyle Hidden -RedirectStandardOutput "nul" -RedirectStandardError "nul" -Wait
    $exitCode = $process.ExitCode
    Write-Host "Exit code: $exitCode" -ForegroundColor $(if ($exitCode -eq 0) { "Green" } elseif ($exitCode -eq -1073741701) { "Red" } else { "Yellow" })
    
    if ($exitCode -eq -1073741701) {
        Write-Host "ERROR CODE -1073741701 (0xC000007B): STATUS_INVALID_IMAGE_FORMAT" -ForegroundColor Red
        Write-Host "This indicates a dependency issue - likely missing or incompatible DLLs" -ForegroundColor Red
    }
} catch {
    Write-Host "Error running ideviceinstaller: $($_.Exception.Message)" -ForegroundColor Red
}

# Method 2: Check for common missing dependencies
Write-Host "`nChecking for common Windows dependencies..." -ForegroundColor Yellow

$commonDependencies = @{
    "Visual C++ 2015-2022 Redistributable (x64)" = "HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64"
    "Visual C++ 2015-2022 Redistributable (x86)" = "HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x86"
    "Visual C++ 2015-2022 Redistributable (ARM64)" = "HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\arm64"
}

foreach ($dep in $commonDependencies.GetEnumerator()) {
    try {
        $regKey = Get-ItemProperty -Path $dep.Value -ErrorAction SilentlyContinue
        if ($regKey) {
            Write-Host "✓ $($dep.Key) - Version: $($regKey.Version)" -ForegroundColor Green
        } else {
            Write-Host "✗ $($dep.Key) - NOT INSTALLED" -ForegroundColor Red
        }
    } catch {
        Write-Host "✗ $($dep.Key) - NOT INSTALLED" -ForegroundColor Red
    }
}

# Method 3: Check specific DLLs that ideviceinstaller needs
Write-Host "`nChecking for libimobiledevice DLLs..." -ForegroundColor Yellow

$requiredDlls = @(
    "libimobiledevice-1.0.dll",
    "libplist-2.0.dll", 
    "libusbmuxd-2.0.dll",
    "libzip.dll",
    "libxml2-2.dll",
    "libcrypto-3-x64.dll",
    "libssl-3-x64.dll",
    "zlib1.dll"
)

$dllDir = Split-Path $ideviceInstallerPath -Parent

foreach ($dll in $requiredDlls) {
    $dllPath = Join-Path $dllDir $dll
    if (Test-Path $dllPath) {
        $fileInfo = Get-ItemProperty $dllPath
        Write-Host "✓ $dll - Size: $($fileInfo.Length) bytes" -ForegroundColor Green
    } else {
        Write-Host "✗ $dll - MISSING" -ForegroundColor Red
    }
}

# Method 4: Use dumpbin if available (part of Visual Studio)
Write-Host "`nTrying to analyze dependencies with dumpbin..." -ForegroundColor Yellow

$dumpbinPath = Get-Command "dumpbin.exe" -ErrorAction SilentlyContinue
if ($dumpbinPath) {
    Write-Host "Found dumpbin at: $($dumpbinPath.Source)" -ForegroundColor Green
    try {
        $dependencies = & $dumpbinPath.Source /DEPENDENTS $ideviceInstallerPath 2>&1
        Write-Host "Dependencies:" -ForegroundColor Cyan
        $dependencies | Where-Object { $_ -match "\.dll" } | ForEach-Object {
            Write-Host "  $_" -ForegroundColor White
        }
    } catch {
        Write-Host "Error running dumpbin: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "dumpbin not available (install Visual Studio Build Tools for detailed dependency analysis)" -ForegroundColor Yellow
}

# Method 5: Check PATH for potential conflicts
Write-Host "`nChecking PATH for potential DLL conflicts..." -ForegroundColor Yellow
$pathDirs = $env:PATH -split ';'
$conflictingDlls = @()

foreach ($dll in $requiredDlls) {
    foreach ($dir in $pathDirs) {
        if (Test-Path $dir) {
            $potentialConflict = Join-Path $dir $dll
            if (Test-Path $potentialConflict) {
                $conflictingDlls += "$dll found in: $dir"
            }
        }
    }
}

if ($conflictingDlls.Count -gt 0) {
    Write-Host "Potential DLL conflicts found:" -ForegroundColor Red
    $conflictingDlls | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
} else {
    Write-Host "No obvious DLL conflicts in PATH" -ForegroundColor Green
}

# Method 6: Recommendations
Write-Host "`nRECOMMENDATIONS:" -ForegroundColor Green
Write-Host "1. Install Microsoft Visual C++ Redistributable (latest version)" -ForegroundColor Cyan
Write-Host "   Download from: https://docs.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist" -ForegroundColor Cyan
Write-Host "2. Ensure all DLL files are in the same directory as ideviceinstaller.exe" -ForegroundColor Cyan
Write-Host "3. Run Flippio as Administrator to rule out permission issues" -ForegroundColor Cyan
Write-Host "4. Check Windows Event Viewer for more detailed error information" -ForegroundColor Cyan

Write-Host "`nDependency check completed." -ForegroundColor Green
