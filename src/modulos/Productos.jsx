/* ============================================================
   7. PRODUCTOS
   ============================================================ */

import React, { useState, useMemo, useRef, useEffect } from "react";
import { Search, Plus, X, Check, Loader2, Upload, Percent, ChevronLeft, ChevronRight, TrendingDown, Barcode } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { fdate, fdatel } from "../datos/generador.js";
import { money, moneyk, pct, nf, faltantesProducto, diasDesde, diasHasta } from "../utils/helpers.js";
import { useScanHandler, beep, Card, Vacio, Boton, Modal, Tabs, TablaSimple } from "../ui/Base.jsx";
import { NumeroDiferido } from "../ui/Campos.jsx";
import { leerPlanilla, analizarPlanilla, exportarCatalogo, FormProducto } from "./Vender.jsx";

export function Productos({ productos, actualizarProducto, agregarProducto, toast, focoInicial, provs, ajustes }) {
  const [alta, setAlta] = useState(null);
  const [planilla, setPlanilla] = useState(null);   // resumen previo a aplicar
  const [modoPrecios, setModoPrecios] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const archivo = useRef(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Todas");
  const [orden, setOrden] = useState("nombre");
  const [pag, setPag] = useState(0);
  const [abierto, setAbierto] = useState(null);
  const [filtro, setFiltro] = useState(focoInicial || "todos");

  useScanHandler((cod) => {
    const p = productos.find((x) => x.barcode === cod);
    if (!p) { beep(false, true); return toast(`El código ${cod} no está en el catálogo.`, "mal"); }
    beep(true, true); setQ(""); setCat("Todas"); setFiltro("todos"); setAbierto(p.id);
  }, true);

  const cats = useMemo(() => ["Todas", ...Array.from(new Set(productos.map((p) => p.categoria)))], [productos]);
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const lista = useMemo(() => {
    let l = productos;
    if (cat !== "Todas") l = l.filter((p) => p.categoria === cat);
    if (filtro === "margen") l = l.filter((p) => p.costo > p.costoPrev * 1.005);
    if (filtro === "flaco") l = l.filter((p) => (p.precio - p.costo) / p.precio < 0.15 && p.u30 >= 4);
    if (filtro === "incompletos") l = l.filter((p) => faltantesProducto(p).length);
    if (q.trim().length >= 2) {
      const t = norm(q.trim());
      l = l.filter((p) => norm(p.nombre).includes(t) || p.sku.toLowerCase().includes(t) || p.barcode.includes(t));
    }
    const cmp = {
      nombre: (a, b) => a.nombre.localeCompare(b.nombre),
      venta: (a, b) => b.u30 * b.precio - a.u30 * a.precio,
      margen: (a, b) => (a.precio - a.costo) / a.precio - (b.precio - b.costo) / b.precio,
      stock: (a, b) => a.stock / (a.vel || 0.01) - b.stock / (b.vel || 0.01),
    }[orden];
    return [...l].sort(cmp);
  }, [productos, cat, q, orden, filtro]);

  const porPagina = 40;
  const paginas = Math.max(1, Math.ceil(lista.length / porPagina));
  const p0 = Math.min(pag, paginas - 1);
  const visibles = lista.slice(p0 * porPagina, p0 * porPagina + porPagina);
  useEffect(() => setPag(0), [q, cat, orden, filtro]);

  /* El historial de costos ya no se arma acá: lo escribe un disparador de la
     base cuando ve el cambio, así ninguna pantalla se puede olvidar de él. */
  const actualizar = actualizarProducto;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, SKU o código"
            className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-xl outline-none focus:border-orange-400 bg-white" />
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="text-sm border border-stone-200 rounded-xl px-3 py-2 bg-white outline-none focus:border-orange-400">
          {cats.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={orden} onChange={(e) => setOrden(e.target.value)} className="text-sm border border-stone-200 rounded-xl px-3 py-2 bg-white outline-none focus:border-orange-400">
          <option value="nombre">Orden alfabético</option>
          <option value="venta">Más vendidos</option>
          <option value="margen">Menor margen</option>
          <option value="stock">Menos cobertura</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[["todos", "Todos"], ["margen", "Subieron de costo"], ["flaco", "Margen bajo"], ["incompletos", "Incompletos"]].map(([k, n]) => (
          <button key={k} onClick={() => setFiltro(k)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${filtro === k ? "bg-stone-900 text-white border-stone-900" : "bg-white border-stone-200 text-stone-500 hover:bg-stone-50"}`}>{n}</button>
        ))}
        <span className="text-xs text-stone-400 self-center ml-1">{nf.format(lista.length)} productos</span>
        {modoPrecios && (
          <span className="text-xs text-stone-500 basis-full sm:basis-auto">
            Editando precios: cada cambio se guarda solo. El porcentaje debajo es el margen.
          </span>
        )}
        <Boton size="sm" variant={modoPrecios ? "dark" : "ghost"} onClick={() => setModoPrecios((v) => !v)}>
          <Percent size={14} /> <span className="hidden sm:inline">{modoPrecios ? "Salir de precios" : "Editar precios"}</span>
        </Boton>
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <input ref={archivo} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={async (e) => {
              const f = e.target.files[0]; e.target.value = "";
              if (!f) return;
              setLeyendo(true);
              try {
                const filas = await leerPlanilla(f);
                if (!filas.length) throw new Error("La planilla no tiene filas.");
                setPlanilla({ nombre: f.name, ...analizarPlanilla(filas, productos, ajustes.listas || []) });
              } catch (err) { toast(err.message, "mal"); }
              setLeyendo(false);
            }} />
          <Boton size="sm" variant="ghost" onClick={() => exportarCatalogo(productos, ajustes.listas || [], toast)}>
            <Upload size={14} className="rotate-180" /> <span className="hidden sm:inline">Exportar</span>
          </Boton>
          <Boton size="sm" variant="ghost" disabled={leyendo} onClick={() => archivo.current && archivo.current.click()}>
            {leyendo ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} <span className="hidden sm:inline">Importar</span>
          </Boton>
          <Boton size="sm" onClick={() => setAlta({})}><Plus size={14} /> <span className="hidden sm:inline">Nuevo producto</span><span className="sm:hidden">Nuevo</span></Boton>
        </div>
      </div>

      <Card className="overflow-hidden">
        {/* Siete columnas no entran en un celular: mismos datos, otra forma */}
        <ul className={`${modoPrecios ? "hidden" : "md:hidden"} divide-y divide-stone-100`}>
          {visibles.map((p) => {
            const m = p.precio ? (p.precio - p.costo) / p.precio : 0;
            const cob = p.vel > 0 ? p.stock / p.vel : 99;
            const faltan = faltantesProducto(p);
            return (
              <li key={p.id}>
                <button onClick={() => setAbierto(p.id)} className="w-full text-left px-3 py-2.5 active:bg-orange-50/60">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-stone-900 leading-snug">{p.nombre}</div>
                      <div className="f-m text-[11px] text-stone-400">{p.categoria}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="f-m text-sm font-semibold">{p.precio ? money(p.precio) : <span className="text-amber-600 text-xs">sin precio</span>}</div>
                      {Object.keys(p.precios || {}).length > 0 && (
                        <div className="text-[10px] text-emerald-600">{Object.keys(p.precios).length} lista{Object.keys(p.precios).length > 1 ? "s" : ""} más</div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px]">
                    <span className="f-m text-stone-500">Stock <span className={cob < 4 ? "text-red-600 font-semibold" : "text-stone-700"}>{p.unidad === "kg" ? p.stock.toFixed(1) : nf.format(p.stock)}</span></span>
                    <span className="f-m text-stone-500">Costo {money(p.costo)}</span>
                    {p.precio > 0 && <span className={`f-m ${m < 0.14 ? "text-red-600" : m < 0.22 ? "text-amber-600" : "text-emerald-600"}`}>{pct(m, 0)}</span>}
                    <span className="f-m text-stone-400">{nf.format(p.u30)} u/mes</span>
                    {faltan.length > 0 && <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">incompleta</span>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        {modoPrecios ? (
          <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-stone-400 border-b border-stone-200 bg-stone-50">
                  <th className="px-4 py-2.5 font-semibold">Producto</th>
                  <th className="px-2 py-2.5 font-semibold text-right w-24">Costo</th>
                  <th className="px-2 py-2.5 font-semibold text-right w-32">General</th>
                  {(ajustes.listas || []).filter((l) => l.activa !== false).map((l) => (
                    <th key={l.id} className="px-2 py-2.5 font-semibold text-right w-32">
                      {l.nombre}<div className="font-normal normal-case text-[10px] text-stone-400">desde {l.umbral} u</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {visibles.map((p) => {
                  const mg = (v) => (Number(v) > 0 ? (Number(v) - p.costo) / Number(v) : null);
                  const celda = (valor, alGuardar) => {
                    const m2 = mg(valor);
                    return (
                      <td className="px-2 py-1.5 text-right">
                        <NumeroDiferido valor={valor} onGuardar={alGuardar} placeholder="—"
                          className={`f-m w-24 text-right border rounded-lg px-2 py-1 text-sm outline-none focus:border-orange-400 ${
                            m2 != null && m2 < 0.08 ? "border-red-300 bg-red-50" : "border-stone-200"}`} />
                        {m2 != null && <div className={`text-[10px] ${m2 < 0.08 ? "text-red-600" : "text-stone-400"}`}>{pct(m2, 0)}</div>}
                      </td>
                    );
                  };
                  return (
                    <tr key={p.id} className="hover:bg-stone-50">
                      <td className="px-4 py-1.5">
                        <div className="font-medium text-stone-900">{p.nombre}</div>
                        <div className="f-m text-[11px] text-stone-400">{p.categoria}</div>
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <NumeroDiferido valor={p.costo} onGuardar={(n) => actualizar(p.id, { costo: n })}
                          className="f-m w-24 text-right border border-stone-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-orange-400 bg-stone-50" />
                      </td>
                      {celda(p.precio, (n) => actualizar(p.id, { precio: n }))}
                      {(ajustes.listas || []).filter((l) => l.activa !== false).map((l) => (
                        <React.Fragment key={l.id}>
                          {celda((p.precios || {})[l.id], (n) => {
                            const cp = { ...(p.precios || {}) };
                            if (n > 0) cp[l.id] = n; else delete cp[l.id];
                            actualizar(p.id, { precios: cp });
                          })}
                        </React.Fragment>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(ajustes.listas || []).filter((l) => l.activa !== false).length === 0 && (
              <Vacio>No hay listas creadas. Creá una en Ajustes para poder cargarle precios.</Vacio>
            )}
          </div>
        ) : (
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-stone-400 border-b border-stone-200 bg-stone-50">
                <th className="px-4 py-2.5 font-semibold">Producto</th>
                <th className="px-2 py-2.5 font-semibold">Categoría</th>
                <th className="px-2 py-2.5 font-semibold text-right">Stock</th>
                <th className="px-2 py-2.5 font-semibold text-right">Costo</th>
                <th className="px-2 py-2.5 font-semibold text-right">Precio</th>
                <th className="px-2 py-2.5 font-semibold text-right">Margen</th>
                <th className="px-4 py-2.5 font-semibold text-right">30 días</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {visibles.map((p) => {
                const m = (p.precio - p.costo) / p.precio;
                const cob = p.vel > 0 ? p.stock / p.vel : 99;
                const subio = p.costo > p.costoPrev * 1.005;
                return (
                  <tr key={p.id} onClick={() => setAbierto(p.id)} className="hover:bg-orange-50/50 cursor-pointer">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-stone-900 flex items-center gap-1.5">
                        {p.nombre}
                        {faltantesProducto(p).length > 0 && (
                          <span title={`Falta: ${faltantesProducto(p).join(", ")}`}
                            className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">incompleta</span>
                        )}
                      </div>
                      <div className="f-m text-[11px] text-stone-400">{p.sku} · {p.barcode || "sin código"}</div>
                    </td>
                    <td className="px-2 py-2.5 text-stone-500 text-xs">{p.categoria}</td>
                    <td className="px-2 py-2.5 text-right f-m">
                      <span className={cob < 4 ? "text-red-600 font-semibold" : cob < 8 ? "text-amber-600" : "text-stone-700"}>
                        {p.unidad === "kg" ? p.stock.toFixed(1) : nf.format(p.stock)}
                      </span>
                      <div className="text-[10px] text-stone-400">{cob > 90 ? "+90 d" : `${Math.round(cob)} d`}</div>
                    </td>
                    <td className="px-2 py-2.5 text-right f-m text-stone-600">
                      {money(p.costo)}
                      {subio && <div className="text-[10px] text-red-500">+{pct(p.costo / p.costoPrev - 1, 0)}</div>}
                    </td>
                    <td className="px-2 py-2.5 text-right f-m font-semibold">
                      {money(p.precio)}
                      {Object.entries(p.precios || {}).slice(0, 2).map(([k, v]) => (
                        <div key={k} className="text-[10px] text-emerald-600 font-normal">{money(v)}</div>
                      ))}
                    </td>
                    <td className="px-2 py-2.5 text-right f-m">
                      <span className={m < 0.14 ? "text-red-600" : m < 0.22 ? "text-amber-600" : "text-emerald-600"}>{pct(m, 0)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right f-m text-stone-600">{nf.format(p.u30)} <span className="text-[10px] text-stone-400">u</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
        {lista.length === 0 && <Vacio>No hay productos con esos filtros. Probá con otra búsqueda.</Vacio>}
        {paginas > 1 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-stone-200 text-xs text-stone-500">
            <span>Página {p0 + 1} de {paginas}</span>
            <div className="flex gap-1">
              <Boton size="sm" variant="ghost" onClick={() => setPag(Math.max(0, p0 - 1))} disabled={p0 === 0}><ChevronLeft size={14} /></Boton>
              <Boton size="sm" variant="ghost" onClick={() => setPag(Math.min(paginas - 1, p0 + 1))} disabled={p0 >= paginas - 1}><ChevronRight size={14} /></Boton>
            </div>
          </div>
        )}
      </Card>

      <FichaProducto p={productos.find((x) => x.id === abierto)} onClose={() => setAbierto(null)} actualizar={actualizar} ajustes={ajustes} editar={(p) => { setAbierto(null); setAlta(p); }} />

      <ImportarPlanilla resumen={planilla} listas={ajustes.listas || []} onCerrar={() => setPlanilla(null)}
        onAplicar={async () => {
          const { nuevos, cambios } = planilla;
          const num = (v) => { const n = Number(String(v).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "")); return isNaN(n) ? null : n; };
          const preciosDe = (f, base) => {
            const precios = { ...(base || {}) };
            for (const l of (ajustes.listas || [])) {
              const col = `precio_${l.nombre.toLowerCase().replace(/[^a-z0-9]+/gi, "_")}`;
              if (String(f[col] ?? "").trim() === "") continue;
              const v = num(f[col]);
              if (v > 0) precios[l.id] = v; else delete precios[l.id];
            }
            return precios;
          };
          setPlanilla(null);

          /* Una fila de la planilla es un guardado en la base: van todas
             juntas, pero cada una responde por su cuenta y una que falle no
             se lleva puestas a las demás. El stock queda afuera a propósito:
             no se pisa, se mueve con un ajuste de inventario. */
          await Promise.all(cambios.map(({ p, datos: f }) => {
            const tomar = (col, actual) => (String(f[col] ?? "").trim() === "" ? actual : (num(f[col]) ?? actual));
            return actualizarProducto(p.id, {
              nombre: String(f.nombre || "").trim() || p.nombre,
              costo: tomar("costo", p.costo),
              precio: tomar("precio", p.precio),
              stockMin: tomar("stock_minimo", p.stockMin),
              precios: preciosDe(f, p.precios),
            });
          }));

          for (const n of nuevos) {
            const f = n.datos;
            await agregarProducto({
              nombre: f.nombre, barcode: String(f.codigo || "").replace(/\D/g, ""),
              categoria: f.rubro, marca: f.marca, proveedor: f.proveedor,
              unidad: f.unidad === "kg" ? "kg" : "un", iva: num(f.iva) || 21, bulto: num(f.bulto) || 1,
              stock: num(f.stock) || 0, stockMin: num(f.stock_minimo) || 0,
              costo: num(f.costo) || 0, precio: num(f.precio) || 0, precios: preciosDe(f, {}),
            }, null);
          }
          toast(`Planilla aplicada: ${cambios.length} actualizados, ${nuevos.length} nuevos.`);
        }} />

      <FormProducto abierto={!!alta} inicial={alta} productos={productos} provs={provs} ajustes0={ajustes} onClose={() => setAlta(null)}
        onGuardar={(d, faltan) => {
          if (d.id) {
            actualizarProducto(d.id, {
              nombre: d.nombre, categoria: d.categoria, marca: d.marca, unidad: d.unidad,
              barcode: String(d.barcode || "").replace(/\D/g, ""),
              costo: Number(d.costo) || 0, precio: Number(d.precio) || 0,
              stockMin: Number(d.stockMin) || 0, bulto: Number(d.bulto) || 1, iva: Number(d.iva) || 21,
              precios: Object.fromEntries(Object.entries(d.precios || {}).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)])),
            }, faltan.length ? `Guardado. Todavía falta ${faltan.join(", ")}.` : "Producto actualizado.");
          } else {
            agregarProducto(d, faltan.length ? `${d.nombre} creado. Falta ${faltan.join(", ")}.` : `${d.nombre} creado.`);
          }
          setAlta(null);
        }} />
    </div>
  );
}

/* Pantalla previa a aplicar una planilla. Se muestra exactamente qué va a
   cambiar antes de tocar el catálogo: una importación a ciegas sobre 900
   productos es irreversible y no hay forma de darse cuenta del error. */
function ImportarPlanilla({ resumen, listas, onAplicar, onCerrar }) {
  if (!resumen) return null;
  const { nuevos, cambios, errores, nombre } = resumen;
  const total = nuevos.length + cambios.length;

  return (
    <Modal open onClose={onCerrar} ancho="max-w-2xl">
      <div className="sticky top-0 bg-white border-b border-stone-200 px-5 py-3.5 flex items-center justify-between">
        <div>
          <h3 className="f-d text-lg">Revisá antes de aplicar</h3>
          <p className="text-xs text-stone-500">{nombre}</p>
        </div>
        <button onClick={onCerrar} className="text-stone-400 hover:text-stone-900"><X size={18} /></button>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[["Se actualizan", cambios.length, "text-amber-700 bg-amber-50 border-amber-200"],
            ["Se crean", nuevos.length, "text-emerald-700 bg-emerald-50 border-emerald-200"],
            ["Con problemas", errores.length, errores.length ? "text-red-700 bg-red-50 border-red-200" : "text-stone-500 bg-stone-50 border-stone-200"]]
            .map(([t, n, cls]) => (
            <div key={t} className={`rounded-xl border p-3 text-center ${cls}`}>
              <div className="f-d text-2xl">{nf.format(n)}</div>
              <div className="text-[10px] uppercase tracking-widest font-bold">{t}</div>
            </div>
          ))}
        </div>

        {errores.length > 0 && (
          <div className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="font-semibold">Estas filas no se van a aplicar:</p>
            <ul className="list-disc ml-5 mt-1 space-y-0.5">{errores.slice(0, 6).map((e, i) => <li key={i}>{e}</li>)}</ul>
            {errores.length > 6 && <p className="mt-1">y {errores.length - 6} más.</p>}
          </div>
        )}

        {cambios.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold mb-2">Qué cambia</div>
            <ul className="border border-stone-200 rounded-xl divide-y divide-stone-100 max-h-64 overflow-auto text-sm">
              {cambios.slice(0, 40).map((c) => (
                <li key={c.fila} className="px-3 py-2">
                  <div className="font-medium truncate">{c.p.nombre}</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                    {c.dif.map((d, i) => (
                      <span key={i} className="f-m text-[11px] text-stone-500">
                        {d.campo}: <span className="line-through text-stone-400">{typeof d.antes === "number" ? nf.format(d.antes) : String(d.antes).slice(0, 22)}</span>
                        {" → "}
                        <span className="text-stone-900">{typeof d.ahora === "number" ? nf.format(d.ahora) : String(d.ahora).slice(0, 22)}</span>
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            {cambios.length > 40 && <p className="text-xs text-stone-400 mt-1">Se muestran los primeros 40 de {cambios.length}.</p>}
          </div>
        )}

        {nuevos.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold mb-2">Productos nuevos</div>
            <ul className="border border-stone-200 rounded-xl divide-y divide-stone-100 max-h-40 overflow-auto text-sm">
              {nuevos.slice(0, 20).map((n) => (
                <li key={n.fila} className="px-3 py-1.5 flex justify-between gap-3">
                  <span className="truncate">{n.datos.nombre}</span>
                  <span className="f-m text-xs text-stone-400 shrink-0">{n.datos.precio ? money(Number(n.datos.precio)) : "sin precio"}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-stone-500">
          Las columnas vacías no se tocan: si borrás el contenido de una celda, ese dato queda como estaba.
          Para quitar el precio de una lista, poné un cero.
        </p>

        <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
          <Boton variant="quiet" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={onAplicar} disabled={total === 0}><Check size={15} /> Aplicar {nf.format(total)} cambios</Boton>
        </div>
      </div>
    </Modal>
  );
}

function FichaProducto({ p, onClose, actualizar, editar, ajustes }) {
  const [precio, setPrecio] = useState("");
  const [costo, setCosto] = useState("");
  useEffect(() => { if (p) { setPrecio(String(p.precio)); setCosto(String(p.costo)); } }, [p && p.id]);
  if (!p) return null;

  const m = (p.precio - p.costo) / p.precio;
  const mAntes = (p.precio - p.costoPrev) / p.precio;
  const subio = p.costo > p.costoPrev * 1.005;
  const precioSug = Math.round(p.costo / (1 - mAntes) / 10) * 10;
  const serie = p.historial.map((h) => ({ label: fdate(h.fecha), costo: h.costo }));

  return (
    <Modal open onClose={onClose} ancho="max-w-2xl">
      <div className="sticky top-0 bg-white border-b border-stone-200 px-5 py-3.5 flex items-start justify-between gap-4">
        <div>
          <h3 className="f-d text-lg leading-tight">{p.nombre}</h3>
          <div className="f-m text-[11px] text-stone-400 mt-0.5">{p.sku} · {p.barcode} · {p.proveedor}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {editar && <Boton size="sm" variant="ghost" onClick={() => editar(p)}>Editar ficha</Boton>}
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900"><X size={18} /></button>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {faltantesProducto(p).length > 0 && (
          <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
            Ficha incompleta. Falta: <strong>{faltantesProducto(p).join(", ")}</strong>.
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[["Costo", money(p.costo)], ["Lista 1", money(p.precio)],
            ["Otras listas", Object.keys(p.precios || {}).length || "—"], ["Margen", pct(m)]].map(([l, v]) => (
            <div key={l} className="bg-stone-50 rounded-xl p-3">
              <div className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">{l}</div>
              <div className="f-m text-lg mt-0.5">{v}</div>
            </div>
          ))}
        </div>

        {subio && (
          <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <TrendingDown size={16} className="text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-amber-900">El costo subió {pct(p.costo / p.costoPrev - 1, 0)} y el precio quedó igual.</p>
                <p className="text-amber-800 mt-1">
                  Ganabas {pct(mAntes)} y ahora ganás {pct(m)}. Con {nf.format(p.u30)} unidades al mes, son{" "}
                  {money((p.costo - p.costoPrev) * p.u30)} menos de ganancia.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <Boton size="sm" onClick={() => actualizar(p.id, { precio: precioSug }, `Precio actualizado a ${money(precioSug)}.`)}>
                    Poner a {money(precioSug)} y recuperar el {pct(mAntes, 0)}
                  </Boton>
                </div>
              </div>
            </div>
          </div>
        )}

        <div>
          <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold mb-2">Historial de costo</div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={serie} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#e7e5e4" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#a8a29e" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#a8a29e" }} tickFormatter={moneyk} axisLine={false} tickLine={false} width={54} />
              <Tooltip formatter={(v) => [money(v), "Costo"]} contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid #e7e5e4" }} />
              <Area type="stepAfter" dataKey="costo" stroke="#f97316" strokeWidth={2} fill="#fed7aa" fillOpacity={0.35} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {(ajustes && ajustes.listas ? ajustes.listas : []).filter((l) => l.activa !== false).length > 0 && (
          <div className="border border-stone-200 rounded-xl p-4">
            <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold mb-2">Precios por lista</div>
            <ul className="divide-y divide-stone-100">
              <li className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">Precio general</div>
                  <div className="text-[11px] text-stone-400">siempre · margen {pct(m, 0)}</div>
                </div>
                <span className="f-m text-sm w-28 text-right">{money(p.precio)}</span>
              </li>
              {ajustes.listas.filter((l) => l.activa !== false).map((l) => {
                const v = (p.precios || {})[l.id] || "";
                const sug = Math.round((p.precio * (1 - (ajustes.desc2 || 10) / 100)) / 10) * 10;
                const mv = Number(v) > 0 ? (Number(v) - p.costo) / Number(v) : null;
                return (
                  <li key={l.id} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{l.nombre}</div>
                      <div className="text-[11px] text-stone-400">
                        desde {l.umbral} u
                        {mv != null && <span className={mv < 0.08 ? " text-red-600" : ""}> · margen {pct(mv, 0)}</span>}
                        {!v && p.precio > 0 && (
                          <button onClick={() => actualizar(p.id, { precios: { ...(p.precios || {}), [l.id]: sug } }, `${l.nombre}: ${money(sug)}`)}
                            className="ml-1 font-semibold text-orange-600 hover:underline">poner {money(sug)}</button>
                        )}
                      </div>
                    </div>
                    <input value={v}
                      onChange={(e) => {
                        const n = Number(e.target.value.replace(/\D/g, ""));
                        const cp = { ...(p.precios || {}) };
                        if (n > 0) cp[l.id] = n; else delete cp[l.id];
                        actualizar(p.id, { precios: cp });
                      }}
                      placeholder="—"
                      className="f-m w-28 text-right border border-stone-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-orange-400" />
                  </li>
                );
              })}
            </ul>
            <p className="text-[11px] text-stone-400 mt-2">Vacío significa que este producto no entra en esa lista.</p>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div className="border border-stone-200 rounded-xl p-4">
            <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold mb-2">Costo y precio general</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[11px] text-stone-500">Costo</span>
                <input value={costo} onChange={(e) => setCosto(e.target.value.replace(/\D/g, ""))}
                  className="f-m w-full text-right border border-stone-200 rounded-lg px-3 py-2 text-sm mt-0.5 outline-none focus:border-orange-400" />
              </label>
              <label className="block">
                <span className="text-[11px] text-stone-500">Precio</span>
                <input value={precio} onChange={(e) => setPrecio(e.target.value.replace(/\D/g, ""))}
                  className="f-m w-full text-right border border-stone-200 rounded-lg px-3 py-2 text-sm mt-0.5 outline-none focus:border-orange-400" />
              </label>
            </div>
            <p className="text-xs text-stone-500 mt-2">
              Margen resultante: <strong>{pct(((Number(precio) || p.precio) - (Number(costo) || p.costo)) / (Number(precio) || p.precio))}</strong>
              {Number(costo) > 0 && Number(costo) !== p.costo && (
                <span className="block text-amber-700 mt-1">
                  El costo pasa de {money(p.costo)} a {money(Number(costo))}: queda registrado en el historial.
                </span>
              )}
            </p>
            <Boton size="sm" className="w-full mt-2" onClick={() => actualizar(p.id, {
              precio: Number(precio) || p.precio,
              costo: Number(costo) || p.costo,
            }, "Costo y precio actualizados.")}>Guardar</Boton>
          </div>
          <div className="border border-stone-200 rounded-xl p-4">
            <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold mb-2">Movimiento</div>
            <ul className="text-sm text-stone-600 space-y-1">
              <li className="flex justify-between"><span>Vendidas 30 días</span><span className="f-m">{nf.format(p.u30)}</span></li>
              <li className="flex justify-between"><span>Mes anterior</span><span className="f-m">{nf.format(p.u30p)}</span></li>
              <li className="flex justify-between"><span>Última venta</span><span className="f-m">{diasDesde(p.ultimaVenta) === 0 ? "hoy" : `hace ${diasDesde(p.ultimaVenta)} d`}</span></li>
              <li className="flex justify-between"><span>Compra por bulto</span><span className="f-m">{p.bulto} u</span></li>
              {p.vence && <li className="flex justify-between"><span>Vence</span><span className={`f-m ${diasHasta(p.vence) <= 7 ? "text-red-600" : ""}`}>{fdatel(p.vence)}</span></li>}
            </ul>
          </div>
        </div>
      </div>
    </Modal>
  );
}
