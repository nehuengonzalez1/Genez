/* ============================================================
   6. VENDER (POS) + 6 bis. ALTAS: PRODUCTO Y PROVEEDOR
   ============================================================ */

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Barcode, ScanLine, Camera as Cam, CameraOff, Zap, ZapOff, Loader2,
  Minus, Plus, Trash2, Printer, FileText, MessageCircle, Mail, QrCode,
  ArrowRight, Check, X, Percent, Users, Search
} from "lucide-react";
import { uid, HOY } from "../datos/generador.js";
import {
  nf, money, pct, esCantidad, aNumero, precioAplicado, proximaLista,
  letraComprobante, conRecargo, mediosDe, medioPorK, FISCAL_INICIAL,
  condicionNombre, faltantesProducto, faltantesProveedor, productoNuevo
} from "../utils/helpers.js";
import {
  beep, useScanHandler, imprimirComandera, ticketVenta,
  Vacio, Modal, Boton, Card, Comandera
} from "../ui/Base.jsx";
import { FormCliente } from "./Clientes.jsx";
import { Campo, inputCls } from "../ui/Campos.jsx";

function AltaRapida({ abierto, inicial, productos, ajustes, onCrear, onClose }) {
  const [camara, setCamara] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [costo, setCosto] = useState("");
  const [otros, setOtros] = useState({});
  const ref = useRef(null);

  useEffect(() => {
    if (!abierto) return;
    setNombre((inicial && inicial.nombre) || "");
    setPrecio(""); setCosto(""); setOtros({});
    setCodigo((inicial && inicial.barcode) || "");
    setTimeout(() => ref.current && ref.current.focus(), 30);
  }, [abierto, inicial]);

  if (!abierto) return null;
  const margen = Number(precio) && Number(costo) ? (Number(precio) - Number(costo)) / Number(precio) : null;

  const crear = (agregar) => {
    if (!nombre.trim()) return;
    onCrear({ nombre: nombre.trim(), precio: Number(precio) || 0, costo: Number(costo) || 0, precios: otros, barcode: codigo }, agregar);
  };

  const teclas = (e) => {
    e.stopPropagation();
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    if (e.key === "Enter") { e.preventDefault(); crear(!!Number(precio)); }
  };

  if (camara) {
    return <EscanerCamara abierto onCerrar={() => setCamara(false)} titulo="Leé el código del producto"
      onLeer={(cod) => { setCodigo(cod); setCamara(false); }} />;
  }

  return (
    <Overlay ancho="max-w-md">
      <div className="bg-acento text-sobre-acento px-5 py-3.5">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest font-bold text-orange-100">
          <ScanLine size={13} /> Producto nuevo
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="f-d text-xl flex-1">{codigo ? `Código ${codigo}` : "Sin código de barras"}</div>
          {!codigo && (
            <button onClick={() => setCamara(true)} className="flex items-center gap-1.5 text-xs font-semibold bg-superficie/20 active:bg-superficie/30 rounded-xl px-2.5 py-1.5">
              <Cam size={14} /> Leer
            </button>
          )}
        </div>
      </div>
      <div className="p-5" onKeyDown={teclas}>
        <p className="text-sm text-texto-suave">
          Cargá lo mínimo para poder cobrar. El rubro, el proveedor y el stock los completás después, cuando no haya nadie esperando.
        </p>
        <label className="block mt-4">
          <span className="text-[10px] uppercase tracking-widest text-texto-tenue font-bold">Nombre</span>
          <input ref={ref} value={nombre} onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Alfajor Jorgito triple" className="w-full border-2 border-borde rounded-xl px-3 py-2.5 text-base mt-1 outline-none focus:border-acento" />
        </label>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-texto-tenue font-bold">Precio de venta</span>
            <input value={precio} onChange={(e) => setPrecio(e.target.value.replace(/\D/g, ""))}
              className="f-m w-full text-right border-2 border-borde rounded-xl px-3 py-2.5 text-lg mt-1 outline-none focus:border-acento" />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-texto-tenue font-bold">Costo (opcional)</span>
            <input value={costo} onChange={(e) => setCosto(e.target.value.replace(/\D/g, ""))}
              className="f-m w-full text-right border border-borde rounded-xl px-3 py-2.5 text-lg mt-1 outline-none focus:border-acento" />
          </label>
        </div>
        {margen != null && <p className="text-xs text-texto-suave mt-2 text-right">Margen {pct(margen)}</p>}

        {(ajustes.listas || []).filter((l) => l.activa !== false).map((l) => (
          <div key={l.id} className="border border-borde rounded-xl p-3 mt-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-widest text-texto-tenue font-bold">{l.nombre}</div>
                <div className="text-[11px] text-texto-suave">Se cobra a partir de {l.umbral} unidades. Vacío: este producto no entra en esta lista.</div>
              </div>
              <input value={otros[l.id] || ""} onChange={(e) => setOtros((o) => ({ ...o, [l.id]: e.target.value.replace(/\D/g, "") }))}
                placeholder="opcional" className="f-m w-28 text-right border border-borde rounded-lg px-2 py-1.5 text-sm outline-none focus:border-acento shrink-0" />
            </div>
            {Number(precio) > 0 && !Number(otros[l.id]) && (
              <button onClick={() => setOtros((o) => ({ ...o, [l.id]: String(Math.round((Number(precio) * (1 - ajustes.desc2 / 100)) / 10) * 10) }))}
                className="text-xs font-semibold text-acento hover:underline mt-2">
                Poner {money(Math.round((Number(precio) * (1 - ajustes.desc2 / 100)) / 10) * 10)} ({ajustes.desc2}% menos)
              </button>
            )}
          </div>
        ))}

        <Boton size="lg" className="w-full mt-4" disabled={!nombre.trim() || !Number(precio)} onClick={() => crear(true)}>
          Crear y agregar al ticket <Tecla>Enter</Tecla>
        </Boton>
        <Boton variant="quiet" className="w-full mt-1.5" disabled={!nombre.trim()} onClick={() => crear(false)}>
          Crear sin precio y seguir
        </Boton>
        <p className="text-[11px] text-texto-tenue mt-3 text-center">
          Va a quedar marcado como ficha incompleta en el Panel. <Tecla>Esc</Tecla> cancela.
        </p>
      </div>
    </Overlay>
  );
}

/* --- Planilla de productos --------------------------------------------
   Exporta e importa el catálogo en Excel. La librería (SheetJS) se descarga
   solo cuando se usa, así no engorda la aplicación para quien nunca la abre.
   Si no se puede descargar, se cae a CSV, que Excel abre igual.            */
async function cargarPlanilla() {
  try {
    return await import(/* @vite-ignore */ "https://esm.sh/xlsx@0.18.5");
  } catch (e) {
    return null;
  }
}

function columnasCatalogo(listas) {
  return [
    ["id", "id"], ["codigo", "barcode"], ["nombre", "nombre"], ["rubro", "categoria"],
    ["marca", "marca"], ["proveedor", "proveedor"], ["unidad", "unidad"], ["iva", "iva"],
    ["bulto", "bulto"], ["stock", "stock"], ["stock_minimo", "stockMin"],
    ["costo", "costo"], ["precio", "precio"],
    ...listas.map((l) => [`precio_${l.nombre.toLowerCase().replace(/[^a-z0-9]+/gi, "_")}`, `lista:${l.id}`]),
  ];
}

function filasCatalogo(productos, listas) {
  const cols = columnasCatalogo(listas);
  return productos.map((p) => {
    const fila = {};
    for (const [titulo, campo] of cols) {
      if (campo.startsWith("lista:")) fila[titulo] = (p.precios || {})[campo.slice(6)] || "";
      else fila[titulo] = p[campo] != null ? p[campo] : "";
    }
    return fila;
  });
}

