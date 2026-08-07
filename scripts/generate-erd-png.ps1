# Run this from the project root: .\scripts\generate-erd-png.ps1
# Requires Node.js/npm installed.

$input = "docs/ERD_COMPARISON.mmd"
$output = "docs/ERD_COMPARISON.png"

if (-Not (Test-Path $input)) {
    Write-Error "Mermaid source file not found: $input"
    exit 1
}

Write-Output "Generating PNG from $input into $output..."

npx --yes @mermaid-js/mermaid-cli -i $input -o $output

if (Test-Path $output) {
    Write-Output "File created: $output"
} else {
    Write-Error "PNG generation failed. Ensure Node.js/npm are installed and internet access is available for npx package install."
}
