# ══════════════════════════════════════════════════════════════
#  Coletor SIR para Windows  (versão w3)
#  - w3: abre o link do número de RECs associadas (coluna Ass.) de cada RAL
#    das suas áreas e envia a lista dessas RECs junto (coluna "RECs Assoc.").
#  - Dois cliques no arquivo "Coletor SIR.cmd" e pronto.
#  - Entra no SIR com o SEU usuário e senha, lê as listas de RAL e REC
#    e envia ao seu servidor a cada 5 minutos, enquanto a janela estiver aberta.
#  - Não precisa instalar nada, nem favorito, nem deixar o navegador aberto.
#  - O login fica guardado criptografado pelo Windows
#    (só a sua conta, neste computador, consegue abrir).
#  - Na 1ª vez cria o ícone "Coletor SIR" na Área de Trabalho.
#  Linhas trocadas pelo SIR Dashboard ao baixar: __SIR_URL__ e __SIR_TOKEN__
# ══════════════════════════════════════════════════════════════
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$VERSAO   = 'w3'
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
  Write-Host '  Digite o seu login do SIR (o mesmo que você usa na tela do SIR)' -ForegroundColor Cyan
  Write-Host '  e aperte ENTER depois de cada um. A senha não aparece enquanto você digita.' -ForegroundColor Cyan
  Write-Host ''
  $u = Read-Host '  Usuário'
  $p = Read-Host '  Senha' -AsSecureString
  $c = New-Object PSCredential($u.Trim(), $p)
  # Fica guardado só neste computador, protegido pelo Windows, para não perguntar de novo
  try { $c | Export-Clixml -Path $ARQ_LOGIN } catch {}
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
  $brutas = New-Object Collections.Generic.List[object]
  $partes = [regex]::Split($html, '(?i)<tr\b[^>]*>')
  for ($i = 1; $i -lt $partes.Length; $i++) {
    $tr = [regex]::Split($partes[$i], '(?i)</tr\s*>')[0]
    $cel = [regex]::Split($tr, '(?i)<t[dh]\b[^>]*>')
    if ($cel.Length -lt 2) { continue }
    $row = @(); $raw = @()
    for ($j = 1; $j -lt $cel.Length; $j++) { $c = [regex]::Split($cel[$j], '(?i)</t[dh]\s*>')[0]; $raw += $c; $row += (Texto-Celula $c) }
    if (($row | Where-Object { $_ }).Count -gt 0) { $linhas.Add($row); $brutas.Add($raw) }
  }
  $cont = @{}; foreach ($r in $linhas) { $cont[$r.Count] = 1 + [int]$cont[$r.Count] }
  $cols = 0; $max = 0; foreach ($k in $cont.Keys) { if ($cont[$k] -gt $max) { $max = $cont[$k]; $cols = $k } }
  $ln = @(); $br = @()
  for ($i = 0; $i -lt $linhas.Count; $i++) { if ($linhas[$i].Count -eq $cols) { $ln += ,$linhas[$i]; $br += ,$brutas[$i] } }
  return @{ Cols = $cols; Linhas = $ln; Brutas = $br }
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
  if ($r.Cols -eq 13 -and $r.Linhas.Count -gt 0) { $r.Url = $url; return $r }
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
# ─────────── RECs associadas às RAL (link do número na coluna "Ass.") ───────────
# Só as RAL das áreas do painel (RJ/ES). Cada RAL com Ass. > 0 tem o número como
# link; o coletor abre esse link e lê as RECs listadas. Para não pesar no SIR,
# relê a RAL quando a quantidade muda e, mesmo sem mudança, a cada 3 coletas (15 min).
$CFS_PAINEL = @('RT/VTA /MTN/FFA/FO','RT/VTA /MTS/FFA/FO','RT/VTA /NOR/FFA/FO','RT/VTA /SUL/FFA/FO',
  'RT/RJO /SUF/NET/FO','RC/RJO /SUF/NET/FO','RT/RJO /SEF/NET/FO','RC/RJO /SEF/NET/FO','RT/RJO /NOF/NET/FO','RC/RJO /NOF/NET/FO',
  'RT/RJO /LGS/NET/FO','RC/RJO /LGS/NET/FO','RT/RJO /BX1/NET/FO','RC/RJO /BX1/NET/FO','RT/RJO /MTP/NET/FO','RC/RJO /MTP/NET/FO',
  'RT/RJO /NO1/NET/FO','RC/RJO /NO1/NET/FO','RT/RJO /NO2/NET/FO','RC/RJO /NO2/NET/FO','RT/RJO /NO3/PCS/FO','RC/RJO /NO3/NET/FO',
  'RT/RJO /OE1/NET/FO','RC/RJO /OE1/NET/FO','RT/RJO /SU2/NET/FO','RC/RJO /SU2/NET/FO','RT/RJO /CZS/NET/FO','RC/RJO /CZS/NET/FO')