function descargar(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function exportarCatalogo(productos, listas, toast) {
  const filas = filasCatalogo(productos, listas);
  const fecha = `${HOY.getFullYear()}-${String(HOY.getMonth() + 1).padStart(2, "0")}-${String(HOY.getDate()).padStart(2, "0")}`;
  const XLSX = await cargarPlanilla();
  if (XLSX) {
    const hoja = XLSX.utils.json_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Productos");
    const buf = XLSX.write(libro, { bookType: "xlsx", type: "array" });
    descargar(`catalogo-${fecha}.xlsx`, buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    toast(`${nf.format(filas.length)} productos exportados a Excel.`);
    return;
  }
  // Respaldo: CSV con punto y coma, que es lo que Excel en español espera.
  const cols = Object.keys(filas[0] || {});
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = "﻿" + [cols.join(";"), ...filas.map((f) => cols.map((c) => esc(f[c])).join(";"))].join("\n");
  descargar(`catalogo-${fecha}.csv`, csv, "text/csv;charset=utf-8");
  toast(`${nf.format(filas.length)} productos exportados a CSV (Excel lo abre igual).`);
}

function parsearCSV(texto) {
  const limpio = texto.replace(/^﻿/, "");
  const sep = (limpio.split("\n")[0].match(/;/g) || []).length >= (limpio.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
  const filas = [];
  let campo = "", fila = [], entre = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (entre) {
      if (c === '"' && limpio[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') entre = false;
      else campo += c;
    } else if (c === '"') entre = true;
    else if (c === sep) { fila.push(campo); campo = ""; }
    else if (c === "\n") { fila.push(campo); filas.push(fila); fila = []; campo = ""; }
    else if (c !== "\r") campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  if (!filas.length) return [];
  const cab = filas[0].map((x) => x.trim());
  return filas.slice(1).filter((f) => f.some((x) => String(x).trim() !== ""))
    .map((f) => Object.fromEntries(cab.map((c, i) => [c, f[i] != null ? f[i] : ""])));
}

export async function leerPlanilla(archivo) {
  const esCSV = /\.csv$/i.test(archivo.name);
  if (esCSV) return parsearCSV(await archivo.text());
  const XLSX = await cargarPlanilla();
  if (!XLSX) throw new Error("No se pudo cargar el lector de Excel. Guardá la planilla como CSV y probá de nuevo.");
  const buf = await archivo.arrayBuffer();
  const libro = XLSX.read(buf, { type: "array" });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  return XLSX.utils.sheet_to_json(hoja, { defval: "" });
}

/* Compara la planilla contra el catálogo y arma el resumen de cambios.
   No aplica nada: eso lo decide el usuario después de ver qué va a pasar. */
export function analizarPlanilla(filas, productos, listas) {
  const porId = new Map(productos.map((p) => [String(p.id), p]));
  const porCodigo = new Map(productos.filter((p) => p.barcode).map((p) => [String(p.barcode), p]));
  const num = (v) => { const n = Number(String(v).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "")); return isNaN(n) ? null : n; };
  const nuevos = [], cambios = [], errores = [];

  filas.forEach((f, i) => {
    const fila = i + 2;
    const id = f.id != null && String(f.id).trim() !== "" ? String(f.id).trim() : null;
    const cod = f.codigo != null ? String(f.codigo).trim().replace(/\D/g, "") : "";
    const p = (id && porId.get(id)) || (cod && porCodigo.get(cod)) || null;
    const nombre = String(f.nombre || "").trim();

    if (!p) {
      if (!nombre) { errores.push(`Fila ${fila}: sin nombre y sin coincidencia en el catálogo.`); return; }
      nuevos.push({ fila, datos: f });
      return;
    }
    const dif = [];
    const comparar = (campo, etiqueta, valor) => {
      if (valor == null || String(f[campo] ?? "").trim() === "") return;
      if (Number(p[etiqueta]) !== valor) dif.push({ campo, antes: p[etiqueta], ahora: valor });
    };
    comparar("costo", "costo", num(f.costo));
    comparar("precio", "precio", num(f.precio));
    comparar("stock", "stock", num(f.stock));
    comparar("stock_minimo", "stockMin", num(f.stock_minimo));
    for (const l of listas) {
      const col = `precio_${l.nombre.toLowerCase().replace(/[^a-z0-9]+/gi, "_")}`;
      if (String(f[col] ?? "").trim() === "") continue;
      const v = num(f[col]);
      if (((p.precios || {})[l.id] || 0) !== (v || 0)) dif.push({ campo: col, antes: (p.precios || {})[l.id] || 0, ahora: v || 0 });
    }
    if (nombre && nombre !== p.nombre) dif.push({ campo: "nombre", antes: p.nombre, ahora: nombre });
    if (dif.length) cambios.push({ fila, p, dif, datos: f });
  });

  return { nuevos, cambios, errores };
}

/* --- Lector por cámara -------------------------------------------------
   Para el que no tiene pistola. Usa BarcodeDetector, que viene en Chrome de
   Android y no pesa nada. Safari todavía no lo trae, así que ahí se carga
   ZXing bajo demanda: solo lo descarga quien lo necesita.
   Sigue leyendo sin cerrarse, para poder cargar varios productos seguidos.  */
export function EscanerCamara({ abierto, onLeer, onCerrar, titulo = "Escaneá el código" }) {
  const video = useRef(null);
  const [estado, setEstado] = useState("iniciando");   // iniciando | leyendo | error
  const [detalle, setDetalle] = useState("");
  const [ultimo, setUltimo] = useState(null);
  const [linterna, setLinterna] = useState(false);
  const pista = useRef(null);
  const ultimoCodigo = useRef({ cod: "", t: 0 });

  useEffect(() => {
    if (!abierto) return;
    let vivo = true;
    let stream = null, timer = null, controles = null;

    const manejar = (cod) => {
      const limpio = String(cod || "").trim();
      if (!limpio) return;
      const ahora = Date.now();
      // Un código se lee muchas veces por segundo: se ignora el repetido.
      if (ultimoCodigo.current.cod === limpio && ahora - ultimoCodigo.current.t < 1800) return;
      ultimoCodigo.current = { cod: limpio, t: ahora };
      setUltimo(limpio);
      try { navigator.vibrate && navigator.vibrate(40); } catch (e) {}
      onLeer(limpio);
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
          audio: false,
        });
        if (!vivo) { stream.getTracks().forEach((t) => t.stop()); return; }
        pista.current = stream.getVideoTracks()[0];
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play().catch(() => {});
        }

        if ("BarcodeDetector" in window) {
          const det = new window.BarcodeDetector({
            formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf"],
          });
          setEstado("leyendo");
          timer = setInterval(async () => {
            if (!vivo || !video.current || video.current.readyState < 2) return;
            try {
              const r = await det.detect(video.current);
              if (r && r.length) manejar(r[0].rawValue);
            } catch (e) { /* fotograma sin código */ }
          }, 220);
        } else {
          // Safari y navegadores viejos: se trae el lector solo si hace falta.
          setDetalle("Preparando el lector…");
          const mod = await import(/* @vite-ignore */ "https://esm.sh/@zxing/browser@0.1.5");
          if (!vivo) return;
          const lector = new mod.BrowserMultiFormatReader();
          controles = await lector.decodeFromVideoElement(video.current, (res) => {
            if (res) manejar(res.getText());
          });
          setDetalle(""); setEstado("leyendo");
        }
      } catch (e) {
        if (!vivo) return;
        setEstado("error");
        setDetalle(
          e && e.name === "NotAllowedError"
            ? "No diste permiso para usar la cámara. Habilitalo desde el candado de la barra de direcciones."
            : e && e.name === "NotFoundError"
              ? "Este dispositivo no tiene cámara disponible."
              : `No se pudo abrir la cámara: ${e && e.message ? e.message : "error desconocido"}`
        );
      }
    })();

    return () => {
      vivo = false;
      if (timer) clearInterval(timer);
      try { controles && controles.stop && controles.stop(); } catch (e) {}
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [abierto]);

  const cambiarLinterna = async () => {
    try {
      const t = pista.current;
      if (!t) return;
      const caps = t.getCapabilities ? t.getCapabilities() : {};
      if (!caps.torch) return;
      await t.applyConstraints({ advanced: [{ torch: !linterna }] });
      setLinterna((v) => !v);
    } catch (e) { /* sin linterna */ }
  };

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-fondo flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 text-white bg-fondo/80">
        <Cam size={18} className="text-acento-vivo shrink-0" />
        <span className="font-semibold text-sm flex-1">{titulo}</span>
        <button onClick={cambiarLinterna} className="p-2 text-white/70 active:text-white" title="Linterna">
          {linterna ? <Zap size={18} /> : <ZapOff size={18} />}
        </button>
        <button onClick={onCerrar} className="p-2 text-white/70 active:text-white"><X size={20} /></button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video ref={video} playsInline muted autoPlay className="absolute inset-0 w-full h-full object-cover" />
        {estado === "leyendo" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[78%] max-w-sm aspect-[5/3] border-2 border-acento rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
          </div>
        )}
        {estado !== "leyendo" && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <div className="text-white">
              {estado === "error" ? <CameraOff size={30} className="mx-auto text-red-400" /> : <Loader2 size={30} className="mx-auto animate-spin text-acento-vivo" />}
              <p className="text-sm mt-3 max-w-xs">{detalle || "Encendiendo la cámara…"}</p>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-3 bg-fondo/85 text-center seguro-abajo">
        {ultimo
          ? <p className="f-m text-sm text-emerald-400">Leído: {ultimo}</p>
          : <p className="text-xs text-white/60">Acercá el código de barras al recuadro</p>}
        <p className="text-[11px] text-white/40 mt-1">Podés seguir escaneando: la ventana no se cierra sola</p>
      </div>
    </div>
  );
}

