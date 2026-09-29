/* ============================================================
   STOCK · cargar el stock desde una planilla (0110)
   ============================================================

   Un comercio que arranca con el sistema tiene la góndola llena y el
   stock en cero, y contar 1.400 productos de a uno en la pantalla no lo
   hace nadie. Con una planilla —código y cantidad, la que tenga o la que
   arme contando con una lista impresa— se carga todo de una vez.

   Cada fila es un conteo (ajustar_stock_lote → ajustar_stock): la base
   calcula la diferencia contra lo que hay en ese momento y lo guarda
   como ajuste, con quién lo hizo. Así sirve también para un recuento
   general más adelante, no solo para el primero. Primero se muestra qué
   cruzó y qué no, y recién después se carga.
   ============================================================ */

import React, { useState } from "react";
import { Upload } from "lucide-react";
import { Boton } from "../ui/Base.jsx";
import { nf } from "../utils/helpers.js";
import { leerFilas } from "./ListaProveedor.jsx";
import { encontrarTitulos, adivinarColumnas } from "../utils/listaProveedor.js";
import { cruzarStock, columnaCantidad } from "../utils/stockInicial.js";
import { guardarConteoLote } from "../datos/sucursales.js";

const selectCls = "text-sm border border-borde rounded-lg px-2 py-1.5 bg-superficie outline-none focus:border-acento w-full";

export function StockInicial({ productos, setProductos, lugar, toast }) {
  const [filas, setFilas] = useState(null);
  const [desde, setDesde] = useState(0);
  const [columnas, setColumnas] = useState({ codigo: -1, cantidad: -1 });
  const [cargando, setCargando] = useState(false);
  const [listo, setListo] = useState(null);

  const subir = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try {
      const todas = await leerFilas(f);
      const t = encontrarTitulos(todas);
      const titulos = todas[t] || [];
      setFilas(todas);
      setDesde(t + 1);
      setColumnas({ codigo: adivinarColumnas(titulos).codigo, cantidad: columnaCantidad(titulos) });
      setListo(null);
    } catch (err) {
      toast(err.message || "No se pudo leer la planilla.", "mal");
    }
  };

  const titulos = filas ? (filas[desde - 1] || []) : [];
  const cruce = filas && columnas.codigo >= 0 && columnas.cantidad >= 0 ? cruzarStock(filas, desde, columnas, productos) : null;
  const sucursal = lugar.varias ? (lugar.sucursales.find((s) => s.id === lugar.actual) || {}).nombre : null;

  const cargar = async () => {
    if (!cruce || !cruce.cruzan.length) return;
    setCargando(true);
    try {
      const hechos = await guardarConteoLote(cruce.cruzan.map((x) => ({ itemId: x.p.id, real: x.real })), { sucursalId: lugar.actual || null });
      const dif = new Map(hechos.map((h) => [h.itemId, h.diferencia]));
      setProductos((ps) => ps.map((p) => (dif.has(p.id) ? { ...p, stock: +(p.stock + dif.get(p.id)).toFixed(3), stockCargado: true } : p)));
      const cambiaron = hechos.filter((h) => h.diferencia !== 0).length;
      setListo({ total: hechos.length, cambiaron });
      setFilas(null);
      toast(`Stock cargado: ${nf.format(hechos.length)} productos.`);
    } catch (err) {
      toast(err.message, "mal");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="mt-6 border-t border-borde pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-semibold">Cargar desde una planilla</h4>
          <p className="text-sm text-texto-suave mt-0.5">
            Una columna con el código de barras y otra con la cantidad. Sirve para el stock inicial y para un recuento general: cada fila queda como un conteo{sucursal ? `, en ${sucursal}` : ""}.
          </p>
        </div>
        <label className="shrink-0">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border border-borde hover:bg-superficie-2 cursor-pointer">
            <Upload size={14} /> Elegir planilla
          </span>
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={subir} />
        </label>
      </div>

      {filas && (
        <div className="mt-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3 max-w-xl">
            <label className="block text-xs text-texto-suave">Código de barras
              <select value={columnas.codigo} onChange={(e) => setColumnas((c) => ({ ...c, codigo: Number(e.target.value) }))} className={`${selectCls} mt-1`}>
                <option value={-1}>Elegí la columna</option>
                {titulos.map((t, i) => <option key={i} value={i}>{String(t || `Columna ${i + 1}`)}</option>)}
              </select>
            </label>
            <label className="block text-xs text-texto-suave">Cantidad
              <select value={columnas.cantidad} onChange={(e) => setColumnas((c) => ({ ...c, cantidad: Number(e.target.value) }))} className={`${selectCls} mt-1`}>
                <option value={-1}>Elegí la columna</option>
                {titulos.map((t, i) => <option key={i} value={i}>{String(t || `Columna ${i + 1}`)}</option>)}
              </select>
            </label>
          </div>

          {cruce && (
            <>
              <p className="text-sm">
                <strong className="f-m">{nf.format(cruce.cruzan.length)}</strong> productos para cargar
                {cruce.noEstan.length > 0 && <> · <span className="text-ojo"><span className="f-m">{nf.format(cruce.noEstan.length)}</span> códigos que no están en el catálogo</span></>}
                {cruce.malas > 0 && <> · <span className="text-texto-tenue"><span className="f-m">{nf.format(cruce.malas)}</span> filas sin código o sin cantidad</span></>}
              </p>
              {cruce.noEstan.length > 0 && (
                <p className="text-xs text-texto-tenue">
                  No están: <span className="f-m">{cruce.noEstan.slice(0, 12).join(", ")}{cruce.noEstan.length > 12 ? "…" : ""}</span>. Esos no se cargan; dalos de alta primero si hacen falta.
                </p>
              )}
              <div className="flex gap-2">
                <Boton disabled={cargando || !cruce.cruzan.length} onClick={cargar}>
                  {cargando ? "Cargando…" : `Cargar ${nf.format(cruce.cruzan.length)} productos`}
                </Boton>
                <Boton variant="quiet" disabled={cargando} onClick={() => setFilas(null)}>Cancelar</Boton>
              </div>
            </>
          )}
        </div>
      )}

      {listo && (
        <p className="text-sm text-bien mt-3">
          Listo: <span className="f-m">{nf.format(listo.total)}</span> productos contados, <span className="f-m">{nf.format(listo.cambiaron)}</span> con diferencia.
        </p>
      )}
    </div>
  );
}
