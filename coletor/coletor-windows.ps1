# ══════════════════════════════════════════════════════════════
#  Coletor SIR para Windows  (versão w1)
#  - Dois cliques no arquivo "Coletor SIR.cmd" e pronto.
#  - Entra no SIR com o SEU usuário e senha, lê as listas de RAL e REC
#    e envia ao seu servidor a cada 5 minutos, enquanto a janela estiver aberta.
#  - Não precisa instalar nada, nem favorito, nem deixar o navegador aberto.
#  - A senha só fica guardada se você pedir, e criptografada pelo Windows
#    (só a sua conta, neste computador, consegue abrir).
#  Linhas trocadas pelo SIR Dashboard ao baixar: __SIR_URL__ e __SIR_TOKEN__
# ══════════════════════════════════════════════════════════════
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$VERSAO   = 'w1'
$SRV_URL  = '__SIR_URL__'
$SRV_TOK  = '__SIR_TOKEN__'
$BASE     = 'http://172.30.130.133'
if ($env:SIR_BASE) { $BASE = $env:SIR_BASE }          # só para testes
$INTERVALO = 300
$REC_PATH = '/generico/NOVAlistaDeTarefasItensRecebidos.cfm'
$RAL_PATH = '/navegacao/NOVAframesetNivel2ListaDeTarefas.cfm'
$F_FILTRO = 'frameFiltro'
$F_LISTA  = @('framesetNivel2ListaDeTarefas', 'frameNivel3ItensRecebidos', 'frameNivel2ItensRecebidosPrincipal')
$HEAD_RAL = @('Designação','Tipo Ral','Anorm.','Num.Recup.','Abertura','Duração','Item','CF Exec.','Ass.','Técn.','Resp.','Anatel','Prejuízo')
$HEAD_REC = @('ID','Prioridade','Num.Recup.','Cliente','Designação','Abertura','CF Exec.','Resp.','Técnico')

try { $Host.UI.RawUI.WindowTitle = 'Coletor SIR' } catch {}
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch {}
try { [Net.WebRequest]::DefaultWebProxy.Credentials = [Net.CredentialCache]::DefaultNetworkCredentials } catch {}

$PASTA = if ($env:APPDATA) { Join-Path $env:APPDATA 'ColetorSIR' } else { Join-Path $HOME '.coletorsir' }
$ARQ_LOGIN = Join-Path $PASTA 'login.xml'
$ARQ_DIAG  = Join-Path $PASTA 'diagnostico.txt'
New-Item -ItemType Directory -Force -Path $PASTA | Out-Null

function Hora { (Get-Date).ToString('HH:mm:ss') }
function Info($t)  { Write-Host ("[{0}] {1}" -f (Hora), $t) }
function Ok($t)    { Write-Host ("[{0}] {1}" -f (Hora), $t) -ForegroundColor Green }
function Aviso($t) { Write-Host ("[{0}] {1}" -f (Hora), $t) -ForegroundColor Yellow }
function Erro($t)  { Write-Host ("[{0}] {1}" -f (Hora), $t) -ForegroundColor Red }

# ─────────── Usuário e senha ───────────
function Ler-Login([bool]$forcar) {
  if (-not $forcar -and (Test-Path $ARQ_LOGIN)) {
    try { $c = Import-Clixml $ARQ_LOGIN; if ($c.UserName) { return $c } } catch {}
  }
  if ($env:SIR_USER -and $env:SIR_PASS) {           # só para testes
    return New-Object PSCredential($env:SIR_USER, (ConvertTo-SecureString $env:SIR_PASS -AsPlainText -Force))
  }
  Write-Host ''
  Write-Host 'Entre com o seu login do SIR (o mesmo da tela do SIR):' -ForegroundColor Cyan
  $u = Read-Host '  Usuário'
  $p = Read-Host '  Senha' -AsSecureString
  $c = New-Object PSCredential($u.Trim(), $p)
  $r = Read-Host '  Lembrar neste computador para não perguntar de novo? (S/N)'
  if ($r -match '^[sS]') {
    try { $c | Export-Clixml -Path $ARQ_LOGIN; Ok 'Login guardado (criptografado pelo Windows, só para a sua conta).' }
    catch { Aviso 'Não consegui guardar o login; vou perguntar de novo da próxima vez.' }
  } elseif (Test-Path $ARQ_LOGIN) { Remove-Item $ARQ_LOGIN -Force }
  return $c
}
function Senha-Texto($c) { return $c.GetNetworkCredential().Password }