function BuscarCliente({ clientes, onElegir, onCrear, onCerrar }) {
  const [q, setQ] = useState("");
  const [nuevo, setNuevo] = useState(false);
  const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const lista = q.trim().length >= 1
    ? clientes.filter((c) => norm(c.razonSocial).includes(norm(q)) || String(c.doc || "").includes(q.trim()))
    : clientes.slice(0, 8);

  if (nuevo) {
    return <FormCliente abierto inicial={{ razonSocial: q }} onCerrar={() => setNuevo(false)} onGuardar={(d) => onCrear(d)} />;
  }

  return (
    <Modal open onClose={onCerrar} ancho="max-w-md">
      <div className="p-5">
        <h3 className="f-d text-lg">¿A quién se le factura?</h3>
        <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Nombre o CUIT"
          className="w-full border border-borde rounded-xl px-3 py-2 text-sm mt-3 outline-none focus:border-acento" />
        <button onClick={() => onElegir(null)} className="w-full text-left px-3 py-2.5 mt-3 rounded-xl border border-borde hover:bg-superficie-2">
          <span className="text-sm font-semibold">Consumidor final</span>
          <span className="block text-[11px] text-texto-tenue">Sin datos del cliente</span>
        </button>
        <ul className="mt-2 border border-borde rounded-xl divide-y divide-borde max-h-64 overflow-auto">
          {lista.map((c) => (
            <li key={c.id}>
              <button onClick={() => onElegir(c)} className="w-full text-left px-3 py-2 hover:bg-superficie-2">
                <div className="text-sm font-medium">{c.razonSocial}</div>
                <div className="f-m text-[11px] text-texto-tenue">{c.tipoDoc} {c.doc} · {condicionNombre(c.condicion)}</div>
              </button>
            </li>
          ))}
        </ul>
        {lista.length === 0 && <p className="text-sm text-texto-tenue text-center py-3">No hay coincidencias.</p>}
        <Boton variant="ghost" className="w-full mt-3" onClick={() => setNuevo(true)}><Plus size={15} /> Cargar un cliente nuevo</Boton>
      </div>
    </Modal>
  );
}

export function Overlay({ children, ancho = "max-w-xl" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
      <div className="absolute inset-0 bg-superficie-3/70 backdrop-blur-[3px]" />
      <div className={`relative w-full ${ancho} bg-superficie text-texto rounded-t-3xl md:rounded-2xl border border-borde shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto seguro-abajo`}>{children}</div>
    </div>
  );
}

export function Tecla({ children }) {
  return <kbd className="f-m text-[10px] border border-borde-fuerte rounded px-1.5 py-0.5 bg-superficie text-texto-suave">{children}</kbd>;
}

const ATAJOS = [
  ["F2", "Cobrar"], ["F4", "Descuento"], ["F7", "Quitar último"], ["F8", "Anular venta"],
  ["F9", "Salón"], ["F10", "Panel"], ["F1", "Ayuda"],
];

