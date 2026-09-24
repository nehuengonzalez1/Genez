/* ============================================================
   PRODUCTOS · ETIQUETAS CON CÓDIGO DE BARRAS
   ============================================================

   Para lo que no se puede pasar con la pistola porque no trae código: lo
   que se fracciona en el local, lo suelto, lo que el proveedor no
   rotuló. Se le genera un código propio (0086), queda guardado en el
   producto, y se imprimen etiquetas para pegar en la góndola o en el
   envase. También sirve para reimprimir la etiqueta de cualquier producto
   que ya tiene código.

   Dos salidas:
   - Hoja A4, en grilla: una al lado de la otra y una debajo de la otra,
     en la impresora común de la oficina, con líneas para recortar.
   - La térmica, una debajo de la otra. Si la computadora tiene la
     impresión directa, sale sin ventana y con el código dibujado por la
     propia impresora.
   ============================================================ */

import React, { useState, useMemo } from "react";
import { Search, Barcode, Printer, Wand2, Minus, Plus, X } from "lucide-react";
import { money, nf } from "../utils/helpers.js";
import { asignarCodigos } from "../datos/items.js";
import { formatoDe, svgCodigo } from "../ui/codigoBarras.js";
import { etiquetasEscPos } from "../ui/escpos.js";
import { impresoraElegida, imprimirDirecto } from "../ui/agenteImpresion.js";
import { Modal, Boton, escaparHTML, utilDe } from "../ui/Base.jsx";

const sinCodigo = (p) => !String(p.barcode || "").trim();
const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/* Lo que va adentro de cada etiqueta, igual en la vista previa y en el
   papel: si la pantalla y la hoja se armaran por separado, un día dejan
   de coincidir. */
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
        font-family: Arial, Helvetica, sans-serif; color: #000; break-inside: avoid; page-break-inside: avoid; }
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

