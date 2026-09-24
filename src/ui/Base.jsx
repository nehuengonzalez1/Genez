/* ============================================================
   4. UI BASE
   ============================================================ */

import React, { useEffect, useRef, useContext, createContext, useCallback } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import QRCode from "qrcode";
import { armarPdfTicket, imprimirPdf } from "./ticketPdf.js";
import { armarEscPos } from "./escpos.js";
import { impresoraElegida, imprimirDirecto } from "./agenteImpresion.js";
import { HOY, fdatel } from "../datos/generador.js";
import { pct, money, nf, nf2, moneyk, FISCAL_INICIAL, letraComprobante, discriminaIVA, condicionLegal, medioPorK } from "../utils/helpers.js";

export const SEV = {
  alta: { pill: "bg-mal-suave text-mal border-mal", dot: "bg-mal", label: "Urgente" },
  media: { pill: "bg-ojo-suave text-ojo border-ojo", dot: "bg-ojo", label: "Atención" },
  info: { pill: "bg-superficie-2 text-texto-suave border-borde", dot: "bg-superficie-3", label: "Dato" },
};

export function Card({ children, className = "" }) {
  return <div className={`bg-superficie border border-borde rounded-2xl ${className}`}>{children}</div>;
}

/* `icono` y `chispa` son opcionales y no cambian nada si no se pasan: sin
   ellos esta tarjeta se dibuja igual que siempre, que es lo que necesitan
   Caja, Stock, Compras y Reportes, que la usan desde antes.

   `chispa` entra como nodo y no como serie de números a propósito: así
   esta tarjeta no depende del gráfico, y el gráfico no depende de ella. */
export function Kpi({ label, valor, delta, sub, tono = "neutro", icono: Ico, chispa }) {
  const col = tono === "bien" ? "text-bien" : tono === "mal" ? "text-mal" : "text-texto";
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        {Ico && (
          <span className="w-8 h-8 shrink-0 rounded-xl bg-superficie-2 flex items-center justify-center">
            <Ico size={15} className="text-acento" />
          </span>
        )}
        <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold min-w-0 truncate">{label}</div>
      </div>
      <div className={`f-d text-3xl mt-1 tabular-nums ${col}`}>{valor}</div>
      <div className="flex items-center gap-2 mt-1">
        {delta !== undefined && delta !== null && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${delta >= 0 ? "text-bien" : "text-mal"}`}>
            {delta >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {pct(Math.abs(delta))}
          </span>
        )}
        {sub && <span className="text-xs text-texto-tenue truncate">{sub}</span>}
        {chispa && <span className="ml-auto shrink-0">{chispa}</span>}
      </div>
    </Card>
  );
}

export function Boton({ children, onClick, variant = "primary", size = "md", className = "", disabled, title }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-acento focus-visible:ring-offset-1 focus-visible:ring-offset-fondo disabled:opacity-40 disabled:cursor-not-allowed";
  /* Sobre el naranja no va blanco: en oscuro el contraste queda flojo y
     se lee peor que con un tono casi negro. `sobre-acento` es cada cosa
     en cada tema. */
  const v = {
    primary: "bg-acento text-sobre-acento hover:bg-acento-vivo",
    dark: "bg-superficie-3 text-texto hover:bg-borde-fuerte",
    ghost: "bg-superficie text-texto border border-borde hover:bg-superficie-2",
    quiet: "text-texto-suave hover:text-texto hover:bg-superficie-2",
    danger: "bg-superficie text-mal border border-mal hover:bg-mal-suave",
  }[variant];
  const s = { sm: "text-xs px-2.5 py-1.5", md: "text-sm px-3.5 py-2", lg: "text-base px-5 py-3" }[size];
  return <button title={title} disabled={disabled} onClick={onClick} className={`${base} ${v} ${s} ${className}`}>{children}</button>;
}

/* Lo que la maqueta muestra y el sistema todavía no hace. Se ve, ocupa su
   lugar y se entiende que no anda: apagado, con el cursor cruzado y el
   motivo en el título. Nunca un control que parece andar y no hace nada. */
export function Apagado({ motivo, children, className = "" }) {
  return (
    <span title={`${motivo} todavía no está disponible.`}
      className={`inline-flex items-center justify-center opacity-35 cursor-not-allowed select-none ${className}`}>
      {children}
    </span>
  );
}

export function Modal({ open, onClose, children, ancho = "max-w-lg" }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
      {/* El velo se apoya en el fondo y no en una superficie: tiene que
          oscurecer lo de atrás en los dos temas, no aclararlo. */}
      <div className="absolute inset-0 bg-fondo/70 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative w-full ${ancho} bg-superficie text-texto rounded-t-3xl md:rounded-2xl border border-borde shadow-xl max-h-[92vh] md:max-h-[88vh] overflow-auto seguro-abajo`}>{children}</div>
    </div>
  );
}

export function Tabs({ items, value, onChange }) {
  return (
    <div className="flex gap-1 border-b border-borde overflow-x-auto">
      {items.map((it) => (
        <button key={it.k} onClick={() => onChange(it.k)}
          className={`px-3 py-2 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${value === it.k ? "border-acento text-texto" : "border-transparent text-texto-tenue hover:text-texto"}`}>
          {it.n}{it.badge != null && <span className="ml-1.5 text-[10px] bg-superficie-2 text-texto-suave rounded-full px-1.5 py-0.5">{it.badge}</span>}
        </button>
      ))}
    </div>
  );
}

/* --- Pistola lectora ---------------------------------------------------
   Un lector de códigos se comporta como un teclado: escribe muy rápido y
   cierra con Enter. Capturamos esa ráfaga a nivel de ventana, así el
   operador puede disparar sin tener que clickear ningún campo antes.      */