export function POS({ productos, setProductos, cobrar, ajustes, toast, ir, pendiente, setPendiente, aPanel, clientes, setClientes, permisos }) {
  const [paso, setPaso] = useState("carga");     // carga → pago → monto → fin
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [cart, setCart] = useState([]);
  const [desc, setDesc] = useState(0);
  const [medioSel, setMedioSel] = useState(0);
  const [recibe, setRecibe] = useState("");
  const [pagos, setPagos] = useState([]);
  const [montoMix, setMontoMix] = useState("");
  const [ticket, setTicket] = useState(null);
  const [verTicket, setVerTicket] = useState(false);
  const [ayuda, setAyuda] = useState(false);
  const [alta, setAlta] = useState(null);
  const [ultimo, setUltimo] = useState(null);
  const [camara, setCamara] = useState(false);
  const inp = useRef(null);
  const inpMonto = useRef(null);
  const inpMix = useRef(null);

  const enCarga = paso === "carga";
  useEffect(() => { if (enCarga && inp.current) inp.current.focus(); }, [enCarga, cart.length, ticket]);
  useEffect(() => { if (paso === "monto" && inpMonto.current) inpMonto.current.focus(); }, [paso]);
  useEffect(() => { if (paso === "mixto" && inpMix.current) inpMix.current.focus(); }, [paso, pagos.length]);

  const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const res = useMemo(() => {
    if (q.trim().length < 2) return [];
    const t = norm(q.trim());
    const ex = productos.find((p) => p.barcode === q.trim());
    if (ex) return [ex];
    return productos.filter((p) => norm(p.nombre).includes(t) || p.sku.toLowerCase().includes(t)).slice(0, 7);
  }, [q, productos]);

  const add = (p, qty) => {
    if (!p.precio) { beep(false, ajustes.sonido); return toast(`${p.nombre} no tiene precio de venta cargado.`, "mal"); }
    const paso_ = p.unidad === "kg" ? 0.25 : 1;
    const cantidad = qty != null ? qty : paso_;
    setCart((c) => {
      const i = c.findIndex((l) => l.pid === p.id);
      if (i >= 0) { const n = [...c]; n[i] = { ...n[i], qty: +(n[i].qty + cantidad).toFixed(3) }; return n; }
      return [...c, { pid: p.id, qty: cantidad, precio: p.precio, precios: p.precios || {}, costo: p.costo, nombre: p.nombre, unidad: p.unidad }];
    });
    setUltimo({ pid: p.id, nombre: p.nombre, unidad: p.unidad });
    setQ(""); setSel(0);
  };

  useScanHandler((cod) => {
    const p = productos.find((x) => x.barcode === cod);
    if (p) { add(p); beep(true, ajustes.sonido); }
    else { beep(false, ajustes.sonido); setAlta({ barcode: cod }); }
  }, enCarga && !alta && !camara);

  useEffect(() => {
    if (!pendiente) return;
    const p = productos.find((x) => x.id === pendiente.id);
    if (p) add(p);
    setPendiente(null);
  }, [pendiente]);

  const crearAlVuelo = (datos, agregar) => {
    let creado = null;
    setProductos((ps) => {
      creado = productoNuevo(datos);
      return [...ps, creado];
    });
    setAlta(null);
    setQ(""); setSel(0);
    setTimeout(() => {
      if (agregar && creado && creado.precio) {
        setCart((c) => [...c, { pid: creado.id, qty: creado.unidad === "kg" ? 0.25 : 1, precio: creado.precio, precios: creado.precios || {}, costo: creado.costo, nombre: creado.nombre, unidad: creado.unidad }]);
        setUltimo({ pid: creado.id, nombre: creado.nombre, unidad: creado.unidad });
        beep(true, ajustes.sonido);
        toast(`${datos.nombre} creado y agregado. Completá la ficha después.`);
      } else {
        toast(`${datos.nombre} creado sin precio: no se puede cobrar hasta completarlo.`, "mal");
      }
    }, 0);
  };

  const setQty = (pid, qty) => setCart((c) => c.map((l) => (l.pid === pid ? { ...l, qty: Math.max(0, +qty.toFixed(3)) } : l)).filter((l) => l.qty > 0));
  const quitar = (pid) => setCart((c) => c.filter((l) => l.pid !== pid));

  const lineas = cart.map((l) => {
    const { precio, lista, nombre } = precioAplicado(l, l.qty, ajustes);
    return { ...l, unit: precio, lista, listaNombre: nombre, proxima: proximaLista(l, l.qty, ajustes),
      importe: precio * l.qty, ahorro: (l.precio - precio) * l.qty };
  });
  const ahorroTotal = lineas.reduce((s, l) => s + l.ahorro, 0);
  const sub = lineas.reduce((s, l) => s + l.importe, 0);
  const descMonto = sub * (desc / 100);
  const total = sub - descMonto;
  const costoTot = lineas.reduce((s, l) => s + l.costo * l.qty, 0);
  const ganancia = total - costoTot;
  const medios = mediosDe(ajustes);
  const medio = medios[medioSel] || medios[0];

  const [fiscal, setFiscal] = useState(!!ajustes.arca);
  const [cliente, setCliente] = useState(null);
  const [buscarCliente, setBuscarCliente] = useState(false);
  const letra = letraComprobante((ajustes.fiscal || FISCAL_INICIAL).condicion, cliente ? cliente.condicion : "CF");
  const rec = conRecargo(total, medio);
  const totalFinal = rec.total;
  // El vuelto se calcula sobre el total con recargo, así que va después.
  const vuelto = recibe ? Number(recibe) - totalFinal : 0;

  const irAPago = () => {
    if (!cart.length) return;
    setMedioSel(0); setRecibe(""); setPagos([]); setMontoMix("");
    setFiscal(!!ajustes.arca); setCliente(null);
    setPaso("pago");
  };

  // ---- Pago combinado ----
  const cubierto = pagos.reduce((s2, p) => s2 + p.monto, 0);
  const falta = Math.max(0, total - cubierto);
  const vueltoMix = pagos.reduce((s2, p) => s2 + (p.exceso || 0), 0);
  const efectivoEntregado = pagos.filter((p) => p.medio === "efectivo").reduce((s2, p) => s2 + p.monto + (p.exceso || 0), 0);

  const agregarPago = () => {
    const m = medios[medioSel];
    const entrada = Number(montoMix) || falta;
    if (entrada <= 0 || falta <= 0) return;
    const aplicado = Math.min(entrada, falta);
    const exceso = m.k === "efectivo" ? Math.max(0, entrada - falta) : 0;
    if (m.k !== "efectivo" && entrada > falta) return toast("Con tarjeta o transferencia no puede sobrar: cobrá el importe exacto.", "mal");
    setPagos((ps) => [...ps, { medio: m.k, monto: aplicado, exceso }]);
    setMontoMix("");
    beep(true, ajustes.sonido);
  };

  const finalizarMixto = () => {
    if (cubierto < total) return toast(`Todavía faltan ${money(falta)}.`, "mal");
    finalizar(pagos[0].medio, efectivoEntregado || null, pagos.map((p) => ({ medio: p.medio, monto: p.monto })), vueltoMix);
  };

  const finalizar = (k, recibido, listaPagos, vueltoDado) => {
    const items = lineas.map((l) => ({ pid: l.pid, qty: l.qty, precio: l.unit, costo: l.costo, nombre: l.nombre, unidad: l.unidad, lista: l.lista, listaNombre: l.listaNombre }));
    const m = medioPorK(ajustes, k);
    const r = listaPagos ? { total, recargo: 0 } : conRecargo(total, m);
    const t = cobrar({ items, sub, desc: descMonto, total: r.total, medio: k, ganancia: ganancia + r.recargo,
      recibe: recibido || null, pagos: listaPagos, recargo: r.recargo, recargoNombre: r.recargo ? m.n : "",
      fiscal, cliente });
    /* Sin caja abierta no hay venta: no se descuenta stock ni se limpia el
       carrito, así el cobro se puede retomar apenas se abra. */
    if (!t) return;
    if (vueltoDado != null) t.vuelto = vueltoDado;
    setProductos((ps) => ps.map((p) => {
      const l = lineas.find((x) => x.pid === p.id);
      // La venta es real aunque el resto del prototipo siga en la fecha congelada.
      return l ? { ...p, stock: +(p.stock - l.qty).toFixed(3), ultimaVenta: new Date(), u30: p.u30 + l.qty } : p;
    }));
    setTicket(t);
    setPaso("fin");
  };

  const nuevaVenta = () => {
    setCart([]); setDesc(0); setRecibe(""); setMedioSel(0); setPagos([]); setMontoMix(""); setUltimo(null); setCliente(null);
    setTicket(null); setVerTicket(false); setPaso("carga");
  };

  // ---- Teclado ----
  useEffect(() => {
    const h = (e) => {
      if (alta || camara || buscarCliente) return;
      if (e.key === "F1") { e.preventDefault(); return setAyuda((a) => !a); }
      if (ayuda) { if (e.key === "Escape") { e.preventDefault(); setAyuda(false); } return; }

      if (paso === "carga") {
        if (e.key === "F2") { e.preventDefault(); return irAPago(); }
        if (e.key === "F4") {
          e.preventDefault();
          if (!permisos.descuentos) return toast("Tu usuario no puede dar descuentos.", "mal");
          return setDesc((d) => [0, 5, 10, 15][([0, 5, 10, 15].indexOf(d) + 1) % 4]);
        }
        if (e.key === "F7") { e.preventDefault(); return setCart((c) => c.slice(0, -1)); }
        if (e.key === "F8") {
          e.preventDefault();
          if (!permisos.anular) return toast("Tu usuario no puede anular ventas.", "mal");
          if (cart.length) { setCart([]); setDesc(0); toast("Venta anulada."); }
          return;
        }
        if (e.key === "F9") { e.preventDefault(); return ir("pedidos"); }
        if (e.key === "F10") { e.preventDefault(); return aPanel(); }
        return;
      }

      if (paso === "pago") {
        e.preventDefault();
        if (e.key === "Escape") return setPaso("carga");
        if (e.key === "ArrowDown") return setMedioSel((i) => (i + 1) % medios.length);
        if (e.key === "ArrowUp") return setMedioSel((i) => (i - 1 + medios.length) % medios.length);
        if (e.key === "6" || e.key.toLowerCase() === "c") { setMedioSel(0); setMontoMix(""); return setPaso("mixto"); }
        if (/^[1-9]$/.test(e.key) && Number(e.key) <= medios.length) {
          const i = Number(e.key) - 1;
          setMedioSel(i);
          if (medios[i].k === "efectivo") return setPaso("monto");
          return finalizar(medios[i].k, null);
        }
        if (e.key === "Enter") {
          if (medios[medioSel].k === "efectivo") return setPaso("monto");
          return finalizar(medios[medioSel].k, null);
        }
        return;
      }

      if (paso === "monto") {
        if (e.key === "Escape") { e.preventDefault(); return setPaso("pago"); }
        if (e.key === "Enter") {
          e.preventDefault();
          if (recibe && Number(recibe) < totalFinal) return toast("El importe recibido es menor al total.", "mal");
          return finalizar("efectivo", recibe ? Number(recibe) : null);
        }
        return;
      }

      if (paso === "mixto") {
        if (e.key === "Escape") { e.preventDefault(); setPagos([]); return setPaso("pago"); }
        if (e.key === "ArrowDown") { e.preventDefault(); return setMedioSel((i) => (i + 1) % medios.length); }
        if (e.key === "ArrowUp") { e.preventDefault(); return setMedioSel((i) => (i - 1 + medios.length) % medios.length); }
        if (e.key === "Delete") { e.preventDefault(); return setPagos((ps) => ps.slice(0, -1)); }
        if (e.key === "Enter") {
          e.preventDefault();
          if (falta <= 0) return finalizarMixto();
          return agregarPago();
        }
        return;
      }

      if (paso === "fin") {
        e.preventDefault();
        if (e.key === "Enter" || e.key === "Escape") return nuevaVenta();
        const k = e.key.toLowerCase();
        if (k === "t") return setVerTicket(true);
        if (k === "i") return imprimirComandera(ticketVenta(ticket, ajustes, W), ajustes.ancho, ticket.fiscal ? ticket.cae : null, toast);
        if (k === "w") return toast("Comprobante enviado por WhatsApp.");
        if (k === "e") return toast("Comprobante enviado por email.");
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [paso, cart, medioSel, recibe, total, ayuda, pagos, montoMix, falta, alta, camara, fiscal, totalFinal, cliente, buscarCliente, permisos]);

  const activo = ultimo && cart.find((l) => l.pid === ultimo.pid) ? ultimo : null;
  const cantidadPendiente = activo && esCantidad(q) && q.trim() !== "";
  const puedeCrear = q.trim().length >= 3 && res.length === 0 && !cantidadPendiente;

  const aplicarCantidad = () => {
    const n = aNumero(q);
    if (!activo || !(n > 0)) return false;
    setQty(activo.pid, n);
    setQ(""); setSel(0);
    beep(true, ajustes.sonido);
    return true;
  };

  const onKeyInput = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((x) => Math.min(x + 1, res.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((x) => Math.max(x - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (!q.trim()) return irAPago();
      if (cantidadPendiente && aplicarCantidad()) return;
      const exacto = productos.find((p) => p.barcode === q.trim());
      if (exacto) { beep(true, ajustes.sonido); return add(exacto); }
      if (res[sel]) { beep(true, ajustes.sonido); return add(res[sel]); }
      if (/^\d{6,}$/.test(q.trim())) return setAlta({ barcode: q.trim() });
      if (puedeCrear) return setAlta({ nombre: q.trim() });
      beep(false, ajustes.sonido); toast("No encontramos ese producto.", "mal");
    } else if (e.key === "*" || e.key === "x") {
      if (cantidadPendiente) { e.preventDefault(); aplicarCantidad(); }
    } else if (e.key === "Escape") setQ("");
  };

  const rapidos = [1000, 2000, 5000, 10000, 20000, 50000];
  const W = ajustes.ancho === 58 ? 32 : 48;

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-4 items-start">
      <div className="space-y-3">
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 bg-superficie-3">
            <Barcode size={20} className="text-acento-vivo shrink-0" />
            <input ref={inp} value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} onKeyDown={onKeyInput}
              placeholder="Escaneá o escribí el nombre · Enter con el campo vacío cobra"
              className="f-m flex-1 bg-transparent text-white placeholder-stone-500 text-base outline-none py-1" autoFocus />
            <button onClick={() => setCamara(true)}
              className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-white bg-superficie/10 active:bg-superficie/20 border border-white/20 rounded-xl px-2.5 py-2"
              title="Leer con la cámara">
              <Cam size={16} className="text-acento-vivo" /> <span className="hidden sm:inline">Cámara</span>
            </button>
            <Tecla>Enter</Tecla>
          </div>
          {cantidadPendiente && (
            <div className="px-4 py-2.5 bg-bien-suave border-b border-bien flex items-center gap-2 text-sm">
              <span className="f-d text-emerald-800 text-lg">{aNumero(q)}</span>
              <span className="text-emerald-900 truncate flex-1">
                {activo.unidad === "kg" ? "kg de" : "unidades de"} <strong>{activo.nombre}</strong>
              </span>
              <Tecla>Enter</Tecla>
            </div>
          )}
          {puedeCrear && (
            <button onClick={() => setAlta(/^\d{6,}$/.test(q.trim()) ? { barcode: q.trim() } : { nombre: q.trim() })}
              className="w-full text-left px-4 py-3 bg-acento-suave hover:bg-acento-suave flex items-center gap-2 border-b border-acento">
              <Plus size={15} className="text-acento shrink-0" />
              <span className="text-sm text-texto truncate">Crear <strong>{q.trim()}</strong> y seguir cobrando</span>
              <Tecla>Enter</Tecla>
            </button>
          )}
          {res.length > 0 && (
            <ul className="divide-y divide-borde max-h-72 overflow-auto">
              {res.map((p, i) => (
                <li key={p.id}>
                  <button onMouseEnter={() => setSel(i)} onClick={() => add(p)}
                    className={`w-full text-left px-4 py-2.5 flex items-center gap-3 ${i === sel ? "bg-acento-suave" : "hover:bg-superficie-2"}`}>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-texto truncate">{p.nombre}</div>
                      <div className="f-m text-[11px] text-texto-tenue">{p.barcode || "sin código"} · stock {p.unidad === "kg" ? p.stock.toFixed(1) : nf.format(p.stock)}</div>
                    </div>
                    <div className="f-m text-sm font-semibold shrink-0">{p.precio ? money(p.precio) : <span className="text-ojo text-xs">sin precio</span>}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden">
          {cart.length === 0 ? <Vacio>El ticket está vacío. Escaneá el primer producto.</Vacio> : (
          <>
            {/* En celular no entra una tabla de cinco columnas: va como lista */}
            <ul className="md:hidden divide-y divide-borde">
              {lineas.map((l, i) => (
                <li key={l.pid} className={`px-3 py-2.5 ${i === lineas.length - 1 ? "bg-acento-suave/40" : ""}`}>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-texto leading-snug">{l.nombre}</div>
                      <div className="f-m text-[11px] text-texto-tenue mt-0.5">
                        {l.lista && <span className="line-through mr-1">{money(l.precio)}</span>}
                        <span className={l.lista ? "text-bien font-semibold" : ""}>{money(l.unit)}</span> c/u
                        {l.lista && <span className="ml-1 text-bien font-bold uppercase">{l.listaNombre}</span>}
                      </div>
                    </div>
                    <div className="f-m text-base font-semibold shrink-0">{money(l.importe)}</div>
                    <button onClick={() => quitar(l.pid)} className="text-texto-tenue active:text-mal shrink-0 p-1"><Trash2 size={16} /></button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => setQty(l.pid, l.qty - (l.unidad === "kg" ? 0.25 : 1))} className="w-10 h-10 rounded-xl border border-borde flex items-center justify-center active:bg-superficie-2"><Minus size={16} /></button>
                    <span className="f-m w-14 text-center text-base">{l.unidad === "kg" ? l.qty.toFixed(2) : l.qty}</span>
                    <button onClick={() => setQty(l.pid, l.qty + (l.unidad === "kg" ? 0.25 : 1))} className="w-10 h-10 rounded-xl border border-borde flex items-center justify-center active:bg-superficie-2"><Plus size={16} /></button>
                  </div>
                </li>
              ))}
            </ul>
            <table className="hidden md:table w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-texto-tenue border-b border-borde">
                  <th className="px-4 py-2 font-semibold">Producto</th>
                  <th className="px-2 py-2 font-semibold w-32 text-center">Cantidad</th>
                  <th className="px-2 py-2 font-semibold w-24 text-right">Precio</th>
                  <th className="px-4 py-2 font-semibold w-28 text-right">Subtotal</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {lineas.map((l, i) => (
                  <tr key={l.pid} className={i === lineas.length - 1 ? "bg-acento-suave/40" : "hover:bg-superficie-2"}>
                    <td className="px-4 py-2.5 text-texto">
                      {l.nombre}
                      {l.lista && (
                        <span className="ml-2 text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border bg-bien-suave text-bien border-bien">
                          {l.listaNombre} −{money(l.ahorro)}
                        </span>
                      )}
                      {!l.lista && l.proxima && (
                        <span className="ml-2 text-[10px] text-texto-tenue">
                          desde {l.proxima.umbral} u paga {money(l.proxima.precio)}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setQty(l.pid, l.qty - (l.unidad === "kg" ? 0.25 : 1))} className="w-7 h-7 rounded-lg border border-borde hover:bg-superficie-2 flex items-center justify-center"><Minus size={13} /></button>
                        <span className="f-m w-12 text-center">{l.unidad === "kg" ? l.qty.toFixed(2) : l.qty}</span>
                        <button onClick={() => setQty(l.pid, l.qty + (l.unidad === "kg" ? 0.25 : 1))} className="w-7 h-7 rounded-lg border border-borde hover:bg-superficie-2 flex items-center justify-center"><Plus size={13} /></button>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right f-m text-texto-suave">
                      {l.lista && <span className="line-through text-texto-tenue mr-1">{money(l.precio)}</span>}
                      <span className={l.lista ? "text-bien font-semibold" : ""}>{money(l.unit)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right f-m font-semibold">{money(l.importe)}</td>
                    <td className="pr-3"><button onClick={() => quitar(l.pid)} className="text-texto-tenue hover:text-mal"><Trash2 size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
          )}
        </Card>

        {activo && !cantidadPendiente && (
          <p className="text-xs text-texto-tenue px-1 -mt-1">
            Último cargado: <strong className="text-texto-suave">{activo.nombre}</strong>. Escribí un número y Enter para dejarlo en esa cantidad.
          </p>
        )}

        <div className="hidden md:flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
          {ATAJOS.filter(([t]) => (t !== "F4" || permisos.descuentos) && (t !== "F8" || permisos.anular)).map(([t, n]) => (
            <span key={t} className="flex items-center gap-1.5 text-[11px] text-texto-tenue"><Tecla>{t}</Tecla> {n}</span>
          ))}
        </div>
      </div>

      {/* En celular el total y el botón de cobrar viven fijos al pie, al alcance del pulgar */}
      {cart.length > 0 && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-superficie border-t border-borde px-3 py-2.5 seguro-abajo shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-texto-tenue font-bold">{cart.length} productos</div>
              <div className="f-d text-2xl leading-none">{money(total)}</div>
              {ahorroTotal > 0 && <div className="text-[11px] text-bien">−{money(ahorroTotal)} por cantidad</div>}
            </div>
            <Boton onClick={irAPago} size="lg" className="flex-1 justify-center">Cobrar</Boton>
          </div>
        </div>
      )}

      <div className="space-y-3 lg:sticky lg:top-4 pb-24 md:pb-0">
        <Card className="p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-texto-suave">{cart.length} productos</span>
            <span className="f-m text-sm">{money(sub)}</span>
          </div>
          {ahorroTotal > 0 && (
            <div className="flex items-baseline justify-between mt-1 text-bien">
              <span className="text-sm">Precio por cantidad</span>
              <span className="f-m text-sm">−{money(ahorroTotal)}</span>
            </div>
          )}
          {permisos.descuentos && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-texto-suave">Descuento <Tecla>F4</Tecla></span>
              <div className="flex items-center gap-1">
                {[0, 5, 10, 15].map((d) => (
                  <button key={d} onClick={() => setDesc(d)} className={`f-m text-xs px-2 py-1 rounded-lg border ${desc === d ? "bg-superficie-3 text-white border-superficie-3" : "border-borde text-texto-suave hover:bg-superficie-2"}`}>{d}%</button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-baseline justify-between mt-4 pt-4 border-t border-borde">
            <span className="f-d text-lg">Total</span>
            <span className="f-d text-4xl tabular-nums">{money(total)}</span>
          </div>
          {cart.length > 0 && permisos.verCostos && <div className="text-xs text-texto-tenue mt-1 text-right">Ganancia {money(ganancia)} · {pct(total ? ganancia / total : 0)}</div>}
          <Boton onClick={irAPago} disabled={!cart.length} size="lg" className="w-full mt-4">
            Cobrar {money(total)} <Tecla>F2</Tecla>
          </Boton>
          <button onClick={() => ir("pedidos")} className="w-full text-xs font-semibold text-acento hover:underline mt-3 inline-flex items-center justify-center gap-1">
            <ScanLine size={13} /> Vender recorriendo el salón <Tecla>F9</Tecla>
          </button>
        </Card>
      </div>

      {/* ---------- Ventana 2: medio de pago ---------- */}
      {paso === "pago" && (
        <Overlay>
          <div className="bg-superficie-3 text-white px-6 py-4 flex items-baseline justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-bold">Total a cobrar · {cart.length} productos</div>
              <div className="f-d text-4xl mt-0.5">{money(total)}</div>
            </div>
            <div className="text-right text-xs text-texto-tenue"><Tecla>Esc</Tecla> volver</div>
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="text-[11px] uppercase tracking-widest text-texto-tenue font-bold">¿Cómo paga?</span>
              <div className="flex rounded-xl border border-borde overflow-hidden text-xs font-semibold">
                <button onClick={() => setFiscal(false)} className={`px-3 py-1.5 ${!fiscal ? "bg-superficie-3 text-white" : "text-texto-suave"}`}>Ticket</button>
                <button onClick={() => setFiscal(true)} className={`px-3 py-1.5 ${fiscal ? "bg-superficie-3 text-white" : "text-texto-suave"}`}>Factura {fiscal ? letra : ""}</button>
              </div>
            </div>

            {fiscal && (
              <button onClick={() => setBuscarCliente(true)}
                className="w-full flex items-center gap-2 px-3 py-2 mb-3 rounded-xl border border-borde hover:bg-superficie-2 text-left">
                <Users size={16} className="text-texto-tenue shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold truncate">{cliente ? cliente.razonSocial : "Consumidor final"}</span>
                  <span className="block text-[11px] text-texto-tenue">
                    {cliente ? `${cliente.tipoDoc} ${cliente.doc} · ${condicionNombre(cliente.condicion)}` : "Sin identificar · toca para elegir un cliente"}
                  </span>
                </span>
                <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border bg-superficie-3 text-white border-superficie-3 shrink-0">{letra}</span>
              </button>
            )}
            <ul className="space-y-1.5">
              {medios.map((m, i) => (
                <li key={m.k}>
                  <button onClick={() => { setMedioSel(i); m.k === "efectivo" ? setPaso("monto") : finalizar(m.k, null); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${i === medioSel ? "border-acento bg-acento-suave" : "border-borde hover:bg-superficie-2"}`}>
                    <Tecla>{i + 1}</Tecla>
                    <span className="font-semibold flex-1">{m.n}</span>
                    {m.tasa > 0 && (
                      <span className="text-xs text-texto-tenue shrink-0">
                        {m.recargo ? `recargo ${m.tasa}%` : `comisión ${money(total * m.tasa / 100)}`}
                      </span>
                    )}
                    {i === medioSel && <ArrowRight size={16} className="text-acento" />}
                  </button>
                </li>
              ))}
            </ul>
            <button onClick={() => { setMedioSel(0); setMontoMix(""); setPaso("mixto"); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-borde-fuerte hover:bg-superficie-2 text-left mt-1.5">
              <Tecla>6</Tecla>
              <span className="font-semibold flex-1">Pago combinado</span>
              <span className="text-xs text-texto-tenue">parte en efectivo y parte con tarjeta</span>
            </button>
            <p className="text-xs text-texto-tenue mt-3 flex items-center gap-2">
              <Tecla>↑</Tecla><Tecla>↓</Tecla> elegir · <Tecla>Enter</Tecla> confirmar · <Tecla>1</Tecla>–<Tecla>6</Tecla> atajo directo
            </p>
          </div>
        </Overlay>
      )}

      {buscarCliente && (
        <BuscarCliente clientes={clientes} onCerrar={() => setBuscarCliente(false)}
          onElegir={(c) => { setCliente(c); setBuscarCliente(false); }}
          onCrear={(d) => { const nuevo = { ...d, id: "c" + uid() }; setClientes((cs) => [...cs, nuevo]); setCliente(nuevo); setBuscarCliente(false); toast(`${d.razonSocial} agregado.`); }} />
      )}

      {/* ---------- Ventana 2b: efectivo ---------- */}
      {paso === "monto" && (
        <Overlay ancho="max-w-lg">
          <div className="bg-superficie-3 text-white px-6 py-4">
            <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-bold">Efectivo · total</div>
            <div className="f-d text-4xl mt-0.5">{money(totalFinal)}</div>
          </div>
          <div className="p-5">
            <label className="text-[11px] uppercase tracking-widest text-texto-tenue font-bold">¿Con cuánto paga?</label>
            <input ref={inpMonto} value={recibe} onChange={(e) => setRecibe(e.target.value.replace(/\D/g, ""))}
              placeholder="Dejalo vacío si paga justo"
              className="f-m w-full text-right text-3xl border-2 border-borde rounded-xl px-4 py-3 mt-2 outline-none focus:border-acento" />
            <div className="flex flex-wrap gap-1.5 mt-3">
              {rapidos.filter((r) => r >= totalFinal).slice(0, 4).map((r) => (
                <button key={r} onClick={() => setRecibe(String(r))} className="f-m text-xs px-2.5 py-1.5 rounded-lg bg-superficie-2 hover:bg-superficie-3 text-texto">{money(r)}</button>
              ))}
              <button onClick={() => setRecibe(String(Math.ceil(totalFinal / 1000) * 1000))} className="f-m text-xs px-2.5 py-1.5 rounded-lg bg-superficie-2 hover:bg-superficie-3 text-texto">
                {money(Math.ceil(totalFinal / 1000) * 1000)}
              </button>
            </div>
            {recibe !== "" && (
              <div className={`mt-4 p-3 rounded-xl text-center ${vuelto < 0 ? "bg-mal-suave" : "bg-bien-suave"}`}>
                <div className="text-[11px] uppercase tracking-widest font-bold text-texto-suave">{vuelto < 0 ? "Falta" : "Vuelto"}</div>
                <div className={`f-d text-3xl ${vuelto < 0 ? "text-mal" : "text-bien"}`}>{money(Math.abs(vuelto))}</div>
              </div>
            )}
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-texto-tenue"><Tecla>Esc</Tecla> cambiar medio</span>
              <Boton size="lg" onClick={() => { if (recibe && Number(recibe) < totalFinal) return toast("El importe recibido es menor al total.", "mal"); finalizar("efectivo", recibe ? Number(recibe) : null); }}>
                Confirmar cobro <Tecla>Enter</Tecla>
              </Boton>
            </div>
          </div>
        </Overlay>
      )}

      {/* ---------- Ventana 2c: pago combinado ---------- */}
      {paso === "mixto" && (
        <Overlay ancho="max-w-lg">
          <div className="bg-superficie-3 text-white px-6 py-4 flex items-baseline justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-bold">
                {falta > 0 ? "Falta cobrar" : "Cubierto"}
              </div>
              <div className={`f-d text-4xl mt-0.5 ${falta > 0 ? "text-acento-vivo" : "text-emerald-400"}`}>{money(falta > 0 ? falta : total)}</div>
            </div>
            <div className="text-right text-xs text-texto-tenue">de {money(total)}<br /><Tecla>Esc</Tecla> volver</div>
          </div>

          <div className="p-5">
            {pagos.length > 0 && (
              <ul className="mb-4 border border-borde rounded-xl divide-y divide-borde">
                {pagos.map((p, i) => (
                  <li key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <Check size={14} className="text-bien shrink-0" />
                    <span className="flex-1">{medioPorK(ajustes, p.medio).n}</span>
                    <span className="f-m">{money(p.monto)}</span>
                    {p.exceso > 0 && <span className="f-m text-[11px] text-texto-tenue">+{money(p.exceso)} vuelto</span>}
                    <button onClick={() => setPagos((ps) => ps.filter((_, j) => j !== i))} className="text-texto-tenue hover:text-mal"><Trash2 size={14} /></button>
                  </li>
                ))}
              </ul>
            )}

            {falta > 0 ? (
              <>
                <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-bold">¿Con qué paga esta parte?</div>
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  {medios.map((m, i) => (
                    <button key={m.k} onClick={() => setMedioSel(i)}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border text-left text-sm font-semibold ${i === medioSel ? "border-acento bg-acento-suave" : "border-borde hover:bg-superficie-2"}`}>
                      <Tecla>{i + 1}</Tecla> {m.n}
                    </button>
                  ))}
                </div>
                <label className="block text-[11px] uppercase tracking-widest text-texto-tenue font-bold mt-4">Importe</label>
                <input ref={inpMix} value={montoMix} onChange={(e) => setMontoMix(e.target.value.replace(/\D/g, ""))}
                  placeholder={`${money(falta)} (todo lo que falta)`}
                  className="f-m w-full text-right text-2xl border-2 border-borde rounded-xl px-4 py-2.5 mt-1 outline-none focus:border-acento" />
                <p className="text-xs text-texto-tenue mt-2 flex items-center gap-1.5 flex-wrap">
                  <Tecla>↑</Tecla><Tecla>↓</Tecla> medio · <Tecla>Enter</Tecla> agregar · <Tecla>Supr</Tecla> borrar el último ·
                  vacío toma {money(falta)}
                </p>
                <Boton size="lg" className="w-full mt-3" onClick={agregarPago}>
                  Agregar {money(Number(montoMix) || falta)} en {medios[medioSel].n} <Tecla>Enter</Tecla>
                </Boton>
              </>
            ) : (
              <>
                {vueltoMix > 0 && (
                  <div className="bg-bien-suave rounded-xl p-3 text-center mb-3">
                    <div className="text-[11px] uppercase tracking-widest font-bold text-texto-suave">Vuelto</div>
                    <div className="f-d text-3xl text-bien">{money(vueltoMix)}</div>
                  </div>
                )}
                <Boton size="lg" className="w-full" onClick={finalizarMixto}>Confirmar cobro <Tecla>Enter</Tecla></Boton>
              </>
            )}
          </div>
        </Overlay>
      )}

      {/* ---------- Ventana 3: cobrado, ticket opcional ---------- */}
      {paso === "fin" && ticket && (
        <Overlay ancho="max-w-lg">
          <div className="bg-emerald-600 text-white px-6 py-5 text-center">
            <Check size={26} className="mx-auto" />
            <div className="f-d text-2xl mt-1">Cobrado {money(ticket.total)}</div>
            <div className="text-emerald-100 text-sm">
              {(ticket.pagos || [{ medio: ticket.medio, monto: ticket.total }]).map((p) => `${medioPorK(ajustes, p.medio).n} ${money(p.monto)}`).join(" + ")} · {ticket.nro}
            </div>
          </div>
          {ticket.recibe && (ticket.vuelto != null ? ticket.vuelto : ticket.recibe - ticket.total) > 0 && (
            <div className="bg-superficie-3 text-white px-6 py-4 text-center">
              <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-bold">Vuelto</div>
              <div className="f-d text-5xl text-acento-vivo">{money(ticket.vuelto != null ? ticket.vuelto : ticket.recibe - ticket.total)}</div>
            </div>
          )}
          <div className="p-5">
            <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-bold mb-2">¿Querés comprobante?</div>
            <div className="grid grid-cols-4 gap-1.5">
              {[[Printer, "Imprimir", "I", () => imprimirComandera(ticketVenta(ticket, ajustes, W), ajustes.ancho, ticket.fiscal ? ticket.cae : null, toast)],
                [FileText, "Ver ticket", "T", () => setVerTicket(true)],
                [MessageCircle, "WhatsApp", "W", () => toast("Comprobante enviado por WhatsApp.")],
                [Mail, "Email", "E", () => toast("Comprobante enviado por email.")]].map(([I, n, k2, fn]) => (
                <button key={n} onClick={fn} className="flex flex-col items-center gap-1 py-2.5 rounded-xl border border-borde hover:bg-superficie-2 text-[11px] font-semibold text-texto-suave">
                  <I size={16} /> {n} <Tecla>{k2}</Tecla>
                </button>
              ))}
            </div>
            <Boton variant="dark" size="lg" className="w-full mt-4" onClick={nuevaVenta}>Nueva venta <Tecla>Enter</Tecla></Boton>
          </div>
        </Overlay>
      )}

      {verTicket && ticket && (
        <Modal open onClose={() => setVerTicket(false)} ancho="max-w-md">
          <div className="p-5">
            <div className="bg-superficie-2 rounded-xl p-3 overflow-auto">
              <Comandera lineas={ticketVenta(ticket, ajustes, W)} ancho={ajustes.ancho} qr={ticket.fiscal ? ticket.cae : null} className="py-2 shadow-sm" />
            </div>
            <div className="grid grid-cols-2 gap-1.5 mt-3 no-print">
              <Boton variant="ghost" onClick={() => imprimirComandera(ticketVenta(ticket, ajustes, W), ajustes.ancho, ticket.fiscal ? ticket.cae : null, toast)}><Printer size={15} /> Imprimir</Boton>
              <Boton variant="dark" onClick={() => setVerTicket(false)}>Cerrar</Boton>
            </div>
          </div>
        </Modal>
      )}

      <EscanerCamara abierto={camara} onCerrar={() => setCamara(false)}
        titulo="Escaneá los productos"
        onLeer={(cod) => {
          const p = productos.find((x) => x.barcode === cod);
          if (p) { add(p); beep(true, ajustes.sonido); toast(`${p.nombre} · ${money(p.precio)}`); }
          else { beep(false, ajustes.sonido); setCamara(false); setAlta({ barcode: cod }); }
        }} />

      <AltaRapida abierto={!!alta} inicial={alta} productos={productos} ajustes={ajustes}
        onClose={() => { setAlta(null); setQ(""); }} onCrear={crearAlVuelo} />

      {ayuda && (
        <Overlay ancho="max-w-md">
          <div className="p-5">
            <h3 className="f-d text-lg">Atajos de teclado</h3>
            <p className="text-sm text-texto-suave mt-0.5">Todo el cobro se puede hacer sin tocar el mouse.</p>
            <ul className="mt-4 space-y-1.5 text-sm">
              {[["Escribir / escanear", "busca y carga el producto"], ["Enter", "agrega el producto marcado"],
                ["Un número + Enter", "cambia la cantidad del último producto"], ["Enter con el campo vacío", "pasa a cobrar"], ["↑ ↓", "elegir en la lista"],
                ["F2", "cobrar"], ["F4", "cambiar descuento"], ["F7", "quitar el último renglón"],
                ["F8", "anular la venta"], ["F9", "vender recorriendo el salón"], ["F10", "ir al panel"],
                ["1 – 5", "elegir medio de pago"], ["6", "pago combinado"], ["Supr", "borrar el último pago parcial"], ["I / T / W / E", "imprimir, ver, WhatsApp, email"],
                ["Esc", "volver un paso"]].map(([k2, d]) => (
                <li key={k2} className="flex items-baseline gap-3">
                  <span className="w-44 shrink-0"><Tecla>{k2}</Tecla></span>
                  <span className="text-texto-suave">{d}</span>
                </li>
              ))}
            </ul>
            <Boton variant="dark" className="w-full mt-4" onClick={() => setAyuda(false)}>Cerrar <Tecla>F1</Tecla></Boton>
          </div>
        </Overlay>
      )}
    </div>
  );
}

export function TicketModal({ t, onClose, ajustes, toast }) {
  if (!t) return null;
  const W = ajustes.ancho === 58 ? 32 : 48;
  const acciones = [
    { i: Printer, n: "Imprimir", fn: () => imprimirComandera(ticketVenta(t, ajustes, W), ajustes.ancho, t.fiscal ? t.cae : null, toast) },
    { i: MessageCircle, n: "WhatsApp", fn: () => toast("Comprobante enviado por WhatsApp.") },
    { i: Mail, n: "Email", fn: () => toast("Comprobante enviado por email.") },
    { i: QrCode, n: "QR", fn: () => toast("QR en pantalla para el cliente.") },
  ];
  return (
    <Modal open={!!t} onClose={onClose} ancho="max-w-md">
      <div className="p-5">
        <div className="flex items-center justify-between no-print">
          <div className="flex items-center gap-2 text-bien font-semibold text-sm">
            <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center"><Check size={14} /></div>
            Venta registrada
          </div>
          <span className="text-[11px] text-texto-tenue">Comandera {ajustes.ancho} mm</span>
        </div>
        <div className="bg-superficie-2 rounded-xl p-3 mt-4 overflow-auto">
          <Comandera lineas={ticketVenta(t, ajustes, W)} ancho={ajustes.ancho}
            qr={t.fiscal ? t.cae : null} className="py-2 shadow-sm" />
        </div>
        <div className="grid grid-cols-4 gap-1.5 mt-4 no-print">
          {acciones.map((a) => (
            <button key={a.n} onClick={a.fn} className="flex flex-col items-center gap-1 py-2.5 rounded-xl border border-borde hover:bg-superficie-2 text-[11px] font-semibold text-texto-suave">
              <a.i size={16} /> {a.n}
            </button>
          ))}
        </div>
        <Boton onClick={onClose} variant="dark" className="w-full mt-3 no-print">Listo</Boton>
      </div>
    </Modal>
  );
}

/* ============================================================
   6 bis. ALTAS: PRODUCTO Y PROVEEDOR
   ============================================================ */

export function FormProducto({ abierto, inicial, productos, provs, ajustes0, onGuardar, onClose }) {
  const [d, setD] = useState({});
  useEffect(() => { if (abierto) setD({ iva: 21, unidad: "un", bulto: 1, stock: 0, ...(inicial || {}) }); }, [abierto, inicial]);
  if (!abierto) return null;

  const set = (c, v) => setD((x) => ({ ...x, [c]: v }));
  const cats = Array.from(new Set(productos.map((p) => p.categoria).filter(Boolean))).sort();
  const editando = !!d.id;
  const costo = Number(d.costo) || 0, precio = Number(d.precio) || 0;
  const margen = precio ? (precio - costo) / precio : 0;
  const faltan = faltantesProducto({ ...d, costo, precio });
  const duplicado = d.barcode && productos.find((p) => p.barcode === String(d.barcode).replace(/\D/g, "") && p.id !== d.id);

  return (
    <Modal open onClose={onClose} ancho="max-w-2xl">
      <div className="sticky top-0 bg-superficie border-b border-borde px-5 py-3.5 flex items-center justify-between">
        <h3 className="f-d text-lg">{editando ? "Editar producto" : "Nuevo producto"}</h3>
        <button onClick={onClose} className="text-texto-tenue hover:text-texto"><X size={18} /></button>
      </div>
      <div className="p-5 space-y-4">
        <Campo label="Nombre">
          <input value={d.nombre || ""} onChange={(e) => set("nombre", e.target.value)} autoFocus
            placeholder="Ej: Gaseosa Coca-Cola 2,25 L" className={inputCls} />
        </Campo>

        <div className="grid md:grid-cols-3 gap-3">
          <Campo label="Código de barras">
            <input value={d.barcode || ""} onChange={(e) => set("barcode", e.target.value.replace(/\D/g, ""))}
              placeholder="Disparalo con la pistola" className={`${inputCls} f-m`} />
            {duplicado && <span className="text-[11px] text-mal">Ya lo usa {duplicado.nombre}</span>}
          </Campo>
          <Campo label="Rubro">
            <input list="rubros" value={d.categoria || ""} onChange={(e) => set("categoria", e.target.value)} className={inputCls} />
            <datalist id="rubros">{cats.map((c) => <option key={c} value={c} />)}</datalist>
          </Campo>
          <Campo label="Marca">
            <input value={d.marca || ""} onChange={(e) => set("marca", e.target.value)} className={inputCls} />
          </Campo>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Campo label="Costo">
            <input value={d.costo || ""} onChange={(e) => set("costo", e.target.value.replace(/\D/g, ""))} className={`${inputCls} f-m text-right`} />
          </Campo>
          <Campo label="Precio lista 1">
            <input value={d.precio || ""} onChange={(e) => set("precio", e.target.value.replace(/\D/g, ""))} className={`${inputCls} f-m text-right`} />
          </Campo>
          <Campo label="Margen">
            <div className={`${inputCls} f-m text-right bg-superficie-2 ${margen > 0 && margen < 0.12 ? "text-mal" : ""}`}>{precio ? pct(margen) : "—"}</div>
          </Campo>
          <Campo label="IVA">
            <select value={d.iva} onChange={(e) => set("iva", Number(e.target.value))} className={inputCls}>
              <option value={21}>21%</option><option value={10.5}>10,5%</option><option value={0}>Exento</option>
            </select>
          </Campo>
        </div>
        {(provs && ajustes0.listas ? ajustes0.listas : []).filter((l) => l.activa !== false).length > 0 && (
          <div>
            <span className="text-[10px] uppercase tracking-widest text-texto-tenue font-bold">Otras listas de precio</span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-1">
              {ajustes0.listas.filter((l) => l.activa !== false).map((l) => {
                const v = Number((d.precios || {})[l.id]) || 0;
                return (
                  <label key={l.id} className="block">
                    <span className="text-[10px] text-texto-suave">{l.nombre} · desde {l.umbral}</span>
                    <input value={(d.precios || {})[l.id] || ""}
                      onChange={(e) => set("precios", { ...(d.precios || {}), [l.id]: e.target.value.replace(/\D/g, "") })}
                      placeholder="—" className={`${inputCls} f-m text-right`} />
                    {v > 0 && v <= costo && <span className="text-[11px] text-mal">bajo el costo</span>}
                    {v > costo && <span className="text-[11px] text-texto-tenue">margen {pct((v - costo) / v, 0)}</span>}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {costo > 0 && !precio && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-texto-suave self-center">Sugerir precio con margen:</span>
            {[0.25, 0.3, 0.35, 0.4].map((m) => (
              <button key={m} onClick={() => set("precio", String(Math.round(costo / (1 - m) / 10) * 10))}
                className="text-xs px-2 py-1 rounded-lg border border-borde hover:bg-superficie-2 f-m">
                {pct(m, 0)} → {money(Math.round(costo / (1 - m) / 10) * 10)}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Campo label="Stock actual">
            <input value={d.stock || ""} onChange={(e) => set("stock", e.target.value.replace(/[^\d.]/g, ""))} className={`${inputCls} f-m text-right`} />
          </Campo>
          <Campo label="Stock mínimo">
            <input value={d.stockMin || ""} onChange={(e) => set("stockMin", e.target.value.replace(/[^\d.]/g, ""))} className={`${inputCls} f-m text-right`} />
          </Campo>
          <Campo label="Unidad de venta">
            <select value={d.unidad} onChange={(e) => set("unidad", e.target.value)} className={inputCls}>
              <option value="un">Por unidad</option><option value="kg">Por kilo</option>
            </select>
          </Campo>
          <Campo label="Compra por bulto de">
            <input value={d.bulto || ""} onChange={(e) => set("bulto", e.target.value.replace(/\D/g, ""))} className={`${inputCls} f-m text-right`} />
          </Campo>
        </div>

        <Campo label="Proveedor">
          <select value={d.proveedor || ""} onChange={(e) => set("proveedor", e.target.value)} className={inputCls}>
            <option value="">Sin asignar</option>
            {Object.keys(provs).map((p) => <option key={p}>{p}</option>)}
          </select>
        </Campo>

        {faltan.length > 0 && (
          <div className="text-sm text-amber-800 bg-ojo-suave border border-ojo rounded-xl p-3">
            Podés guardarlo igual, pero le falta: <strong>{faltan.join(", ")}</strong>. Va a quedar marcado como ficha incompleta hasta que lo completes.
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-borde">
          <Boton variant="quiet" onClick={onClose}>Cancelar</Boton>
          <Boton onClick={() => onGuardar(d, faltan)} disabled={!d.nombre || !!duplicado}>
            <Check size={15} /> {editando ? "Guardar cambios" : "Crear producto"}
          </Boton>
        </div>
      </div>
    </Modal>
  );
}

export function FormProveedor({ abierto, inicial, onGuardar, onClose }) {
  const [d, setD] = useState({});
  useEffect(() => { if (abierto) setD(inicial || {}); }, [abierto, inicial]);
  if (!abierto) return null;
  const set = (c, v) => setD((x) => ({ ...x, [c]: v }));
  const faltan = faltantesProveedor(d);
  return (
    <Modal open onClose={onClose} ancho="max-w-lg">
      <div className="p-5">
        <h3 className="f-d text-lg">{inicial && inicial.nombreOriginal ? "Editar proveedor" : "Nuevo proveedor"}</h3>
        <div className="space-y-3 mt-4">
          <Campo label="Nombre"><input value={d.nombre || ""} onChange={(e) => set("nombre", e.target.value)} autoFocus className={inputCls} /></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="CUIT"><input value={d.cuit || ""} onChange={(e) => set("cuit", e.target.value)} placeholder="30-12345678-9" className={`${inputCls} f-m`} /></Campo>
            <Campo label="Teléfono"><input value={d.tel || ""} onChange={(e) => set("tel", e.target.value)} placeholder="11 4455-2210" className={`${inputCls} f-m`} /></Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Condición de pago">
              <input list="pagos" value={d.pago || ""} onChange={(e) => set("pago", e.target.value)} placeholder="Contado" className={inputCls} />
              <datalist id="pagos"><option value="Contado" /><option value="Cta. cte. 15 días" /><option value="Cta. cte. 21 días" /><option value="Cta. cte. 30 días" /></datalist>
            </Campo>
            <Campo label="Días de entrega"><input value={d.entrega || ""} onChange={(e) => set("entrega", e.target.value)} placeholder="Mar y Vie" className={inputCls} /></Campo>
          </div>
        </div>
        {faltan.length > 0 && (
          <div className="text-sm text-amber-800 bg-ojo-suave border border-ojo rounded-xl p-3 mt-4">
            Falta: <strong>{faltan.join(", ")}</strong>. Se guarda igual y queda marcado para completar.
          </div>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <Boton variant="quiet" onClick={onClose}>Cancelar</Boton>
          <Boton onClick={() => onGuardar(d)} disabled={!d.nombre}><Check size={15} /> Guardar</Boton>
        </div>
      </div>
    </Modal>
  );
}

export { Campo, inputCls };
