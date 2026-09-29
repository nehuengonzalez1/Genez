/* ============================================================
   PRODUCTOS · LA LISTA DE PRECIOS DE UN PROVEEDOR
   ============================================================

   Se sube la planilla del proveedor, se dice qué columna es cada cosa
   (viene adivinado) y qué es el importe (costo o precio de venta), y los
   cambios pasan al borrador de Editar en tabla: se ven resaltados y se
   guardan después de mirarlos. Nada se escribe desde acá.

   Se cruza por código de barras, que es lo que tienen los productos
   (Super 25, 29/09: 1.389 de 1.415). Los que la lista trae y el catálogo
   no, se muestran aparte y no se dan de alta solos: una lista de
   proveedor trae cientos de productos que el comercio no vende.

   Cómo se lee la planilla: src/utils/listaProveedor.js.
   ============================================================ */

import React, { useState, useMemo } from "react";
import { X, Upload, Loader2 } from "lucide-react";
import { Modal, Boton } from "../ui/Base.jsx";
import { nf, money } from "../utils/helpers.js";
import { cargarPlanilla } from "../utils/planilla.js";
import { encontrarTitulos, adivinarColumnas, cruzarLista } from "../utils/listaProveedor.js";

const selectCls = "text-sm border border-borde rounded-lg px-2 py-1.5 bg-superficie outline-none focus:border-acento w-full";

/* La primera hoja, como filas de celdas. SheetJS lee también el CSV. */
export async function leerFilas(archivo) {
  const XLSX = await cargarPlanilla();
  if (!XLSX) throw new Error("No se pudo cargar el lector de planillas. Revisá la conexión y probá de nuevo.");
  const libro = /\.csv$/i.test(archivo.name)
    ? XLSX.read(await archivo.text(), { type: "string" })
    : XLSX.read(await archivo.arrayBuffer(), { type: "array" });
  return XLSX.utils.sheet_to_json(libro.Sheets[libro.SheetNames[0]], { header: 1, defval: "" });
}

