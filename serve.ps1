# Imagination AI - local server (no Node/Python needed)
# Laptop:  http://localhost:5180/
# Phone:   http://<this-PC-Wi-Fi-IP>:5180/  (same Wi-Fi network)
#
# Also proxies Nova's conversations to Claude so the API key never reaches the browser:
#   GET  /api/status  -> { connected }
#   POST /api/key     -> saves the key (only from this PC)   body: { key }
#   POST /api/chat    -> Claude reply                         body: { system, messages }
# The key is read from $env:ANTHROPIC_API_KEY, else from %LOCALAPPDATA%\imagination-ai\anthropic-key.txt
param([int]$Port = 5180)

$siteRoot = $PSScriptRoot
$keyDir = Join-Path $env:LOCALAPPDATA 'imagination-ai'
$keyFile = Join-Path $keyDir 'anthropic-key.txt'
$model = 'claude-opus-5-5'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.Web

$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'; '.svg' = 'image/svg+xml'
  '.png'  = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.webp' = 'image/webp'
  '.woff2' = 'font/woff2'; '.ico' = 'image/x-icon'; '.glb' = 'model/gltf-binary'
}

$polFile = Join-Path $keyDir 'pollinations-key.txt'
function Get-PolKey {
  if ($env:POLLINATIONS_API_KEY) { return $env:POLLINATIONS_API_KEY.Trim() }
  if (Test-Path $polFile) { return ([IO.File]::ReadAllText($polFile)).Trim() }
  return $null
}
# Real text-to-image through Pollinations.
# Free tier = 1 image every 45 s per IP (HTTP 402 + Retry-After). A free "pollen" key from
# https://enter.pollinations.ai removes the limit. We cache results and report the exact wait.
$imgCache = [ordered]@{}
$script:nextFreeAt = [DateTime]::MinValue
function Get-Image($query) {
  $q = [Web.HttpUtility]::ParseQueryString($query)
  $prompt = [string]$q['prompt']; if (-not $prompt) { return @{ code = 400 } }
  $w = [Math]::Min([Math]::Max([int]$q['w'], 256), 1280); $h = [Math]::Min([Math]::Max([int]$q['h'], 256), 1280)
  $seed = [int]$q['seed']
  $ck = "$prompt|$w|$h|$seed"
  if ($imgCache.Contains($ck)) { return @{ code = 200; bytes = $imgCache[$ck]; type = 'image/jpeg' } }
  $pk = Get-PolKey
  if (-not $pk) {
    $left = ($script:nextFreeAt - [DateTime]::UtcNow).TotalSeconds
    if ($left -gt 0) { return @{ code = 429; wait = [int][Math]::Ceiling($left) } }
  }
  $url = "https://image.pollinations.ai/prompt/$([Uri]::EscapeDataString($prompt))?width=$w&height=$h&seed=$seed&nologo=true&enhance=false&referrer=imagination-ai"
  if ($pk) { $url += "&key=$([Uri]::EscapeDataString($pk))" }
  $req = [Net.HttpWebRequest]::Create($url)
  $req.Timeout = 90000; $req.ReadWriteTimeout = 90000
  if ($pk) { $req.Headers.Add('Authorization', "Bearer $pk") }
  try {
    $resp = $req.GetResponse()
    $ms = New-Object IO.MemoryStream; $resp.GetResponseStream().CopyTo($ms); $resp.Close()
    $bytes = $ms.ToArray()
    if (-not $pk) { $script:nextFreeAt = [DateTime]::UtcNow.AddSeconds(46) }
    $imgCache[$ck] = $bytes
    while ($imgCache.Count -gt 40) { $imgCache.RemoveAt(0) }
    return @{ code = 200; bytes = $bytes; type = 'image/jpeg' }
  } catch [System.Net.WebException] {
    $r = $_.Exception.Response
    if ($r) {
      $status = [int]$r.StatusCode
      if ($status -eq 402 -or $status -eq 429) {
        $wait = 45; if ($r.Headers['Retry-After']) { $wait = [int]$r.Headers['Retry-After'] + 1 }
        $script:nextFreeAt = [DateTime]::UtcNow.AddSeconds($wait)
        Write-Host "  image: free limit, next in ${wait}s" -ForegroundColor DarkYellow
        return @{ code = 429; wait = $wait }
      }
      Write-Host "  image error $status" -ForegroundColor DarkYellow
      return @{ code = $status }
    }
    Write-Host "  image error: $($_.Exception.Message)" -ForegroundColor DarkYellow
    return @{ code = 504 }
  }
}

