Add-Type -AssemblyName System.Drawing
$src = "C:\Users\Ralph Zaimon\Downloads\ChickInteL2026\assets\images\chickintel-app-logo.jpg"
$img = [System.Drawing.Image]::FromFile($src)
$bmp = New-Object System.Drawing.Bitmap(1024, 1024)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($img, 0, 0, 1024, 1024)

$pngFormat = [System.Drawing.Imaging.ImageFormat]::Png
$bmp.Save("C:\Users\Ralph Zaimon\Downloads\ChickInteL2026\assets\images\icon.png", $pngFormat)
$bmp.Save("C:\Users\Ralph Zaimon\Downloads\ChickInteL2026\assets\images\android-icon-foreground.png", $pngFormat)
$bmp.Save("C:\Users\Ralph Zaimon\Downloads\ChickInteL2026\assets\images\splash-icon.png", $pngFormat)

$g.Dispose()
$bmp.Dispose()
$img.Dispose()
Write-Host "Images successfully converted to true square PNG format."