$script:CacheAss = @{}
$script:Ciclo = 0
$RX_REC = '(?i)^(?:REC\s*-?\s*)?(\d{4,8})\s*/\s*(20\d\d)$'

function Link-Da-Celula([string]$raw) {
  foreach ($m in [regex]::Matches($raw, '(?is)\bhref\s*=\s*["'']([^"'']+)["'']')) {
    $v = [Net.WebUtility]::HtmlDecode($m.Groups[1].Value).Trim()
    if ($v -and $v -notmatch '^(?i)(javascript:|#)') { return $v }
  }
  # link feito por script: window.open('pagina.cfm?...') / location='...'
  $m = [regex]::Match($raw, '(?is)["'']([^"'']*?\.cfm[^"'']*)["'']')
  if ($m.Success) { return [Net.WebUtility]::HtmlDecode($m.Groups[1].Value).Trim() }
  return $null
}
function Limpo([string]$t) { return (([string]$t) -replace '[|^;\r\n"]', ' ' -replace '\s+', ' ').Trim() }

# Lê as RECs de uma página (e dos quadros dentro dela)
function Recs-Da-Pagina([string]$html, [string]$url, [string]$ralNum, [int]$prof, $achadas) {
  $cab = $null
  $partes = [regex]::Split($html, '(?i)<tr\b[^>]*>')
  for ($i = 1; $i -lt $partes.Length; $i++) {
    $tr = [regex]::Split($partes[$i], '(?i)</tr\s*>')[0]
    $cel = [regex]::Split($tr, '(?i)<t[dh]\b[^>]*>')
    if ($cel.Length -lt 2) { continue }
    $row = @(); for ($j = 1; $j -lt $cel.Length; $j++) { $row += (Texto-Celula ([regex]::Split($cel[$j], '(?i)</t[dh]\s*>')[0])) }
    $k = -1; for ($j = 0; $j -lt $row.Count; $j++) { if ($row[$j] -match $RX_REC) { $k = $j; break } }
    if ($k -lt 0) {
      if (($row -join ' ') -match '(?i)cliente|designa|abertura') { $cab = $row }
      continue
    }
    $m = [regex]::Match($row[$k], $RX_REC)
    $num = 'REC-' + $m.Groups[1].Value + '/' + $m.Groups[2].Value
    if ($num -eq ($ralNum -replace '^RAL', 'REC') -or $achadas.Contains($num)) { continue }
    $it = @{ Rec = $num; Cliente = ''; Desig = ''; Abertura = ''; Tipo = '' }
    if ($cab -and $cab.Count -eq $row.Count) {
      for ($j = 0; $j -lt $cab.Count; $j++) {
        $h = $cab[$j].ToUpper()
        if ($h -match 'CLIENTE') { $it.Cliente = $row[$j] }
        elseif ($h -match 'DESIGNA') { $it.Desig = $row[$j] }
        elseif ($h -match 'ABERTURA') { $it.Abertura = $row[$j] }
        elseif ($h -match 'TIPO|SERVI|PRODUTO|ANORM') { if (-not $it.Tipo) { $it.Tipo = $row[$j] } }
      }
    } else {
      foreach ($c in $row) { if (-not $it.Abertura -and $c -match '^\d\d/\d\d/\d{4}') { $it.Abertura = $c } }
    }
    $achadas[$num] = $it
  }
  if ($achadas.Count -eq 0) {
    # sem tabela: procura os números de REC soltos no texto
    foreach ($m in [regex]::Matches((Texto-Celula $html), '(?i)\bREC\s*-?\s*(\d{4,8})\s*/\s*(20\d\d)')) {
      $num = 'REC-' + $m.Groups[1].Value + '/' + $m.Groups[2].Value
      if (-not $achadas.Contains($num)) { $achadas[$num] = @{ Rec = $num; Cliente = ''; Desig = ''; Abertura = ''; Tipo = '' } }
    }
  }
  if ($prof -lt 3) {
    foreach ($q in (Quadros $html)) {
      try { $p = Abrir (Juntar $url $q.Src); if (Eh-Login $p.Html) { throw 'sessao' }; Recs-Da-Pagina $p.Html $p.Url $ralNum ($prof + 1) $achadas }
      catch { if ("$($_.Exception.Message)" -eq 'sessao') { throw } }
    }
  }
}

