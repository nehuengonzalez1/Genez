# ============================================================
#  GENEZ - IMPRESION DIRECTA
# ============================================================
#
#  Un navegador no puede imprimir sin abrir su ventana de impresion, y a
#  todo lo que imprime Chrome le agrega la fecha, el titulo y la direccion
#  de la pagina. Esto corre en la computadora de la caja y hace de puente:
#  Genez le manda el ticket ya armado en el idioma de la impresora termica
#  (ESC/POS) y esto se lo pasa directo, sin ventana, sin encabezados y con
#  el corte de papel.
#
#  Es tonto a proposito. No sabe que es un ticket: recibe bytes y los manda
#  tal cual a la impresora elegida. Todo lo que se imprime lo arma Genez
#  (src/ui/escpos.js), asi que un cambio en el ticket no obliga a
#  reinstalar esto en cada caja.
#
#  QUIEN LE PUEDE HABLAR
#  ---------------------
#  Escucha solo en 127.0.0.1: desde otra computadora de la red no se llega.
#  Y dentro de la computadora, solo contesta a las paginas de Genez: exige
#  el encabezado X-Genez, que obliga al navegador a preguntar antes (CORS),
#  y responde a esa pregunta solo si el origen es de Genez. Sin eso,
#  cualquier pagina abierta en esa computadora podria mandar a imprimir.
#
#  Se instala con instalar-impresora-genez.cmd, que lo deja arrancando con
#  Windows. Ver docs/impresion/README.md.
# ============================================================

$ErrorActionPreference = 'Stop'
$VERSION = '1'
$PUERTO = 9197
$CARPETA = Join-Path $env:LOCALAPPDATA 'GenezImpresora'
$REGISTRO = Join-Path $CARPETA 'registro.txt'

# Las paginas de Genez, y el servidor de desarrollo.
$ORIGENES = @(
  'https://genez.com.ar',
  'https://www.genez.com.ar',
  'http://localhost:5173',
  'http://localhost:5190'
)

New-Item -ItemType Directory -Force -Path $CARPETA | Out-Null

function Anotar([string]$texto) {
  try {
    $linea = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '  ' + $texto
    Add-Content -Path $REGISTRO -Value $linea -Encoding UTF8
    # El registro no crece para siempre.
    if ((Get-Item $REGISTRO).Length -gt 512KB) {
      Get-Content $REGISTRO -Tail 2000 | Set-Content $REGISTRO -Encoding UTF8
    }
  } catch {}
}

# Mandar bytes crudos a una impresora de Windows. Es la misma forma en que
# imprimen los sistemas de punto de venta: el driver no interpreta nada,
# los comandos ESC/POS le llegan a la impresora tal cual.
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class ImpresoraCruda {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFO {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }

  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern bool OpenPrinter(string nombre, out IntPtr h, IntPtr defecto);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern int StartDocPrinter(IntPtr h, int nivel, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFO doc);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool WritePrinter(IntPtr h, byte[] datos, int largo, out int escritos);

  public static void Enviar(string impresora, byte[] datos) {
    IntPtr h;
    if (!OpenPrinter(impresora, out h, IntPtr.Zero))
      throw new Exception("No se encontro la impresora \"" + impresora + "\".");
    try {
      DOCINFO doc = new DOCINFO();
      doc.pDocName = "Ticket Genez";
      doc.pDataType = "RAW";
      if (StartDocPrinter(h, 1, doc) == 0)
        throw new Exception("La impresora no acepto el trabajo (error " + Marshal.GetLastWin32Error() + ").");
      try {
        StartPagePrinter(h);
        int escritos;
        if (!WritePrinter(h, datos, datos.Length, out escritos) || escritos != datos.Length)
          throw new Exception("No se pudo mandar el ticket completo a la impresora.");
        EndPagePrinter(h);
      } finally {
        EndDocPrinter(h);
      }
    } finally {
      ClosePrinter(h);
    }
  }
}
"@

Add-Type -AssemblyName System.Drawing

function Impresoras {
  $lista = @()
  foreach ($n in [System.Drawing.Printing.PrinterSettings]::InstalledPrinters) { $lista += [string]$n }
  $predeterminada = (New-Object System.Drawing.Printing.PrinterSettings).PrinterName
  return @{ impresoras = $lista; predeterminada = $predeterminada }
}

# ------------------------------------------------------------
#  Un servidor HTTP minimo sobre TCP. HttpListener pide permisos de
#  administrador para escuchar; esto no, y para dos pedidos chicos alcanza.
# ------------------------------------------------------------