export function ListaProveedor({ productos, onCerrar, onAplicar }) {
  const [archivo, setArchivo] = useState(null);
  const [filas, setFilas] = useState(null);
  const [desde, setDesde] = useState(0);
  const [col, setCol] = useState({ codigo: -1, descripcion: -1, importe: -1 });
  const [que, setQue] = useState("costo");
  const [sumarIva, setSumarIva] = useState(false);
  const [conPrecio, setConPrecio] = useState(false);
  const [markup, setMarkup] = useState("40");
  const [redondeo, setRedondeo] = useState("10");
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState(null);

  const subir = async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = "";
    if (!f) return;
    setLeyendo(true); setError(null);
    try {
      const todas = await leerFilas(f);
      if (!todas.length) throw new Error("La planilla está vacía.");
      const d = encontrarTitulos(todas);
      const c = adivinarColumnas(todas[d] || []);
      setFilas(todas); setDesde(d); setCol(c); setArchivo(f.name);
      /* "s/IVA", "sin IVA" o "neto" en el título del importe: casi seguro
         que no lo incluye. Se deja marcado, y se puede desmarcar. */
      const titulo = String((todas[d] || [])[c.importe] || "").toLowerCase();
      setSumarIva(/s\/\s*iva|sin iva|neto/.test(titulo));
    } catch (e) {
      setError(e.message || "No se pudo leer la planilla.");
    } finally {
      setLeyendo(false);
    }
  };

  const titulos = filas ? (filas[desde] || []).map((t, i) => String(t || "").trim() || `Columna ${i + 1}`) : [];
  const listo = filas && col.codigo >= 0 && col.importe >= 0;
  const r = useMemo(() => (listo ? cruzarLista({
    filas, desde: desde + 1, columnas: col, productos, que, sumarIva: que === "costo" && sumarIva,
    markup: que === "costo" && conPrecio ? Number(markup) || 0 : null, redondeo: Number(redondeo) || 1,
  }) : null), [listo, filas, desde, col, productos, que, sumarIva, conPrecio, markup, redondeo]);

  const elegir = (campo, nombre) => (
    <label className="block">
      <span className="text-[11px] uppercase tracking-widest text-texto-tenue font-bold">{nombre}</span>
      <select value={col[campo]} onChange={(e) => setCol((c) => ({ ...c, [campo]: Number(e.target.value) }))} className={`${selectCls} mt-1`}>
        <option value={-1}>—</option>
        {titulos.map((t, i) => <option key={i} value={i}>{t}</option>)}
      </select>
    </label>
  );

  return (
    <Modal open onClose={onCerrar} ancho="max-w-2xl">
      <div className="sticky top-0 bg-superficie border-b border-borde px-5 py-3.5 flex items-center justify-between">
        <div>
          <h3 className="f-d text-lg">Lista de precios de un proveedor</h3>
          <p className="text-xs text-texto-suave">{archivo || "Excel o CSV, como la manda el proveedor"}</p>
        </div>
        <button onClick={onCerrar} className="text-texto-tenue hover:text-texto"><X size={18} /></button>
      </div>

      <div className="p-5 space-y-4 text-sm">
        <label className="inline-flex">
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={subir} />
          <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-borde hover:bg-superficie-2 cursor-pointer font-semibold">
            {leyendo ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {filas ? "Subir otra" : "Subir la lista"}
          </span>
        </label>
        {error && <p className="text-mal">{error}</p>}

        {filas && (
          <>
            <div>
              <p className="text-texto-suave">
                Los títulos están en la fila{" "}
                <select value={desde} onChange={(e) => { const d = Number(e.target.value); setDesde(d); setCol(adivinarColumnas(filas[d] || [])); }}
                  className="text-sm border border-borde rounded px-1 bg-superficie">
                  {filas.slice(0, 20).map((_, i) => <option key={i} value={i}>{i + 1}</option>)}
                </select>
                . Revisá qué columna es cada cosa:
              </p>
              <div className="grid grid-cols-3 gap-3 mt-2">
                {elegir("codigo", "Código de barras")}
                {elegir("descripcion", "Descripción")}
                {elegir("importe", "Importe")}
              </div>
            </div>

            <div className="rounded-lg border border-borde p-3 space-y-2">
              <div className="flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2"><input type="radio" checked={que === "costo"} onChange={() => setQue("costo")} /> El importe es lo que me cobra (costo)</label>
                <label className="inline-flex items-center gap-2"><input type="radio" checked={que === "precio"} onChange={() => setQue("precio")} /> Es el precio de venta sugerido</label>
              </div>
              {que === "costo" && (
                <>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={sumarIva} onChange={(e) => setSumarIva(e.target.checked)} />
                    No incluye IVA: sumárselo, con la alícuota de cada producto
                  </label>
                  <label className="flex flex-wrap items-center gap-2">
                    <input type="checkbox" checked={conPrecio} onChange={(e) => setConPrecio(e.target.checked)} />
                    Calcular también el precio de venta: costo +
                    <input value={markup} onChange={(e) => setMarkup(e.target.value.replace(/[^\d]/g, ""))} disabled={!conPrecio}
                      className="f-m w-14 text-right border border-borde rounded px-1.5 py-0.5 bg-superficie" />%, redondeando a
                    <select value={redondeo} onChange={(e) => setRedondeo(e.target.value)} disabled={!conPrecio} className="border border-borde rounded px-1 py-0.5 bg-superficie">
                      <option value="1">$1</option><option value="10">$10</option><option value="50">$50</option><option value="100">$100</option>
                    </select>
                  </label>
                </>
              )}
            </div>

            {!listo ? (
              <p className="text-ojo">Elegí al menos la columna del código de barras y la del importe.</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  {[["Cambian", r.cambios.length, "text-ojo bg-ojo-suave border-ojo"],
                    ["Quedan igual", r.iguales, "text-texto-suave bg-superficie-2 border-borde"],
                    ["No están en el catálogo", r.noEstan.length, "text-texto-suave bg-superficie-2 border-borde"]].map(([t, n, cls]) => (
                    <div key={t} className={`rounded-xl border p-3 text-center ${cls}`}>
                      <div className="f-d text-2xl">{nf.format(n)}</div>
                      <div className="text-[10px] uppercase tracking-widest font-bold">{t}</div>
                    </div>
                  ))}
                </div>
                {r.cambios.length > 0 && (
                  <ul className="divide-y divide-borde border border-borde rounded-lg max-h-48 overflow-y-auto">
                    {r.cambios.slice(0, 50).map((c) => (
                      <li key={c.producto.id} className="px-3 py-1.5 flex justify-between gap-3">
                        <span className="truncate">{c.producto.nombre}</span>
                        <span className="f-m text-xs text-texto-suave shrink-0">
                          {c.costo !== undefined && <>costo {money(c.producto.costo)} → <b className="text-texto">{money(c.costo)}</b> </>}
                          {c.precio !== undefined && <>precio {money(c.producto.precio)} → <b className="text-texto">{money(c.precio)}</b></>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {r.noEstan.length > 0 && (
                  <details className="text-texto-suave">
                    <summary className="cursor-pointer">Los {nf.format(r.noEstan.length)} que no están en el catálogo (no se dan de alta solos)</summary>
                    <ul className="mt-1 text-xs space-y-0.5">
                      {r.noEstan.slice(0, 30).map((x) => <li key={x.codigo} className="f-m">{x.codigo} · {x.descripcion || "sin descripción"}</li>)}
                      {r.noEstan.length > 30 && <li>… y {nf.format(r.noEstan.length - 30)} más</li>}
                    </ul>
                  </details>
                )}
                {r.sinCodigo > 0 && <p className="text-xs text-texto-tenue">{nf.format(r.sinCodigo)} filas sin código de barras o sin importe se saltearon (títulos de sección, códigos propios del proveedor).</p>}
              </>
            )}
          </>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-borde">
          <Boton variant="ghost" onClick={onCerrar}>Cancelar</Boton>
          <Boton disabled={!r || !r.cambios.length} onClick={() => onAplicar(r.cambios)}>
            Pasar {r ? nf.format(r.cambios.length) : 0} cambios al borrador
          </Boton>
        </div>
      </div>
    </Modal>
  );
}