export function Etiquetas({ productos, empresaId, ajustes, toast, onClose }) {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("sin");            // sin | todos
  const [elegidos, setElegidos] = useState({});           // id → copias
  const [codigos, setCodigos] = useState({});             // id → código recién generado
  const [generando, setGenerando] = useState(false);
  const [formato, setFormato] = useState("a4");           // a4 | termica
  const [columnas, setColumnas] = useState(4);
  const [conNombre, setConNombre] = useState(true);
  const [conPrecio, setConPrecio] = useState(false);
  const [mostrar, setMostrar] = useState(80);

  /* El código que tiene, contando el que se acaba de generar: el catálogo
     se actualiza solo por tiempo real, pero puede tardar un instante. */
  const codigoDe = (p) => codigos[p.id] || String(p.barcode || "").trim();

  const activos = useMemo(() => productos.filter((p) => p.activo !== false), [productos]);
  const cuantosSin = activos.filter((p) => !codigoDe(p)).length;
  const lista = useMemo(() => {
    const t = norm(q.trim());
    return activos
      .filter((p) => filtro === "todos" || !codigoDe(p))
      .filter((p) => !t || norm(p.nombre).includes(t) || codigoDe(p).includes(q.trim()))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [activos, q, filtro, codigos]);

  const marcados = activos.filter((p) => elegidos[p.id]);
  const marcadosSin = marcados.filter((p) => !codigoDe(p));
  const etiquetas = marcados.filter((p) => codigoDe(p)).flatMap((p) => Array.from({ length: elegidos[p.id] }, () => ({
    codigo: codigoDe(p), nombre: p.nombre, precio: p.precio ? money(p.precio) : "",
  })));

  const alternar = (p) => setElegidos((e) => { const n = { ...e }; if (n[p.id]) delete n[p.id]; else n[p.id] = 1; return n; });
  const copias = (p, d) => setElegidos((e) => ({ ...e, [p.id]: Math.max(1, Math.min(200, (e[p.id] || 1) + d)) }));
  const todosLosQueSeVen = () => setElegidos((e) => { const n = { ...e }; lista.slice(0, mostrar).forEach((p) => { n[p.id] = n[p.id] || 1; }); return n; });

  const generar = async () => {
    setGenerando(true);
    try {
      const nuevos = await asignarCodigos(empresaId, marcadosSin.map((p) => p.id));
      setCodigos((c) => { const n = { ...c }; nuevos.forEach((x) => { n[x.id] = x.barcode; }); return n; });
      toast(nuevos.length === 1 ? "Se generó 1 código. Quedó guardado en el producto." : `Se generaron ${nuevos.length} códigos. Quedaron guardados en cada producto.`);
    } catch (e) {
      toast(e.message || "No se pudieron generar los códigos.", "mal");
    } finally {
      setGenerando(false);
    }
  };

  /* A4: el ancho de cada celda sale de la hoja menos los márgenes. */
  const anchoCeldaMM = formato === "a4" ? (210 - 16) / columnas : utilDe(58);
  const opciones = { anchoMM: anchoCeldaMM - 4, conNombre, conPrecio };

  const imprimir = async () => {
    if (!etiquetas.length) return;
    if (formato === "termica") {
      const impresora = impresoraElegida();
      if (impresora) {
        try {
          const W = ajustes.ancho === 58 ? 32 : 48;
          await imprimirDirecto(impresora, etiquetasEscPos({
            etiquetas: etiquetas.map((e) => ({ ...e, nombre: conNombre ? e.nombre : "", precio: conPrecio ? e.precio : "" })),
            mm: ajustes.ancho === 58 ? 58 : 80, W, formatoDe,
          }));
          return toast(`${nf.format(etiquetas.length)} etiquetas enviadas a la impresora.`);
        } catch (e) {
          toast(`No salió por la impresión directa (${e.message}). Se abre la ventana.`, "mal");
        }
      }
    }
    const celdas = etiquetas.map((e) => htmlEtiqueta(e, opciones)).join("");
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

  const previa = etiquetas.slice(0, formato === "a4" ? columnas * 4 : 4);

  return (
    <Modal open onClose={onClose} ancho="max-w-6xl">
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="f-d text-xl">Etiquetas con código de barras</h3>
            <p className="text-sm text-texto-suave mt-1">
              A los productos sin código se les genera uno propio que queda guardado y se lee con la pistola. Elegí cuáles y cuántas copias.
            </p>
          </div>
          <button onClick={onClose} className="text-texto-tenue hover:text-texto p-1 -mr-2 -mt-2"><X size={18} /></button>
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-5 mt-5">
          {/* ---------- Qué productos ---------- */}
          <div className="border border-borde rounded-lg overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-borde">
              <div className="relative flex-1 min-w-[12rem]">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-texto-tenue" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o código"
                  className="w-full border border-borde rounded-md pl-8 pr-3 py-1.5 text-sm bg-superficie outline-none focus:border-acento" />
              </div>
              <div className="flex rounded-md border border-borde overflow-hidden text-xs font-semibold">
                <button onClick={() => setFiltro("sin")} className={`px-3 py-1.5 ${filtro === "sin" ? "bg-superficie-3 text-texto" : "text-texto-suave"}`}>Sin código ({nf.format(cuantosSin)})</button>
                <button onClick={() => setFiltro("todos")} className={`px-3 py-1.5 ${filtro === "todos" ? "bg-superficie-3 text-texto" : "text-texto-suave"}`}>Todos</button>
              </div>
              <button onClick={todosLosQueSeVen} className="text-xs font-semibold text-acento hover:underline">Marcar los que se ven</button>
            </div>
            <ul className="divide-y divide-borde max-h-[420px] overflow-auto">
              {lista.length === 0 && <li className="px-4 py-6 text-sm text-texto-tenue">{filtro === "sin" ? "Todos los productos tienen código." : "Ningún producto coincide."}</li>}
              {lista.slice(0, mostrar).map((p) => {
                const cod = codigoDe(p);
                const marcado = !!elegidos[p.id];
                return (
                  <li key={p.id} className={`flex items-center gap-3 px-4 py-2 ${marcado ? "bg-acento-suave/40" : ""}`}>
                    <input type="checkbox" checked={marcado} onChange={() => alternar(p)} className="accent-[var(--acento)]" />
                    <button onClick={() => alternar(p)} className="min-w-0 flex-1 text-left">
                      <div className="text-sm truncate">{p.nombre}</div>
                      <div className="text-xs f-m text-texto-tenue">
                        {cod ? cod : <span className="text-ojo">sin código</span>}
                        {codigos[p.id] && <span className="text-bien"> · nuevo</span>}
                      </div>
                    </button>
                    {marcado && (
                      <div className="flex items-center border border-borde rounded-md shrink-0">
                        <button onClick={() => copias(p, -1)} className="px-1.5 py-1 hover:bg-superficie-2"><Minus size={12} /></button>
                        <span className="f-m text-xs w-7 text-center">{elegidos[p.id]}</span>
                        <button onClick={() => copias(p, 1)} className="px-1.5 py-1 hover:bg-superficie-2"><Plus size={12} /></button>
                      </div>
                    )}
                  </li>
                );
              })}
              {lista.length > mostrar && (
                <li className="px-4 py-2"><button onClick={() => setMostrar((m) => m + 200)} className="text-xs font-semibold text-acento hover:underline">Mostrar más ({nf.format(lista.length - mostrar)} restantes)</button></li>
              )}
            </ul>
          </div>

          {/* ---------- Cómo y la vista previa ---------- */}
          <div className="space-y-4">
            {marcadosSin.length > 0 && (
              <div className="rounded-lg border border-ojo bg-ojo-suave p-4">
                <p className="text-sm text-texto">
                  {marcadosSin.length === 1 ? "1 de los marcados no tiene código." : `${marcadosSin.length} de los marcados no tienen código.`}
                </p>
                <Boton className="mt-3 w-full" onClick={generar} disabled={generando}>
                  <Wand2 size={15} /> {generando ? "Generando…" : `Generar ${marcadosSin.length === 1 ? "su código" : `sus ${marcadosSin.length} códigos`}`}
                </Boton>
              </div>
            )}

            <div className="rounded-lg border border-borde p-4 space-y-3">
              <div className="text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold">Dónde se imprime</div>
              <div className="flex rounded-md border border-borde overflow-hidden text-xs font-semibold">
                <button onClick={() => setFormato("a4")} className={`flex-1 px-3 py-2 ${formato === "a4" ? "bg-superficie-3 text-texto" : "text-texto-suave"}`}>Hoja A4</button>
                <button onClick={() => setFormato("termica")} className={`flex-1 px-3 py-2 ${formato === "termica" ? "bg-superficie-3 text-texto" : "text-texto-suave"}`}>Térmica</button>
              </div>
              {formato === "a4" && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-texto-suave">Columnas</span>
                  {[3, 4, 5].map((c) => (
                    <button key={c} onClick={() => setColumnas(c)} className={`f-m text-xs px-2.5 py-1 rounded-md border ${columnas === c ? "bg-superficie-3 text-texto border-superficie-3" : "border-borde text-texto-suave"}`}>{c}</button>
                  ))}
                  <span className="text-xs text-texto-tenue ml-auto">{columnas * 9} por hoja</span>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-texto-suave">
                <input type="checkbox" checked={conNombre} onChange={(e) => setConNombre(e.target.checked)} className="accent-[var(--acento)]" /> Nombre del producto
              </label>
              <label className="flex items-center gap-2 text-sm text-texto-suave">
                <input type="checkbox" checked={conPrecio} onChange={(e) => setConPrecio(e.target.checked)} className="accent-[var(--acento)]" /> Precio
              </label>
              {formato === "termica" && (
                <p className="text-xs text-texto-tenue">
                  {impresoraElegida() ? `Sale directo por ${impresoraElegida()}, una debajo de la otra.` : "Se abre la ventana de impresión. Con la impresión directa (Ajustes) sale sin ventana."}
                </p>
              )}
            </div>

            <div className="rounded-lg border border-borde p-3 bg-white">
              {previa.length === 0 ? (
                <p className="text-sm text-stone-500 p-3 text-center"><Barcode size={16} className="inline mb-0.5" /> Marcá productos con código para ver cómo quedan.</p>
              ) : (
                <>
                  <style>{CSS_ETIQUETA + " .previa .et { border: 0.2mm dashed #ccc; margin: -0.1mm; }"}</style>
                  <div className="previa text-black" style={{ display: "grid", gridTemplateColumns: `repeat(${formato === "a4" ? Math.min(columnas, 3) : 1}, 1fr)` }}
                    dangerouslySetInnerHTML={{ __html: previa.slice(0, formato === "a4" ? 6 : 3).map((e) => htmlEtiqueta(e, { ...opciones, anchoMM: formato === "a4" ? 40 : opciones.anchoMM })).join("") }} />
                </>
              )}
            </div>

            <Boton size="lg" className="w-full" onClick={imprimir} disabled={!etiquetas.length}>
              <Printer size={16} /> Imprimir {etiquetas.length ? `${nf.format(etiquetas.length)} ${etiquetas.length === 1 ? "etiqueta" : "etiquetas"}` : ""}
            </Boton>
            {formato === "a4" && etiquetas.length > 0 && (
              <p className="text-xs text-texto-tenue text-center">{Math.ceil(etiquetas.length / (columnas * 9))} {Math.ceil(etiquetas.length / (columnas * 9)) === 1 ? "hoja" : "hojas"}. En la ventana de impresión, Márgenes: Predeterminado.</p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
