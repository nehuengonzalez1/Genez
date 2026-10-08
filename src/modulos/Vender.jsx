/* ============================================================
   6. VENDER (POS) + 6 bis. ALTAS: PRODUCTO Y PROVEEDOR
   ============================================================ */

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Barcode, ScanLine, Camera as Cam, CameraOff, Zap, ZapOff, Loader2,
  Minus, Plus, Trash2, Printer, FileText, MessageCircle, Mail, QrCode,
  ArrowRight, Check, X, Percent, Users, Search, History
} from "lucide-react";
import { uid } from "../datos/generador.js";
import { saldoDe } from "../datos/cuentas.js";
import { pideCuit, MONTO_IDENTIFICAR_CONSUMIDOR } from "../utils/fiscal.js";
import { cargarPlanilla, descargar } from "../utils/planilla.js";
import { aplicarPromociones, descuentoPorMedio } from "../utils/promociones.js";
import { buscarEnCatalogo, rubroSugerido, FUENTE_CATALOGO } from "../datos/catalogo.js";
import { qrMercadoPago } from "../datos/mercadopago.js";
import { saldoDePuntos } from "../datos/puntos.js";
import { reglaDePuntos, puntosGanados, canjeMaximo, valorDePuntos } from "../utils/puntos.js";
import QRCode from "qrcode";
import {
  nf, money, pct, esCantidad, aNumero, precioAplicado, proximaLista, listasDeCliente, comisionDe,
  conRecargo, mediosDe, medioPorK, letraComprobante, FISCAL_INICIAL,
  condicionNombre, faltantesProducto, faltantesProveedor, productoNuevo,
  leerCodigoBalanza, pasoDe, formatoCantidad, nombreUnidad, MEDIO_CUENTA_CORRIENTE,
  TOPE_DESCUENTO, topeDescuento, limpiarPorcentaje, leerPorcentaje,
  ALICUOTAS, claveAlicuota, alicuotaDe
} from "../utils/helpers.js";
import {
  beep, useScanHandler, ticketVenta, imprimirTicket, qrDeFactura, esperaCAE,
  Vacio, Modal, Boton, Card, Comandera
} from "../ui/Base.jsx";
import { FormCliente } from "./Clientes.jsx";
import { UltimasVentas } from "./UltimasVentas.jsx";
import { Campo, inputCls } from "../ui/Campos.jsx";
import { useOcupado } from "../ui/actualizacion.js";

/* De dónde salió lo que apareció escrito. La licencia de SEPA (CC-BY)
   pide citar la fuente, y al que carga le sirve saber que no lo inventó
   el sistema: si el nombre está mal, lo corrige. */
function DelCatalogo({ sug }) {
  const datos = [sug.marca, sug.rubro].filter(Boolean).join(" · ");
  return (
    <p className="text-[11px] text-texto-tenue mt-1.5">
      Sugerido por el catálogo{datos ? `: ${datos}` : ""}. Fuente: {FUENTE_CATALOGO}.
    </p>
  );
}

function AltaRapida({ abierto, inicial, productos, ajustes, onCrear, onClose }) {
  const [camara, setCamara] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [costo, setCosto] = useState("");
  const [otros, setOtros] = useState({});
  const [sug, setSug] = useState(null);
  const ref = useRef(null);
  const refPrecio = useRef(null);

  useEffect(() => {
    if (!abierto) return;
    setNombre((inicial && inicial.nombre) || "");
    setPrecio(""); setCosto(""); setOtros({}); setSug(null);
    setCodigo((inicial && inicial.barcode) || "");
    setTimeout(() => ref.current && ref.current.focus(), 30);
  }, [abierto, inicial]);

  /* El catálogo base (0106): si SEPA conoce el código, el nombre llega
     solo y el cursor salta al precio. Pero el alta ya está abierta y
     vacía: si el cajero empezó a escribir, no se le pisa nada ni se le
     mueve el cursor. */
  useEffect(() => {
    if (!abierto || !codigo) return;
    let vivo = true;
    buscarEnCatalogo(codigo).then((s) => {
      if (!vivo || !s) return;
      setSug(s);
      if (ref.current && !ref.current.value) {
        setNombre(s.nombre);
        if (document.activeElement === ref.current) setTimeout(() => refPrecio.current && refPrecio.current.focus(), 0);
      }
    });
    return () => { vivo = false; };
  }, [abierto, codigo]);

  if (!abierto) return null;
  const margen = Number(precio) && Number(costo) ? (Number(precio) - Number(costo)) / Number(precio) : null;

  const crear = (agregar) => {
    if (!nombre.trim()) return;
    const delCatalogo = sug ? {
      marca: sug.marca || undefined,
      categoria: rubroSugerido(sug, productos.map((p) => p.categoria)) || undefined,
    } : {};
    onCrear({ ...delCatalogo, nombre: nombre.trim(), precio: Number(precio) || 0, costo: Number(costo) || 0, precios: otros, barcode: codigo }, agregar);
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
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest font-bold text-acento-vivo">
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
        {sug && <DelCatalogo sug={sug} />}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-texto-tenue font-bold">Precio de venta</span>
            <input ref={refPrecio} value={precio} onChange={(e) => setPrecio(e.target.value.replace(/\D/g, ""))}
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
                <div className="text-[11px] text-texto-suave">{l.tipo === "cliente" ? "Para los clientes con esta lista." : `Se cobra a partir de ${l.umbral} unidades.`} Vacío: este producto no entra en esta lista.</div>
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
          Va a quedar marcado como ficha incompleta en el Panel.<span className="solo-teclado"> <Tecla>Esc</Tecla> cancela.</span>
        </p>
      </div>
    </Overlay>
  );
}

/* --- Planilla de productos --------------------------------------------
   Exporta e importa el catálogo en Excel. Cargar la librería y bajar el
   archivo viven en src/utils/planilla.js, que comparte con las planillas
   para el contador.                                                     */

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
      /* "Exento" y no 0: al volver a importarla, un 0 sería gravado al 0%. */
      else if (campo === "iva") fila[titulo] = (ALICUOTAS.find((a) => a.k === claveAlicuota(p.iva, p.ivaCondicion)) || {}).n || "";
      else fila[titulo] = p[campo] != null ? p[campo] : "";
    }
    return fila;
  });
}

export async function exportarCatalogo(productos, listas, toast) {
  const filas = filasCatalogo(productos, listas);
  const hoy = new Date();
  const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
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
      <div className="flex items-center gap-3 px-4 py-3 text-texto bg-fondo/80">
        <Cam size={18} className="text-acento-vivo shrink-0" />
        <span className="font-semibold text-sm flex-1">{titulo}</span>
        <button onClick={cambiarLinterna} className="p-2 text-texto/70 active:text-texto" title="Linterna">
          {linterna ? <Zap size={18} /> : <ZapOff size={18} />}
        </button>
        <button onClick={onCerrar} className="p-2 text-texto/70 active:text-texto"><X size={20} /></button>
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
            <div className="text-texto">
              {estado === "error" ? <CameraOff size={30} className="mx-auto text-mal" /> : <Loader2 size={30} className="mx-auto animate-spin text-acento-vivo" />}
              <p className="text-sm mt-3 max-w-xs">{detalle || "Encendiendo la cámara…"}</p>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-3 bg-fondo/85 text-center seguro-abajo">
        {ultimo
          ? <p className="f-m text-sm text-bien">Leído: {ultimo}</p>
          : <p className="text-xs text-texto/60">Acercá el código de barras al recuadro</p>}
        <p className="text-[11px] text-texto/40 mt-1">Podés seguir escaneando: la ventana no se cierra sola</p>
      </div>
    </div>
  );
}

export function BuscarCliente({ clientes, onElegir, onCrear, onCerrar, listas = [] }) {
  const [q, setQ] = useState("");
  const [nuevo, setNuevo] = useState(false);
  const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const lista = q.trim().length >= 1
    ? clientes.filter((c) => norm(c.razonSocial).includes(norm(q)) || String(c.doc || "").includes(q.trim()))
    : clientes.slice(0, 8);

  if (nuevo) {
    return <FormCliente abierto inicial={{ razonSocial: q }} onCerrar={() => setNuevo(false)} onGuardar={(d) => onCrear(d)} listas={listas} />;
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

/* --- El importe de un producto de precio abierto ------------------------
   Aparece entre que el cajero elige el producto y el renglón entra al
   carrito. Es un solo campo a propósito: en un mostrador con gente
   esperando, cualquier cosa que haya que leer antes de tipear es tiempo.

   El teclado numérico ya está en la mano del cajero, así que Enter
   confirma y Escape cancela sin tocar el mouse.                           */
function PedirImporte({ pedido, onClose, onConfirmar }) {
  const [valor, setValor] = useState("");
  const campo = useRef(null);

  /* Se limpia al abrir y no al cerrar: si quedara el importe anterior, el
     segundo corte de fiambre saldría con el precio del primero. */
  useEffect(() => { if (pedido) { setValor(""); setTimeout(() => campo.current && campo.current.focus(), 30); } }, [pedido]);
  if (!pedido) return null;

  const importe = Number(valor) || 0;
  const confirmar = () => { if (importe > 0) onConfirmar(importe); };

  return (
    <Modal open onClose={onClose} ancho="max-w-xs">
      <div className="p-5">
        <h3 className="f-d text-lg">{pedido.p.nombre}</h3>
        <p className="text-sm text-texto-suave mt-0.5">¿Cuánto se cobra?</p>
        <input ref={campo} value={valor} inputMode="numeric"
          onChange={(e) => setValor(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); confirmar(); }
            if (e.key === "Escape") { e.preventDefault(); onClose(); }
          }}
          className="w-full border border-borde rounded-xl px-3 py-3 mt-3 f-m text-right text-2xl outline-none focus:border-acento" />
        <div className="f-m text-right text-sm text-texto-tenue mt-1 h-5">{importe > 0 ? money(importe) : ""}</div>
        <Boton className="w-full mt-3" disabled={importe <= 0} onClick={confirmar}>Agregar</Boton>
        <button onClick={onClose} className="w-full mt-2 text-xs text-texto-tenue hover:text-texto py-1">Cancelar<span className="solo-teclado"> · Esc</span></button>
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
  return <kbd className="solo-teclado f-m text-[10px] border border-borde-fuerte rounded px-1.5 py-0.5 bg-superficie text-texto-suave">{children}</kbd>;
}

/* El descuento de la venta: un porcentaje o un importe en pesos. Los
   botones de 5, 10 y 15 % siguen siendo los rápidos, y F4 rota entre
   ellos; lo que no está en los botones se escribe. */
const SIN_DESC = { modo: "pct", valor: 0 };
/* Lo que se ve en el campo. `texto` es lo tipeado, para que "99," no se
   pierda a mitad de escribir; los botones no lo traen y se muestra el
   número. */
const textoDesc = (d) => d.texto != null ? d.texto : d.valor ? String(d.valor).replace(".", ",") : "";
const DESC_RAPIDOS = [0, 5, 10, 15];

/* El precio de un renglón, que se toca con un clic. Cambia lo que se
   cobra en esta venta y nada más: el precio del catálogo sigue igual, que
   es lo que se espera de "se lo dejo a tanto". Para cambiarlo de verdad
   está Productos. */
function PrecioEditable({ linea, puede, onCambiar, className = "" }) {
  const [editando, setEditando] = useState(false);
  const [v, setV] = useState("");
  if (!puede) return <span className={className}>{money(linea.unit)}</span>;
  if (editando) {
    const confirmar = () => {
      const n = Number(v);
      if (n > 0) onCambiar(n);
      setEditando(false);
    };
    return (
      <input autoFocus inputMode="numeric" value={v}
        onChange={(e) => setV(e.target.value.replace(/[^\d]/g, ""))}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          /* Enter y Esc son de este campo: sin cortarlos acá, llegan al
             buscador del cobro. */
          if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); confirmar(); }
          if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setEditando(false); }
        }}
        onBlur={confirmar}
        className="f-m w-24 text-right border border-acento rounded-md px-2 py-1 text-sm bg-superficie outline-none" />
    );
  }
  return (
    <button onClick={() => { setV(String(linea.unit)); setEditando(true); }} title="Cambiar el precio en esta venta"
      className={`underline decoration-dotted decoration-texto-tenue underline-offset-4 hover:decoration-acento ${className}`}>
      {money(linea.unit)}
    </button>
  );
}