# Google Gemini image models ("Nano Banana"): best quality + real photo editing. Key from aistudio.google.com/apikey
$gemFile = Join-Path $keyDir 'gemini-key.txt'
$gemModels = @('gemini-3-pro-image', 'gemini-3.1-flash-image', 'gemini-2.5-flash-image')
function Get-GemKey {
  if ($env:GEMINI_API_KEY) { return $env:GEMINI_API_KEY.Trim() }
  if (Test-Path $gemFile) { return ([IO.File]::ReadAllText($gemFile)).Trim() }
  return $null
}
# images may use their own key (a billing-enabled project); falls back to the text key
$gemImgFile = Join-Path $keyDir 'gemini-image-key.txt'
function Get-GemImageKey {
  if ($env:GEMINI_IMAGE_API_KEY) { return $env:GEMINI_IMAGE_API_KEY.Trim() }
  if (Test-Path $gemImgFile) { return ([IO.File]::ReadAllText($gemImgFile)).Trim() }
  return Get-GemKey
}
$script:gemImgBlockedUntil = [DateTime]::UtcNow.AddSeconds(-1)
function Invoke-Gemini($payload) {
  $key = Get-GemImageKey
  if (-not $key) { return @{ code = 401; json = @{ error = 'no_key' } } }
  # after a "free tier limit 0" answer don't waste the visitor's time for 30 minutes
  if ([DateTime]::UtcNow -lt $script:gemImgBlockedUntil) { return @{ code = 429; json = @{ error = 'quota' } } }
  $parts = @(@{ text = [string]$payload.prompt })
  if ($payload.image) { $parts += @{ inline_data = @{ mime_type = 'image/jpeg'; data = [string]$payload.image } } }
  $gen = @{ responseModalities = @('TEXT', 'IMAGE') }
  if ($payload.aspect) { $gen.imageConfig = @{ aspectRatio = [string]$payload.aspect } }
  $body = @{ contents = @(@{ role = 'user'; parts = $parts }); generationConfig = $gen } | ConvertTo-Json -Depth 10 -Compress
  $lastErr = 'api_error'
  foreach ($m in $gemModels) {
    $wc = New-Object System.Net.WebClient
    $wc.Encoding = [Text.Encoding]::UTF8
    $wc.Headers.Add('x-goog-api-key', $key)
    $wc.Headers.Add('content-type', 'application/json')
    try {
      $raw = $wc.UploadString("https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent", 'POST', $body)
    } catch [System.Net.WebException] {
      $status = 502; $detail = $_.Exception.Message
      if ($_.Exception.Response) {
        $status = [int]$_.Exception.Response.StatusCode
        $detail = (New-Object IO.StreamReader($_.Exception.Response.GetResponseStream(), [Text.Encoding]::UTF8)).ReadToEnd()
      }
      Write-Host "  gemini $m -> $status $($detail.Substring(0, [Math]::Min(200, $detail.Length)))" -ForegroundColor DarkYellow
      if ($status -eq 401 -or $status -eq 403) { return @{ code = $status; json = @{ error = 'bad_key' } } }
      if ($status -eq 429) { $lastErr = 'quota'; continue }
      continue   # model not available for this key -> try the next one
    }
    # parse with regex: PowerShell 5.1's JSON parser chokes on multi-MB base64 strings
    $img = [regex]::Match($raw, '"data"\s*:\s*"([A-Za-z0-9+/=]{200,})"')
    if ($img.Success) {
      $mime = 'image/png'; $mm = [regex]::Match($raw, '"mimeType"\s*:\s*"(image/[a-z]+)"'); if ($mm.Success) { $mime = $mm.Groups[1].Value }
      return @{ code = 200; bytes = [Convert]::FromBase64String($img.Groups[1].Value); type = $mime; model = $m }
    }
    if ($raw -match 'SAFETY|PROHIBITED|blockReason|IMAGE_OTHER|RECITATION') { return @{ code = 422; json = @{ error = 'blocked'; model = $m } } }
    $lastErr = 'no_image'
  }
  if ($lastErr -eq 'quota') { $script:gemImgBlockedUntil = [DateTime]::UtcNow.AddMinutes(30); return @{ code = 429; json = @{ error = 'quota' } } }
  return @{ code = 502; json = @{ error = $lastErr } }
}