export function useScanner(onScan, activo = true) {
  const buf = useRef("");
  const ult = useRef(0);
  useEffect(() => {
    if (!activo) return;
    const h = (e) => {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const ahora = Date.now();
      if (ahora - ult.current > 90) buf.current = "";
      ult.current = ahora;
      if (e.key === "Enter") {
        const cod = buf.current;
        buf.current = "";
        if (/^\d{6,}$/.test(cod)) { e.preventDefault(); onScan(cod); }
        return;
      }
      if (e.key.length === 1) buf.current += e.key;
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [onScan, activo]);
}

/* Despachador de escaneo. Cada pantalla que sabe qué hacer con un código se
   registra en una pila; el último en montarse gana (un modal le gana a la
   pantalla que lo abrió). Si nadie se registra, el escaneo cae en la ficha
   rápida global: el producto se puede vender, reponer o repreciar desde
   cualquier lugar del sistema.                                              */
export const ScanCtx = createContext({ push: () => () => {} });

export function useScanHandler(fn, activo = true) {
  const { push } = useContext(ScanCtx);
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!activo) return;
    return push((cod) => ref.current(cod));
  }, [activo, push]);
}

let _ac = null;
export function beep(ok = true, activo = true) {
  if (!activo) return;
  try {
    if (!audio()) return;
    const o = _ac.createOscillator(), g = _ac.createGain();
    o.connect(g); g.connect(_ac.destination);
    o.type = "square";
    o.frequency.value = ok ? 1760 : 240;
    g.gain.setValueAtTime(0.05, _ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, _ac.currentTime + (ok ? 0.08 : 0.3));
    o.start(); o.stop(_ac.currentTime + (ok ? 0.09 : 0.32));
  } catch (e) { /* sin audio disponible */ }
}

/* Aviso sonoro de cobro: dos notas ascendentes, distintas del beep del
   lector para que no se confundan a tres metros del mostrador.              */
/* Chrome suspende el AudioContext cuando la pestaña pasa a segundo plano o
   tras un rato sin uso. Si se programan notas sobre un contexto suspendido no
   suena nada, así que hay que despertarlo en cada aviso.                     */
export function audio() {
  try {
    _ac = _ac || new (window.AudioContext || window.webkitAudioContext)();
    if (_ac.state === "suspended") _ac.resume();
    return _ac;
  } catch (e) { return null; }
}

export function campanita(activo = true) {
  if (!activo) return;
  const ac = audio();
  if (!ac) return;
  try {
    [880, 1318.5].forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type = "sine";
      o.frequency.value = f;
      const t0 = ac.currentTime + 0.05 + i * 0.16;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.14, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);
      o.start(t0); o.stop(t0 + 0.45);
    });
  } catch (e) { /* sin audio disponible */ }
}

/* Ojo con cancel(): si entran dos cobros seguidos, el segundo cortaba al
   primero y Chrome puede quedar en pausa y no volver a hablar nunca más.
   Sin cancel, los avisos se encolan y se escuchan todos.                     */
export function hablar(texto, activo = true) {
  if (!activo) return;
  try {
    const s = window.speechSynthesis;
    if (!s) return;
    s.resume();
    let dicho = false;
    const decir = () => {
      if (dicho) return;
      dicho = true;
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = "es-AR";
      u.rate = 0.98;
      const voces = s.getVoices();
      const voz = voces.find((v) => /es[-_]AR/i.test(v.lang)) || voces.find((v) => /^es/i.test(v.lang));
      if (voz) u.voice = voz;
      s.speak(u);
    };
    // Las voces cargan de forma asíncrona la primera vez.
    if (!s.getVoices().length) {
      s.addEventListener("voiceschanged", decir, { once: true });
      setTimeout(decir, 300);
    } else decir();
  } catch (e) { /* sin voz disponible */ }
}

/* Imprimir la comandera.
   Antes se ocultaba la app con CSS y se imprimía la página. Eso fallaba por
   dos motivos: el papel salía en A4 con márgenes enormes, y el ticket estaba
   posicionado como "fixed", lo que hace que el navegador lo repita en TODAS
   las hojas. Por eso salían dos.
   Ahora el ticket se imprime en un documento propio, dentro de un iframe
   invisible, con el tamaño de papel declarado. Sale una sola hoja del ancho
   del rollo y del alto exacto del contenido. */