# ─────────── HTTP ───────────
$script:Sessao = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$script:Sessao.UserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ColetorSIR/' + $VERSAO

function Decodificar([byte[]]$b) {
  try { return (New-Object Text.UTF8Encoding($false, $true)).GetString($b) }
  catch { return [Text.Encoding]::GetEncoding(1252).GetString($b) }
}
function Abrir([string]$url, [string]$metodo = 'GET', $campos = $null) {
  $p = @{ Uri = $url; Method = $metodo; WebSession = $script:Sessao; UseBasicParsing = $true; TimeoutSec = 60; MaximumRedirection = 10 }
  if ($campos) {
    $pares = foreach ($k in $campos.Keys) { [Net.WebUtility]::UrlEncode([string]$k) + '=' + [Net.WebUtility]::UrlEncode([string]$campos[$k]) }
    $corpo = ($pares -join '&')
    if ($metodo -eq 'GET') { $p.Uri = $url + $(if ($url.Contains('?')) { '&' } else { '?' }) + $corpo }
    else { $p.Body = $corpo; $p.ContentType = 'application/x-www-form-urlencoded' }
  }
  $r = Invoke-WebRequest @p
  $script:Trilha += ,('{0} {1}' -f $metodo, ([Uri]$url).AbsolutePath)
  $ms = New-Object IO.MemoryStream; $r.RawContentStream.Position = 0; $r.RawContentStream.CopyTo($ms)
  $final = $url
  try { if ($r.BaseResponse.ResponseUri) { $final = $r.BaseResponse.ResponseUri.AbsoluteUri } } catch {}
  try { if ($r.BaseResponse.RequestMessage.RequestUri) { $final = $r.BaseResponse.RequestMessage.RequestUri.AbsoluteUri } } catch {}
  $html = Decodificar $ms.ToArray()
  $q = ([regex]::Matches($html, '(?is)<i?frame\b[^>]*name\s*=\s*["'']?([\w-]+)') | ForEach-Object { $_.Groups[1].Value }) -join ','
  $script:Trilha += ,('   -> {0} | quadros: {1} | forms: {2} | tabelas: {3} | login: {4}' -f ([Uri]$final).AbsolutePath, $q, ([regex]::Matches($html, '(?i)<form\b')).Count, ([regex]::Matches($html, '(?i)<table\b')).Count, (Eh-Login $html))
  return @{ Html = $html; Url = $final }
}
function Juntar([string]$base, [string]$rel) {
  if (-not $rel) { return $base }
  return (New-Object Uri((New-Object Uri($base)), [Net.WebUtility]::HtmlDecode($rel))).AbsoluteUri
}

