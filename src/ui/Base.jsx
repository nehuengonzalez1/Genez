/* ============================================================
   4. UI BASE
   ============================================================ */

import React, { useEffect, useRef, useContext, createContext, useCallback } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { mulberry32, HOY, addDays, fdatel } from "../datos/generador.js";
import { pct, money, nf, nf2, moneyk, FISCAL_INICIAL, letraComprobante, discriminaIVA, condicionLegal, medioPorK } from "../utils/helpers.js";

export const SEV = {
  alta: { pill: "bg-mal-suave text-mal border-mal", dot: "bg-mal", label: "Urgente" },
  media: { pill: "bg-ojo-suave text-ojo border-ojo", dot: "bg-ojo", label: "Atención" },
  info: { pill: "bg-superficie-2 text-texto-suave border-borde", dot: "bg-superficie-3", label: "Dato" },
};

export function Card({ children, className = "" }) {
  return <div className={`bg-superficie border border-borde rounded-2xl ${className}`}>{children}</div>;
}

export function Kpi({ label, valor, delta, sub, tono = "neutro" }) {
  const col = tono === "bien" ? "text-bien" : tono === "mal" ? "text-mal" : "text-texto";
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold">{label}</div>
      <div className={`f-d text-3xl mt-1 tabular-nums ${col}`}>{valor}</div>
      <div className="flex items-center gap-2 mt-1">
        {delta !== undefined && delta !== null && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${delta >= 0 ? "text-bien" : "text-mal"}`}>
            {delta >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {pct(Math.abs(delta))}
          </span>
        )}
        {sub && <span className="text-xs text-texto-tenue">{sub}</span>}
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

export function imprimirComandera(lineas, ancho, qrSemilla, toast) {
  try {
    const mm = ancho === 58 ? 58 : 80;
    const cuerpo = escaparHTML(lineas.join("\n"));
    const qr = qrSemilla
      ? `<div class="qr">${svgQR(qrSemilla, mm === 58 ? 18 : 22)}</div>`
      : "";
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Ticket</title><style>
      @page { size: ${mm}mm auto; margin: 0; }
      html, body { margin: 0; padding: 0; background: #fff; }
      body { width: ${mm}mm; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      pre { margin: 0; padding: ${mm === 58 ? "1.5mm 1mm" : "2mm 1.5mm"}; white-space: pre;
            font-family: "Courier New", ui-monospace, monospace;
            font-size: ${mm === 58 ? "8.6pt" : "9.2pt"}; line-height: 1.28;
            /* Negro puro y negrita: el papel térmico no imprime grises */
            color: #000; font-weight: 700; -webkit-font-smoothing: none; }
      .qr { text-align: center; padding-bottom: 4mm; }
      .qr svg { display: inline-block; }
    </style></head><body><pre>${cuerpo}</pre>${qr}</body></html>`;

    const marco = document.createElement("iframe");
    marco.setAttribute("aria-hidden", "true");
    marco.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    marco.onload = () => {
      try {
        marco.contentWindow.focus();
        marco.contentWindow.print();
      } catch (e) {
        toast && toast("El navegador bloqueó la impresión.", "mal");
      }
      setTimeout(() => { try { marco.remove(); } catch (e) {} }, 2000);
    };
    document.body.appendChild(marco);
    marco.srcdoc = html;
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
    else if (b.t === "c") out.push(centro(b.v));
    else if (b.t === "lr") out.push(lr(b.a, b.b));
    else if (b.t === "w") out.push(...wrap(b.v));
    else if (b.t === "b") out.push("");
    else out.push(String(b.v).slice(0, W));
  }
  return out;
}

export function celdasQR(semilla) {
  const n = 21;
  let h = 0;
  for (let i = 0; i < String(semilla).length; i++) h = (h * 31 + String(semilla).charCodeAt(i)) >>> 0;
  const rnd = mulberry32(h);
  const out = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const esquina = (x < 7 && y < 7) || (x > n - 8 && y < 7) || (x < 7 && y > n - 8);
    const anillo = esquina && (x % 6 === 0 || y % 6 === 0 || (x > 1 && x < 5 && y > 1 && y < 5) ||
      ((x > n - 7 && x < n - 2) && y > 1 && y < 5) || (x > 1 && x < 5 && y > n - 7 && y < n - 2));
    if (esquina ? anillo : rnd() > 0.55) out.push([x, y]);
  }
  return { n, celdas: out };
}

export function PseudoQR({ semilla, size = 84 }) {
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
      {qr && <div className="flex justify-center py-1"><PseudoQR semilla={qr} size={ancho === 58 ? 70 : 88} /></div>}
    </div>
  );
}

export function ticketVenta(t, ajustes, W) {
  const f = ajustes.fiscal || FISCAL_INICIAL;
  const cli = t.cliente || null;
  const letra = t.fiscal ? letraComprobante(f.condicion, cli ? cli.condicion : "CF") : null;
  const discrimina = letra && discriminaIVA(letra);

  const b = [
    { t: "c", v: (f.nombreFactura || f.razonSocial || ajustes.negocio).toUpperCase() },
    { t: "c", v: f.domicilio || "" },
  ];
  // En un comprobante fiscal la razón social y el CUIT son obligatorios,
  // aunque arriba figure el nombre del local.
  if (t.fiscal && f.razonSocial && f.razonSocial !== f.nombreFactura) b.push({ t: "c", v: f.razonSocial.toUpperCase() });
  b.push({ t: "c", v: `CUIT ${f.cuit}` });
  if (t.fiscal && f.iibb) b.push({ t: "c", v: `IIBB ${f.iibb}  Inicio ${f.inicio || ""}`.trim() });
  b.push({ t: "c", v: t.fiscal ? condicionLegal(f.condicion) : "NO VALIDO COMO FACTURA" });
  b.push({ t: "sep", c: "=" });
  b.push({ t: "c", v: t.fiscal ? `FACTURA ${letra}` : "TICKET DE VENTA" });
  b.push({ t: "lr", a: `Nro ${t.nro}`, b: `${fdatel(HOY)} ${t.hora}` });

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
    b.push({ t: "c", v: `CAE ${t.cae}` });
    b.push({ t: "c", v: `Vto CAE ${fdatel(addDays(HOY, 10))}` });
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
