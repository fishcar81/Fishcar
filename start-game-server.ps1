param(
  [switch]$NoBrowser,
  [int]$Port = 8765
)

# Golden Scapegoat local launcher. Keep this window open while playing.
$ErrorActionPreference = 'Stop'
$gameRoot = Split-Path -Parent $PSCommandPath
$gameFolder = Split-Path -Leaf $gameRoot

$mimeTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.htm'  = 'text/html; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.gif'  = 'image/gif'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
  '.wav'  = 'audio/wav'
  '.mp3'  = 'audio/mpeg'
}

function Send-Response([System.Net.Sockets.TcpClient]$Client, [int]$StatusCode, [string]$Reason, [byte[]]$Body, [string]$ContentType = 'text/plain; charset=utf-8', [string]$ExtraHeaders = '') {
  $stream = $Client.GetStream()
  $headers = "HTTP/1.1 $StatusCode $Reason`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nConnection: close`r`n$ExtraHeaders`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
  $stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($Body.Length -gt 0) { $stream.Write($Body, 0, $Body.Length) }
  $stream.Flush()
}

function Send-Text([System.Net.Sockets.TcpClient]$Client, [int]$StatusCode, [string]$Reason, [string]$Text) {
  Send-Response $Client $StatusCode $Reason ([System.Text.Encoding]::UTF8.GetBytes($Text))
}

$listener = $null
$firstPort = $Port
for ($candidatePort = $firstPort; $candidatePort -lt ($firstPort + 20); $candidatePort++) {
  try {
    $endpoint = [System.Net.IPEndPoint]::new([System.Net.IPAddress]::Loopback, $candidatePort)
    $candidate = [System.Net.Sockets.TcpListener]::new($endpoint)
    $candidate.Start()
    $listener = $candidate
    $Port = $candidatePort
    break
  } catch {
    if ($null -ne $candidate) { try { $candidate.Stop() } catch {} }
  }
}
if ($null -eq $listener) {
  Write-Host ''
  Write-Host "Unable to start a local game server on ports $firstPort to $($firstPort + 19)." -ForegroundColor Red
  Write-Host 'Close any existing game server windows and try again.' -ForegroundColor Yellow
  Write-Host ''
  Read-Host 'Press Enter to close'
  exit 1
}

$gameUrl = "http://127.0.0.1:$Port/$gameFolder/"
if (-not $NoBrowser) { Start-Process $gameUrl }
Clear-Host
Write-Host '==============================================' -ForegroundColor DarkCyan
Write-Host ' Golden Scapegoat is running locally.' -ForegroundColor Yellow
Write-Host '==============================================' -ForegroundColor DarkCyan
Write-Host "Game address: $gameUrl" -ForegroundColor Cyan
Write-Host ''
Write-Host 'Keep this window open while playing.' -ForegroundColor White
Write-Host 'Press Ctrl+C or close this window to stop the local server.' -ForegroundColor DarkGray
Write-Host ''

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 8192, $true)
      $requestLine = $reader.ReadLine()
      while ($true) {
        $line = $reader.ReadLine()
        if ($null -eq $line -or $line.Length -eq 0) { break }
      }
      if ([string]::IsNullOrWhiteSpace($requestLine)) { continue }

      $parts = $requestLine -split ' '
      if ($parts.Length -lt 2 -or $parts[0] -ne 'GET') {
        Send-Text $client 405 'Method Not Allowed' 'Only GET requests are supported.'
        continue
      }

      $requestPath = [System.Uri]::UnescapeDataString(($parts[1] -split '\?')[0])
      $basePath = "/$gameFolder"
      if ($requestPath -eq $basePath) {
        Send-Response $client 302 'Found' ([byte[]]@()) 'text/plain; charset=utf-8' "Location: $basePath/`r`n"
        continue
      }
      if (-not $requestPath.StartsWith("$basePath/", [System.StringComparison]::OrdinalIgnoreCase)) {
        Send-Text $client 404 'Not Found' 'Not found.'
        continue
      }

      $relativePath = $requestPath.Substring($basePath.Length).TrimStart('/')
      if ([string]::IsNullOrWhiteSpace($relativePath)) { $relativePath = 'index.html' }
      $relativePath = $relativePath -replace '/', [System.IO.Path]::DirectorySeparatorChar
      $filePath = [System.IO.Path]::GetFullPath((Join-Path $gameRoot $relativePath))
      if (-not $filePath.StartsWith($gameRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        Send-Text $client 403 'Forbidden' 'Forbidden.'
        continue
      }
      if (Test-Path -LiteralPath $filePath -PathType Container) { $filePath = Join-Path $filePath 'index.html' }
      if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
        Send-Text $client 404 'Not Found' 'File not found.'
        continue
      }

      $body = [System.IO.File]::ReadAllBytes($filePath)
      $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
      $contentType = if ($mimeTypes.ContainsKey($extension)) { $mimeTypes[$extension] } else { 'application/octet-stream' }
      Send-Response $client 200 'OK' $body $contentType
    } catch {
      try { Send-Text $client 500 'Internal Server Error' 'The local game server encountered an error.' } catch {}
    } finally {
      if ($null -ne $client) { $client.Close() }
    }
  }
} finally {
  if ($null -ne $listener) { $listener.Stop() }
}

