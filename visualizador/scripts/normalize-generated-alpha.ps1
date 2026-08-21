param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [Parameter(Mandatory = $true)]
  [string]$OutputPath
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing
$runtimeDirectory = Split-Path ([System.Drawing.Bitmap].Assembly.Location)
$references = Get-ChildItem -LiteralPath $runtimeDirectory -Filter "*.dll" |
  Where-Object {
    try {
      [void][System.Reflection.AssemblyName]::GetAssemblyName($_.FullName)
      $true
    }
    catch {
      $false
    }
  } |
  Select-Object -ExpandProperty FullName

if (-not ("MateArte.CheckerboardAlpha" -as [type])) {
  $source = @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

namespace MateArte {
  public static class CheckerboardAlpha {
    public static void Convert(string inputPath, string outputPath) {
      using var source = new Bitmap(inputPath);
      using var bitmap = source.Clone(
        new Rectangle(0, 0, source.Width, source.Height),
        PixelFormat.Format32bppArgb
      );

      int width = bitmap.Width;
      int height = bitmap.Height;
      var rectangle = new Rectangle(0, 0, width, height);
      var bits = bitmap.LockBits(
        rectangle,
        ImageLockMode.ReadWrite,
        PixelFormat.Format32bppArgb
      );
      int stride = bits.Stride;
      byte[] pixels = new byte[stride * height];
      Marshal.Copy(bits.Scan0, pixels, 0, pixels.Length);

      bool[] outside = new bool[width * height];
      int[] queue = new int[width * height];
      int head = 0;
      int tail = 0;

      bool Candidate(int x, int y) {
        int pixel = y * stride + x * 4;
        int blue = pixels[pixel];
        int green = pixels[pixel + 1];
        int red = pixels[pixel + 2];
        int alpha = pixels[pixel + 3];
        int maximum = Math.Max(red, Math.Max(green, blue));
        int minimum = Math.Min(red, Math.Min(green, blue));
        return alpha <= 16 || (minimum >= 226 && maximum - minimum <= 8);
      }

      void Enqueue(int x, int y) {
        int index = y * width + x;
        if (!outside[index] && Candidate(x, y)) {
          outside[index] = true;
          queue[tail++] = index;
        }
      }

      for (int x = 0; x < width; x++) {
        Enqueue(x, 0);
        Enqueue(x, height - 1);
      }
      for (int y = 1; y < height - 1; y++) {
        Enqueue(0, y);
        Enqueue(width - 1, y);
      }

      while (head < tail) {
        int index = queue[head++];
        int x = index % width;
        int y = index / width;
        if (x > 0) Enqueue(x - 1, y);
        if (x + 1 < width) Enqueue(x + 1, y);
        if (y > 0) Enqueue(x, y - 1);
        if (y + 1 < height) Enqueue(x, y + 1);
      }

      for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
          int pixel = y * stride + x * 4;
          pixels[pixel + 3] = outside[y * width + x] ? (byte)0 : (byte)255;
        }
      }

      Marshal.Copy(pixels, 0, bits.Scan0, pixels.Length);
      bitmap.UnlockBits(bits);
      bitmap.Save(outputPath, ImageFormat.Png);
    }
  }
}
'@

  Add-Type -TypeDefinition $source -ReferencedAssemblies $references
}

$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
$temporaryInput = $null
if ([System.IO.Path]::GetExtension($resolvedInput) -ieq ".webp") {
  $temporaryInput = Join-Path ([System.IO.Path]::GetTempPath()) ("matearte-alpha-" + [guid]::NewGuid().ToString("N") + ".png")
  & ffmpeg -hide_banner -loglevel error -y -i $resolvedInput $temporaryInput
  if ($LASTEXITCODE -ne 0) {
    throw "No se pudo convertir el WebP de entrada."
  }
  $resolvedInput = $temporaryInput
}
$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory) {
  New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
}
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
try {
  [MateArte.CheckerboardAlpha]::Convert($resolvedInput, $resolvedOutput)
}
finally {
  if ($temporaryInput -and (Test-Path -LiteralPath $temporaryInput)) {
    Remove-Item -LiteralPath $temporaryInput -Force
  }
}