/* ------------------------------------------------------------------
   COBRO CON QR DINÁMICO (0107)
   ------------------------------------------------------------------
   Arma la orden en Mercado Pago con el monto de la venta, muestra el QR
   y pregunta cada dos segundos si ya se pagó. Pagada, la venta se
   registra sola. Si Mercado Pago no contesta, el cajero puede cobrar
   como antes, con el QR fijo: el mostrador no se traba nunca.

   Volver cancela la orden, así nadie la paga después. Y si justo se
   pagó, la cancelación devuelve "pagada" y la venta se registra igual:
   la plata no se pierde entre un botón y otro. */
function CobroQr({ monto, referencia, cajaMp, empresaId, sonido, onPagado, onVolver, onQrFijo }) {
  const [orden, setOrden] = useState(null);
  const [imagen, setImagen] = useState(null);
  const [estado, setEstado] = useState("armando");   // armando → esperando → pagada | vencida | cancelada | rechazada | error
  const [mensaje, setMensaje] = useState("");
  const listo = useRef(false);

  const pagado = (o, pago) => {
    if (listo.current) return;
    listo.current = true;
    beep(true, sonido);
    onPagado({ orden: o, pago });
  };

  useEffect(() => {
    let vivo = true;
    qrMercadoPago("crear", { monto, referencia, cajaMp, detalle: "Compra" }, empresaId)
      .then(async (r) => {
        if (!vivo) return;
        setOrden(r.orden);
        setImagen(await QRCode.toDataURL(r.qr, { margin: 1, width: 320, errorCorrectionLevel: "M" }));
        setEstado("esperando");
      })
      .catch((e) => { if (vivo) { setEstado("error"); setMensaje(e.message); } });
    return () => { vivo = false; };
  }, [monto, referencia, cajaMp, empresaId]);

  useEffect(() => {
    if (!orden || estado !== "esperando") return;
    let vivo = true;
    const id = setInterval(async () => {
      try {
        const r = await qrMercadoPago("estado", { orden }, empresaId);
        if (!vivo) return;
        if (r.estado === "pagada") return pagado(orden, r.pago);
        if (r.estado !== "esperando") setEstado(r.estado);
      } catch { /* un sondeo que falla no corta: el próximo pregunta de nuevo */ }
    }, 2000);
    return () => { vivo = false; clearInterval(id); };
  }, [orden, estado, empresaId]);

  const volver = async () => {
    if (orden && estado === "esperando") {
      try {
        const r = await qrMercadoPago("cancelar", { orden }, empresaId);
        if (r.estado === "pagada") return pagado(orden, r.pago);
      } catch { /* si no se pudo cancelar, vence sola a los diez minutos */ }
    }
    onVolver();
  };

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); volver(); } };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  });

  const textos = {
    armando: "Armando el cobro en Mercado Pago…",
    esperando: "Que lo escanee con la app de Mercado Pago o de su banco. El monto ya está adentro.",
    vencida: "El QR venció sin que se pagara.",
    cancelada: "El cobro se canceló.",
    rechazada: "Mercado Pago rechazó el pago.",
    error: mensaje || "Mercado Pago no contestó.",
  };

  return (
    <Overlay ancho="max-w-sm">
      <div className="p-6 text-center">
        <div className="text-[11px] uppercase tracking-widest font-bold text-texto-tenue">Cobrar con QR</div>
        <div className="f-d f-m text-4xl mt-1">{money(monto)}</div>
        <div className="mt-4 mx-auto w-[260px] h-[260px] rounded-xl border border-borde bg-superficie flex items-center justify-center">
          {imagen && estado === "esperando"
            ? <img src={imagen} alt="QR para pagar con Mercado Pago" className="w-[240px] h-[240px]" />
            : <span className="text-sm text-texto-tenue px-4">{estado === "armando" ? "…" : "Sin QR"}</span>}
        </div>
        <p className={`text-sm mt-4 ${["error", "rechazada", "vencida"].includes(estado) ? "text-mal" : "text-texto-suave"}`}>{textos[estado]}</p>
        {estado === "esperando" && <p className="text-[11px] text-texto-tenue mt-1">Se registra solo cuando entra el pago.</p>}
        <div className="flex flex-col gap-1.5 mt-5">
          {estado !== "esperando" && estado !== "armando" && (
            <Boton onClick={onQrFijo}>Cobrar con el QR fijo, como antes</Boton>
          )}
          <Boton variant="quiet" onClick={volver}>Volver a los medios de pago <Tecla>Esc</Tecla></Boton>
        </div>
      </div>
    </Overlay>
  );
}

const ATAJOS = [
  ["F2", "Cobrar"], ["F3", "Últimas ventas"], ["F4", "Descuento"], ["F7", "Quitar último"], ["F8", "Anular venta"],
  ["F9", "Salón"], ["F10", "Panel"], ["F1", "Ayuda"],
];

/* `descuentoMax` (06/10): el tope de descuento del rol de quien cobra, en
   porcentaje, o null sin tope (el dueño, la plataforma, o un rol al que no
   se le puso). Lo fija el comercio en Ajustes → Cobros y facturas. Como
   el permiso de descontar, lo controla la pantalla y no la base. */