# ─────────── Leitura de HTML (sem depender de nada instalado) ───────────
function Atributos([string]$s) {
  $h = @{}
  foreach ($m in [regex]::Matches($s, '([\w:-]+)\s*=\s*(?:"([^"]*)"|''([^'']*)''|([^\s>]+))')) {
    $v = if ($m.Groups[2].Success) { $m.Groups[2].Value } elseif ($m.Groups[3].Success) { $m.Groups[3].Value } else { $m.Groups[4].Value }
    $h[$m.Groups[1].Value.ToLower()] = [Net.WebUtility]::HtmlDecode($v)
  }
  foreach ($m in [regex]::Matches($s, '(?i)(?:^|\s)(checked|selected)(?=[\s/>]|$)')) { $h[$m.Groups[1].Value.ToLower()] = '1' }
  return $h
}
function Quadros([string]$html) {
  $out = @()
  foreach ($m in [regex]::Matches($html, '(?is)<i?frame\b([^>]*)>')) {
    $a = Atributos $m.Groups[1].Value
    if ($a['src']) { $out += ,@{ Nome = [string]$a['name']; Src = $a['src'] } }
  }
  return ,$out
}
function Formularios([string]$html) {
  $out = @()
  foreach ($f in [regex]::Matches($html, '(?is)<form\b([^>]*)>(.*?)(?:</form>|$)')) {
    $fa = Atributos $f.Groups[1].Value
    $corpo = $f.Groups[2].Value
    $campos = [ordered]@{}; $botoes = @{}; $selects = @{}
    foreach ($m in [regex]::Matches($corpo, '(?is)<input\b([^>]*)>')) {
      $a = Atributos $m.Groups[1].Value; $n = $a['name']; if (-not $n) { continue }
      $t = ([string]$a['type']).ToLower()
      if ($t -in @('submit','button','image','reset')) { $botoes[$n] = [string]$a['value']; continue }
      if ($t -eq 'file') { continue }
      if ($t -in @('checkbox','radio') -and -not $a['checked']) { continue }
      $campos[$n] = [string]$a['value']
    }
    foreach ($m in [regex]::Matches($corpo, '(?is)<button\b([^>]*)>')) {
      $a = Atributos $m.Groups[1].Value; if ($a['name']) { $botoes[$a['name']] = [string]$a['value'] }
    }
    foreach ($m in [regex]::Matches($corpo, '(?is)<select\b([^>]*)>(.*?)</select>')) {
      $a = Atributos $m.Groups[1].Value; $n = $a['name']; if (-not $n) { continue }
      $ops = @(); $esc = $null; $sel = $false
      foreach ($o in [regex]::Matches($m.Groups[2].Value, '(?is)<option\b([^>]*)>([^<]*)')) {
        $oa = Atributos $o.Groups[1].Value
        $v = if ($oa.ContainsKey('value')) { $oa['value'] } else { [Net.WebUtility]::HtmlDecode($o.Groups[2].Value).Trim() }
        $ops += $v
        if ($null -eq $esc) { $esc = $v }
        if ($oa['selected'] -and -not $sel) { $esc = $v; $sel = $true }
      }
      $selects[$n] = $ops; $campos[$n] = [string]$esc
    }
    foreach ($m in [regex]::Matches($corpo, '(?is)<textarea\b([^>]*)>(.*?)</textarea>')) {
      $a = Atributos $m.Groups[1].Value; if ($a['name']) { $campos[$a['name']] = [Net.WebUtility]::HtmlDecode($m.Groups[2].Value) }
    }
    $out += ,@{ Action = [string]$fa['action']; Method = $(if (([string]$fa['method']).ToLower() -eq 'post') { 'POST' } else { 'GET' }); Campos = $campos; Botoes = $botoes; Selects = $selects }
  }
  return ,$out
}
function Eh-Login([string]$html) { return [regex]::IsMatch($html, '(?is)<input\b[^>]*type\s*=\s*["'']?password') }

function Texto-Celula([string]$s) {
  $s = [regex]::Replace($s, '(?is)<(script|style)\b.*?</\1>', ' ')
  $s = [regex]::Replace($s, '(?s)<[^>]*>', ' ')
  $s = [Net.WebUtility]::HtmlDecode($s) -replace [char]0xA0, ' '
  return ([regex]::Replace($s, '\s+', ' ')).Trim()
}
# Mesma regra do robô original: fica com as linhas que têm o número de colunas mais comum
function Linhas-Tabela([string]$html) {
  $linhas = New-Object Collections.Generic.List[object]
  $partes = [regex]::Split($html, '(?i)<tr\b[^>]*>')
  for ($i = 1; $i -lt $partes.Length; $i++) {
    $tr = [regex]::Split($partes[$i], '(?i)</tr\s*>')[0]
    $cel = [regex]::Split($tr, '(?i)<t[dh]\b[^>]*>')
    if ($cel.Length -lt 2) { continue }
    $row = @(); for ($j = 1; $j -lt $cel.Length; $j++) { $row += (Texto-Celula ([regex]::Split($cel[$j], '(?i)</t[dh]\s*>')[0])) }
    if (($row | Where-Object { $_ }).Count -gt 0) { $linhas.Add($row) }
  }
  $cont = @{}; foreach ($r in $linhas) { $cont[$r.Count] = 1 + [int]$cont[$r.Count] }
  $cols = 0; $max = 0; foreach ($k in $cont.Keys) { if ($cont[$k] -gt $max) { $max = $cont[$k]; $cols = $k } }
  return @{ Cols = $cols; Linhas = @($linhas | Where-Object { $_.Count -eq $cols }) }
}
function Para-Csv($res, [string[]]$cab, [string]$nome) {
  if ($res.Cols -ne $cab.Count) { throw "formato:${nome}: esperava $($cab.Count) colunas, veio $($res.Cols)" }
  $ok = @($res.Linhas | Where-Object { -not ($_[0] -eq $cab[0] -and $_[1] -eq $cab[1]) })
  if ($ok.Count -eq 0) { throw "vazio:${nome}" }
  $sb = New-Object Text.StringBuilder
  [void]$sb.Append(($cab -join ';') + "`n")
  foreach ($r in $ok) { [void]$sb.Append((($r | ForEach-Object { ($_ -replace ';', ',') -replace '[\r\n"]', ' ' }) -join ';') + "`n") }
  return @{ Csv = $sb.ToString(); N = $ok.Count }
}

