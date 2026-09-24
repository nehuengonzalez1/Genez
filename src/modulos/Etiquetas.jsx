/* ============================================================
   PRODUCTOS · CÓDIGOS DE BARRAS
   ============================================================

   Una pestaña de Productos con todas las etiquetas de los códigos que
   generó el comercio, dibujadas como salen en el papel y juntas en una
   grilla: al entrar se ven todas. Se crea un código nuevo y aparece ahí
   mismo, al lado de las otras. Cada una se imprime sola, o todas juntas.

   Los códigos son para lo que no se puede pasar con la pistola porque no
   trae código: lo que se fracciona en el local, lo suelto, lo que el
   proveedor no rotuló. Se generan en la base (0086), quedan guardados en
   el producto, y se registra cuándo y quién (0087).

   Dos salidas de impresión:
   - Hoja A4, en grilla: una al lado de la otra y una debajo de la otra,
     en la impresora común, con líneas para recortar.
   - La térmica, una debajo de la otra. Con la impresión directa sale sin
     ventana y el código lo dibuja la propia impresora.
   ============================================================ */

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Search, Printer, Plus, Minus, X, Wand2 } from "lucide-react";
import { money, nf } from "../utils/helpers.js";
import { asignarCodigos, cargarCodigosPropios } from "../datos/items.js";
import { formatoDe, svgCodigo } from "../ui/codigoBarras.js";
import { etiquetasEscPos } from "../ui/escpos.js";
import { impresoraElegida, imprimirDirecto } from "../ui/agenteImpresion.js";
import { Modal, Boton, Vacio, escaparHTML, utilDe } from "../ui/Base.jsx";
import { fdatel } from "../datos/generador.js";

const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/* Un tope para que un cero de más en el campo no mande mil etiquetas a
   la térmica: 500 ya son más de diez hojas A4 de una sola. */
const MAX_COPIAS = 500;
const acotar = (n) => Math.min(MAX_COPIAS, Math.max(1, Math.floor(Number(n)) || 1));

/* Lo que va adentro de cada etiqueta, igual en la pantalla y en el papel:
   si se armaran por separado, un día dejan de coincidir. */
function htmlEtiqueta(e, { anchoMM, conNombre, conPrecio }) {
  return `<div class="et">
    ${conNombre ? `<div class="nom">${escaparHTML(e.nombre)}</div>` : ""}
    <div class="cod">${svgCodigo(e.codigo, { anchoMM, altoMM: 12 })}</div>
    <div class="num">${escaparHTML(e.codigo)}</div>
    ${conPrecio && e.precio ? `<div class="pre">${escaparHTML(e.precio)}</div>` : ""}
  </div>`;
}

const CSS_ETIQUETA = `
  .et { box-sizing: border-box; padding: 2mm 1.5mm; text-align: center; overflow: hidden;
        font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff;
        break-inside: avoid; page-break-inside: avoid; }
  .nom { font-size: 7.5pt; font-weight: 700; line-height: 1.15; max-height: 2.3em; overflow: hidden; margin-bottom: 1mm; }
  .cod svg { display: inline-block; }
  .num { font-family: "Courier New", monospace; font-size: 8pt; letter-spacing: 0.5pt; margin-top: 0.5mm; }
  .pre { font-size: 11pt; font-weight: 700; margin-top: 0.5mm; }
`;

/* Imprime un documento aparte en un iframe. Las mismas lecciones que el
   ticket (ver imprimirComandera en src/ui/Base.jsx): el iframe tiene que
   estar dentro de la ventana y visible —si no, Chrome imprime la hoja en
   blanco—, el contenido se asigna antes de agregarlo, y se imprime
   después de que se pintó, no en el `load`. */