function Get-ApiKey {
  if ($env:ANTHROPIC_API_KEY) { return $env:ANTHROPIC_API_KEY.Trim() }
  if (Test-Path $keyFile) { return ([IO.File]::ReadAllText($keyFile)).Trim() }
  return $null
}

$server = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
$server.Start()
Write-Host ""
Write-Host "  Imagination AI is live" -ForegroundColor Magenta
Write-Host "  Laptop : http://localhost:$Port/" -ForegroundColor Cyan
foreach ($ip in (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' })) {
  Write-Host "  Phone  : http://$($ip.IPAddress):$Port/" -ForegroundColor Cyan
}
if (Get-ApiKey) { Write-Host "  Claude : connected ($model)" -ForegroundColor Green } else { Write-Host "  Claude : not connected yet (add your key from the site)" -ForegroundColor Yellow }
Write-Host ""

function Send-Response($stream, [int]$code, [string]$status, [string]$type, [byte[]]$body, [bool]$withBody) {
  $header = "HTTP/1.1 $code $status`r`nContent-Type: $type`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
  $hb = [System.Text.Encoding]::ASCII.GetBytes($header)
  $stream.Write($hb, 0, $hb.Length)
  if ($withBody) { $stream.Write($body, 0, $body.Length) }
  $stream.Flush()
}
function Send-Json($stream, [int]$code, $obj) {
  $bytes = [Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Depth 20 -Compress))
  $status = if ($code -eq 200) { 'OK' } else { 'Error' }
  Send-Response $stream $code $status 'application/json; charset=utf-8' $bytes $true
}

# Nova's brain on Gemini (used when there is a Gemini key but no Claude key)
$gemTextModels = @('gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-3.1-flash-lite', 'gemini-flash-latest')  # next one is tried when a model is busy (503)
function Invoke-GeminiChat($payload) {
  $key = Get-GemKey
  $contents = @()
  foreach ($m in @($payload.messages)) {
    $parts = @()
    if ($m.content -is [string]) { $parts += @{ text = $m.content } }
    else {
      foreach ($b in @($m.content)) {
        if ($b.type -eq 'text' -and $b.text) { $parts += @{ text = [string]$b.text } }
        elseif ($b.type -eq 'image') { $parts += @{ inline_data = @{ mime_type = [string]$b.source.media_type; data = [string]$b.source.data } } }
      }
    }
    if ($parts.Count -eq 0) { continue }
    $role = 'user'; if ($m.role -eq 'assistant') { $role = 'model' }
    $contents += @{ role = $role; parts = $parts }
  }
  foreach ($model in $gemTextModels) {
    $req = @{ contents = $contents; generationConfig = @{ maxOutputTokens = 1024; temperature = 0.8 } }
    if ([string]$payload.system) { $req.systemInstruction = @{ parts = @(@{ text = [string]$payload.system }) } }
    $wc = New-Object System.Net.WebClient
    $wc.Encoding = [Text.Encoding]::UTF8
    $wc.Headers.Add('x-goog-api-key', $key)
    $wc.Headers.Add('content-type', 'application/json')
    try {
      $res = $wc.UploadString("https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent", 'POST', ($req | ConvertTo-Json -Depth 20 -Compress)) | ConvertFrom-Json
      $text = (@($res.candidates)[0].content.parts | Where-Object { $_.text } | ForEach-Object { $_.text }) -join ''
      if ($text) { return @{ code = 200; body = @{ text = $text; content = $text; brain = $model } } }
      return @{ code = 200; body = @{ text = ''; refusal = $true } }
    } catch [System.Net.WebException] {
      $status = 502; if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode
        $d = (New-Object IO.StreamReader($_.Exception.Response.GetResponseStream(), [Text.Encoding]::UTF8)).ReadToEnd()
        Write-Host "  gemini chat $model -> $status $($d.Substring(0, [Math]::Min(200, $d.Length)))" -ForegroundColor DarkYellow }
      if ($status -eq 401 -or $status -eq 403) { return @{ code = $status; body = @{ error = 'bad_key' } } }
    }
  }
  return @{ code = 502; body = @{ error = 'api_error' } }
}