export function escaparHTML(t) {
  return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* Lo que imprime el cabezal de cada rollo, en mm. Ver "EL PAPEL NO SE
   IMPRIME ENTERO" más abajo: el número se ajustó mirando el papel de
   Super 25. Lo usan las dos formas de imprimir. */
const UTIL_MM = { 58: 53, 80: 72 };

/* Cómo se imprime: como PDF (de fábrica) o como página. Lo decide
   Ajustes y lo avisa Sistema; queda acá y no en cada llamada porque
   imprimen el cobro, la comanda, la caja y la cuenta corriente, y ninguno
   tiene por qué saberlo. */
/* APAGADO DE FÁBRICA. Con un PDF, Chrome no toma el tamaño de papel de
   la página: usa el del driver de la impresora y centra el ticket ahí. En
   la térmica de Super 25 el papel del driver era más ancho que el rollo,
   el ticket de 58 mm salió corrido a la derecha y de los importes quedaba
   un dígito. La forma de página le dice a Chrome el papel exacto con
   `@page`, y por eso sigue siendo la de fábrica. */
let comoPagina = true;
/* Lo que imprime el cabezal lo puede corregir cada comercio en Ajustes:
   el número de fábrica se calibró en una impresora, y en la misma de
   Super 25 después sobraba medio centímetro a la derecha. Cada térmica
   es distinta, y corregirlo no tiene que esperar una actualización. */
let utilPropio = null;
export function configurarImpresion({ pdf = false, anchoUtil = null } = {}) {
  comoPagina = pdf !== true;
  utilPropio = Number(anchoUtil) > 0 ? Number(anchoUtil) : null;
}
/* Entre 40 mm y el ancho del papel: más allá no hay papel, y menos no
   entra ni una columna de importes. */
export const utilDe = (mm) => Math.min(mm, Math.max(40, utilPropio || UTIL_MM[mm]));

/* El ticket sale como PDF para que Chrome no le agregue la fecha, el
   título y la dirección (ver src/ui/ticketPdf.js). Si algo falla —un
   navegador sin visor de PDF, uno que bloquea la impresión del iframe—
   se imprime como antes, como página: mejor un ticket con encabezado
   que ningún ticket. */
/* LA IMPRESIÓN DIRECTA VA PRIMERO
   Si esta computadora tiene el programa de impresión de Genez y una
   impresora elegida (Ajustes → Impresión directa), el ticket sale por ahí:
   sin ventana, sin la fecha ni la dirección del navegador, y con el corte
   de papel. Si el programa no contesta —se cerró, la computadora se
   reinició y no arrancó, se desenchufó la impresora—, se abre la ventana
   de siempre y se avisa: un ticket que no sale es peor que uno con
   ventana. */
export function imprimirComandera(lineas, ancho, qrSemilla, toast) {
  const impresora = impresoraElegida();
  if (impresora) {
    let bytes = null;
    try {
      bytes = armarEscPos({ lineas, mm: ancho === 58 ? 58 : 80, celdas: qrSemilla ? celdasQR(qrSemilla) : null });
    } catch (e) { /* se imprime con la ventana */ }
    if (bytes) {
      imprimirDirecto(impresora, bytes).catch((e) => {
        toast && toast(`No salió por la impresión directa (${e.message || "el programa no contesta"}). Se abre la ventana.`, "mal");
        imprimirConVentana(lineas, ancho, qrSemilla, toast);
      });
      return;
    }
  }
  imprimirConVentana(lineas, ancho, qrSemilla, toast);
}

function imprimirConVentana(lineas, ancho, qrSemilla, toast) {
  const mm = ancho === 58 ? 58 : 80;
  if (!comoPagina) {
    try {
      const bytes = armarPdfTicket({
        lineas, mm, util: utilDe(mm),
        celdas: qrSemilla ? celdasQR(qrSemilla) : null,
        qrMM: mm === 58 ? 30 : 34,
      });
      imprimirPdf(bytes).catch(() => imprimirComoPagina(lineas, ancho, qrSemilla, toast));
      return;
    } catch (e) {
      /* sigue abajo, como página */
    }
  }
  imprimirComoPagina(lineas, ancho, qrSemilla, toast);
}

function imprimirComoPagina(lineas, ancho, qrSemilla, toast) {
  try {
    const mm = ancho === 58 ? 58 : 80;
    const cuerpo = escaparHTML(lineas.join("\n"));
    const qr = qrSemilla
      ? `<div class="qr">${svgQR(qrSemilla, mm === 58 ? 30 : 34)}</div>`
      : "";
    /* El `@page` no va acá: se inyecta al cargar, con el alto ya medido.
       Ver el comentario del iframe, abajo. */
    /* EL PAPEL NO SE IMPRIME ENTERO

       Un rollo de 58 mm tiene un cabezal de 384 puntos a 203 ppp, o sea
       unos 48 mm; el de 80 mm imprime unos 72. El resto es margen físico
       que ningún driver alcanza. Componer a 58 mm dejaba la franja derecha
       fuera del cabezal, que es justo donde `armarLineas` alinea los
       importes: de `$12.600` salía `$1`.

       La PÁGINA sigue siendo del ancho del papel —si se la achica, el
       driver reescala para llenar el rollo y vuelve a cortar— y lo que se
       limita es el contenido.

       ESTE NÚMERO SE AJUSTA MIRANDO EL PAPEL

       Los 48 mm teóricos de un cabezal de 384 puntos resultaron
       conservadores: en la impresora de Super 25 sobraban 5 mm a la
       derecha. Así que el valor que vale es el medido, no el de la hoja de
       datos, y se sube hasta que el ticket llegue al borde de lo que el
       cabezal imprime sin pasarse.

       Si en otra impresora quedara corto o cortara, es este número y nada
       más: el cuerpo de letra se recalcula solo contra él. */
    const util = utilDe(mm);

    /* La línea más larga es la que tiene que entrar justa. Sale de lo que
       ya compuso `armarLineas`, así que no hay que mantener un ancho en dos
       lados: si un día cambia, esto lo sigue solo. */
    const columnas = lineas.reduce((m, l) => Math.max(m, String(l).length), 0) || (mm === 58 ? 32 : 48);

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Ticket</title><style>
      html, body { margin: 0; padding: 0; background: #fff; }
      body { width: ${util}mm; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      pre { margin: 0; padding: ${mm === 58 ? "1.5mm" : "2mm"} 0; white-space: pre;
            font-family: "Courier New", ui-monospace, monospace;
            font-size: ${mm === 58 ? "8.6pt" : "9.2pt"}; line-height: 1.28;
            /* Negro puro y negrita: el papel térmico no imprime grises */
            color: #000; font-weight: 700; -webkit-font-smoothing: none; }
      /* Sirve para medir cuánto ocupa de verdad una línea llena y ajustar
         el cuerpo de la letra. No se ve ni se imprime. */
      #medida { position: absolute; visibility: hidden; top: 0; left: 0; }
      .qr { text-align: center; padding-bottom: 4mm; }
      .qr svg { display: inline-block; }
    </style></head><body><pre id="medida">${"0".repeat(columnas)}</pre><pre id="ticket">${cuerpo}</pre>${qr}</body></html>`;

    const marco = document.createElement("iframe");
    marco.setAttribute("aria-hidden", "true");
    /* EL IFRAME TIENE QUE ESTAR DENTRO DE LA VENTANA

       Acá estuvo el ticket en blanco, y costó porque hay dos formas de
       equivocarse y las dos parecen razonables: primero era 0x0 con
       `visibility:hidden`, después lo mandé a `left:-10000px`. Las dos
       imprimen una hoja vacía.

       Lo que lo probó fue el PDF: la página salía de 58 mm con el alto
       correcto —o sea que Chrome leía nuestro `@page`— pero su stream de
       contenido decía `/Length 0`, cero operaciones de dibujo, sin
       siquiera una fuente en los recursos. Chrome maqueta el documento del
       iframe, pero lo PINTA desde la composición del padre; un iframe
       oculto o fuera de la ventana nunca se compone, y de ahí sale la hoja
       en blanco con el tamaño justo.

       Así que va arriba de todo y visible. Durante el diálogo lo tapa el
       propio diálogo, y se saca al cerrarlo. El alto real se le pone
       después de medir: si el contenido desborda el iframe, lo que queda
       abajo tampoco se pinta. */
    marco.style.cssText =
      `position:fixed;left:0;top:0;z-index:2147483647;border:0;background:#fff;width:${mm}mm;height:100px`;
    /* UNA SOLA CARGA CUENTA, Y NO ES LA PRIMERA

       Ésta era la causa de fondo del ticket en blanco, y estuvo debajo de
       todo lo demás desde el principio.

       Agregar el iframe al documento dispara una carga de `about:blank`
       ANTES de la de `srcdoc`. O sea que este manejador corría dos veces, y
       la primera con el documento vacío: medía un cuerpo de cero, armaba un
       `@page` con esa medida y llamaba a `print()`. Esa primera llamada es
       la que abre el diálogo; la segunda, ya con el diálogo abierto, Chrome
       la descarta. Resultado: se imprimía el `about:blank`, y de ahí salía
       la hoja con el tamaño puesto y el dibujo vacío.

       Se corta por dos lados, porque cualquiera solo alcanza pero juntos no
       dejan lugar a dudas: `srcdoc` se asigna ANTES de agregar el iframe,
       así la única carga es la buena; y aun así se verifica que el
       documento traiga el <pre> antes de tocar nada. */
    let impreso = false;
    marco.onload = () => {
      try {
        const doc = marco.contentDocument;
        if (impreso || !doc || !doc.querySelector("pre")) return;
        impreso = true;

        /* EL ALTO SE MIDE, NO SE ADIVINA

           Antes decía `size: ${mm}mm auto`, que no es CSS válido —una medida
           seguida de la palabra `auto` no es una combinación permitida— así
           que Chrome descartaba la declaración entera y el ticket salía con
           el tamaño de papel por defecto de la impresora.

           Con el documento ya cargado se puede preguntar cuánto mide de
           verdad y armar un `@page` con las dos medidas, que sí es válido.
           Así el papel sale del largo del ticket y no al revés. Los 2 mm de
           más son para que la última línea no quede al filo del corte. */
        /* EL CUERPO DE LETRA SE CALCULA, NO SE FIJA

           Los 8,6 pt de antes eran un número elegido a mano, y a ese tamaño
           Courier avanza ~1,82 mm por carácter: 32 columnas daban 58 mm,
           más que los 48 que el cabezal imprime. Acá se mide cuánto ocupa
           de verdad una línea llena y se escala para que entre justa. Si
           mañana cambia el ancho del ticket o la fuente, esto se acomoda
           solo. */
        const medida = doc.getElementById("medida");
        const tinta = doc.getElementById("ticket");
        if (medida && tinta) {
          const objetivoPx = util * 96 / 25.4;
          const realPx = medida.getBoundingClientRect().width;
          if (realPx > 0) {
            const base = parseFloat(marco.contentWindow.getComputedStyle(tinta).fontSize);
            /* Para abajo a propósito: que sobre un pelo no se nota, que
               falte corta el último carácter de cada importe. */
            tinta.style.fontSize = `${Math.floor(base * (objetivoPx / realPx) * 100) / 100}px`;
          }
          medida.remove();
        }

        /* El alto se mide DESPUÉS de ajustar la letra, que es lo que lo
           cambia. */
        const altoPx = Math.ceil(doc.body.getBoundingClientRect().height);
        const altoMM = Math.ceil(altoPx * 25.4 / 96) + 2;
        const regla = doc.createElement("style");
        regla.textContent = `@page { size: ${mm}mm ${altoMM}mm; margin: 0; }`;
        doc.head.appendChild(regla);

        /* El iframe se estira al alto del ticket: lo que desborde queda
           fuera de la composición y saldría cortado en el papel. */
        marco.style.height = `${altoPx}px`;

        const ventana = marco.contentWindow;

        /* EL IFRAME SE SACA CUANDO SE CERRÓ EL DIÁLOGO, NO A LOS DOS SEGUNDOS

           No era la causa del ticket en blanco —eso está explicado abajo—
           pero sí un problema real: `print()` sobre un iframe no siempre
           bloquea el hilo, así que el temporizador de 2 s que había antes
           podía arrancar con el diálogo abierto y borrar el documento por
           debajo. Chrome re-dibuja la vista previa cada vez que se toca una
           opción —elegir la impresora, por ejemplo— y para entonces ya no
           quedaría nada que dibujar. */
        let sacado = false;
        const sacar = () => {
          if (sacado) return;
          sacado = true;
          try { marco.remove(); } catch (e) {}
        };
        ventana.addEventListener("afterprint", sacar);
        /* Respaldo por si `afterprint` no llega —algunos navegadores no lo
           disparan al cancelar—: el iframe no queda colgado para siempre,
           pero el minuto alcanza para cualquier diálogo. */
        setTimeout(sacar, 60000);

        /* SE IMPRIME DESPUÉS DE QUE EL CUADRO SE PINTÓ, NO EN EL `load`

           Última pieza del ticket en blanco. `load` avisa que el documento
           terminó de cargar, no que se dibujó: llamar a `print()` ahí es
           pedirle a Chrome que imprima algo que todavía no compuso ni una
           vez, y sale la hoja con el tamaño correcto y el dibujo vacío
           (`/Length 0` en el PDF, sin una sola fuente en los recursos).

           Forzar el reflujo no alcanzaba: eso obliga a MAQUETAR, que es
           justo la parte que ya funcionaba —de ahí salía el `@page` bien
           calculado— y no a PINTAR.

           Dos `requestAnimationFrame` encadenados son la forma de esperar
           un cuadro de verdad: el primero corre antes de pintar, el
           segundo ya del otro lado. */
        let lanzado = false;
        const lanzar = () => {
          if (lanzado) return;
          lanzado = true;
          try {
            ventana.focus();
            ventana.print();
          } catch (e) {
            toast && toast("El navegador bloqueó la impresión.", "mal");
            sacar();
          }
        };
        requestAnimationFrame(() => requestAnimationFrame(lanzar));
        /* `requestAnimationFrame` no corre en una pestaña que no se está
           dibujando —otra solapa al frente, ventana minimizada—, y ahí la
           impresión no saldría nunca, que es peor que salir en blanco. Con
           el respaldo, en ese caso se imprime igual. */
        setTimeout(lanzar, 300);
      } catch (e) {
        toast && toast("El navegador bloqueó la impresión.", "mal");
        try { marco.remove(); } catch (e2) {}
      }
    };
    /* El orden importa: primero el contenido, después al documento. Al
       revés, el `appendChild` provoca la carga de `about:blank` que se
       explica arriba. */
    marco.srcdoc = html;
    document.body.appendChild(marco);
  } catch (e) {
    toast && toast(`No se pudo imprimir: ${e.message}`, "mal");
  }
}

/* --- Comandera térmica -------------------------------------------------
   58 mm = 32 caracteres, 80 mm = 48. Todo se compone como texto de ancho
   fijo, igual que lo que recibe la impresora.                              */
export function armarLineas(W, bloques) {
  const out = [];
  const sep = (c) => c.repeat(W);
  const centro = (t) => {
    const s = t.slice(0, W);
    return " ".repeat(Math.max(0, Math.floor((W - s.length) / 2))) + s;
  };
  const lr = (a, b) => {
    const der = String(b);
    const izq = String(a).slice(0, Math.max(0, W - der.length - 1));
    return izq + " ".repeat(Math.max(1, W - izq.length - der.length)) + der;
  };
  const wrap = (t) => {
    const palabras = String(t).split(" ");
    const ls = []; let cur = "";
    for (const p of palabras) {
      if ((cur + " " + p).trim().length > W) { if (cur) ls.push(cur); cur = p.slice(0, W); }
      else cur = (cur ? cur + " " : "") + p;
    }
    if (cur) ls.push(cur);
    return ls;
  };
  for (const b of bloques) {
    if (b.t === "sep") out.push(sep(b.c || "-"));
    /* Un renglón centrado que no entra se parte en palabras, como los
       nombres de los productos, en vez de cortarse: la dirección de un
       comercio no entra casi nunca en 32 caracteres, y salía mocha. Uno
       vacío se deja: hay quien lo usa de separación. */
    else if (b.t === "c") {
      if (String(b.v) === "") out.push("");
      else out.push(...wrap(b.v).map(centro));
    }
    else if (b.t === "lr") out.push(lr(b.a, b.b));
    else if (b.t === "w") out.push(...wrap(b.v));
    else if (b.t === "b") out.push("");
    else out.push(String(b.v).slice(0, W));
  }
  return out;
}

/* --- El QR de la factura -------------------------------------------------
   Hasta 0082 esto era un dibujo: un patrón al azar sembrado con el CAE,
   con las tres esquinas de un QR para que lo pareciera. No se podía
   escanear. Ahora es un QR de verdad, y en una factura lleva lo que pide
   ARCA (RG 4892): la dirección de su verificador con los datos del
   comprobante en base64. Quien lo escanea ve en el sitio de ARCA si la
   factura existe. */
export function celdasQR(texto) {
  const { modules } = QRCode.create(String(texto), { errorCorrectionLevel: "L" });
  const n = modules.size;
  const out = [];
  // get(fila, columna): la fila es la y. Al revés sale espejado y no se lee.
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (modules.get(y, x)) out.push([x, y]);
  return { n, celdas: out };
}

/* Lo que ARCA espera adentro del QR, con sus nombres de campo. */
export function qrDeFactura(fac) {
  if (!fac) return null;
  const datos = {
    ver: 1,
    fecha: fac.fecha,
    cuit: Number(fac.cuit),
    ptoVta: fac.puntoVenta,
    tipoCmp: fac.tipo,
    nroCmp: fac.numero,
    importe: fac.total,
    moneda: "PES",
    ctz: 1,
    tipoDocRec: fac.docTipo,
    nroDocRec: fac.docNro,
    tipoCodAut: "E",
    codAut: Number(fac.cae),
  };
  return `https://www.afip.gob.ar/fe/qr/?p=${btoa(JSON.stringify(datos))}`;
}

/* Una factura sin CAE no se imprime. El cliente se lleva un solo papel
   de cada venta, y ese papel es la factura: si se imprimiera algo antes,
   serían dos. */
export const esperaCAE = (t) => !!(t && t.fiscal && !t.factura);

export function imprimirTicket(t, ajustes, toast) {
  if (esperaCAE(t)) {
    toast("La factura todavía no tiene CAE. Se imprime cuando ARCA la autorice (Caja → Facturas).", "mal");
    return;
  }
  const W = ajustes.ancho === 58 ? 32 : 48;
  imprimirComandera(ticketVenta(t, ajustes, W), ajustes.ancho, t.fiscal ? qrDeFactura(t.factura) : null, toast);
}

export function CodigoQR({ semilla, size = 84 }) {

  const { n, celdas } = celdasQR(semilla);
  return (
    <svg viewBox={`0 0 ${n} ${n}`} width={size} height={size} shapeRendering="crispEdges" fill="currentColor">
      {celdas.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />)}
    </svg>
  );
}

/* El mismo QR, como texto, para el documento de impresión. */
export function svgQR(semilla, mm) {
  const { n, celdas } = celdasQR(semilla);
  const rects = celdas.map(([x, y]) => `<rect x="${x}" y="${y}" width="1" height="1"/>`).join("");
  return `<svg viewBox="0 0 ${n} ${n}" width="${mm}mm" height="${mm}mm" shape-rendering="crispEdges" fill="#000" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}

export function Comandera({ lineas, ancho, qr, className = "" }) {
  const mm = ancho === 58 ? 58 : 80;
  return (
    <div className={`bg-superficie text-black mx-auto ${className}`} style={{ width: `${mm}mm`, maxWidth: "100%" }}>
      <pre className="f-m whitespace-pre leading-[1.35] m-0" style={{ fontSize: ancho === 58 ? "9.5px" : "10.5px" }}>
        {lineas.join("\n")}
      </pre>
      {qr && <div className="flex justify-center py-1"><CodigoQR semilla={qr} size={ancho === 58 ? 150 : 170} /></div>}
    </div>
  );
}

export function ticketVenta(t, ajustes, W) {
  const f = ajustes.fiscal || FISCAL_INICIAL;
  const cli = t.cliente || null;
  /* Con CAE, la letra y el número son los que dio ARCA, no los que se
     deducen acá: el papel tiene que decir lo mismo que el comprobante. */
  const fac = t.fiscal ? t.factura || null : null;
  const letra = t.fiscal ? (fac ? fac.letra : letraComprobante(f.condicion, cli ? cli.condicion : "CF")) : null;
  const discrimina = letra && discriminaIVA(letra);

  const b = [
    { t: "c", v: (f.nombreFactura || f.razonSocial || ajustes.negocio).toUpperCase() },
    { t: "c", v: f.domicilio || "" },
  ];
  // En un comprobante fiscal la razón social y el CUIT son obligatorios,
  // aunque arriba figure el nombre del local.
  if (t.fiscal && f.razonSocial && f.razonSocial !== f.nombreFactura) b.push({ t: "c", v: f.razonSocial.toUpperCase() });
  if (f.cuit) b.push({ t: "c", v: `CUIT ${f.cuit}` });
  if (t.fiscal && f.iibb) b.push({ t: "c", v: `IIBB ${f.iibb}  Inicio ${f.inicio || ""}`.trim() });
  b.push({ t: "c", v: t.fiscal ? condicionLegal(f.condicion) : "NO VALIDO COMO FACTURA" });
  b.push({ t: "sep", c: "=" });
  b.push({ t: "c", v: t.fiscal ? `FACTURA ${letra}` : "TICKET DE VENTA" });
  /* Homologación es el ARCA de pruebas: el CAE es real pero no vale nada.
     Se dice arriba, porque ese papel puede terminar en la mano de un
     cliente mientras el comercio prueba. */
  if (fac && fac.homologacion) b.push({ t: "c", v: "PRUEBA - SIN VALIDEZ FISCAL" });
  /* La fecha viene del ticket, no de `HOY`: la venta ocurrió hoy de verdad.
     El respaldo es la fecha real y no la congelada, para que un ticket
     viejo que se reimprima tampoco mienta. */
  /* El número de una factura son 14 dígitos con el guión, y a 58 mm no
     entra junto con la fecha y la hora: se cortaba el último dígito. Va
     solo en su renglón. */
  if (fac) {
    b.push({ t: "c", v: `Nro ${String(fac.puntoVenta).padStart(5, "0")}-${String(fac.numero).padStart(8, "0")}` });
    b.push({ t: "c", v: `${t.fecha || fdatel(new Date())} ${t.hora}` });
  } else {
    b.push({ t: "lr", a: `Nro ${t.nro}`, b: `${t.fecha || fdatel(new Date())} ${t.hora}` });
  }

  if (t.fiscal) {
    b.push({ t: "sep" });
    b.push({ t: "w", v: `CLIENTE: ${(cli ? cli.razonSocial : "CONSUMIDOR FINAL").toUpperCase()}` });
    if (cli) {
      b.push({ t: "v", v: `${cli.tipoDoc || "CUIT"} ${cli.doc}` });
      b.push({ t: "w", v: condicionLegal(cli.condicion) });
      if (cli.domicilio) b.push({ t: "w", v: cli.domicilio.toUpperCase() });
    }
  }

  b.push({ t: "sep" });
  for (const l of t.items) {
    b.push({ t: "w", v: l.nombre.toUpperCase() });
    // En factura A los importes van sin IVA, porque se discrimina al pie.
    const unit = discrimina ? l.precio / 1.21 : l.precio;
    const cant = l.unidad === "kg" ? `${l.qty.toFixed(3)} kg x ${money(unit)}` : `${l.qty} x ${money(unit)}`;
    b.push({ t: "lr", a: "  " + cant, b: money(unit * l.qty) });
    if (l.lista) b.push({ t: "v", v: `  ${String(l.listaNombre || "PRECIO ESPECIAL").toUpperCase()}` });
  }

  b.push({ t: "sep" });
  if (discrimina) {
    const neto = t.total / 1.21;
    b.push({ t: "lr", a: "SUBTOTAL NETO", b: money(neto) });
    b.push({ t: "lr", a: "IVA 21%", b: money(t.total - neto) });
  } else {
    b.push({ t: "lr", a: "SUBTOTAL", b: money(t.sub) });
    if (t.desc > 0) b.push({ t: "lr", a: "DESCUENTO", b: "-" + money(t.desc) });
    if (t.recargo > 0) b.push({ t: "lr", a: `RECARGO ${t.recargoNombre || ""}`.trim(), b: "+" + money(t.recargo) });
  }
  b.push({ t: "sep", c: "=" });
  b.push({ t: "lr", a: "TOTAL", b: money(t.total) });
  b.push({ t: "sep", c: "=" });

  const pagos = t.pagos && t.pagos.length ? t.pagos : [{ medio: t.medio, monto: t.total }];
  pagos.forEach((p) => b.push({ t: "lr", a: medioPorK(ajustes, p.medio).n.toUpperCase(), b: money(p.monto) }));
  if (t.recibe) {
    b.push({ t: "lr", a: "RECIBIDO EN EFECTIVO", b: money(t.recibe) });
    b.push({ t: "lr", a: "VUELTO", b: money(t.vuelto != null ? t.vuelto : t.recibe - t.total) });
  }

  if (t.fiscal) {
    b.push({ t: "b" });
    if (fac) {
      b.push({ t: "c", v: `CAE ${fac.cae}` });
      b.push({ t: "c", v: `Vto CAE ${fac.vencimiento.split("-").reverse().join("/")}` });
    } else {
      /* Solo se ve en pantalla: `imprimirTicket` no la deja salir. */
      b.push({ t: "c", v: "ESPERANDO CAE DE ARCA" });
      b.push({ t: "c", v: "NO ENTREGAR" });
    }
  }
  b.push({ t: "b" });
  b.push({ t: "c", v: `${t.items.length} items` });
  b.push({ t: "c", v: "GRACIAS POR SU COMPRA" });
  return armarLineas(W, b);
}

/* --- Pre cuenta --------------------------------------------------------
   Lo que se lleva a la mesa antes de cobrar, para que vean cómo va la
   cuenta y decidan cómo pagan. No es un comprobante y no puede parecerlo:
   sin numeración fiscal, sin CAE, y con el aviso al pie encerrado entre
   asteriscos para que se lea de un vistazo aunque el papel esté flojo.

   La fecha llega armada desde la pantalla y no sale de HOY: una comanda
   es del reloj de verdad, no de la fecha congelada de los datos
   simulados.                                                             */
export function preCuenta(c, ajustes, W) {
  const f = ajustes.fiscal || FISCAL_INICIAL;
  const b = [{ t: "c", v: String(ajustes.negocio || f.nombreFactura || f.razonSocial || "").toUpperCase() }];
  if (f.domicilio) b.push({ t: "c", v: f.domicilio });
  b.push({ t: "sep", c: "=" });
  b.push({ t: "c", v: "PRE CUENTA" });
  b.push({ t: "lr", a: String(c.titulo || "").toUpperCase(), b: `${c.fecha} ${c.hora}` });
  if (c.comensales > 0) b.push({ t: "lr", a: "COMENSALES", b: String(c.comensales) });

  b.push({ t: "sep" });
  for (const l of c.items) {
    b.push({ t: "w", v: String(l.nombre).toUpperCase() });
    b.push({ t: "lr", a: `  ${l.cantidad} x ${money(l.precio)}`, b: money(l.total) });
  }

  b.push({ t: "sep" });
  b.push({ t: "lr", a: "SUBTOTAL", b: money(c.subtotal) });
  if (c.descuento > 0) {
    b.push({ t: "lr", a: `DESCUENTO${c.descuentoPct != null ? ` ${c.descuentoPct}%` : ""}`, b: "-" + money(c.descuento) });
  }
  b.push({ t: "sep", c: "=" });
  b.push({ t: "lr", a: "TOTAL", b: money(c.total) });
  b.push({ t: "sep", c: "=" });
  if (c.comensales > 0) {
    b.push({ t: "lr", a: `POR PERSONA (${c.comensales})`, b: money(Math.round(c.total / c.comensales)) });
  }

  b.push({ t: "b" });
  b.push({ t: "sep", c: "*" });
  const aviso = "NO VALIDO COMO COMPROBANTE FISCAL";
  if (aviso.length <= W) b.push({ t: "c", v: aviso });
  else { b.push({ t: "c", v: "NO VALIDO COMO" }); b.push({ t: "c", v: "COMPROBANTE FISCAL" }); }
  b.push({ t: "sep", c: "*" });
  b.push({ t: "b" });
  return armarLineas(W, b);
}

/* --- Comanda de cocina -------------------------------------------------
   El papel que va a la plancha. No lleva precios: al que cocina no le
   sirven y le tapan lo único que importa, que es qué hacer y cómo.

   Las cantidades van adelante y grandes, los modificadores debajo de su
   plato y con sangría, y la observación del pedido arriba de todo,
   porque "cliente alérgico" leído al final es tarde.                     */
export function comandaCocina(c, W) {
  const b = [
    { t: "c", v: (c.titulo || "PEDIDO").toUpperCase() },
    { t: "lr", a: c.referencia ? `#${c.referencia}` : "", b: c.hora },
  ];
  if (c.mozo) b.push({ t: "v", v: `MOZO ${c.mozo.toUpperCase()}` });
  if (c.comensales > 0) b.push({ t: "v", v: `COMENSALES ${c.comensales}` });

  if (c.observacion) {
    b.push({ t: "sep", c: "*" });
    b.push({ t: "w", v: c.observacion.toUpperCase() });
    b.push({ t: "sep", c: "*" });
  } else {
    b.push({ t: "sep", c: "=" });
  }

  for (const l of c.items) {
    b.push({ t: "w", v: `${l.cantidad}  ${String(l.nombre).toUpperCase()}` });
    for (const m of l.modificadores || []) {
      b.push({ t: "w", v: `   - ${String(m.nombre).toUpperCase()}` });
    }
    if (l.notas) b.push({ t: "w", v: `   ** ${String(l.notas).toUpperCase()}` });
  }

  b.push({ t: "sep" });
  b.push({ t: "lr", a: "TOTAL DE PLATOS", b: String(c.items.reduce((s, l) => s + l.cantidad, 0)) });
  b.push({ t: "b" });
  return armarLineas(W, b);
}

export function comandaPicking(ped, W) {
  const b = [
    { t: "c", v: "PREPARACION DE PEDIDO" },
    { t: "sep", c: "=" },
    { t: "lr", a: ped.nro, b: `${fdatel(HOY)} ${ped.hora}` },
    { t: "w", v: `CLIENTE: ${ped.cliente.toUpperCase()}` },
    { t: "w", v: `${ped.entrega.toUpperCase()}: ${ped.dir.toUpperCase()}` },
    { t: "v", v: `TEL ${ped.tel}` },
    { t: "sep" },
  ];
  for (const l of ped.items) {
    b.push({ t: "w", v: l.nombre.toUpperCase() });
    const est = l.faltante > 0 ? `FALTAN ${l.faltante}` : "OK";
    b.push({ t: "lr", a: `  [ ] ${l.unidad === "kg" ? l.preparado.toFixed(2) + " kg" : l.preparado + " u"} de ${l.unidad === "kg" ? l.pedido.toFixed(2) : l.pedido}`, b: est });
  }
  b.push({ t: "sep" });
  const tot = ped.items.reduce((s, l) => s + l.precio * l.preparado, 0);
  b.push({ t: "lr", a: "TOTAL PREPARADO", b: money(tot) });
  const falt = ped.items.filter((l) => l.faltante > 0);
  if (falt.length) {
    b.push({ t: "sep" });
    b.push({ t: "v", v: "NO SE PUDO PREPARAR:" });
    falt.forEach((l) => b.push({ t: "w", v: `- ${l.nombre.toUpperCase()} (${l.faltante})` }));
  }
  if (ped.nota) { b.push({ t: "sep" }); b.push({ t: "w", v: `NOTA: ${ped.nota.toUpperCase()}` }); }
  b.push({ t: "b" });
  b.push({ t: "c", v: `Preparo: ${fdatel(HOY)}  Control: ______` });
  return armarLineas(W, b);
}

export function Vacio({ children }) {
  return <div className="text-center py-14 text-texto-tenue text-sm">{children}</div>;
}

/* Los otros tres estados que toda pantalla tiene y que hasta ahora cada
   una resolvía a su manera: una decía "Cargando…", otra ponía un spinner,
   otra no mostraba nada. Con una sola voz, el sistema se siente uno. */
export function Cargando({ children = "Cargando…" }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-14 text-texto-tenue text-sm">
      <span className="w-4 h-4 rounded-full border-2 border-borde-fuerte border-t-acento animate-spin" />
      {children}
    </div>
  );
}

/* El error dice qué pasó y ofrece reintentar. Un mensaje sin salida deja
   al usuario mirando una pantalla rota sin nada que hacer. */
export function ErrorEstado({ children, onReintentar }) {
  return (
    <div className="text-center py-14">
      <p className="text-sm text-mal">{children || "Algo salió mal."}</p>
      {onReintentar && (
        <button onClick={onReintentar} className="mt-3 text-xs font-semibold text-acento hover:underline">
          Reintentar
        </button>
      )}
    </div>
  );
}

export function SinPermiso({ children = "No tenés permiso para ver esta parte." }) {
  return <div className="text-center py-14 text-texto-tenue text-sm">{children}</div>;
}

/* La pastilla de estado, que estaba copiada en seis pantallas con clases
   distintas. El tono es semántico: verde está bien, rojo hay que mirarlo.
   El fondo es el suave del mismo color y no el saturado, que es la regla
   de DISENO.md. */
const TONO_SELLO = {
  bien: "text-bien border-bien bg-bien-suave",
  ojo: "text-ojo border-ojo bg-ojo-suave",
  mal: "text-mal border-mal bg-mal-suave",
  info: "text-info border-info bg-info-suave",
  acento: "text-acento border-acento bg-acento-suave",
  tenue: "text-texto-tenue border-borde bg-superficie-2",
};

export function Sello({ tono = "tenue", children, className = "" }) {
  return (
    <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${TONO_SELLO[tono] || TONO_SELLO.tenue} ${className}`}>
      {children}
    </span>
  );
}

export function TablaSimple({ cols, filas, vacio }) {
  if (!filas.length) return <Vacio>{vacio}</Vacio>;
  return (
    <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
      <table className="w-full text-sm min-w-[680px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-texto-tenue border-b border-borde">
            {cols.map((c, i) => <th key={i} className={`px-4 py-2.5 font-semibold ${i > 0 ? "text-right" : ""}`}>{c}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-borde">
          {filas.map((f, i) => (
            <tr key={i} className="hover:bg-superficie-2">
              {f.map((c, j) => <td key={j} className={`px-4 py-2.5 ${j > 0 ? "text-right" : ""}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