export function POS({ productos, setProductos, cobrar, ajustes, toast, ir, pendiente, setPendiente, aPanel, clientes, guardarCliente, permisos, descuentoMax = null,
  facturacion = { puede: false }, facturas = {}, pedirCAEs, empresaId = null, caja = null, recargarCaja = null, agregarProducto = null, promos = [], cajaMp = null,
  muestra = false }) {
  const [paso, setPaso] = useState("carga");     // carga → pago → (monto | qr) → fin
  /* Los puntos del cliente elegido y cuántos se usan en esta venta (0112). */
  const [puntosCliente, setPuntosCliente] = useState(null);
  const [canje, setCanje] = useState(0);
  /* El cobro con QR dinámico en curso (0107): el monto ya validado. */
  const [qr, setQr] = useState(null);
  /* El rubro de cada producto, para las promos que abarcan un rubro: el
     renglón del carrito no lo guarda. */
  const catDe = useMemo(() => new Map(productos.map((p) => [p.id, p.categoria])), [productos]);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [cart, setCart] = useState([]);
  const [desc, setDesc] = useState(SIN_DESC);
  const [medioSel, setMedioSel] = useState(0);
  const [recibe, setRecibe] = useState("");
  const [pagos, setPagos] = useState([]);
  const [montoMix, setMontoMix] = useState("");
  const [ticket, setTicket] = useState(null);
  /* Va acá arriba y no junto a su saldo: el precio de cada renglón ya lo
     usa (lista del cliente), y leerlo antes de declararlo deja la pantalla
     en negro (pasó el 29/09 en Sistema). */
  const [cliente, setCliente] = useState(null);
  /* Con una venta a medio cargar o a medio cobrar, la página no se
     actualiza sola (src/ui/actualizacion.js): se perdería el carrito. Con
     la venta ya cobrada ("fin") sí: la venta está guardada. */
  useOcupado(paso !== "fin" && (cart.length > 0 || pagos.length > 0));
  /* El ticket que se muestra, con la factura si ARCA ya la autorizó. El
     CAE llega después del cobro —a veces mucho después—, así que no se
     guarda en `ticket`: se mira cada vez en lo que va llegando. */
  const tk = ticket && ticket.fiscal ? { ...ticket, factura: facturas[ticket.id] || null } : ticket;
  const [verTicket, setVerTicket] = useState(false);
  const [ayuda, setAyuda] = useState(false);
  const [ultimas, setUltimas] = useState(false);   // F3: las últimas ventas, para reimprimir
  const [alta, setAlta] = useState(null);
  /* `{ p, qty }` mientras se pide el importe de un producto de precio
     abierto; null el resto del tiempo. */
  const [precioAbierto, setPrecioAbierto] = useState(null);
  const [ultimo, setUltimo] = useState(null);
  const [camara, setCamara] = useState(false);
  const [verTodo, setVerTodo] = useState(false);
  const inp = useRef(null);
  const inpMonto = useRef(null);
  const inpMix = useRef(null);

  const enCarga = paso === "carga";
  useEffect(() => { if (enCarga && inp.current) inp.current.focus(); }, [enCarga, cart.length, ticket]);
  useEffect(() => { if (paso === "monto" && inpMonto.current) inpMonto.current.focus(); }, [paso]);
  useEffect(() => { if (paso === "mixto" && inpMix.current) inpMix.current.focus(); }, [paso, pagos.length]);

  const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  /* "Ver todo" es para el mostrador sin pistola: la mayor\u00eda de estos
     art\u00edculos no tiene c\u00f3digo de barras, as\u00ed que escribir el nombre a
     ciegas no alcanza \u2014 hace falta poder tocar de una lista. Ordenado
     por lo m\u00e1s vendido primero, que es lo que m\u00e1s se va a volver a
     pedir. Se apaga solo en cuanto el operador escribe algo: buscar y
     mirar todo son dos modos, no uno encima del otro. */
  /* LO QUE SE PUEDE VENDER NO ES TODO EL CATÁLOGO

     `activo` existía como columna desde el principio y no lo miraba nadie:
     dar de baja un producto no lo sacaba del mostrador. Se filtra acá, en
     el punto donde el POS resuelve qué producto es, y no en la prop: el
     formulario de alta necesita ver también los dados de baja para avisar
     que un código de barras ya está usado. */
  const vendibles = useMemo(() => productos.filter((p) => p.activo !== false), [productos]);

  const res = useMemo(() => {
    if (verTodo && q.trim().length < 2) return [...vendibles].sort((a, b) => (b.u30 || 0) - (a.u30 || 0)).slice(0, 60);
    if (q.trim().length < 2) return [];
    const t = norm(q.trim());
    const ex = vendibles.find((p) => p.barcode === q.trim());
    if (ex) return [ex];
    return vendibles.filter((p) => norm(p.nombre).includes(t) || p.sku.toLowerCase().includes(t)).slice(0, 7);
  }, [q, vendibles, verTodo]);

  /* `importe` solo llega desde el cuadro de precio abierto. Cuando el
     producto es de precio abierto y todavía no hay importe, esto no suma
     nada: abre el cuadro y vuelve por acá cuando el cajero confirmó. */
  const add = (p, qty, importe) => {
    if (p.precioAbierto && importe == null) { setPrecioAbierto({ p, qty }); return; }
    const unitario = p.precioAbierto ? importe : p.precio;
    if (!unitario) { beep(false, ajustes.sonido); return toast(`${p.nombre} no tiene precio de venta cargado.`, "mal"); }
    /* El de precio abierto entra de a uno: la cantidad ya está adentro del
       importe que escribió el cajero —son 300 g de jamón, no "una unidad
       de jamón"— y multiplicarlo por el paso de la unidad lo falsearía. */
    const cantidad = p.precioAbierto ? 1 : (qty != null ? qty : pasoDe(p.unidad));
    /* Vender sin stock (Ajustes → Precios y stock, 06/10). De fábrica se
       deja, como siempre. No se mira un producto que no controla stock ni
       uno al que nunca se le cargó (0110): ahí el número no dice nada. */
    const regla = ajustes.sinStock || "permitir";
    if (regla !== "permitir" && p.controlaStock !== false && p.stockCargado !== false && typeof p.stock === "number") {
      const yaEnTicket = cart.filter((l) => l.pid === p.id).reduce((s, l) => s + Number(l.qty || 0), 0);
      const quedan = p.stock - yaEnTicket;
      if (quedan - cantidad < 0) {
        if (regla === "bloquear") {
          beep(false, ajustes.sonido);
          return toast(quedan > 0 ? `De ${p.nombre} quedan ${formatoCantidad(p.unidad, quedan)}: no alcanza.` : `${p.nombre} no tiene stock.`, "mal");
        }
        toast(quedan > 0 ? `De ${p.nombre} quedan ${formatoCantidad(p.unidad, quedan)}.` : `${p.nombre} no tiene stock: el stock queda en negativo.`, "mal");
      }
    }
    setCart((c) => {
      /* Dos renglones de precio abierto del mismo producto NO se juntan:
         son dos cortes distintos con dos importes distintos, y sumarlos
         perdería de vista qué se cobró por cada uno. */
      const i = p.precioAbierto ? -1 : c.findIndex((l) => l.pid === p.id && !l.precioAbierto);
      if (i >= 0) { const n = [...c]; n[i] = { ...n[i], qty: +(n[i].qty + cantidad).toFixed(3) }; return n; }
      return [...c, {
        lid: uid(), pid: p.id, qty: cantidad, precio: unitario,
        /* Sin listas por volumen: el importe ya es el que se cobra, y una
           lista de "desde 3 unidades" no significa nada acá. */
        precios: p.precioAbierto ? {} : (p.precios || {}),
        costo: p.costo, nombre: p.nombre, unidad: p.unidad, precioAbierto: !!p.precioAbierto,
        /* Solo para el papel de la A, que muestra cada renglón sin IVA. Lo
           que se le informa a ARCA sale de la base (0097), no de acá. */
        iva: p.iva, ivaCondicion: p.ivaCondicion,
      }];
    });
    setUltimo({ pid: p.id, nombre: p.nombre, unidad: p.unidad });
    setQ(""); setSel(0);
  };

  useScanHandler((cod) => {
    /* Balanza antes que código de barras normal: un código de balanza
       tiene la misma forma (todo dígitos) y si se buscara tal cual nunca
       va a matchear ningún producto — hay que desarmarlo primero. */
    const bal = leerCodigoBalanza(cod, ajustes.balanza);
    if (bal) {
      const p = vendibles.find((x) => x.barcode === bal.codigo);
      if (p) {
        const cantidad = bal.peso != null ? bal.peso : +(bal.importe / p.precio).toFixed(3);
        add(p, cantidad);
        return beep(true, ajustes.sonido);
      }
      beep(false, ajustes.sonido);
      return toast(`Balanza: no hay ningún producto con el código ${bal.codigo}.`, "mal");
    }
    const p = vendibles.find((x) => x.barcode === cod);
    if (p) { add(p); beep(true, ajustes.sonido); }
    else { beep(false, ajustes.sonido); setAlta({ barcode: cod }); }
  }, enCarga && !alta && !camara && !precioAbierto);

  useEffect(() => {
    if (!pendiente) return;
    const p = productos.find((x) => x.id === pendiente.id);
    if (p) add(p);
    setPendiente(null);
  }, [pendiente]);

  /* El producto nuevo se guarda en la base ANTES de entrar a la venta.
     Antes se creaba solo en esta pantalla (productoNuevo) y nunca llegaba
     a la base: la venta salía apuntando a un producto que no existía y la
     base la rechazaba. El primer día de Super 25 pasó dos veces ("pote
     helado acapulco 5L", "jabon en pan esencial"): ventas cobradas que
     quedaron apartadas en el equipo.

     Si no se puede guardar —sin internet, un error—, entra a la venta
     como renglón suelto: nombre y precio, sin ficha. La venta se guarda
     igual (un renglón sin producto es un concepto, como en una nota de
     débito) y el aviso dice que hay que cargarlo después en Productos. */
  const crearAlVuelo = async (datos, agregar) => {
    setAlta(null);
    setQ(""); setSel(0);
    const creado = agregarProducto ? await agregarProducto(datos, null) : null;

    if (creado) {
      if (agregar && creado.precio) {
        add(creado);
        beep(true, ajustes.sonido);
        toast(`${creado.nombre} creado y agregado. Completá la ficha después.`);
      } else if (!creado.precio) {
        toast(`${creado.nombre} creado sin precio: no se puede cobrar hasta completarlo.`, "mal");
      } else {
        toast(`${creado.nombre} creado.`);
      }
      return;
    }

    if (agregar && Number(datos.precio) > 0) {
      setCart((c) => [...c, {
        lid: uid(), pid: null, qty: 1, precio: Number(datos.precio), precios: {},
        costo: Number(datos.costo) || 0, nombre: datos.nombre, unidad: "un", precioAbierto: false,
      }]);
      beep(true, ajustes.sonido);
      toast(`No se pudo guardar "${datos.nombre}" como producto: entró a la venta como renglón suelto. Cargalo en Productos después.`, "mal");
    }
  };

  /* Por renglón y no por producto: con precio abierto puede haber dos
     renglones del mismo producto en el carrito, y tocar uno no tiene que
     tocar el otro. */
  /* El precio a mano va al renglón, no al producto: si el mismo artículo
     está dos veces, cada uno tiene el suyo. Volver al de lista es poner
     el mismo número o apretar la cruz. */
  const setPrecioManual = (lid, precio) => {
    /* Bajar el precio a mano también es descontar: con tope, no puede
       quedar por debajo de lo que el tope permite. */
    const linea = cart.find((l) => l.lid === lid);
    if (descuentoMax != null && precio != null && linea && precio < Math.ceil(linea.precio * (1 - descuentoMax / 100))) {
      return toast(`Tu usuario puede bajar el precio hasta un ${String(descuentoMax).replace(".", ",")}%: no menos de ${money(Math.ceil(linea.precio * (1 - descuentoMax / 100)))}.`, "mal");
    }
    setCart((c) => c.map((l) => (
      l.lid === lid ? { ...l, manual: precio == null || precio === l.precio ? null : precio } : l
    )));
  };
  const setQty = (lid, qty) => setCart((c) => c.map((l) => (l.lid === lid ? { ...l, qty: Math.max(0, +qty.toFixed(3)) } : l)).filter((l) => l.qty > 0));
  const quitar = (lid) => setCart((c) => c.filter((l) => l.lid !== lid));

  /* La lista del cliente elegido (06/10): cambia el precio de todo el
     ticket apenas se lo elige. */
  const listaDelCliente = (cliente && cliente.camposExtra && cliente.camposExtra.lista) || null;
  const conPrecio = cart.map((l) => {
    /* Un precio puesto a mano gana a todo, también al precio por
       cantidad: es lo que decidió quien cobra, para esta venta. */
    if (l.manual != null) {
      return { ...l, unit: l.manual, lista: null, listaNombre: null, proxima: null, importe: l.manual * l.qty, ahorro: 0 };
    }
    const { precio, lista, nombre } = precioAplicado(l, l.qty, ajustes, listaDelCliente);
    /* "Llevando 3 te sale menos" solo si de verdad sale menos: a un
       mayorista con su lista no se le ofrece una por cantidad más cara. */
    const px = proximaLista(l, l.qty, ajustes);
    return { ...l, unit: precio, lista, listaNombre: nombre, proxima: px && px.precio < precio ? px : null,
      importe: precio * l.qty, ahorro: (l.precio - precio) * l.qty };
  });
  /* Las promos (0102) sobre lo que quedó: sin precio a mano, sin precio
     por cantidad, sin precio abierto (src/utils/promociones.js explica
     por qué). El descuento baja el importe del renglón, que es lo que
     leen el total, el IVA de la factura y los informes. */
  const promoCalc = aplicarPromociones(conPrecio.map((l) => ({
    lid: l.lid, pid: l.pid, qty: l.qty, unit: l.unit, unidad: l.unidad,
    categoria: (catDe.get(l.pid) || ""),
    elegible: l.manual == null && !l.lista && !l.precioAbierto,
  })), promos);
  const lineas = conPrecio.map((l) => {
    const pr = promoCalc.porLinea[l.lid];
    return pr ? { ...l, promo: pr.descuento, promoNombre: pr.promos.join(" + "), importe: l.importe - pr.descuento } : l;
  });
  const ahorroTotal = lineas.reduce((s, l) => s + l.ahorro, 0);
  const sub = lineas.reduce((s, l) => s + l.importe, 0);
  /* Lo que se rebajó a mano, para que se vea al lado del total y no
     quede escondido en un renglón. */
  const rebajaManual = lineas.reduce((s, l) => s + (l.manual != null ? (l.precio - l.manual) * l.qty : 0), 0);
  /* En pesos enteros, como toda la plata del sistema. Un descuento en
     pesos no puede pasar el subtotal: la venta no queda en negativo. */
  const topeRol = descuentoMax == null ? TOPE_DESCUENTO : Math.min(descuentoMax, TOPE_DESCUENTO);
  const descPedido = desc.modo === "pct"
    ? Math.round(sub * Math.min(desc.valor, topeRol) / 100)
    : (descuentoMax == null ? Math.round(desc.valor) : Math.min(Math.round(desc.valor), Math.floor(sub * topeRol / 100)));
  /* Los puntos (0112) se canjean como descuento, sumado al del pedido: así
     el total baja en todos lados (pago combinado, vuelto, factura) sin
     tocar cada cuenta. Se guardan aparte en la venta, y la base los resta. */
  const regla = reglaDePuntos(ajustes);
  const maxCanje = canjeMaximo(puntosCliente ? puntosCliente.saldo : 0, topeDescuento(sub) - Math.min(descPedido, topeDescuento(sub)), regla);
  const puntosUsados = Math.min(canje, maxCanje);
  const montoCanje = valorDePuntos(puntosUsados, regla);
  const descMonto = Math.min(descPedido + montoCanje, topeDescuento(sub));
  const total = sub - descMonto;
  const costoTot = lineas.reduce((s, l) => s + l.costo * l.qty, 0);
  const ganancia = total - costoTot;
  /* Fiar es un permiso (0085): a quien no lo tiene, el medio no le aparece. */
  const medios = mediosDe(ajustes).filter((m) => m.k !== MEDIO_CUENTA_CORRIENTE || permisos.fiar);
  const medio = medios[medioSel] || medios[0];

  /* Lo que debe el cliente elegido, para decidir si se le fía. Se pregunta
     al elegirlo: sin internet queda en null y la venta sigue, porque
     frenar el mostrador por no poder consultar un saldo es peor que fiar
     de más una vez. */
  const [saldoCliente, setSaldoCliente] = useState(null);
  useEffect(() => {
    setSaldoCliente(null);
    if (!cliente || !cliente.id) return undefined;
    let vigente = true;
    saldoDe(cliente.id).then((v) => { if (vigente) setSaldoCliente(v); }).catch(() => {});
    return () => { vigente = false; };
  }, [cliente && cliente.id]);
  useEffect(() => {
    setPuntosCliente(null); setCanje(0);
    if (!cliente || !cliente.id || !reglaDePuntos(ajustes).activo) return undefined;
    let vigente = true;
    saldoDePuntos(cliente.id).then((s) => { if (vigente) setPuntosCliente(s); }).catch(() => {});
    return () => { vigente = false; };
  }, [cliente && cliente.id]);

  /* Identificar para sumar puntos: el DNI o el teléfono y Enter. Si no
     está, se crea con ese dato; el nombre se completa después. Tiene que
     llevar un segundo, o en la caja no lo hace nadie. */
  const [dato, setDato] = useState("");
  const identificar = async () => {
    const d = dato.replace(/\D/g, "");
    if (d.length < 6) return toast("Poné el DNI o el teléfono completo.", "mal");
    const digitos = (v) => String(v || "").replace(/\D/g, "");
    const esta = clientes.find((c) => digitos(c.doc) === d || (digitos(c.tel) && digitos(c.tel).endsWith(d)));
    if (esta) { setCliente(esta); setDato(""); return; }
    const dni = d.length <= 8;
    const nuevo = await guardarCliente({ razonSocial: `Cliente ${d}`, tipoDoc: dni ? "DNI" : "", doc: dni ? d : "", tel: dni ? "" : d, condicion: "CF" });
    if (nuevo) { setCliente(nuevo); setDato(""); }
  };
  const [buscarCliente, setBuscarCliente] = useState(false);
  /* "Factura" existe solo si el comercio está conectado con ARCA. La
     preferencia de Ajustes decide con cuál arranca cada venta. */
  const arrancaFactura = !!ajustes.arca && facturacion.puede;
  const [fiscal, setFiscal] = useState(arrancaFactura);
  const letra = letraComprobante((ajustes.fiscal || FISCAL_INICIAL).condicion, cliente ? cliente.condicion : "CF", (ajustes.fiscal || FISCAL_INICIAL).claseInscripto);
  /* El descuento por medio de pago (0103) va antes del recargo: el
     recargo se calcula sobre lo que se cobra de verdad. */
  const promoMedio = descuentoPorMedio(promos, medio && medio.k, total);
  const rec = conRecargo(total - (promoMedio ? promoMedio.monto : 0), medio);
  const totalFinal = rec.total;
  // El vuelto se calcula sobre el total con recargo, así que va después.
  const vuelto = recibe ? Number(recibe) - totalFinal : 0;

  /* Modo muestra (07/10): el recorrido guiado muestra la venta con la
     caja cerrada. Se carga un producto de ejemplo para que se vean el
     total, Cobrar y los medios de pago. El cobro que llega en este modo
     no guarda nada (ver cobrarMuestra en Sistema). */
  useEffect(() => {
    if (!muestra || cart.length) return;
    const p = productos.find((x) => Number(x.precio) > 0 && !x.precioAbierto);
    if (p) setCart([{ lid: uid(), pid: p.id, qty: 1, precio: p.precio, precios: p.precios || {}, costo: p.costo, nombre: p.nombre,
      unidad: p.unidad, precioAbierto: false, iva: p.iva, ivaCondicion: p.ivaCondicion }]);
  }, [muestra]); // eslint-disable-line react-hooks/exhaustive-deps

  const irAPago = () => {
    if (!cart.length) return;
    setMedioSel(0); setRecibe(""); setPagos([]); setMontoMix("");
    setFiscal(arrancaFactura); setCliente(null);
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

  /* Con "extra.antesDeCobrar" hace todas las verificaciones y la cuenta
     del total, y en vez de cobrar le pasa el total: es lo que usa el QR
     dinámico, que tiene que frenar un CUIT faltante ANTES de que el
     cliente pague, no después. Con "extra.mp" cobra y guarda la orden. */
  const finalizar = (k, recibido, listaPagos, vueltoDado, extra = {}) => {
    /* A cuenta corriente es una deuda de alguien puntual: sin saber de
       quién, no hay a quién cobrarle después. Se frena acá, el único
       lugar por el que pasan las tres formas de cobrar (un solo medio,
       con vuelto, o combinado). */
    const esCC = (p) => p.medio === MEDIO_CUENTA_CORRIENTE;
    if ((k === MEDIO_CUENTA_CORRIENTE || (listaPagos || []).some(esCC)) && !cliente) {
      beep(false, ajustes.sonido);
      toast("Elegí un cliente antes de cobrar a cuenta corriente.", "mal");
      return setBuscarCliente(true);
    }
    /* La A y la M se le hacen a un inscripto o a un monotributista, y
       ARCA los identifica por el CUIT: sin él las rechaza. Pero la venta
       ya estaría cobrada y su factura trabaría la fila de CAE de todas las
       que vienen atrás (se piden en orden). Por eso se frena acá, antes de
       cobrar. Lo mismo con una factura de $10 millones o más sin
       documento (RG 5700/2025), que vale también para la C. */
    if (fiscal && facturacion.puede) {
      const doc = String((cliente && cliente.doc) || "").replace(/\D/g, "");
      const tipo = String((cliente && cliente.tipoDoc) || "").toUpperCase();
      if (pideCuit(letra) && (doc.length !== 11 || (tipo && tipo !== "CUIT"))) {
        beep(false, ajustes.sonido);
        return toast(`La factura ${letra} necesita el CUIT de ${cliente ? cliente.razonSocial : "quien compra"}. Cargalo en su ficha, o cobrá con ticket.`, "mal");
      }
      const totalFactura = listaPagos ? total : conRecargo(total, medioPorK(ajustes, k)).total;
      if (totalFactura >= MONTO_IDENTIFICAR_CONSUMIDOR && !doc) {
        beep(false, ajustes.sonido);
        toast(`Una factura de ${money(MONTO_IDENTIFICAR_CONSUMIDOR)} o más tiene que decir el documento de quien compra (RG 5700). Elegí o cargá el cliente.`, "mal");
        return setBuscarCliente(true);
      }
    }
    const items = lineas.map((l) => ({ pid: l.pid, qty: l.qty, precio: l.unit, costo: l.costo, nombre: l.nombre, unidad: l.unidad, lista: l.lista, listaNombre: l.listaNombre,
      precioLista: l.manual != null ? l.precio : null, iva: l.iva, ivaCondicion: l.ivaCondicion,
      promo: l.promo || 0, promoNombre: l.promoNombre || null }));
    const m = medioPorK(ajustes, k);
    /* Un pago combinado no lleva descuento por medio: con dos medios no
       hay uno solo al que hacérselo (src/utils/promociones.js). El que
       entra se topea para que el descuento total no pase del 99,99% (0088). */
    let pm = listaPagos ? null : descuentoPorMedio(promos, k, total);
    if (pm) pm = { ...pm, monto: Math.min(pm.monto, Math.max(0, topeDescuento(sub) - descMonto)) };
    if (pm && !pm.monto) pm = null;
    const base = total - (pm ? pm.monto : 0);
    const r = listaPagos ? { total, recargo: 0 } : conRecargo(base, m);

    /* El límite de crédito se controla acá y no en la base (ver 0085): la
       venta puede llegar a la base una hora después, sin internet, y
       rechazarla ahí no devuelve la mercadería. El cajero no lo puede
       pasar; quien puede ajustar cuentas sí, pero se le pregunta. */
    const fiado = k === MEDIO_CUENTA_CORRIENTE ? r.total : (listaPagos || []).filter(esCC).reduce((s2, p) => s2 + p.monto, 0);
    if (fiado > 0 && cliente.limiteCredito != null && saldoCliente != null && saldoCliente + fiado > cliente.limiteCredito) {
      const texto = `${cliente.razonSocial} debe ${money(saldoCliente)} y su límite es ${money(cliente.limiteCredito)}. Con esta venta quedaría en ${money(saldoCliente + fiado)}.`;
      if (!permisos.ajustarCuentas) {
        beep(false, ajustes.sonido);
        return toast(`${texto} No se puede fiar: que la autorice el dueño o el encargado.`, "mal");
      }
      if (!window.confirm(`${texto}\n\n¿Fiar igual?`)) return;
    }
    const descPromo = pm ? { nombre: pm.promo.nombre, monto: pm.monto } : null;
    if (extra.antesDeCobrar) return extra.antesDeCobrar(r.total);
    const t = cobrar({ items, sub, desc: descMonto + (pm ? pm.monto : 0), total: r.total, medio: k, ganancia: ganancia - (pm ? pm.monto : 0) + r.recargo,
      puntos: puntosUsados && cliente ? { usados: puntosUsados, monto: montoCanje } : null,
      puntosSumados: cliente ? puntosGanados(r.total, regla) : 0,
      recibe: recibido || null, pagos: listaPagos, recargo: r.recargo, recargoNombre: r.recargo ? m.n : "",
      fiscal: fiscal && facturacion.puede, cliente, descPromo, mp: extra.mp || null,
      promos: pm ? [...promoCalc.aplicadas, { id: pm.promo.id, nombre: pm.promo.nombre, descuento: pm.monto }] : promoCalc.aplicadas });
    /* Sin caja abierta no hay venta: no se descuenta stock ni se limpia el
       carrito, así el cobro se puede retomar apenas se abra. */
    if (!t) {
      /* Con el QR la plata ya entró: que no pase como una venta que no se
         hizo. Queda la orden para buscarla en la cuenta. */
      if (extra.mp) toast(`El pago entró en Mercado Pago (orden ${extra.mp.orden}) pero la venta no se registró. Abrí la caja y cargala a mano.`, "mal");
      return;
    }
    if (vueltoDado != null) t.vuelto = vueltoDado;
    setProductos((ps) => ps.map((p) => {
      /* Se suman TODOS los renglones del producto y no se toma el primero:
         con precio abierto el mismo producto puede aparecer varias veces
         en la venta, y quedarse con uno descontaría de menos. */
      const vendida = lineas.reduce((s, x) => (x.pid === p.id ? s + x.qty : s), 0);
      if (!vendida) return p;
      // La venta es real aunque el resto del prototipo siga en la fecha congelada.
      return { ...p, stock: +(p.stock - vendida).toFixed(3), ultimaVenta: new Date(), u30: p.u30 + vendida };
    }));
    setTicket(t);
    setPaso("fin");
  };

  /* Un medio que no es efectivo. Mercado Pago, en una caja que tiene
     elegida su caja de Mercado Pago, muestra el QR con el monto; si no,
     cobra como siempre (el cliente paga al QR fijo y el cajero confirma). */
  const cobrarCon = (k) => {
    if (k === "mp" && cajaMp && empresaId) {
      return finalizar(k, null, null, null, { antesDeCobrar: (monto) => { setQr({ monto, ref: crypto.randomUUID() }); setPaso("qr"); } });
    }
    return finalizar(k, null);
  };

  const nuevaVenta = () => {
    setCart([]); setDesc(SIN_DESC); setRecibe(""); setMedioSel(0); setPagos([]); setMontoMix(""); setUltimo(null); setCliente(null);
    setTicket(null); setVerTicket(false); setPaso("carga");
  };

  // ---- Teclado ----
  useEffect(() => {
    const h = (e) => {
      /* Con las últimas ventas abiertas, las teclas son de esa ventana
         (1 a 5 imprime, Esc cierra); F3 la vuelve a cerrar. */
      if (ultimas) { if (e.key === "F3") { e.preventDefault(); setUltimas(false); } return; }
      if (alta || camara || buscarCliente) return;
      if (e.key === "F1") { e.preventDefault(); return setAyuda((a) => !a); }
      /* F3 desde cualquier paso: el cliente vuelve a pedir el papel
         también mientras se está cobrando al siguiente. */
      if (e.key === "F3" && empresaId) { e.preventDefault(); return setUltimas(true); }
      if (ayuda) { if (e.key === "Escape") { e.preventDefault(); setAyuda(false); } return; }

      if (paso === "carga") {
        if (e.key === "F2") { e.preventDefault(); return irAPago(); }
        if (e.key === "F4") {
          e.preventDefault();
          if (!permisos.descuentos) return toast("Tu usuario no puede dar descuentos.", "mal");
          return setDesc((d) => {
            const i = d.modo === "pct" ? DESC_RAPIDOS.indexOf(d.valor) : -1;
            return { modo: "pct", valor: DESC_RAPIDOS[(i + 1) % DESC_RAPIDOS.length] };
          });
        }
        if (e.key === "F7") { e.preventDefault(); return setCart((c) => c.slice(0, -1)); }
        if (e.key === "F8") {
          e.preventDefault();
          if (!permisos.anular) return toast("Tu usuario no puede anular ventas.", "mal");
          if (cart.length) { setCart([]); setDesc(SIN_DESC); toast("Venta anulada."); }
          return;
        }
        if (e.key === "F9") { e.preventDefault(); return ir("pedidos"); }
        if (e.key === "F10") { e.preventDefault(); return aPanel(); }
        return;
      }

      if (paso === "pago") {
        /* Solo el campo del DNI para puntos: el buscador de productos
           sigue con el foco al apretar F2, y ahí las teclas son del cobro. */
        if (e.target && e.target.dataset && e.target.dataset.campoDelCobro) return;
        e.preventDefault();
        if (e.key === "Escape") return setPaso("carga");
        if (e.key === "ArrowDown") return setMedioSel((i) => (i + 1) % medios.length);
        if (e.key === "ArrowUp") return setMedioSel((i) => (i - 1 + medios.length) % medios.length);
        if (e.key === "6" || e.key.toLowerCase() === "c") { setMedioSel(0); setMontoMix(""); return setPaso("mixto"); }
        if (/^[1-9]$/.test(e.key) && Number(e.key) <= medios.length) {
          const i = Number(e.key) - 1;
          setMedioSel(i);
          if (medios[i].k === "efectivo") return setPaso("monto");
          return cobrarCon(medios[i].k);
        }
        if (e.key === "Enter") {
          if (medios[medioSel].k === "efectivo") return setPaso("monto");
          return cobrarCon(medios[medioSel].k);
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
        if (k === "i") return imprimirTicket(tk, ajustes, toast);
        if (k === "w") return toast("Comprobante enviado por WhatsApp.");
        if (k === "e") return toast("Comprobante enviado por email.");
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [paso, cart, medioSel, recibe, total, ayuda, pagos, montoMix, falta, alta, camara, fiscal, totalFinal, cliente, buscarCliente, permisos, tk, ultimas, empresaId]);

  const activo = ultimo && cart.find((l) => l.pid === ultimo.pid) ? ultimo : null;
  const cantidadPendiente = activo && esCantidad(q) && q.trim() !== "";
  const puedeCrear = q.trim().length >= 3 && res.length === 0 && !cantidadPendiente;

  const aplicarCantidad = () => {
    const n = aNumero(q);
    if (!activo || !(n > 0)) return false;
    /* `setQty` trabaja por renglón (`lid`), no por producto: desde el
       precio abierto un mismo producto puede estar dos veces. Acá se le
       pasaba el id del producto, que no coincide con ningún renglón, así
       que el cartel aparecía y la cantidad no cambiaba. Va al último
       renglón de ese producto, que es el que se acaba de cargar. */
    const renglon = [...cart].reverse().find((l) => l.pid === activo.pid);
    if (!renglon) return false;
    /* En uno de precio abierto la cantidad ya está adentro del importe
       (300 g de jamón son un renglón de $X, no "una unidad"): multiplicar
       lo falsearía. */
    if (renglon.precioAbierto) {
      beep(false, ajustes.sonido);
      toast(`${activo.nombre} se cobra por importe: para otro, cargalo de nuevo.`, "mal");
      setQ("");
      return true;
    }
    setQty(renglon.lid, n);
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
      const exacto = vendibles.find((p) => p.barcode === q.trim());
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
    /* grid-cols-1 en el celular: sin columnas definidas, la grilla tomaba
       el ancho mínimo de la fila del lector (campo, tres botones y la
       tecla) y la pantalla de cobro medía 451 px en un teléfono de 375. */
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 items-start">
      <div className="space-y-3">
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 bg-superficie-3">
            <Barcode size={20} className="text-acento-vivo shrink-0" />
            <input ref={inp} value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} onKeyDown={onKeyInput}
              placeholder="Escaneá o escribí el nombre · Enter con el campo vacío cobra"
              className="f-m flex-1 min-w-0 bg-transparent text-texto placeholder-texto-tenue text-base outline-none py-1" autoFocus />
            <button onClick={() => { setVerTodo((v) => !v); setQ(""); inp.current && inp.current.focus(); }}
              className={`shrink-0 flex items-center gap-1.5 text-xs font-semibold border rounded-xl px-2.5 py-2 ${
                verTodo ? "text-acento border-acento bg-acento-suave" : "text-texto bg-superficie/10 active:bg-superficie/20 border-borde-fuerte"}`}
              title="Buscar tocando, para lo que no tiene código de barras">
              <Search size={16} className={verTodo ? "" : "text-acento-vivo"} /> <span className="hidden sm:inline">Catálogo</span>
            </button>
            <button onClick={() => setCamara(true)}
              className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-texto bg-superficie/10 active:bg-superficie/20 border border-borde-fuerte rounded-xl px-2.5 py-2"
              title="Leer con la cámara">
              <Cam size={16} className="text-acento-vivo" /> <span className="hidden sm:inline">Cámara</span>
            </button>
            {empresaId && (
              <button onClick={() => setUltimas(true)}
                className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-texto bg-superficie/10 active:bg-superficie/20 border border-borde-fuerte rounded-xl px-2.5 py-2"
                title="Las últimas ventas, para volver a imprimir (F3)">
                <History size={16} className="text-acento-vivo" /> <span className="hidden sm:inline">Últimas</span>
              </button>
            )}
            <Tecla>Enter</Tecla>
          </div>
          {cantidadPendiente && (
            <div className="px-4 py-2.5 bg-bien-suave border-b border-bien flex items-center gap-2 text-sm">
              <span className="f-d text-bien text-lg">{aNumero(q)}</span>
              <span className="text-bien truncate flex-1">
                {activo.unidad === "un" ? "unidades de" : `${nombreUnidad(activo.unidad).toLowerCase()}s de`} <strong>{activo.nombre}</strong>
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
                  <div className={`w-full flex items-center gap-2 px-4 py-2.5 ${i === sel ? "bg-acento-suave" : "hover:bg-superficie-2"}`}>
                    <button onMouseEnter={() => setSel(i)} onClick={() => add(p)} className="text-left flex-1 min-w-0 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-texto truncate">{p.nombre}</div>
                        <div className="f-m text-[11px] text-texto-tenue">{p.barcode || "sin código"} · stock {formatoCantidad(p.unidad, p.stock)}</div>
                      </div>
                      <div className="f-m text-sm font-semibold shrink-0">{p.precio ? money(p.precio) : <span className="text-ojo text-xs">sin precio</span>}</div>
                    </button>
                    {p.bulto > 1 && (
                      <button onClick={() => add(p, p.bulto)}
                        title={`Vender el bulto entero: ${p.bulto} unidades`}
                        className="shrink-0 text-[11px] font-semibold px-2 py-1 rounded-lg border border-borde text-texto-suave hover:border-acento hover:text-acento">
                        ×{p.bulto} bulto
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden">
          {cart.length === 0 ? <Vacio>El ticket está vacío. Escaneá el primer producto.</Vacio> : (
          <>
            {/* En celular no entra una tabla de cinco columnas: va como lista */}
            {/* data-guia: lo que señala el recorrido guiado ("La venta"). */}
            <ul data-guia="venta" className="md:hidden divide-y divide-borde">
              {lineas.map((l, i) => (
                <li key={l.lid} className={`px-3 py-2.5 ${i === lineas.length - 1 ? "bg-acento-suave/40" : ""}`}>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-texto leading-snug">{l.nombre}</div>
                      <div className="f-m text-[11px] text-texto-tenue mt-0.5">
                        {(l.lista || l.manual != null) && <span className="line-through mr-1">{money(l.precio)}</span>}
                        <PrecioEditable linea={l} puede={permisos.descuentos} onCambiar={(n) => setPrecioManual(l.lid, n)}
                          className={l.lista || l.manual != null ? "text-bien font-semibold" : ""} /> c/u
                        {l.lista && <span className="ml-1 text-bien font-bold uppercase">{l.listaNombre}</span>}
                        {l.promo > 0 && <span className="ml-1 text-bien font-bold uppercase">{l.promoNombre} −{money(l.promo)}</span>}
                      </div>
                    </div>
                    <div className="f-m text-base font-semibold shrink-0">{money(l.importe)}</div>
                    <button onClick={() => quitar(l.lid)} className="text-texto-tenue active:text-mal shrink-0 p-1"><Trash2 size={16} /></button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => setQty(l.lid, l.qty - pasoDe(l.unidad))} className="w-10 h-10 rounded-xl border border-borde flex items-center justify-center active:bg-superficie-2"><Minus size={16} /></button>
                    <span className="f-m w-14 text-center text-base">{formatoCantidad(l.unidad, l.qty)}</span>
                    <button onClick={() => setQty(l.lid, l.qty + pasoDe(l.unidad))} className="w-10 h-10 rounded-xl border border-borde flex items-center justify-center active:bg-superficie-2"><Plus size={16} /></button>
                  </div>
                </li>
              ))}
            </ul>
            <table data-guia="venta" className="hidden md:table w-full text-sm">
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
                  <tr key={l.lid} className={i === lineas.length - 1 ? "bg-acento-suave/40" : "hover:bg-superficie-2"}>
                    <td className="px-4 py-2.5 text-texto">
                      {l.nombre}
                      {l.lista && (
                        <span className="ml-2 text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border bg-bien-suave text-bien border-bien">
                          {l.listaNombre} −{money(l.ahorro)}
                        </span>
                      )}
                      {l.manual != null && (
                        <span className="ml-2 text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border bg-ojo-suave text-ojo border-ojo">
                          precio a mano
                        </span>
                      )}
                      {!l.lista && l.proxima && (
                        <span className="ml-2 text-[10px] text-texto-tenue">
                          desde {l.proxima.umbral} u paga {money(l.proxima.precio)}
                        </span>
                      )}
                      {l.promo > 0 && (
                        <span className="ml-2 text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border bg-bien-suave text-bien border-bien">
                          {l.promoNombre} −{money(l.promo)}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setQty(l.lid, l.qty - pasoDe(l.unidad))} className="w-7 h-7 rounded-lg border border-borde hover:bg-superficie-2 flex items-center justify-center"><Minus size={13} /></button>
                        <span className="f-m w-12 text-center">{formatoCantidad(l.unidad, l.qty)}</span>
                        <button onClick={() => setQty(l.lid, l.qty + pasoDe(l.unidad))} className="w-7 h-7 rounded-lg border border-borde hover:bg-superficie-2 flex items-center justify-center"><Plus size={13} /></button>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right f-m text-texto-suave">
                      {(l.lista || l.manual != null) && <span className="line-through text-texto-tenue mr-1">{money(l.precio)}</span>}
                      <PrecioEditable linea={l} puede={permisos.descuentos} onCambiar={(n) => setPrecioManual(l.lid, n)}
                        className={l.lista || l.manual != null ? "text-bien font-semibold" : ""} />
                      {l.manual != null && (
                        <button onClick={() => setPrecioManual(l.lid, null)} title="Volver al precio de lista" className="ml-1 text-texto-tenue hover:text-mal align-middle"><X size={12} /></button>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right f-m font-semibold">{money(l.importe)}</td>
                    <td className="pr-3"><button onClick={() => quitar(l.lid)} className="text-texto-tenue hover:text-mal"><Trash2 size={15} /></button></td>
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

        <div className="solo-teclado hidden md:flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
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
          {rebajaManual !== 0 && (
            <div className="flex items-baseline justify-between mt-1 text-ojo">
              <span className="text-sm">Precios a mano</span>
              <span className="f-m text-sm">{rebajaManual > 0 ? "−" : "+"}{money(Math.abs(rebajaManual))}</span>
            </div>
          )}
          {permisos.descuentos && (
            <div className="mt-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-texto-suave">Descuento <Tecla>F4</Tecla></span>
                <div className="flex items-center gap-1">
                  {DESC_RAPIDOS.filter((d) => d <= topeRol).map((d) => (
                    <button key={d} onClick={() => setDesc({ modo: "pct", valor: d })}
                      className={`f-m text-xs px-2 py-1 rounded-md border ${desc.modo === "pct" && desc.valor === d ? "bg-superficie-3 text-texto border-superficie-3" : "border-borde text-texto-suave hover:bg-superficie-2"}`}>{d}%</button>
                  ))}
                </div>
              </div>
              {/* Cualquier otro: un porcentaje o un importe en pesos. */}
              <div className="flex items-center gap-1.5 mt-2">
                <div className="flex rounded-md border border-borde overflow-hidden text-xs font-semibold shrink-0">
                  {[["pct", "%"], ["monto", "$"]].map(([m, n]) => (
                    <button key={m} onClick={() => setDesc((d) => ({ modo: m, valor: d.modo === m ? d.valor : 0 }))}
                      className={`px-2.5 py-1.5 ${desc.modo === m ? "bg-superficie-3 text-texto" : "text-texto-suave hover:bg-superficie-2"}`}>{n}</button>
                  ))}
                </div>
                <input inputMode="decimal" placeholder={desc.modo === "pct" ? "Otro %" : "Importe en pesos"}
                  value={textoDesc(desc)}
                  onChange={(e) => {
                    if (desc.modo === "monto") {
                      const n = Number(e.target.value.replace(/[^\d]/g, "")) || 0;
                      return setDesc({ modo: "monto", valor: n });
                    }
                    /* Un porcentaje de más se muestra ya topeado: que el
                       campo diga lo que se va a descontar. */
                    const t = limpiarPorcentaje(e.target.value);
                    const pasado = Number(t.replace(",", ".")) > topeRol;
                    if (pasado && descuentoMax != null) toast(`Tu usuario puede descontar hasta un ${String(descuentoMax).replace(".", ",")}%.`, "mal");
                    setDesc({ modo: "pct", valor: Math.min(leerPorcentaje(t), topeRol), texto: pasado ? String(topeRol).replace(".", ",") : t });
                  }}
                  className="f-m flex-1 min-w-0 border border-borde rounded-md px-2.5 py-1.5 text-sm bg-superficie outline-none focus:border-acento" />
              </div>
              {descMonto > 0 && (
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-sm text-texto-suave">{desc.modo === "pct" ? `Descuento ${String(desc.valor).replace(".", ",")}%` : "Descuento"}</span>
                  <span className="f-m text-sm">−{money(descMonto)}</span>
                </div>
              )}
              {descPedido > descMonto && sub > 0 && (
                <p className="text-[11px] text-ojo mt-1">El descuento llega hasta 99,99 %: se descuenta {money(descMonto)} y se cobra {money(sub - descMonto)}.</p>
              )}
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
          <div className="bg-superficie-3 text-texto px-6 py-4 flex items-baseline justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-bold">Total a cobrar · {cart.length} productos</div>
              <div className="f-d text-4xl mt-0.5">{money(total)}</div>
            </div>
            <div className="solo-teclado text-right text-xs text-texto-tenue"><Tecla>Esc</Tecla> volver</div>
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="text-[11px] uppercase tracking-widest text-texto-tenue font-bold">¿Cómo paga?</span>
              {/* Solo con conexión a ARCA. Antes estaba siempre y la
                  factura salía con un CAE inventado. */}
              {facturacion.puede && (
                <div className="flex rounded-md border border-borde overflow-hidden text-xs font-semibold">
                  <button onClick={() => setFiscal(false)} className={`px-3 py-1.5 ${!fiscal ? "bg-superficie-3 text-texto" : "text-texto-suave"}`}>Ticket</button>
                  <button onClick={() => setFiscal(true)} className={`px-3 py-1.5 ${fiscal ? "bg-superficie-3 text-texto" : "text-texto-suave"}`}>
                    Factura {fiscal ? letra : ""}{fiscal && facturacion.modo === "homologacion" ? " · prueba" : ""}
                  </button>
                </div>
              )}
            </div>

            {/* A quién se le factura, o a quién se le anota la deuda de una
                cuenta corriente. */}
            {fiscal && !cliente && (
              <button onClick={() => setBuscarCliente(true)}
                className="w-full flex items-center gap-2 px-3 py-2 mb-3 rounded-md border border-borde hover:bg-superficie-2 text-left">
                <Users size={16} className="text-texto-tenue shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">Consumidor final</span>
                  <span className="block text-[11px] text-texto-tenue">Sin identificar · tocá para elegir un cliente</span>
                </span>
              </button>
            )}
            {cliente && (
              <button onClick={() => setBuscarCliente(true)}
                className="w-full flex items-center gap-2 px-3 py-2 mb-3 rounded-xl border border-borde hover:bg-superficie-2 text-left">
                <Users size={16} className="text-texto-tenue shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold truncate">{cliente.razonSocial}</span>
                  <span className="block text-[11px] text-texto-tenue">
                    {`${cliente.tipoDoc} ${cliente.doc} · ${condicionNombre(cliente.condicion)}`}
                    {saldoCliente != null && saldoCliente !== 0 && (
                      <span className={saldoCliente > 0 ? "text-mal font-semibold" : "text-bien"}>
                        {saldoCliente > 0 ? ` · debe ${money(saldoCliente)}` : ` · a favor ${money(-saldoCliente)}`}
                      </span>
                    )}
                    {cliente.limiteCredito != null && ` · límite ${money(cliente.limiteCredito)}`}
                  </span>
                </span>
              </button>
            )}
            {regla.activo && !cliente && (
              <div className="flex items-center gap-2 mb-3">
                <input data-campo-del-cobro="puntos" value={dato} onChange={(e) => setDato(e.target.value.replace(/[^\d]/g, ""))}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); identificar(); } if (e.key === "Escape") e.target.blur(); }}
                  placeholder="DNI o teléfono para sumar puntos"
                  className="f-m flex-1 border border-borde rounded-lg px-3 py-2 text-sm bg-superficie outline-none focus:border-acento" />
                <Boton size="sm" variant="ghost" disabled={dato.length < 6} onClick={identificar}>Sumar</Boton>
              </div>
            )}
            {regla.activo && cliente && puntosCliente && (
              <div className="flex items-center justify-between gap-3 mb-3 px-3 py-2 rounded-lg border border-borde text-sm">
                <span className="text-texto-suave">
                  Tiene <span className="f-m text-texto">{puntosCliente.saldo}</span> puntos
                  {puntosCliente.porVencer > 0 && <span className="text-ojo"> · <span className="f-m">{puntosCliente.porVencer}</span> vencen pronto</span>}
                </span>
                {maxCanje > 0 ? (
                  <Boton size="sm" variant={puntosUsados ? "primary" : "ghost"} onClick={() => setCanje(puntosUsados ? 0 : maxCanje)}>
                    {puntosUsados ? `Usando ${puntosUsados} (−${money(montoCanje)})` : `Usar ${maxCanje} (−${money(valorDePuntos(maxCanje, regla))})`}
                  </Boton>
                ) : (
                  <span className="text-[11px] text-texto-tenue">se canjea desde {regla.minimo}</span>
                )}
              </div>
            )}
            <ul data-guia="medios" className="space-y-1.5">
              {medios.map((m, i) => (
                <li key={m.k}>
                  <button onClick={() => { setMedioSel(i); m.k === "efectivo" ? setPaso("monto") : cobrarCon(m.k); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${i === medioSel ? "border-acento bg-acento-suave" : "border-borde hover:bg-superficie-2"}`}>
                    <Tecla>{i + 1}</Tecla>
                    <span className="font-semibold flex-1">{m.n}</span>
                    {(() => {
                      /* Que se vea antes de elegir: "−10% hoy" es lo que
                         hace que el cliente saque la tarjeta que conviene. */
                      const pmm = descuentoPorMedio(promos, m.k, total);
                      return pmm ? (
                        <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border bg-bien-suave text-bien border-bien shrink-0">
                          −{pmm.pct}% hoy · {money(total - pmm.monto)}
                        </span>
                      ) : null;
                    })()}
                    {m.tasa > 0 && (
                      <span className="text-xs text-texto-tenue shrink-0">
                        {m.recargo ? `recargo ${m.tasa}%` : `comisión ${money(comisionDe(m, total))}`}
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
            <p className="solo-teclado text-xs text-texto-tenue mt-3 flex items-center gap-2">
              <Tecla>↑</Tecla><Tecla>↓</Tecla> elegir · <Tecla>Enter</Tecla> confirmar · <Tecla>1</Tecla>–<Tecla>6</Tecla> atajo directo
            </p>
          </div>
        </Overlay>
      )}

      {buscarCliente && (
        <BuscarCliente clientes={clientes} onCerrar={() => setBuscarCliente(false)} listas={listasDeCliente(ajustes)}
          onElegir={(c) => { setCliente(c); setBuscarCliente(false); }}
          onCrear={async (d) => {
            /* Se espera el id que devuelve la base antes de seleccionarlo:
               el cliente va impreso en el comprobante y uno inventado acá
               no existiría en ningún lado. */
            const c = await guardarCliente(d);
            if (!c) return;
            setCliente(c);
            setBuscarCliente(false);
          }} />
      )}

      {/* ---------- Ventana 2b: efectivo ---------- */}
      {paso === "qr" && qr && (
        <CobroQr monto={qr.monto} referencia={qr.ref} cajaMp={cajaMp} empresaId={empresaId} sonido={ajustes.sonido}
          onPagado={(mp) => { setQr(null); finalizar("mp", null, null, null, { mp }); }}
          onVolver={() => { setQr(null); setPaso("pago"); }}
          onQrFijo={() => { setQr(null); finalizar("mp", null); }} />
      )}

      {paso === "monto" && (
        <Overlay ancho="max-w-lg">
          <div className="bg-superficie-3 text-texto px-6 py-4">
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
              <span className="solo-teclado text-xs text-texto-tenue"><Tecla>Esc</Tecla> cambiar medio</span>
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
          <div className="bg-superficie-3 text-texto px-6 py-4 flex items-baseline justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-bold">
                {falta > 0 ? "Falta cobrar" : "Cubierto"}
              </div>
              <div className={`f-d text-4xl mt-0.5 ${falta > 0 ? "text-acento-vivo" : "text-bien"}`}>{money(falta > 0 ? falta : total)}</div>
            </div>
            <div className="text-right text-xs text-texto-tenue">de {money(total)}<span className="solo-teclado"><br /><Tecla>Esc</Tecla> volver</span></div>
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
                  <span className="solo-teclado"><Tecla>↑</Tecla><Tecla>↓</Tecla> medio · <Tecla>Enter</Tecla> agregar · <Tecla>Supr</Tecla> borrar el último · </span>
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
          <div className="bg-bien text-sobre-acento px-6 py-5 text-center">
            <Check size={26} className="mx-auto" />
            <div className="f-d text-2xl mt-1">Cobrado {money(ticket.total)}</div>
            <div className="opacity-80 text-sm">
              {(ticket.pagos || [{ medio: ticket.medio, monto: ticket.total }]).map((p) => `${medioPorK(ajustes, p.medio).n} ${money(p.monto)}`).join(" + ")} · {ticket.nro}
            </div>
          </div>
          {ticket.recibe && (ticket.vuelto != null ? ticket.vuelto : ticket.recibe - ticket.total) > 0 && (
            <div className="bg-superficie-3 text-texto px-6 py-4 text-center">
              <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-bold">Vuelto</div>
              <div className="f-d text-5xl text-acento-vivo">{money(ticket.vuelto != null ? ticket.vuelto : ticket.recibe - ticket.total)}</div>
            </div>
          )}
          <div className="p-5">
            {/* La factura sin CAE no se imprime: el papel que se lleva el
                cliente es uno solo y tiene que ser la factura. Queda
                guardada y se imprime desde acá apenas llega, o después
                desde Caja → Facturas. */}
            {tk.fiscal && (
              <div className={`rounded-md border p-3 mb-4 text-sm ${tk.factura ? "border-bien bg-bien-suave text-bien" : "border-ojo bg-ojo-suave text-ojo"}`}>
                {tk.factura ? (
                  <span>Factura {tk.factura.letra} {String(tk.factura.puntoVenta).padStart(5, "0")}-{String(tk.factura.numero).padStart(8, "0")} · CAE {tk.factura.cae}
                    {tk.factura.homologacion ? " · prueba, sin validez fiscal" : ""}</span>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="flex-1">Esperando el CAE de ARCA. La factura queda guardada: si no llega, se pide desde Caja → Facturas.</span>
                    {pedirCAEs && <Boton size="sm" variant="ghost" onClick={() => pedirCAEs()}>Pedir CAE</Boton>}
                  </div>
                )}
              </div>
            )}
            <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-bold mb-2">¿Querés comprobante?</div>
            <div className="grid grid-cols-4 gap-1.5">
              {[[Printer, "Imprimir", "I", () => imprimirTicket(tk, ajustes, toast)],
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
              <Comandera lineas={ticketVenta(tk, ajustes, W)} ancho={ajustes.ancho} qr={tk.fiscal ? qrDeFactura(tk.factura) : null} className="py-2 shadow-sm" />
            </div>
            <div className="grid grid-cols-2 gap-1.5 mt-3 no-print">
              <Boton variant="ghost" disabled={esperaCAE(tk)} onClick={() => imprimirTicket(tk, ajustes, toast)}><Printer size={15} /> Imprimir</Boton>
              <Boton variant="dark" onClick={() => setVerTicket(false)}>Cerrar</Boton>
            </div>
          </div>
        </Modal>
      )}

      <EscanerCamara abierto={camara} onCerrar={() => setCamara(false)}
        titulo="Escaneá los productos"
        onLeer={(cod) => {
          const p = vendibles.find((x) => x.barcode === cod);
          if (p) { add(p); beep(true, ajustes.sonido); toast(`${p.nombre} · ${money(p.precio)}`); }
          else { beep(false, ajustes.sonido); setCamara(false); setAlta({ barcode: cod }); }
        }} />

      <AltaRapida abierto={!!alta} inicial={alta} productos={productos} ajustes={ajustes}
        onClose={() => { setAlta(null); setQ(""); }} onCrear={crearAlVuelo} />

      <PedirImporte pedido={precioAbierto}
        onClose={() => { setPrecioAbierto(null); setQ(""); setSel(0); }}
        onConfirmar={(importe) => {
          const { p, qty } = precioAbierto;
          setPrecioAbierto(null);
          add(p, qty, importe);
          beep(true, ajustes.sonido);
        }} />

      {ultimas && (
        <UltimasVentas empresaId={empresaId} ajustes={ajustes} toast={toast}
          caja={caja} permisos={permisos} pedirCAEs={pedirCAEs} onCambio={recargarCaja}
          onCerrar={() => { setUltimas(false); inp.current && inp.current.focus(); }} />
      )}
      {ayuda && (
        <Overlay ancho="max-w-md">
          <div className="p-5">
            <h3 className="f-d text-lg">Atajos de teclado</h3>
            <p className="text-sm text-texto-suave mt-0.5">Todo el cobro se puede hacer sin tocar el mouse.</p>
            <ul className="mt-4 space-y-1.5 text-sm">
              {[["Escribir / escanear", "busca y carga el producto"], ["Enter", "agrega el producto marcado"],
                ["Un número + Enter", "cambia la cantidad del último producto"], ["Enter con el campo vacío", "pasa a cobrar"], ["↑ ↓", "elegir en la lista"],
                ["F2", "cobrar"], ["F3", "últimas ventas, para reimprimir"], ["F4", "cambiar descuento"], ["F7", "quitar el último renglón"],
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
    { i: Printer, n: "Imprimir", fn: () => imprimirTicket(t, ajustes, toast) },
    { i: MessageCircle, n: "WhatsApp", fn: () => toast("Comprobante enviado por WhatsApp.") },
    { i: Mail, n: "Email", fn: () => toast("Comprobante enviado por email.") },
    { i: QrCode, n: "QR", fn: () => toast("QR en pantalla para el cliente.") },
  ];
  return (
    <Modal open={!!t} onClose={onClose} ancho="max-w-md">
      <div className="p-5">
        <div className="flex items-center justify-between no-print">
          <div className="flex items-center gap-2 text-bien font-semibold text-sm">
            <div className="w-6 h-6 rounded-full bg-bien-suave flex items-center justify-center"><Check size={14} /></div>
            Venta registrada
          </div>
          <span className="text-[11px] text-texto-tenue">Comandera {ajustes.ancho} mm</span>
        </div>
        <div className="bg-superficie-2 rounded-xl p-3 mt-4 overflow-auto">
          <Comandera lineas={ticketVenta(t, ajustes, W)} ancho={ajustes.ancho}
            qr={t.fiscal ? qrDeFactura(t.factura) : null} className="py-2 shadow-sm" />
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

/* --- La foto y la descripción del producto -----------------------------
   Lo que ve el cliente en la carta. La foto se achica en el navegador
   antes de guardarse: una foto de celular son cuatro megas, y cuatro
   megas por plato multiplicado por una carta entera es una pantalla que
   tarda diez segundos en abrir. A 400 px de ancho se ve igual de bien en
   una tarjeta de 60 px y pesa treinta veces menos.

   Se guarda adentro del producto y no en un servicio de archivos aparte:
   el sistema no tiene todavía dónde subir archivos, y una carta que
   depende de un servidor de imágenes que no existe no es una carta. */
const ANCHO_FOTO = 220;

/* Un recorte sin fondo se guarda como PNG y una foto como JPEG, y no es
   un detalle de formato: pasar un PNG con transparencia a JPEG le pone
   fondo negro, que es exactamente lo que el recorte venía a evitar. El
   JPEG pesa la mitad, así que se usa para todo lo demás. */
function tieneTransparencia(lienzo) {
  const { width, height } = lienzo;
  const datos = lienzo.getContext("2d").getImageData(0, 0, width, height).data;
  for (let i = 3; i < datos.length; i += 4) if (datos[i] < 250) return true;
  return false;
}

function achicarFoto(archivo) {
  return new Promise((resolver, fallar) => {
    const lector = new FileReader();
    lector.onerror = () => fallar(new Error("No se pudo leer la imagen."));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => fallar(new Error("Ese archivo no es una imagen."));
      img.onload = () => {
        const escala = Math.min(1, ANCHO_FOTO / img.width);
        const lienzo = document.createElement("canvas");
        lienzo.width = Math.round(img.width * escala);
        lienzo.height = Math.round(img.height * escala);
        lienzo.getContext("2d").drawImage(img, 0, 0, lienzo.width, lienzo.height);
        resolver(tieneTransparencia(lienzo)
          ? lienzo.toDataURL("image/png")
          : lienzo.toDataURL("image/jpeg", 0.75));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}

function FotoYDescripcion({ d, set }) {
  const archivo = useRef(null);
  const [error, setError] = useState("");

  const elegir = async (f) => {
    setError("");
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) return setError("La imagen supera los 8 MB.");
    try {
      set("imagen", await achicarFoto(f));
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0">
        <span className="text-[10px] uppercase tracking-widest text-texto-tenue font-bold">Foto</span>
        <div className="mt-1">
          {d.imagen ? (
            <div className="relative">
              <img src={d.imagen} alt="" className="w-24 h-24 rounded-lg object-cover border border-borde" />
              <button onClick={() => set("imagen", "")} title="Sacar la foto"
                className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-md bg-superficie-3 border border-borde text-texto-suave hover:text-mal grid place-items-center">
                <X size={13} />
              </button>
            </div>
          ) : (
            <button onClick={() => archivo.current && archivo.current.click()}
              className="w-24 h-24 rounded-lg border border-dashed border-borde-fuerte text-texto-tenue hover:text-texto hover:bg-superficie-2 grid place-items-center text-[11px] font-semibold transition-colors">
              + Foto
            </button>
          )}
          <input ref={archivo} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files[0]; e.target.value = ""; elegir(f); }} />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <Campo label="Descripción">
          <textarea value={d.descripcion || ""} onChange={(e) => set("descripcion", e.target.value)} rows={3}
            placeholder="Carne, lechuga, tomate, cebolla y mayo."
            className={`${inputCls} resize-none`} />
        </Campo>
        <p className="text-[11px] text-texto-tenue mt-1">
          Se muestran en la carta de la comanda. La foto se achica sola a {ANCHO_FOTO} px de ancho.
        </p>
        {error && <p className="text-[11px] text-mal mt-1">{error}</p>}
      </div>
    </div>
  );
}

export function FormProducto({ abierto, inicial, productos, provs, ajustes0, onGuardar, onClose }) {
  const [d, setD] = useState({});
  const [sug, setSug] = useState(null);
  useEffect(() => { if (abierto) { setD({ iva: 21, unidad: "un", bulto: 1, stock: 0, ...(inicial || {}) }); setSug(null); } }, [abierto, inicial]);

  /* El catálogo base (0106), solo en un alta: al editar, lo que está
     cargado es del comercio y no se le sugiere nada. Completa los campos
     vacíos y nada más, así que da igual si llega antes o después de que
     empiecen a escribir. Se pregunta con el código que vino y con el que
     se escriba en el campo, cuando se sale de él. */
  const [codigoBuscado, setCodigoBuscado] = useState("");
  useEffect(() => { if (abierto && inicial && !inicial.id) setCodigoBuscado(inicial.barcode || ""); }, [abierto, inicial]);
  useEffect(() => {
    if (!abierto || !codigoBuscado || (inicial && inicial.id)) return;
    let vivo = true;
    buscarEnCatalogo(codigoBuscado).then((s) => {
      if (!vivo || !s) return;
      setSug(s);
      setD((x) => {
        if (String(x.barcode || "") !== codigoBuscado) return x;
        const rubro = rubroSugerido(s, productos.map((p) => p.categoria));
        return {
          ...x,
          nombre: x.nombre || s.nombre,
          marca: x.marca || s.marca,
          categoria: x.categoria || rubro,
        };
      });
    });
    return () => { vivo = false; };
  }, [abierto, codigoBuscado]);

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
          {sug && !editando && <DelCatalogo sug={sug} />}
        </Campo>

        <div className="grid md:grid-cols-3 gap-3">
          <Campo label="Código de barras">
            <input value={d.barcode || ""} onChange={(e) => set("barcode", e.target.value.replace(/\D/g, ""))}
              onBlur={() => !editando && setCodigoBuscado(String(d.barcode || ""))}
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

        {/* La descripción y la foto son para la carta: es lo que el cliente
            mira antes de pedir. En un minimercado no molestan porque van
            plegadas; en gastronomía son la mitad de la pantalla. */}
        <FotoYDescripcion d={d} set={set} />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Campo label="Costo">
            <input value={d.costo || ""} onChange={(e) => set("costo", e.target.value.replace(/\D/g, ""))} className={`${inputCls} f-m text-right`} />
          </Campo>
          <Campo label="Precio lista 1">
            <input value={d.precioAbierto ? "" : (d.precio || "")} disabled={d.precioAbierto}
              placeholder={d.precioAbierto ? "al vender" : ""}
              onChange={(e) => set("precio", e.target.value.replace(/\D/g, ""))}
              className={`${inputCls} f-m text-right ${d.precioAbierto ? "opacity-40" : ""}`} />
          </Campo>
          <Campo label="Margen">
            <div className={`${inputCls} f-m text-right bg-superficie-2 ${margen > 0 && margen < 0.12 ? "text-mal" : ""}`}>{d.precioAbierto || !precio ? "—" : pct(margen)}</div>
          </Campo>
          <Campo label="IVA">
            <select value={claveAlicuota(d.iva, d.ivaCondicion)} onChange={(e) => setD((x) => ({ ...x, ...alicuotaDe(e.target.value) }))} className={inputCls}>
              {ALICUOTAS.map((a) => <option key={a.k} value={a.k}>{a.n}</option>)}
            </select>
          </Campo>
        </div>

        {/* Para el mostrador que corta y pesa: el producto existe en el
            catálogo con su nombre y su rubro, pero el importe lo pone el
            cajero. Va debajo del precio porque es lo que lo reemplaza. */}
        <label className="flex items-start gap-2.5 cursor-pointer select-none">
          <input type="checkbox" checked={!!d.precioAbierto}
            onChange={(e) => set("precioAbierto", e.target.checked)}
            className="w-4 h-4 mt-0.5 accent-acento" />
          <span>
            <span className="text-sm">Precio abierto</span>
            <span className="block text-xs text-texto-tenue">
              El cajero escribe el importe al vender. Para fiambrería, panadería y todo lo que se cobra por lo que se lleva.
            </span>
          </span>
        </label>
        {(provs && ajustes0.listas ? ajustes0.listas : []).filter((l) => l.activa !== false).length > 0 && (
          <div>
            <span className="text-[10px] uppercase tracking-widest text-texto-tenue font-bold">Otras listas de precio</span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-1">
              {ajustes0.listas.filter((l) => l.activa !== false).map((l) => {
                const v = Number((d.precios || {})[l.id]) || 0;
                return (
                  <label key={l.id} className="block">
                    <span className="text-[10px] text-texto-suave">{l.nombre} · {l.tipo === "cliente" ? "clientes" : `desde ${l.umbral}`}</span>
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
            {/* Stock en negativo: se vendió más de lo que se cargó. Antes de
                cargar lo que hay, se lo lleva a cero (08/10, Nehuen); al
                guardar entra como ajuste, igual que cualquier corrección
                de stock desde la ficha. */}
            {Number(d.stock) < 0 && (
              <button type="button" onClick={() => set("stock", "0")}
                className="mt-1 text-[11px] font-semibold text-acento hover:underline">
                Está en negativo: ponerlo en 0
              </button>
            )}
          </Campo>
          <Campo label="Stock mínimo">
            <input value={d.stockMin || ""} onChange={(e) => set("stockMin", e.target.value.replace(/[^\d.]/g, ""))} className={`${inputCls} f-m text-right`} />
          </Campo>
          <Campo label="Unidad de venta">
            <select value={d.unidad} onChange={(e) => set("unidad", e.target.value)} className={inputCls}>
              <option value="un">Por unidad</option><option value="kg">Por kilo</option><option value="m">Por metro</option>
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
          <div className="text-sm text-ojo bg-ojo-suave border border-ojo rounded-xl p-3">
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
          <div className="text-sm text-ojo bg-ojo-suave border border-ojo rounded-xl p-3 mt-4">
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