function Anexar-Associadas($lista) {
  $script:Ciclo++
  $novas = @(); $nRal = 0; $nRec = 0; $semLink = 0; $exemplo = ''
  for ($i = 0; $i -lt $lista.Linhas.Count; $i++) {
    $r = $lista.Linhas[$i]; $val = ''
    $ralNum = $r[3]; $ass = 0
    if ([int]::TryParse(($r[8] -replace '\D', ''), [ref]$ass) -and $ass -gt 0 -and $CFS_PAINEL -contains $r[7] -and $ralNum -match '^RAL') {
      $nRal++
      $c = $script:CacheAss[$ralNum]
      if ($c -and $c.N -eq $ass -and ($script:Ciclo - $c.Ciclo) -lt 3) { $val = $c.Val }
      else {
        $link = Link-Da-Celula $lista.Brutas[$i][8]
        if (-not $link) {
          $semLink++
          if (-not $exemplo) { $exemplo = ($lista.Brutas[$i][8] -replace '\d', '9').Substring(0, [Math]::Min(400, $lista.Brutas[$i][8].Length)) }
          if ($c) { $val = $c.Val }
        } else {
          try {
            $p = Abrir (Juntar $lista.Url $link)
            if (Eh-Login $p.Html) { throw 'sessao' }
            $ach = [ordered]@{}
            Recs-Da-Pagina $p.Html $p.Url $ralNum 0 $ach
            $val = (@($ach.Values | ForEach-Object { (@($_.Rec, $_.Cliente, $_.Desig, $_.Abertura, $_.Tipo) | ForEach-Object { Limpo $_ }) -join ' ^ ' }) -join ' | ')
            $script:CacheAss[$ralNum] = @{ N = $ass; Val = $val; Ciclo = $script:Ciclo }
            if ($ach.Count -ne $ass) { Aviso "RAL $ralNum mostra $ass REC(s) associada(s), li $($ach.Count)." }
          } catch {
            if ("$($_.Exception.Message)" -eq 'sessao') { throw }
            if ($c) { $val = $c.Val }
          }
        }
      }
      if ($val) { $nRec += ($val -split ' \| ').Count }
    }
    $novas += ,(@($r) + $val)
  }
  # tira do cache as RAL que saíram da lista
  $vivas = @{}; foreach ($r in $lista.Linhas) { $vivas[$r[3]] = 1 }
  foreach ($k in @($script:CacheAss.Keys)) { if (-not $vivas.ContainsKey($k)) { $script:CacheAss.Remove($k) } }
  $script:DiagAss = @{ rals = $nRal; recs = $nRec; semLink = $semLink; exemploCelula = $exemplo }
  if ($nRal) { Info "RECs associadas: $nRec em $nRal RAL das suas áreas$(if ($semLink) { " ($semLink sem link reconhecido)" })" }
  return @{ Cols = $lista.Cols + 1; Linhas = $novas; Url = $lista.Url }
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
  $lista = Anexar-Associadas $lista
  return Para-Csv $lista ($HEAD_RAL + 'RECs Assoc.') 'RAL'
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
    'login'    { return 'O SIR não aceitou o usuário ou a senha. Digite de novo.' }
    'estrutura'{ return "A tela do SIR está diferente do esperado ($e). Envie o arquivo diagnostico.txt para o Claude ajustar." }
    'formato'  { return "A lista veio com colunas diferentes ($e). Envie o arquivo diagnostico.txt para o Claude ajustar." }
    'vazio'    { return "A lista ($e) veio vazia. Tento de novo na próxima coleta." }
    'servidor' {
      if ($e -eq 'servidor:codigo') { return 'Este coletor ficou antigo. Abra o painel, vá em Configurações > Dados > Meu coletor e baixe de novo.' }
      return "Não consegui entregar ao seu servidor ($e). A rede pode estar bloqueando workers.dev."
    }
    default    { return "Não consegui abrir o SIR. Confira se a VPN da Claro está ligada; tento de novo sozinho. ($e)" }
  }
}