function imprimirDocumento(html, { rolloMM = null } = {}) {
  const marco = document.createElement("iframe");
  marco.setAttribute("aria-hidden", "true");
  marco.style.cssText = `position:fixed;left:0;top:0;z-index:2147483647;border:0;background:#fff;width:${rolloMM ? rolloMM + "mm" : "210mm"};height:100px`;
  let listo = false;
  marco.onload = () => {
    const doc = marco.contentDocument;
    if (listo || !doc || !doc.querySelector(".hoja")) return;
    listo = true;
    const alto = Math.ceil(doc.body.getBoundingClientRect().height);
    if (rolloMM) {
      const regla = doc.createElement("style");
      regla.textContent = `@page { size: ${rolloMM}mm ${Math.ceil(alto * 25.4 / 96) + 4}mm; margin: 0; }`;
      doc.head.appendChild(regla);
    }
    marco.style.height = `${Math.min(alto, 20000)}px`;
    const sacar = () => { try { marco.remove(); } catch (e) {} };
    marco.contentWindow.addEventListener("afterprint", sacar);
    setTimeout(sacar, 60000);
    let hecho = false;
    const lanzar = () => { if (hecho) return; hecho = true; marco.contentWindow.focus(); marco.contentWindow.print(); };
    requestAnimationFrame(() => requestAnimationFrame(lanzar));
    setTimeout(lanzar, 300);
  };
  marco.srcdoc = html;
  document.body.appendChild(marco);
}