function Invoke-Claude($payload) {
  $key = Get-ApiKey
  if (-not $key -and (Get-GemKey)) { return Invoke-GeminiChat $payload }
  if (-not $key) { return @{ code = 401; body = @{ error = 'no_key' } } }
  $msgs = @($payload.messages)
  if ($msgs.Count -lt 1 -or $msgs.Count -gt 40) { return @{ code = 400; body = @{ error = 'bad_messages' } } }
  $req = [ordered]@{
    model         = $model
    max_tokens    = 1024
    system        = [string]$payload.system
    messages      = $msgs
    output_config = @{ effort = 'low' }   # voice chat: fast, conversational replies
    fallbacks     = 'default'
  }
  $wc = New-Object System.Net.WebClient
  $wc.Encoding = [Text.Encoding]::UTF8
  $wc.Headers.Add('x-api-key', $key)
  $wc.Headers.Add('anthropic-version', '2023-06-01')
  $wc.Headers.Add('anthropic-beta', 'server-side-fallback-2026-07-01')
  $wc.Headers.Add('content-type', 'application/json')
  try {
    $raw = $wc.UploadString('https://api.anthropic.com/v1/messages', 'POST', ($req | ConvertTo-Json -Depth 30 -Compress))
    $res = $raw | ConvertFrom-Json
    if ($res.stop_reason -eq 'refusal') { return @{ code = 200; body = @{ text = ''; refusal = $true; content = @() } } }
    $text = (@($res.content) | Where-Object { $_.type -eq 'text' } | ForEach-Object { $_.text }) -join ''
    return @{ code = 200; body = @{ text = $text; content = $res.content } }
  } catch [System.Net.WebException] {
    $status = 502; $detail = $_.Exception.Message
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
      $sr = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream(), [Text.Encoding]::UTF8)
      $detail = $sr.ReadToEnd()
    }
    Write-Host "  Claude error $status : $detail" -ForegroundColor Red
    return @{ code = $status; body = @{ error = 'api_error'; status = $status } }
  }
}

