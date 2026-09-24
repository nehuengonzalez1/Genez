/* ============================================================
   EL TICKET COMO PDF
   ============================================================

   POR QUÉ UN PDF
   --------------
   Chrome le agrega a toda página web que se imprime la fecha y el título
   arriba y la dirección abajo ("Encabezados y pies de página"). Es una
   opción de cada computadora: ninguna página la puede apagar, y la única
   forma de sacarla era ir caja por caja tocando el diálogo o el registro
   de Windows (ver docs/impresion/). A un PDF, en cambio, Chrome no le
   agrega nada: la opción ni aparece. Así que el ticket se arma como PDF y
   se imprime eso, y sale limpio en cualquier computadora sin configurar
   nada.

   POR QUÉ A MANO Y NO CON UNA LIBRERÍA
   ------------------------------------
   Un ticket son renglones de texto de ancho fijo y, a veces, los
   cuadraditos de un QR. Para eso alcanza con las fuentes que todo lector
   de PDF trae de fábrica (Courier) y dos operaciones de dibujo. Una
   librería de PDF entera son 30 MB para esto.

   La letra es Courier en negrita, como en el ticket de HTML: el papel
   térmico no imprime grises, y un trazo fino sale cortado.
   ============================================================ */

const PT_POR_MM = 72 / 25.4;

/* Courier es de las 14 fuentes que todo lector de PDF trae, y con
   WinAnsiEncoding entiende los acentos y la eñe de un byte. Lo que no
   existe en esa tabla se cambia por lo más parecido antes que imprimir un
   signo raro en el ticket. */
const WINANSI = { "€": 0x80, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97 };
const PARECIDO = { "−": "-", "→": ">", "·": "·" };

function aWinAnsi(texto) {
  let s = "";
  for (const ch of String(texto)) {
    const c = PARECIDO[ch] || ch;
    const cod = c.charCodeAt(0);
    let b;
    if (WINANSI[c] != null) b = WINANSI[c];
    else if (cod < 0x80 || (cod >= 0xa0 && cod <= 0xff)) b = cod;
    else b = 0x3f; // "?"
    const letra = String.fromCharCode(b);
    s += letra === "(" || letra === ")" || letra === "\\" ? "\\" + letra : letra;
  }
  return s;
}

const n2 = (v) => (Math.round(v * 100) / 100).toString();

/**
 * Arma el PDF de un ticket.
 *
 * @param lineas    los renglones de `armarLineas`, ya del ancho del rollo
 * @param mm        ancho del papel (58 u 80)
 * @param util      lo que imprime el cabezal, en mm (ver imprimirComandera)
 * @param celdas    el QR como { n, celdas } de `celdasQR`, o null
 * @param qrMM      lado del QR impreso
 * @returns Uint8Array con el PDF
 */
export function armarPdfTicket({ lineas, mm, util, celdas = null, qrMM = 30 }) {
  const columnas = lineas.reduce((m, l) => Math.max(m, String(l).length), 0) || (mm === 58 ? 32 : 48);
  /* Courier avanza 0,6 em por carácter: la línea más larga tiene que
     entrar justa en lo que imprime el cabezal. Mismo cálculo que el
     ticket de HTML, pero sin tener que medir nada. */
  const cuerpo = (util * PT_POR_MM) / (columnas * 0.6);
  const interlineado = cuerpo * 1.28;
  const margen = (mm === 58 ? 1.5 : 2) * PT_POR_MM;

  const anchoPt = mm * PT_POR_MM;
  const altoTexto = lineas.length * interlineado;
  const ladoQR = celdas ? qrMM * PT_POR_MM : 0;
  const pieQR = celdas ? 4 * PT_POR_MM : 0;
  /* Los 2 mm de más son para que la última línea no quede al filo del
     corte, igual que en el de HTML. */
  const altoPt = margen + altoTexto + margen + ladoQR + pieQR + 2 * PT_POR_MM;

  /* El PDF cuenta de abajo para arriba: el primer renglón va arriba. */
  const partes = [];
  partes.push("BT");
  partes.push(`/F1 ${n2(cuerpo)} Tf`);
  partes.push(`${n2(interlineado)} TL`);
  partes.push(`0 ${n2(altoPt - margen - cuerpo)} Td`);
  for (const l of lineas) partes.push(`(${aWinAnsi(l)}) Tj T*`);
  partes.push("ET");

  if (celdas) {
    const { n, celdas: negras } = celdas;
    const modulo = ladoQR / n;
    const x0 = (util * PT_POR_MM - ladoQR) / 2;
    const yArriba = altoPt - margen - altoTexto - margen;
    partes.push("0 g");
    /* Los módulos negros seguidos de una misma fila van en un solo
       rectángulo: menos operaciones y ninguna rendija blanca entre ellos. */
    const porFila = new Map();
    for (const [x, y] of negras) {
      if (!porFila.has(y)) porFila.set(y, []);
      porFila.get(y).push(x);
    }
    for (const [y, xs] of porFila) {
      xs.sort((a, b) => a - b);
      let desde = xs[0];
      let hasta = xs[0];
      const tramo = () => partes.push(`${n2(x0 + desde * modulo)} ${n2(yArriba - (y + 1) * modulo)} ${n2((hasta - desde + 1) * modulo)} ${n2(modulo)} re f`);
      for (let i = 1; i < xs.length; i++) {
        if (xs[i] === hasta + 1) hasta = xs[i];
        else { tramo(); desde = hasta = xs[i]; }
      }
      tramo();
    }
  }

  const contenido = partes.join("\n");
  const objetos = [
    /* /PrintScaling /None: que el lector no achique la hoja para
       "ajustarla" al papel. El ticket ya es del tamaño del rollo. */
    "<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /PrintScaling /None >> >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n2(anchoPt)} ${n2(altoPt)}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
  ];

  /* Todo lo de arriba es de un byte por carácter, así que la posición en
     el texto es la posición en el archivo: la tabla xref sale de ahí. */
  let pdf = "%PDF-1.4\n";
  const posiciones = [];
  objetos.forEach((o, i) => {
    posiciones.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const p of posiciones) pdf += `${String(p).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return bytes;
}

/**
 * Imprime un PDF con el diálogo del navegador. El visor de PDF de Chrome
 * no agrega encabezados ni pies.
 *
 * El iframe no tiene que ser visible, a diferencia del ticket de HTML
 * (ver imprimirComandera): el que dibuja el PDF es el visor, no la
 * composición de la página. Es la misma forma en que lo hace print-js.
 */
export function imprimirPdf(bytes) {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const marco = document.createElement("iframe");
    marco.setAttribute("aria-hidden", "true");
    marco.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;visibility:hidden";
    let listo = false;
    const sacar = () => { try { marco.remove(); URL.revokeObjectURL(url); } catch (e) {} };
    marco.onload = () => {
      if (listo) return;
      listo = true;
      /* El visor de PDF termina de montarse un instante después del
         `load`: imprimir en el acto a veces abre el diálogo vacío. */
      setTimeout(() => {
        try {
          marco.contentWindow.focus();
          marco.contentWindow.print();
          resolver();
        } catch (e) {
          sacar();
          rechazar(e);
        }
        /* El visor de PDF no avisa cuándo se cerró el diálogo: el minuto
           alcanza para cualquier impresión. */
        setTimeout(sacar, 60000);
      }, 250);
    };
    marco.src = url;
    document.body.appendChild(marco);
  });
}