# ─────────── Login no SIR ───────────
function Achar-FormLogin([string]$url, [int]$prof) {
  $p = Abrir $url
  foreach ($f in (Formularios $p.Html)) { if ($f.Campos.Contains('usuario') -or ($f.Campos.Keys | Where-Object { $_ -match '^(usuario|login|user)' })) { return @{ Form = $f; Url = $p.Url } } }
  if ($prof -lt 3) { foreach ($q in (Quadros $p.Html)) { $r = Achar-FormLogin (Juntar $p.Url $q.Src) ($prof + 1); if ($r) { return $r } } }
  return $null
}
function Entrar($cred) {
  Info 'Entrando no SIR...'
  $fl = Achar-FormLogin ($BASE + '/') 0
  if (-not $fl) { throw 'estrutura:não achei a tela de login do SIR' }
  $f = $fl.Form; $c = [ordered]@{}; foreach ($k in $f.Campos.Keys) { $c[$k] = $f.Campos[$k] }
  $nu = @($c.Keys | Where-Object { $_ -match '^(usuario|login|user)' })[0]
  $ns = @($c.Keys | Where-Object { $_ -match '^(senha|pass)' })[0]
  if (-not $nu -or -not $ns) { throw 'estrutura:campos de usuário/senha não encontrados' }
  $c[$nu] = $cred.UserName; $c[$ns] = (Senha-Texto $cred)
  foreach ($b in $f.Botoes.Keys) { $c[$b] = $f.Botoes[$b]; break }
  $null = Abrir (Juntar $fl.Url $f.Action) $f.Method $c
  $t = Abrir ($BASE + $REC_PATH)
  if (Eh-Login $t.Html) { throw 'login' }
  Ok 'Login no SIR feito.'
}

# ─────────── Coletas ───────────
function Coletar-Rec {
  $p = Abrir ($BASE + $REC_PATH)
  if (Eh-Login $p.Html) { throw 'sessao' }
  return Para-Csv (Linhas-Tabela $p.Html) $HEAD_REC 'REC'
}
# Desce pelos quadros (primeiro os nomes conhecidos) até achar a tabela de 13 colunas
function Achar-Lista([string]$html, [string]$url, [int]$prof) {
  $r = Linhas-Tabela $html
  if ($r.Cols -eq 13 -and $r.Linhas.Count -gt 0) { return $r }
  if ($prof -ge 4) { return $null }
  $qs = Quadros $html
  $ord = @($qs | Where-Object { $F_LISTA -contains $_.Nome }) + @($qs | Where-Object { $F_LISTA -notcontains $_.Nome -and $_.Nome -ne $F_FILTRO })
  foreach ($q in $ord) {
    $p = Abrir (Juntar $url $q.Src)
    if (Eh-Login $p.Html) { throw 'sessao' }
    $x = Achar-Lista $p.Html $p.Url ($prof + 1); if ($x) { return $x }
  }
  return $null
}
function Coletar-Ral {
  $top = Abrir ($BASE + $RAL_PATH)
  if (Eh-Login $top.Html) { throw 'sessao' }
  $qf = @((Quadros $top.Html) | Where-Object { $_.Nome -eq $F_FILTRO })[0]
  if (-not $qf) { throw "estrutura:quadro $F_FILTRO não encontrado" }
  $fp = Abrir (Juntar $top.Url $qf.Src)
  $f = @((Formularios $fp.Html) | Where-Object { $_.Selects.ContainsKey('indic_tipo_recup') })[0]
  if (-not $f) { throw 'estrutura:filtro de tipo (indic_tipo_recup) não encontrado' }
  if ($f.Selects['indic_tipo_recup'] -notcontains 'RAL') { throw ('estrutura:opção RAL não existe no filtro (' + ($f.Selects['indic_tipo_recup'] -join ',') + ')') }
  $c = [ordered]@{}; foreach ($k in $f.Campos.Keys) { $c[$k] = $f.Campos[$k] }
  $c['indic_tipo_recup'] = 'RAL'
  if ($f.Botoes.ContainsKey('confirma')) { $c['confirma'] = $f.Botoes['confirma'] }
  $res = Abrir (Juntar $fp.Url $f.Action) $f.Method $c
  if (Eh-Login $res.Html) { throw 'sessao' }
  $lista = Achar-Lista $res.Html $res.Url 0
  if (-not $lista) {                       # o filtro pode ter ficado guardado na sessão: relê a tela
    $top2 = Abrir ($BASE + $RAL_PATH)
    $lista = Achar-Lista $top2.Html $top2.Url 0
  }
  if (-not $lista) { throw 'estrutura:lista de RAL não encontrada depois do filtro' }
  return Para-Csv $lista $HEAD_RAL 'RAL'
}
function Enviar($ral, $rec) {
  $corpo = @{ token = $SRV_TOK; ral = $ral; rec = $rec; by = "Coletor Windows $VERSAO" } | ConvertTo-Json -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($corpo)
  try { return Invoke-RestMethod -Uri ($SRV_URL + '/ingest') -Method Post -Body $bytes -ContentType 'application/json; charset=utf-8' -TimeoutSec 60 -UseBasicParsing }
  catch {
    $st = 0; try { $st = [int]$_.Exception.Response.StatusCode } catch {}
    if ($st -eq 403) { throw 'servidor:codigo' }
    if ($st) { throw "servidor:resposta $st" }
    throw ('servidor:rede ' + $_.Exception.Message)
  }
}