while ($true) {
  $conn = $server.AcceptTcpClient()
  try {
    $conn.ReceiveTimeout = 4000
    $net = $conn.GetStream()
    $rd = [System.IO.StreamReader]::new($net, [Text.Encoding]::UTF8)
    $request = $rd.ReadLine()
    $len = 0
    do {
      $hdr = $rd.ReadLine()
      if ($hdr -match '^Content-Length:\s*(\d+)') { $len = [int]$Matches[1] }
    } while ($hdr)
    if (-not ($request -match '^(GET|HEAD|POST) ([^ ]+)')) { $conn.Close(); continue }
    $method = $Matches[1]
    $rel = [Uri]::UnescapeDataString(($Matches[2].Split('?')[0]).TrimStart('/'))

    # read a UTF-8 body of $len bytes through the same reader
    $body = ''
    if ($method -eq 'POST' -and $len -gt 0 -and $len -lt 2000000) {
      $sb = New-Object Text.StringBuilder; $buf = New-Object char[] 4096; $got = 0
      while ($got -lt $len) {
        $n = $rd.Read($buf, 0, $buf.Length); if ($n -le 0) { break }
        [void]$sb.Append($buf, 0, $n); $got += [Text.Encoding]::UTF8.GetByteCount($buf, 0, $n)
      }
      $body = $sb.ToString()
    }

    if ($rel -eq 'api/status') {
      $brain = 'none'; if (Get-ApiKey) { $brain = 'claude' } elseif (Get-GemKey) { $brain = 'gemini' }
      Send-Json $net 200 @{ connected = ($brain -ne 'none'); brain = $brain; model = $model; images = [bool](Get-PolKey); gemini = ([bool](Get-GemImageKey) -and [DateTime]::UtcNow -ge $script:gemImgBlockedUntil) }
    } elseif ($rel -eq 'api/gemini' -and $method -eq 'POST') {
      $g = Invoke-Gemini ($body | ConvertFrom-Json)
      if ($g.code -eq 200) { Send-Response $net 200 'OK' $g.type $g.bytes $true }
      else { Send-Json $net $g.code $g.json }
    } elseif ($rel -eq 'api/gemkey' -and $method -eq 'POST') {
      $local = ([System.Net.IPEndPoint]$conn.Client.RemoteEndPoint).Address
      if (-not [System.Net.IPAddress]::IsLoopback($local)) { Send-Json $net 403 @{ error = 'only_from_this_pc' } }
      else {
        $k = ([string]($body | ConvertFrom-Json).key).Trim()
        if ($k -notmatch '^(AIza[0-9A-Za-z_\-]{30,}|AQ\.[0-9A-Za-z_\-\.]{20,})$') { Send-Json $net 400 @{ error = 'bad_key' } }
        else { New-Item -ItemType Directory -Force $keyDir | Out-Null; [IO.File]::WriteAllText($gemFile, $k); Write-Host "  Gemini : key saved" -ForegroundColor Green; Send-Json $net 200 @{ gemini = $true } }
      }
    } elseif ($rel -eq 'api/image') {
      $qs = ''; if ($request -match '\?([^ ]*)') { $qs = $Matches[1] }
      $img = Get-Image $qs
      if ($img.code -eq 200) { Send-Response $net 200 'OK' $img.type $img.bytes $true }
      else { Send-Json $net $img.code @{ error = 'image_failed'; status = $img.code; wait = $img.wait } }
    } elseif ($rel -eq 'api/prompt') {
      # free fallback prompt writer (used when Claude isn't connected): any language -> rich English image prompt
      $qs = ''; if ($request -match '\?([^ ]*)') { $qs = $Matches[1] }
      $text = [string]([Web.HttpUtility]::ParseQueryString($qs)['q'])
      $ask = "Rewrite this as one vivid, detailed English prompt for an AI image generator (subject, setting, lighting, composition, mood). Keep every element the user asked for. Reply with the prompt only, no quotes: $text"
      try {
        $wc = New-Object System.Net.WebClient; $wc.Encoding = [Text.Encoding]::UTF8
        $out = $wc.DownloadString("https://text.pollinations.ai/$([Uri]::EscapeDataString($ask))?referrer=imagination-ai")
        Send-Json $net 200 @{ prompt = $out.Trim() }
      } catch { Send-Json $net 502 @{ error = 'prompt_failed' } }
    } elseif ($rel -eq 'api/imgkey' -and $method -eq 'POST') {
      $local = ([System.Net.IPEndPoint]$conn.Client.RemoteEndPoint).Address
      if (-not [System.Net.IPAddress]::IsLoopback($local)) { Send-Json $net 403 @{ error = 'only_from_this_pc' } }
      else {
        $k = ([string]($body | ConvertFrom-Json).key).Trim()
        if ($k.Length -lt 10) { Send-Json $net 400 @{ error = 'bad_key' } }
        else { New-Item -ItemType Directory -Force $keyDir | Out-Null; [IO.File]::WriteAllText($polFile, $k); Send-Json $net 200 @{ images = $true } }
      }
    } elseif ($rel -eq 'api/key' -and $method -eq 'POST') {
      $local = ([System.Net.IPEndPoint]$conn.Client.RemoteEndPoint).Address
      if (-not [System.Net.IPAddress]::IsLoopback($local)) { Send-Json $net 403 @{ error = 'only_from_this_pc' } }
      else {
        $k = ([string]($body | ConvertFrom-Json).key).Trim()
        if ($k -notmatch '^sk-ant-[A-Za-z0-9_\-]{20,}$') { Send-Json $net 400 @{ error = 'bad_key' } }
        else {
          New-Item -ItemType Directory -Force $keyDir | Out-Null
          [IO.File]::WriteAllText($keyFile, $k)
          Write-Host "  Claude : key saved, connected" -ForegroundColor Green
          Send-Json $net 200 @{ connected = $true }
        }
      }
    } elseif ($rel -eq 'api/chat' -and $method -eq 'POST') {
      $r = Invoke-Claude ($body | ConvertFrom-Json)
      Send-Json $net $r.code $r.body
    } else {
      if (-not $rel -or $rel.EndsWith('/')) { $rel += 'index.html' }
      $full = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($siteRoot, $rel))
      if ($full.StartsWith($siteRoot, [StringComparison]::OrdinalIgnoreCase) -and [System.IO.File]::Exists($full) -and -not ($rel -match '(^|/)\.' -or $rel -match '\.ps1$')) {
        $ext = [System.IO.Path]::GetExtension($full).ToLower()
        $ctype = $mime[$ext]; if (-not $ctype) { $ctype = 'application/octet-stream' }
        Send-Response $net 200 'OK' $ctype ([System.IO.File]::ReadAllBytes($full)) ($method -ne 'HEAD')
      } else {
        Send-Response $net 404 'Not Found' 'text/plain' ([System.Text.Encoding]::UTF8.GetBytes('404')) ($method -ne 'HEAD')
      }
    }
  } catch { Write-Host "  request error: $($_.Exception.Message)" -ForegroundColor DarkYellow } finally { $conn.Close() }
}
