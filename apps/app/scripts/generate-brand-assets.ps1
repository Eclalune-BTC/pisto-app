Add-Type -AssemblyName System.Drawing

$brandRoot = Join-Path $PSScriptRoot '..\assets\brand'
$brandRoot = [System.IO.Path]::GetFullPath($brandRoot)
[System.IO.Directory]::CreateDirectory($brandRoot) | Out-Null

function New-BrandBitmap {
  param(
    [int]$Size,
    [bool]$Transparent,
    [bool]$DrawBackground,
    [bool]$Monochrome,
    [string]$OutputName
  )

  $pixelFormat = [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size, $pixelFormat)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear($(if ($Transparent) { [System.Drawing.Color]::Transparent } else { [System.Drawing.ColorTranslator]::FromHtml('#E7F1E8') }))

  $scale = $Size / 1024
  if ($DrawBackground) {
    $background = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#132A22'))
    $graphics.FillRectangle($background, 0, 0, $Size, $Size)
    $background.Dispose()
  }

  $coinColor = if ($Monochrome) { [System.Drawing.Color]::White } else { [System.Drawing.ColorTranslator]::FromHtml('#D9FB67') }
  $markColor = if ($Monochrome) { [System.Drawing.Color]::Transparent } else { [System.Drawing.ColorTranslator]::FromHtml('#132A22') }
  $coin = [System.Drawing.SolidBrush]::new($coinColor)
  $mark = [System.Drawing.SolidBrush]::new($markColor)

  $graphics.FillEllipse($coin, 226 * $scale, 226 * $scale, 572 * $scale, 572 * $scale)

  if (-not $Monochrome) {
    $font = [System.Drawing.Font]::new('Segoe UI', 390 * $scale, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $format = [System.Drawing.StringFormat]::new()
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $graphics.DrawString('P', $font, $mark, [System.Drawing.RectangleF]::new(220 * $scale, 170 * $scale, 584 * $scale, 644 * $scale), $format)
    $format.Dispose()
    $font.Dispose()
  }

  $bitmap.Save((Join-Path $brandRoot $OutputName), [System.Drawing.Imaging.ImageFormat]::Png)
  $coin.Dispose()
  $mark.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

New-BrandBitmap -Size 1024 -Transparent $false -DrawBackground $true -Monochrome $false -OutputName 'icon.png'
New-BrandBitmap -Size 1024 -Transparent $true -DrawBackground $false -Monochrome $false -OutputName 'adaptive-foreground.png'
New-BrandBitmap -Size 1024 -Transparent $false -DrawBackground $false -Monochrome $false -OutputName 'adaptive-background.png'
New-BrandBitmap -Size 1024 -Transparent $true -DrawBackground $false -Monochrome $true -OutputName 'monochrome.png'
New-BrandBitmap -Size 512 -Transparent $true -DrawBackground $false -Monochrome $false -OutputName 'splash-icon.png'
New-BrandBitmap -Size 64 -Transparent $false -DrawBackground $true -Monochrome $false -OutputName 'favicon.png'