function Explicar([string]$e) {
  $tipo = $e.Split(':')[0]
  switch ($tipo) {
    'login'    { return 'Usuário ou senha do SIR não aceitos. Vou pedir de novo.' }
    'estrutura'{ return "A tela do SIR está diferente do esperado ($e). Envie o arquivo diagnostico.txt para o Claude ajustar." }
    'formato'  { return "A lista veio com colunas diferentes ($e). Envie o arquivo diagnostico.txt para o Claude ajustar." }
    'vazio'    { return "A lista ($e) veio vazia. Tento de novo na próxima coleta." }
    'servidor' {
      if ($e -eq 'servidor:codigo') { return 'O código deste coletor não vale mais (foi gerado outro). Baixe o coletor de novo no SIR Dashboard.' }
      return "Não consegui entregar ao seu servidor ($e). A rede pode estar bloqueando workers.dev."
    }
    default    { return "Falha: $e" }
  }
}

# ─────────── Início ───────────
Clear-Host
Write-Host '══════════════════════════════════════════════' -ForegroundColor Cyan
Write-Host '  COLETOR SIR  ·  RAL e REC para o seu painel' -ForegroundColor Cyan
Write-Host '══════════════════════════════════════════════' -ForegroundColor Cyan
Write-Host '  Deixe esta janela aberta (pode minimizar).'
Write-Host '  Ela coleta e envia a cada 5 minutos. Para parar, feche a janela.'
if ($SRV_TOK -like '__*') { Erro 'Este arquivo não tem o código do coletor. Baixe-o pelo SIR Dashboard.'; return }

$cred = Ler-Login $false
$logado = $false; $envios = 0; $falhas = 0
while ($true) {
  $diag = [ordered]@{ versao = $VERSAO; em = (Get-Date).ToString('s'); base = $BASE }
  $script:Trilha = @()
  try {
    if (-not $logado) { Entrar $cred; $logado = $true }
    Info 'Lendo RAL e REC no SIR...'
    try { $rec = Coletar-Rec; $ral = Coletar-Ral }
    catch { if ("$($_.Exception.Message)" -eq 'sessao') { $logado = $false; Entrar $cred; $logado = $true; $rec = Coletar-Rec; $ral = Coletar-Ral } else { throw } }
    $diag.ral = $ral.N; $diag.rec = $rec.N
    Info "Enviando ao seu servidor (RAL $($ral.N) · REC $($rec.N))..."
    $j = Enviar $ral.Csv $rec.Csv
    $envios++; $falhas = 0
    $novos = if ($j.novos) { " · $($j.novos) ticket(s) novo(s)" } else { '' }
    Ok "Entregue! RAL $($ral.N) · REC $($rec.N)$novos  (envios: $envios)"
  } catch {
    $msg = "$($_.Exception.Message)"
    $falhas++; $diag.erro = $msg; $diag.trilha = $script:Trilha
    Erro (Explicar $msg)
    if ($msg -eq 'login') { $logado = $false; $cred = Ler-Login $true }
    elseif ($msg -like 'sessao*') { $logado = $false }
    try { ($diag | ConvertTo-Json) | Set-Content -Path $ARQ_DIAG -Encoding UTF8; Info "Diagnóstico salvo em $ARQ_DIAG (sem dados de tickets nem senha)" } catch {}
  }
  if ($env:SIR_UMA_VEZ) { break }            # só para testes
  $prox = (Get-Date).AddSeconds($INTERVALO).ToString('HH:mm')
  Info "Próxima coleta às $prox."
  Start-Sleep -Seconds $INTERVALO
}
