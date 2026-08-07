# Run this from the project root: PowerShell -ExecutionPolicy Bypass -File .\scripts\generate-erd-png-highres.ps1
# Generates a higher-resolution PNG for the ERD diagram.

$input = "docs/ERD_COMPARISON.mmd"
$output = "docs/ERD_COMPARISON.png"
$width = 3840
$height = 2160

if (-Not (Test-Path $input)) {
    Write-Error "Mermaid source file not found: $input"
    exit 1
}

Write-Output "Generating high-resolution PNG from $input into $output..."

$npx = Get-Command npx -ErrorAction SilentlyContinue
if (-Not $npx) {
    Write-Error "npx command not found. Install Node.js/npm or use the Mermaid preview extension." 
    exit 1
}

npx --yes @mermaid-js/mermaid-cli -i $input -o $output --width $width --height $height

if (Test-Path $output) {
    Write-Output "File created: $output"
} else {
    Write-Error "PNG generation failed. Ensure Node.js/npm are installed and internet access is available for npx package install."
    exit 1
}