export function Etiquetas({ productos, empresaId, ajustes, toast }) {
  const [q, setQ] = useState("");
  const [propios, setPropios] = useState(null);       // id → { codigo, generadoEn, generadoPor }
  const [creando, setCreando] = useState(false);
  const [formato, setFormato] = useState("a4");       // a4 | termica
  const [columnas, setColumnas] = useState(4);
  const [conNombre, setConNombre] = useState(true);
  const [conPrecio, setConPrecio] = useState(false);
  /* Cuántas de cada una: id → n, y la que no está vale 1. Es de la
     impresión del momento, no del producto: no se guarda en la base y se
     pierde al salir de la pestaña, a propósito. Lo que hoy se imprime por
     diez mañana se imprime por una. */
  const [copias, setCopias] = useState({});
  const copiasDe = (id) => copias[id] || 1;
  const fijarCopias = (id, n) => setCopias((c) => {
    const v = acotar(n);
    const nuevo = { ...c };
    if (v === 1) delete nuevo[id]; else nuevo[id] = v;
    return nuevo;
  });

  const leer = useCallback(async () => {
    try {
      const lista = await cargarCodigosPropios(empresaId);
      setPropios(Object.fromEntries(lista.map((x) => [x.id, x])));
    } catch (e) {
      setPropios({});
      toast(e.message || "No se pudieron leer los códigos.", "mal");
    }
  }, [empresaId]);
  useEffect(() => { leer(); }, [leer]);

  const porId = useMemo(() => Object.fromEntries(productos.map((p) => [p.id, p])), [productos]);

  /* Las etiquetas de la grilla: los códigos propios de hoy, del más nuevo
     al más viejo, con el nombre y el precio que el producto tiene ahora. */
  const etiquetas = useMemo(() => {
    if (!propios) return [];
    const t = norm(q.trim());
    return Object.values(propios)
      .map((x) => {
        const p = porId[x.id];
        return p && p.activo !== false ? { ...x, nombre: p.nombre, precio: p.precio ? money(p.precio) : "" } : null;
      })
      .filter(Boolean)
      .filter((e) => !t || norm(e.nombre).includes(t) || e.codigo.includes(q.trim()))
      .sort((a, b) => (b.generadoEn ? b.generadoEn.getTime() : 0) - (a.generadoEn ? a.generadoEn.getTime() : 0) || a.nombre.localeCompare(b.nombre));
  }, [propios, porId, q]);

  const sinCodigo = useMemo(
    () => productos.filter((p) => p.activo !== false && !String(p.barcode || "").trim()).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [productos]
  );

  const anchoCeldaMM = formato === "a4" ? (210 - 16) / columnas : utilDe(58);
  const opciones = { anchoMM: anchoCeldaMM - 4, conNombre, conPrecio };

  /* Las copias se resuelven acá, repitiendo cada etiqueta: así la hoja A4,
     la ventana de la térmica y el ESC/POS reciben una lista común y
     ninguno tiene que saber de copias. Las repetidas quedan juntas, que es
     como se recortan y se pegan. */
  const totalCopias = (lista) => lista.reduce((s, e) => s + copiasDe(e.id), 0);
  const imprimir = async (elegidas) => {
    const lista = elegidas.flatMap((e) => Array(copiasDe(e.id)).fill(e));
    if (!lista.length) return;
    if (formato === "termica") {
      const impresora = impresoraElegida();
      if (impresora) {
        try {
          await imprimirDirecto(impresora, etiquetasEscPos({
            etiquetas: lista.map((e) => ({ codigo: e.codigo, nombre: conNombre ? e.nombre : "", precio: conPrecio ? e.precio : "" })),
            mm: ajustes.ancho === 58 ? 58 : 80, W: ajustes.ancho === 58 ? 32 : 48, formatoDe,
          }));
          return toast(lista.length === 1 ? "Etiqueta enviada a la impresora." : `${nf.format(lista.length)} etiquetas enviadas a la impresora.`);
        } catch (e) {
          toast(`No salió por la impresión directa (${e.message}). Se abre la ventana.`, "mal");
        }
      }
    }
    const celdas = lista.map((e) => htmlEtiqueta(e, opciones)).join("");
    const html = formato === "a4"
      ? `<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas</title><style>
          @page { size: A4; margin: 8mm; }
          html, body { margin: 0; background: #fff; }
          ${CSS_ETIQUETA}
          .hoja { display: grid; grid-template-columns: repeat(${columnas}, 1fr); }
          /* Líneas de corte finas: separan sin gastar tinta. */
          .et { height: 30mm; border: 0.2mm dashed #bbb; margin: -0.1mm; }
        </style></head><body><div class="hoja">${celdas}</div></body></html>`
      : `<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas</title><style>
          html, body { margin: 0; background: #fff; }
          body { width: ${utilDe(58)}mm; }
          ${CSS_ETIQUETA}
          .et { border-bottom: 0.3mm dashed #000; padding: 3mm 0; }
        </style></head><body><div class="hoja">${celdas}</div></body></html>`;
    imprimirDocumento(html, { rolloMM: formato === "a4" ? null : (ajustes.ancho === 58 ? 58 : 80) });
  };

  const alCrear = (nuevos) => {
    setCreando(false);
    leer();
    toast(nuevos === 1 ? "Código creado. Ya está en la grilla." : `${nuevos} códigos creados. Ya están en la grilla.`);
  };

  return (
    <div className="bg-superficie border border-borde rounded-lg p-6">
      <div>
        <h3 className="f-d text-xl">Códigos de barras</h3>
        <p className="text-sm text-texto-suave mt-1">
          Los códigos propios del comercio, para lo que no trae código de fábrica. Quedan guardados en cada producto y se leen con la pistola.
        </p>
      </div>

      {/* ---------- Barra: buscar, crear, imprimir ---------- */}
      <div className="flex flex-wrap items-center gap-2 mt-5">
        <div className="relative flex-1 min-w-[14rem]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-texto-tenue" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o código"
            className="w-full border border-borde rounded-md pl-8 pr-3 py-2 text-sm bg-superficie outline-none focus:border-acento" />
        </div>
        <Boton onClick={() => setCreando(true)}><Plus size={15} /> Crear código</Boton>
        <Boton variant="ghost" onClick={() => imprimir(etiquetas)} disabled={!etiquetas.length}>
          <Printer size={15} /> Imprimir {q ? "las que se ven" : "todas"}{etiquetas.length ? ` (${nf.format(totalCopias(etiquetas))})` : ""}
        </Boton>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3 text-sm">
        <div className="flex rounded-md border border-borde overflow-hidden text-xs font-semibold">
          <button onClick={() => setFormato("a4")} className={`px-3 py-1.5 ${formato === "a4" ? "bg-superficie-3 text-texto" : "text-texto-suave"}`}>Hoja A4</button>
          <button onClick={() => setFormato("termica")} className={`px-3 py-1.5 ${formato === "termica" ? "bg-superficie-3 text-texto" : "text-texto-suave"}`}>Térmica</button>
        </div>
        {formato === "a4" && (
          <div className="flex items-center gap-1.5">
            <span className="text-texto-suave">Columnas</span>
            {[3, 4, 5].map((c) => (
              <button key={c} onClick={() => setColumnas(c)} className={`f-m text-xs px-2.5 py-1 rounded-md border ${columnas === c ? "bg-superficie-3 text-texto border-superficie-3" : "border-borde text-texto-suave"}`}>{c}</button>
            ))}
            <span className="text-xs text-texto-tenue ml-1">{columnas * 9} por hoja</span>
          </div>
        )}
        <label className="flex items-center gap-1.5 text-texto-suave">
          <input type="checkbox" checked={conNombre} onChange={(e) => setConNombre(e.target.checked)} className="accent-[var(--acento)]" /> Nombre
        </label>
        <label className="flex items-center gap-1.5 text-texto-suave">
          <input type="checkbox" checked={conPrecio} onChange={(e) => setConPrecio(e.target.checked)} className="accent-[var(--acento)]" /> Precio
        </label>
        {formato === "termica" && (
          <span className="text-xs text-texto-tenue">
            {impresoraElegida() ? `Sale directo por ${impresoraElegida()}.` : "Se abre la ventana de impresión (con la impresión directa, sale sin ventana)."}
          </span>
        )}
      </div>

      {/* ---------- La grilla de etiquetas ---------- */}
      <div className="mt-5">
        {propios === null ? (
          <p className="text-sm text-texto-tenue">Cargando…</p>
        ) : etiquetas.length === 0 ? (
          <Vacio>
            {q ? "Ningún código coincide con la búsqueda."
              : `Todavía no hay códigos propios. ${sinCodigo.length ? `Hay ${nf.format(sinCodigo.length)} productos sin código: apretá "Crear código".` : ""}`}
          </Vacio>
        ) : (
          <>
            <style>{CSS_ETIQUETA}</style>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))" }}>
              {etiquetas.map((e) => (
                <div key={e.id}>
                  <div className="rounded-md border border-dashed border-stone-300 overflow-hidden text-black"
                    dangerouslySetInnerHTML={{ __html: htmlEtiqueta(e, { anchoMM: 38, conNombre, conPrecio }) }} />
                  <p className="text-[11px] text-texto-tenue truncate mt-1.5" title={e.generadoPor ? `por ${e.generadoPor}` : ""}>
                    {e.generadoEn ? `Generado el ${fdatel(e.generadoEn)}` : "Cargado a mano"}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Contador valor={copiasDe(e.id)} onCambiar={(n) => fijarCopias(e.id, n)} />
                    <span className="flex-1" />
                    <button onClick={() => imprimir([e])} title={copiasDe(e.id) > 1 ? `Imprimir ${copiasDe(e.id)} copias` : "Imprimir esta etiqueta"}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-texto-suave hover:text-acento">
                      <Printer size={12} /> Imprimir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {creando && (
        <CrearCodigo sinCodigo={sinCodigo} empresaId={empresaId} toast={toast}
          onCerrar={() => setCreando(false)} onCreados={alCrear} />
      )}
    </div>
  );
}

/* − n + de las copias. El número se puede escribir: mientras se escribe
   se deja el campo vacío o a medias, y recién al salir (o con Enter) se
   acota. Si se acotara en cada tecla, borrar el 1 para poner 40 dejaba
   "140". */
function Contador({ valor, onCambiar }) {
  const [texto, setTexto] = useState(null); // null: se muestra `valor`
  const confirmar = () => { if (texto !== null) onCambiar(texto); setTexto(null); };
  const boton = "w-6 h-6 inline-flex items-center justify-center text-texto-suave hover:text-acento disabled:opacity-30 disabled:hover:text-texto-suave";
  return (
    <div className="inline-flex items-center border border-borde rounded-md" title="Copias de esta etiqueta">
      <button className={boton} onClick={() => onCambiar(valor - 1)} disabled={valor <= 1} aria-label="Una copia menos"><Minus size={12} /></button>
      <input value={texto ?? String(valor)} inputMode="numeric" aria-label="Copias"
        onFocus={(ev) => ev.target.select()}
        onChange={(ev) => setTexto(ev.target.value.replace(/\D/g, "").slice(0, 3))}
        onBlur={confirmar}
        onKeyDown={(ev) => { if (ev.key === "Enter") ev.currentTarget.blur(); }}
        className="f-m w-8 text-center text-xs bg-transparent outline-none" />
      <button className={boton} onClick={() => onCambiar(valor + 1)} disabled={valor >= MAX_COPIAS} aria-label="Una copia más"><Plus size={12} /></button>
    </div>
  );
}

/* Elegir a qué productos sin código crearles uno. Pueden ser varios de
   una vez: al volver, todos están en la grilla. */
function CrearCodigo({ sinCodigo, empresaId, toast, onCerrar, onCreados }) {
  const [q, setQ] = useState("");
  const [elegidos, setElegidos] = useState({});
  const [guardando, setGuardando] = useState(false);
  const t = norm(q.trim());
  const lista = sinCodigo.filter((p) => !t || norm(p.nombre).includes(t));
  const ids = Object.keys(elegidos);

  const crear = async () => {
    setGuardando(true);
    try {
      const nuevos = await asignarCodigos(empresaId, ids);
      onCreados(nuevos.length);
    } catch (e) {
      toast(e.message || "No se pudieron crear los códigos.", "mal");
      setGuardando(false);
    }
  };

  return (
    <Modal open onClose={onCerrar} ancho="max-w-lg">
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="f-d text-lg">Crear código</h3>
            <p className="text-sm text-texto-suave mt-1">Elegí el producto, o varios. El código queda guardado en cada uno y aparece en la grilla.</p>
          </div>
          <button onClick={onCerrar} className="text-texto-tenue hover:text-texto p-1 -mr-2 -mt-2"><X size={18} /></button>
        </div>
        <div className="relative mt-4">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-texto-tenue" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar entre ${nf.format(sinCodigo.length)} productos sin código`}
            className="w-full border border-borde rounded-md pl-8 pr-3 py-2 text-sm bg-superficie outline-none focus:border-acento" />
        </div>
        <ul className="mt-3 max-h-80 overflow-auto divide-y divide-borde border border-borde rounded-md">
          {sinCodigo.length === 0 && <li className="px-3 py-4 text-sm text-texto-tenue">Todos los productos ya tienen código.</li>}
          {sinCodigo.length > 0 && lista.length === 0 && <li className="px-3 py-4 text-sm text-texto-tenue">Ningún producto sin código coincide.</li>}
          {lista.slice(0, 200).map((p) => (
            <li key={p.id}>
              <label className="flex items-center gap-3 px-3 py-2.5 hover:bg-superficie-2 cursor-pointer">
                <input type="checkbox" checked={!!elegidos[p.id]} className="accent-[var(--acento)]"
                  onChange={() => setElegidos((e) => { const n = { ...e }; if (n[p.id]) delete n[p.id]; else n[p.id] = true; return n; })} />
                <span className="text-sm flex-1 truncate">{p.nombre}</span>
                {p.precio ? <span className="f-m text-xs text-texto-tenue">{money(p.precio)}</span> : null}
              </label>
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2 mt-4">
          <Boton variant="quiet" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={crear} disabled={!ids.length || guardando}>
            <Wand2 size={15} /> {guardando ? "Creando…" : ids.length > 1 ? `Crear ${ids.length} códigos` : "Crear código"}
          </Boton>
        </div>
      </div>
    </Modal>
  );
}