function Responder($flujo, [int]$codigo, [string]$cuerpo, [string]$origen) {
  $textos = @{ 200 = 'OK'; 204 = 'No Content'; 400 = 'Bad Request'; 403 = 'Forbidden'; 404 = 'Not Found'; 500 = 'Internal Server Error' }
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($cuerpo)
  $cab = "HTTP/1.1 $codigo $($textos[$codigo])`r`n"
  $cab += "Content-Type: application/json; charset=utf-8`r`n"
  $cab += "Content-Length: $($bytes.Length)`r`n"
  $cab += "Connection: close`r`n"
  if ($origen) {
    $cab += "Access-Control-Allow-Origin: $origen`r`n"
    $cab += "Vary: Origin`r`n"
    $cab += "Access-Control-Allow-Methods: GET, POST, OPTIONS`r`n"
    $cab += "Access-Control-Allow-Headers: content-type, x-genez`r`n"
    # Chrome pregunta esto antes de dejar que una pagina publica le hable a
    # la propia computadora (Private Network Access).
    $cab += "Access-Control-Allow-Private-Network: true`r`n"
    $cab += "Access-Control-Max-Age: 600`r`n"
  }
  $cab += "`r`n"
  $c = [System.Text.Encoding]::ASCII.GetBytes($cab)
  $flujo.Write($c, 0, $c.Length)
  if ($bytes.Length) { $flujo.Write($bytes, 0, $bytes.Length) }
  $flujo.Flush()
}

function Atender($cliente) {
  $flujo = $cliente.GetStream()
  $flujo.ReadTimeout = 5000
  # Encabezados, hasta la linea vacia.
  $buf = New-Object byte[] 65536
  $leido = 0
  $fin = -1
  while ($fin -lt 0 -and $leido -lt $buf.Length) {
    $n = $flujo.Read($buf, $leido, $buf.Length - $leido)
    if ($n -le 0) { return }
    $leido += $n
    $texto = [System.Text.Encoding]::ASCII.GetString($buf, 0, $leido)
    $fin = $texto.IndexOf("`r`n`r`n")
  }
  if ($fin -lt 0) { return }
  $lineas = $texto.Substring(0, $fin).Split("`n")
  $partes = $lineas[0].Trim().Split(' ')
  $metodo = $partes[0]; $ruta = $partes[1]
  $cab = @{}
  foreach ($l in $lineas[1..($lineas.Length - 1)]) {
    $i = $l.IndexOf(':')
    if ($i -gt 0) { $cab[$l.Substring(0, $i).Trim().ToLower()] = $l.Substring($i + 1).Trim() }
  }

  $origen = $cab['origin']
  $permitido = $origen -and ($ORIGENES -contains $origen)
  $eco = $(if ($permitido) { $origen } else { $null })

  if ($metodo -eq 'OPTIONS') { Responder $flujo 204 '' $eco; return }
  if (-not $permitido -or -not $cab.ContainsKey('x-genez')) {
    Responder $flujo 403 '{"error":"Solo Genez puede usar esta impresora."}' $null
    return
  }

  if ($metodo -eq 'GET' -and $ruta -eq '/estado') {
    $i = Impresoras
    $cuerpo = @{ version = $VERSION; impresoras = $i.impresoras; predeterminada = $i.predeterminada } | ConvertTo-Json -Compress
    Responder $flujo 200 $cuerpo $eco
    return
  }

  if ($metodo -eq 'POST' -and $ruta -eq '/imprimir') {
    $largo = [int]$cab['content-length']
    $inicio = $fin + 4
    $cuerpoBytes = New-Object byte[] $largo
    $yaTengo = [Math]::Min($leido - $inicio, $largo)
    if ($yaTengo -gt 0) { [Array]::Copy($buf, $inicio, $cuerpoBytes, 0, $yaTengo) }
    while ($yaTengo -lt $largo) {
      $n = $flujo.Read($cuerpoBytes, $yaTengo, $largo - $yaTengo)
      if ($n -le 0) { break }
      $yaTengo += $n
    }
    try {
      $pedido = [System.Text.Encoding]::UTF8.GetString($cuerpoBytes) | ConvertFrom-Json
      $datos = [Convert]::FromBase64String($pedido.datos)
      [ImpresoraCruda]::Enviar([string]$pedido.impresora, $datos)
      Anotar ("impreso en " + $pedido.impresora + " (" + $datos.Length + " bytes)")
      Responder $flujo 200 '{"ok":true}' $eco
    } catch {
      # PowerShell envuelve el error de C# en "Excepcion al llamar a Enviar...":
      # lo que sirve leer es el de adentro.
      $e = $_.Exception
      while ($e.InnerException) { $e = $e.InnerException }
      $msg = $e.Message
      Anotar ("error: " + $msg)
      Responder $flujo 500 (@{ error = $msg } | ConvertTo-Json -Compress) $eco
    }
    return
  }

  Responder $flujo 404 '{"error":"No existe."}' $eco
}

# Uno solo por computadora: si el puerto esta tomado, ya hay uno andando.
$servidor = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $PUERTO)
try { $servidor.Start() } catch { Anotar "ya habia uno andando en el puerto $PUERTO"; exit 0 }
Anotar "arranco la version $VERSION en el puerto $PUERTO"

while ($true) {
  $cliente = $servidor.AcceptTcpClient()
  try { Atender $cliente } catch { Anotar ("pedido fallido: " + $_.Exception.Message) }
  finally { $cliente.Close() }
}