# ─────────── Atalho na Área de Trabalho (para os próximos dias) ───────────
function Instalar-Atalho {
  $dest = Join-Path $PASTA 'Coletor SIR.cmd'
  try {
    $self = $env:SIR_SELF
    if (-not $self -or -not (Test-Path -LiteralPath $self)) { return }
    if ([IO.Path]::GetFullPath($self) -ne [IO.Path]::GetFullPath($dest)) { Copy-Item -LiteralPath $self -Destination $dest -Force }
  } catch { return }
  try {
    $desk = [Environment]::GetFolderPath('Desktop')
    if (-not $desk) { return }
    $sh = New-Object -ComObject WScript.Shell
    $a = $sh.CreateShortcut((Join-Path $desk 'Coletor SIR.lnk'))
    $a.TargetPath = $dest; $a.WorkingDirectory = $PASTA
    $a.Description = 'Coletor SIR - envia RAL e REC para o seu painel'
    $a.Save()
    $script:TemAtalho = $true
  } catch {}
}

# ─────────── Início ───────────
Clear-Host
Write-Host ''
Write-Host '  ==============================================' -ForegroundColor Cyan
Write-Host '   COLETOR SIR' -ForegroundColor Cyan
Write-Host '   Leva as RAL e REC do SIR para o seu painel' -ForegroundColor Cyan
Write-Host '  ==============================================' -ForegroundColor Cyan
Write-Host ''
Write-Host '   1. A VPN da Claro precisa estar ligada.'
Write-Host '   2. DEIXE ESTA JANELA ABERTA (pode minimizar).'
Write-Host '   3. Para desligar o coletor, feche esta janela.'
Write-Host ''
if ($SRV_TOK -like '__*') { Erro 'Este arquivo está incompleto. Baixe o coletor de novo pelo SIR Dashboard.'; return }
$script:TemAtalho = $false
Instalar-Atalho
if ($script:TemAtalho) { Ok 'Criei o ícone "Coletor SIR" na sua Área de Trabalho. Nos próximos dias, é só dar dois cliques nele.' }

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
    $diag.ral = $ral.N; $diag.rec = $rec.N; $diag.associadas = $script:DiagAss
    Info "Enviando ao seu servidor (RAL $($ral.N) · REC $($rec.N))..."
    $j = Enviar $ral.Csv $rec.Csv
    $envios++; $falhas = 0
    $novos = if ($j.novos) { " · $($j.novos) ticket(s) novo(s)" } else { '' }
    Ok "FUNCIONANDO - painel atualizado: $($ral.N) RAL e $($rec.N) REC$novos"
  } catch {
    $msg = "$($_.Exception.Message)"
    $falhas++; $diag.erro = $msg; $diag.trilha = $script:Trilha
    Erro (Explicar $msg)
    if ($msg -eq 'login') { $logado = $false; $cred = Ler-Login $true }
    elseif ($msg -like 'sessao*') { $logado = $false }
    try { ($diag | ConvertTo-Json) | Set-Content -Path $ARQ_DIAG -Encoding UTF8; Info "Diagnóstico salvo em $ARQ_DIAG (sem dados de tickets nem senha)" } catch {}
  }
  if ($env:SIR_UMA_VEZ) { break }            # só para testes
  if ($falhas -gt 0 -and "$msg" -eq 'login') { continue }      # login corrigido: tenta na hora
  $espera = if ($falhas -gt 0) { 60 } else { $INTERVALO }       # depois de uma falha, tenta de novo em 1 minuto
  $prox = (Get-Date).AddSeconds($espera).ToString('HH:mm')
  if ($falhas -gt 0) { Info "Tento de novo às $prox." } else { Info "Próxima atualização às $prox. Pode minimizar esta janela." }
  Start-Sleep -Seconds $espera
}
