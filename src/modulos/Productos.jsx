/* ============================================================
   7. PRODUCTOS
   ============================================================ */

import React, { useState, useMemo, useRef, useEffect } from "react";
import { Search, Plus, X, Check, Loader2, Upload, Percent, ChevronLeft, ChevronRight, TrendingDown, Barcode, Trash2, ChefHat, Ban } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { fdate, fdatel } from "../datos/generador.js";
import { money, moneyk, pct, nf, faltantesProducto, diasDesde, diasHasta, formatoCantidad, unidadDesdeTexto, nombreUnidad } from "../utils/helpers.js";
import { useScanHandler, beep, Card, Vacio, Boton, Modal, Tabs, TablaSimple } from "../ui/Base.jsx";
import { NumeroDiferido, TextoDiferido, Campo, inputCls } from "../ui/Campos.jsx";
import { leerPlanilla, analizarPlanilla, exportarCatalogo, FormProducto } from "./Vender.jsx";
import { cargarRecetas, cargarReceta, guardarReceta, producirLote } from "../datos/recetas.js";
import { usoDelProducto } from "../datos/items.js";
import { Etiquetas } from "./Etiquetas.jsx";
import { EtiquetasGondola } from "./EtiquetasGondola.jsx";

export function Productos({ productos, actualizarProducto, agregarProducto, borrarProducto, toast, focoInicial, provs, ajustes, empresaId }) {
  const [alta, setAlta] = useState(null);
  /* Catálogo o códigos de barras: una pestaña y no una ventana, para que
     los códigos generados queden a la vista cuando se los quiera buscar. */
  const [pestana, setPestana] = useState("catalogo");
  const [captura, setCaptura] = useState(false);
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
  const margenMinimo = (ajustes?.margenMinimo ?? 15) / 100;

  /* LA GRILLA DE PRECIOS ES UN BORRADOR, NO UNA EDICIÓN EN VIVO

     Antes cada celda escribía en la base al salir del campo. Para corregir
     un precio suelto está bien, pero actualizar una lista entera así son
     doscientas escrituras sueltas y —lo que importa— un número mal tipeado
     queda publicado antes de que nadie lo mire. Acá los cambios se juntan
     y recién se aplican al confirmar, que es como se actualiza una lista de
     precios: se arma, se revisa, se publica.

     Guardado por producto y no por celda: tocar el costo y dos listas del
     mismo artículo es una sola escritura y no tres. */
  const [borrador, setBorrador] = useState({});
  const [guardando, setGuardando] = useState(false);

  const anotar = (pid, parcial) =>
    setBorrador((b) => ({ ...b, [pid]: { ...(b[pid] || {}), ...parcial } }));

  /* Lo que se ve en una celda: el borrador si esa celda se tocó, y si no
     el valor de la base. `??` y no `||` porque poner 0 es un cambio
     válido —un precio que se borra— y `||` lo confundiría con "sin tocar". */
  const enBorrador = (p, campo) => (borrador[p.id] && borrador[p.id][campo] !== undefined ? borrador[p.id][campo] : p[campo]);

  const cuantosCambios = Object.values(borrador).reduce((s, c) => s + Object.keys(c).length, 0);

  const descartar = () => setBorrador({});

  /* PRECIOS SUGERIDOS POR MARKUP

     Markup y margen no son lo mismo y confundirlos cuesta plata: un markup
     del 60% deja un margen del 37,5%, no del 60%. Acá se pide markup
     —`precio = costo × (1 + markup)`— porque es como se habla con el
     proveedor y como se piensa la lista, y debajo de cada precio se
     muestran los dos para que nadie tenga que hacer la cuenta de cabeza.

     Sugiere sobre el borrador y no sobre la base: lo que sale de acá se
     mira, se corrige lo que haga falta y recién después se guarda. Por eso
     puede alcanzar a toda la lista filtrada sin que sea peligroso. */
  const [markup, setMarkup] = useState("");
  const [destinoMarkup, setDestinoMarkup] = useState("precio");

  const listasActivas = (ajustes.listas || []).filter((l) => l.activa !== false);

  const sugerirPorMarkup = () => {
    const m = Number(markup);
    if (!(m > 0)) return toast("Poné un markup mayor que cero.", "mal");

    const nuevos = {};
    let alcanzados = 0, sinCosto = 0;

    for (const p of lista) {
      /* Contra el costo del borrador: si se acaba de cargar un costo nuevo
         sin guardar todavía, el sugerido tiene que salir de ese. */
      const costo = Number(enBorrador(p, "costo")) || 0;
      if (!costo) { sinCosto++; continue; }
      /* Redondeo a 10, como el resto del sistema: un precio de $4.237 en
         una góndola no existe. */
      const sug = Math.round((costo * (1 + m / 100)) / 10) * 10;
      const yaEnBorrador = borrador[p.id] || {};

      if (destinoMarkup === "precio") {
        if ((Number(enBorrador(p, "precio")) || 0) === sug) continue;
        nuevos[p.id] = { ...yaEnBorrador, precio: sug };
      } else {
        const precios = { ...(enBorrador(p, "precios") || {}) };
        if ((Number(precios[destinoMarkup]) || 0) === sug) continue;
        precios[destinoMarkup] = sug;
        nuevos[p.id] = { ...yaEnBorrador, precios };
      }
      alcanzados++;
    }

    setBorrador((b) => ({ ...b, ...nuevos }));

    if (!alcanzados) {
      return toast(sinCosto ? `Ninguno cambió: ${sinCosto} no tienen costo cargado.` : "Ya estaban todos a ese markup.", "mal");
    }
    const cola = sinCosto ? ` · ${sinCosto} sin costo quedaron afuera` : "";
    toast(`${alcanzados} ${alcanzados === 1 ? "precio sugerido" : "precios sugeridos"}. Revisalos y guardá.${cola}`);
  };

  const guardarBorrador = async () => {
    const pendientes = Object.entries(borrador);
    if (!pendientes.length) return;
    setGuardando(true);
    let hechos = 0;
    try {
      for (const [pid, cambios] of pendientes) {
        /* `propagar` para que un fallo corte el lote y llegue al catch:
           sin eso `actualizarProducto` se traga el error, avisa por su
           cuenta y este contador diría que se guardó todo. */
        await actualizarProducto(pid, cambios, null, { propagar: true });
        /* Se saca del borrador recién cuando la base lo confirmó, uno por
           uno: si el lote se corta en el cuarenta, los diez que faltan
           siguen cargados y se reintenta con el mismo botón. */
        setBorrador((b) => { const { [pid]: _, ...resto } = b; return resto; });
        hechos++;
      }
      toast(`${hechos} ${hechos === 1 ? "producto actualizado" : "productos actualizados"}.`, "bien");
    } catch (e) {
      toast(`Se guardaron ${hechos} de ${pendientes.length}. ${e.message || "Falló la conexión."}`, "mal");
    } finally {
      setGuardando(false);
    }
  };

  /* Salir del modo con cambios sin guardar los perdería en silencio. */
  const alternarModoPrecios = () => {
    if (modoPrecios && cuantosCambios > 0) {
      toast("Tenés cambios sin guardar. Guardalos o descartalos antes de salir.", "mal");
      return;
    }
    setModoPrecios((v) => !v);
  };

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
    if (filtro === "flaco") l = l.filter((p) => (p.precio - p.costo) / p.precio < margenMinimo && p.u30 >= 4);
    if (filtro === "incompletos") l = l.filter((p) => faltantesProducto(p).length);
    /* Los que entraron con pistola: el alta les pone el código como nombre
       provisorio, así que el nombre igual al código es exactamente "todavía
       nadie le puso nombre".

       Hace falta un filtro propio porque "Incompletos" no los distingue: un
       catálogo importado de una planilla sin costos ya cae entero ahí, y los
       treinta recién escaneados quedarían perdidos entre doscientos. */
    if (filtro === "sinNombre") l = l.filter((p) => p.barcode && p.nombre === p.barcode);
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
  }, [productos, cat, q, orden, filtro, margenMinimo]);

  const porPagina = 40;
  const paginas = Math.max(1, Math.ceil(lista.length / porPagina));
  const p0 = Math.min(pag, paginas - 1);
  const visibles = lista.slice(p0 * porPagina, p0 * porPagina + porPagina);
  useEffect(() => setPag(0), [q, cat, orden, filtro]);

  /* El historial de costos ya no se arma acá: lo escribe un disparador de la
     base cuando ve el cambio, así ninguna pantalla se puede olvidar de él. */
  const actualizar = actualizarProducto;

  const pestanas = (
    <Tabs value={pestana} onChange={setPestana}
      items={[{ k: "catalogo", n: "Catálogo" }, { k: "codigos", n: "Códigos de barras" }, { k: "gondola", n: "Etiquetas de góndola" }]} />
  );

  if (pestana === "gondola") {
    return (
      <div className="space-y-4">
        {pestanas}
        <EtiquetasGondola productos={productos} empresaId={empresaId} ajustes={ajustes} toast={toast} />
      </div>
    );
  }

  if (pestana === "codigos") {
    return (
      <div className="space-y-4">
        {pestanas}
        <Etiquetas productos={productos} empresaId={empresaId} ajustes={ajustes} toast={toast} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pestanas}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-tenue" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, SKU o código"
            className="w-full pl-9 pr-3 py-2 text-sm border border-borde rounded-xl outline-none focus:border-acento bg-superficie" />
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="text-sm border border-borde rounded-xl px-3 py-2 bg-superficie outline-none focus:border-acento">
          {cats.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={orden} onChange={(e) => setOrden(e.target.value)} className="text-sm border border-borde rounded-xl px-3 py-2 bg-superficie outline-none focus:border-acento">
          <option value="nombre">Orden alfabético</option>
          <option value="venta">Más vendidos</option>
          <option value="margen">Menor margen</option>
          <option value="stock">Menos cobertura</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[["todos", "Todos"], ["sinNombre", "Sin nombre"], ["margen", "Subieron de costo"], ["flaco", "Margen bajo"], ["incompletos", "Incompletos"]].map(([k, n]) => (
          <button key={k} onClick={() => setFiltro(k)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${filtro === k ? "bg-superficie-3 text-texto border-superficie-3" : "bg-superficie border-borde text-texto-suave hover:bg-superficie-2"}`}>{n}</button>
        ))}
        <span className="text-xs text-texto-tenue self-center ml-1">{nf.format(lista.length)} productos</span>
        {modoPrecios && (
          <span className="text-xs text-texto-suave basis-full sm:basis-auto">
            Nombre, rubro, costo y precios: editá lo que haga falta y guardá al final. Debajo de cada precio: <b>mg</b> margen, <b>mk</b> markup.
          </span>
        )}
        <Boton size="sm" variant={modoPrecios ? "dark" : "ghost"} onClick={alternarModoPrecios}>
          <Percent size={14} /> <span className="hidden sm:inline">{modoPrecios ? "Salir de la tabla" : "Editar en tabla"}</span>
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
          <Boton size="sm" variant="ghost" onClick={() => setCaptura(true)}>
            <Barcode size={14} /> <span className="hidden sm:inline">Captura con pistola</span><span className="sm:hidden">Pistola</span>
          </Boton>
          <Boton size="sm" variant="ghost" onClick={() => setPestana("codigos")}>
            <Barcode size={14} /> <span className="hidden sm:inline">Etiquetas</span>
          </Boton>
          <Boton size="sm" onClick={() => setAlta({})}><Plus size={14} /> <span className="hidden sm:inline">Nuevo producto</span><span className="sm:hidden">Nuevo</span></Boton>
        </div>
      </div>

      <Card className="overflow-hidden">
        {/* Siete columnas no entran en un celular: mismos datos, otra forma */}
        <ul className={`${modoPrecios ? "hidden" : "md:hidden"} divide-y divide-borde`}>
          {visibles.map((p) => {
            const m = p.precio ? (p.precio - p.costo) / p.precio : 0;
            const cob = p.vel > 0 ? p.stock / p.vel : 99;
            const faltan = faltantesProducto(p);
            return (
              <li key={p.id}>
                <button onClick={() => setAbierto(p.id)} className="w-full text-left px-3 py-2.5 active:bg-acento-suave/60">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-texto leading-snug">{p.nombre}</div>
                      <div className="f-m text-[11px] text-texto-tenue">{p.categoria}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="f-m text-sm font-semibold">{p.precio ? money(p.precio) : <span className="text-ojo text-xs">sin precio</span>}</div>
                      {Object.keys(p.precios || {}).length > 0 && (
                        <div className="text-[10px] text-bien">{Object.keys(p.precios).length} lista{Object.keys(p.precios).length > 1 ? "s" : ""} más</div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px]">
                    <span className="f-m text-texto-suave">Stock <span className={cob < 4 ? "text-mal font-semibold" : "text-texto"}>{formatoCantidad(p.unidad, p.stock)}</span></span>
                    <span className="f-m text-texto-suave">Costo {money(p.costo)}</span>
                    {p.precio > 0 && <span className={`f-m ${m < 0.14 ? "text-mal" : m < 0.22 ? "text-ojo" : "text-bien"}`}>{pct(m, 0)}</span>}
                    <span className="f-m text-texto-tenue">{nf.format(p.u30)} u/mes</span>
                    {faltan.length > 0 && <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border bg-ojo-suave text-ojo border-ojo">incompleta</span>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        {modoPrecios ? (
          <>
          {/* Los rubros que ya existen, para que el de un producto nuevo se
              elija en vez de escribirse: así no terminan conviviendo
              "Limpieza", "limpieza" y "LIMPIEZA" como tres rubros. */}
          <datalist id="rubros-de-la-grilla">
            {cats.filter((c) => c && c !== "Todas").map((c) => <option key={c} value={c} />)}
          </datalist>

          {/* Arriba de la tabla y no en la barra de filtros: es una acción
              sobre lo que se está viendo, y tiene que leerse junto a ello. */}
          <div className="flex flex-wrap items-center gap-2 border-b border-borde bg-superficie-2 px-4 py-2.5">
            <span className="text-xs uppercase tracking-widest text-texto-tenue font-bold">Sugerir por markup</span>
            <div className="flex items-center gap-1">
              <input value={markup} onChange={(e) => setMarkup(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="60" inputMode="numeric"
                onKeyDown={(e) => { if (e.key === "Enter") sugerirPorMarkup(); }}
                className="f-m w-16 text-right border border-borde rounded-lg px-2 py-1 text-sm outline-none focus:border-acento bg-superficie" />
              <span className="text-sm text-texto-suave">%</span>
            </div>
            <span className="text-sm text-texto-suave">sobre el costo, a</span>
            <select value={destinoMarkup} onChange={(e) => setDestinoMarkup(e.target.value)}
              className="text-sm border border-borde rounded-lg px-2 py-1 bg-superficie outline-none focus:border-acento">
              <option value="precio">Precio general</option>
              {listasActivas.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
            <Boton size="sm" variant="ghost" onClick={sugerirPorMarkup}>
              Aplicar a {nf.format(lista.length)}
            </Boton>
            {Number(markup) > 0 && (
              /* El margen que deja ese markup, dicho en el momento: es la
                 cuenta que nadie hace y la que después duele. */
              <span className="text-xs text-texto-tenue">
                deja {pct(Number(markup) / (100 + Number(markup)), 1)} de margen
              </span>
            )}

            {/* Pegada a la grilla y no en la barra de filtros de arriba: los
                rótulos `mg` y `mk` se leen acá abajo, y una aclaración que
                hay que ir a buscar a otra parte de la pantalla no aclara. */}
            <span className="ml-auto text-[11px] text-texto-tenue">
              <b className="text-texto-suave">mg</b> margen = ganancia ÷ precio
              <span className="mx-1.5">·</span>
              <b className="text-texto-suave">mk</b> markup = ganancia ÷ costo
            </span>
          </div>
          <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
            <table className="w-full text-sm min-w-[790px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-texto-tenue border-b border-borde bg-superficie-2">
                  <th className="px-4 py-2.5 font-semibold">Producto</th>
                  <th className="px-2 py-2.5 font-semibold text-right w-24">Costo</th>
                  <th className="px-2 py-2.5 font-semibold text-right w-24">
                    Markup
                    <div className="font-normal normal-case text-[10px] text-texto-tenue">
                      a {destinoMarkup === "precio" ? "general" : (listasActivas.find((l) => l.id === destinoMarkup) || {}).nombre}
                    </div>
                  </th>
                  <th className="px-2 py-2.5 font-semibold text-right w-32">General</th>
                  {(ajustes.listas || []).filter((l) => l.activa !== false).map((l) => (
                    <th key={l.id} className="px-2 py-2.5 font-semibold text-right w-32">
                      {l.nombre}<div className="font-normal normal-case text-[10px] text-texto-tenue">desde {l.umbral} u</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {visibles.map((p) => {
                  /* El margen se calcula contra el costo del borrador, no
                     contra el de la base: si se está subiendo el costo, el
                     margen tiene que moverse mientras se escribe. */
                  const costoAhora = Number(enBorrador(p, "costo")) || 0;
                  const mg = (v) => (Number(v) > 0 ? (Number(v) - costoAhora) / Number(v) : null);
                  const tocado = (campo) => borrador[p.id] && borrador[p.id][campo] !== undefined;

                  /* LA COLUMNA DE MARKUP VA EN LAS DOS DIRECCIONES

                     Muestra a qué markup está hoy el precio de destino, y si
                     se escribe otro recalcula ese precio. Sirve para leer y
                     para fijar con el mismo campo, que es lo que hace el ojo
                     cuando recorre una lista: ve a cuánto está cada cosa y
                     corrige la que se fue de línea.

                     El destino es el mismo que elige la barra de arriba, así
                     el markup de a uno y el de a muchos no significan cosas
                     distintas en la misma pantalla. */
                  const precioDestino = destinoMarkup === "precio"
                    ? Number(enBorrador(p, "precio")) || 0
                    : Number((enBorrador(p, "precios") || {})[destinoMarkup]) || 0;

                  const markupActual = costoAhora > 0 && precioDestino > 0
                    ? Math.round(((precioDestino - costoAhora) / costoAhora) * 100)
                    : "";

                  const aplicarMarkupFila = (mk) => {
                    if (!(costoAhora > 0)) return toast(`${p.nombre}: cargá el costo primero, sin costo no hay markup.`, "mal");
                    /* Redondeo a 10 como el resto del sistema. Eso hace que
                       el markup que vuelve a mostrarse pueda diferir en un
                       punto del que se escribió: manda el precio redondo,
                       no el porcentaje exacto. */
                    const sug = Math.round((costoAhora * (1 + mk / 100)) / 10) * 10;
                    if (destinoMarkup === "precio") return anotar(p.id, { precio: sug });
                    const precios = { ...(enBorrador(p, "precios") || {}) };
                    precios[destinoMarkup] = sug;
                    anotar(p.id, { precios });
                  };

                  const celda = (valor, cambiado, alAnotar) => {
                    const m2 = mg(valor);
                    const flojo = m2 != null && m2 < margenMinimo;
                    return (
                      <td className={`px-2 py-1.5 text-right ${cambiado ? "bg-acento-suave/40" : ""}`}>
                        <NumeroDiferido valor={valor} onGuardar={alAnotar} placeholder="—"
                          className={`f-m w-24 text-right border rounded-lg px-2 py-1 text-sm outline-none focus:border-acento ${
                            flojo ? "border-mal bg-mal-suave" : cambiado ? "border-acento" : "border-borde"}`} />
                        {/* Los dos, y rotulados. El margen solo se prestaba a
                            leerse como markup, que es el error que hace
                            vender pensando que se gana casi el doble. */}
                        {m2 != null && (costoAhora > 0 ? (
                          <div className={`text-[10px] ${flojo ? "text-mal" : "text-texto-tenue"}`}
                            title={`Ganancia ${money(Number(valor) - costoAhora)}\nmargen = ganancia ÷ precio (${money(Number(valor))})\nmarkup = ganancia ÷ costo (${money(costoAhora)})`}>
                            mg {pct(m2, 0)} · mk {pct((Number(valor) - costoAhora) / costoAhora, 0)}
                          </div>
                        ) : (
                          /* Sin costo el margen da 100% y es mentira: no se
                             gana todo, no se sabe cuánto se gana. Decirlo
                             así manda a cargar el costo, que es lo que
                             falta; "mg 100%" manda a no hacer nada. */
                          <div className="text-[10px] text-texto-tenue">sin costo</div>
                        ))}
                      </td>
                    );
                  };
                  return (
                    <tr key={p.id} className="hover:bg-superficie-2">
                      <td className="px-4 py-1.5">
                        {/* Editables acá y no solo en la ficha: los que
                            entran con pistola vienen con el código como
                            nombre, y completarlos de a uno abriendo un
                            formulario es lo que la pistola vino a evitar. */}
                        <TextoDiferido valor={enBorrador(p, "nombre")} onGuardar={(t) => t && anotar(p.id, { nombre: t })}
                          placeholder="Sin nombre"
                          className={`w-full font-medium text-texto bg-transparent border rounded-lg px-2 py-1 text-sm outline-none focus:border-acento ${
                            tocado("nombre") ? "border-acento bg-acento-suave/40" : "border-transparent hover:border-borde"}`} />
                        <TextoDiferido valor={enBorrador(p, "categoria")} onGuardar={(t) => anotar(p.id, { categoria: t })}
                          placeholder="Sin rubro" lista="rubros-de-la-grilla"
                          className={`w-full f-m text-[11px] text-texto-tenue bg-transparent border rounded-lg px-2 py-0.5 mt-0.5 outline-none focus:border-acento ${
                            tocado("categoria") ? "border-acento bg-acento-suave/40" : "border-transparent hover:border-borde"}`} />
                      </td>
                      <td className={`px-2 py-1.5 text-right ${tocado("costo") ? "bg-acento-suave/40" : ""}`}>
                        <NumeroDiferido valor={enBorrador(p, "costo")} onGuardar={(n) => anotar(p.id, { costo: n })}
                          className={`f-m w-24 text-right border rounded-lg px-2 py-1 text-sm outline-none focus:border-acento bg-superficie-2 ${
                            tocado("costo") ? "border-acento" : "border-borde"}`} />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <NumeroDiferido valor={markupActual} onGuardar={aplicarMarkupFila}
                          placeholder={costoAhora > 0 ? "%" : "—"}
                          className={`f-m w-20 text-right border border-borde rounded-lg px-2 py-1 text-sm outline-none focus:border-acento ${
                            costoAhora > 0 ? "" : "opacity-40"}`} />
                      </td>
                      {celda(enBorrador(p, "precio"), tocado("precio"), (n) => anotar(p.id, { precio: n }))}
                      {(ajustes.listas || []).filter((l) => l.activa !== false).map((l) => {
                        const precios = enBorrador(p, "precios") || {};
                        /* Por lista y no por producto: si se cambió la lista
                           mayorista, resaltar también la minorista diría que
                           se tocó algo que quedó igual. */
                        const cambiadaEsta = (Number(precios[l.id]) || 0) !== (Number((p.precios || {})[l.id]) || 0);
                        return (
                          <React.Fragment key={l.id}>
                            {celda(precios[l.id], cambiadaEsta, (n) => {
                              const cp = { ...precios };
                              if (n > 0) cp[l.id] = n; else delete cp[l.id];
                              anotar(p.id, { precios: cp });
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(ajustes.listas || []).filter((l) => l.activa !== false).length === 0 && (
              <Vacio>No hay listas creadas. Creá una en Ajustes para poder cargarle precios.</Vacio>
            )}
          </div>

          {/* Pegada abajo y fuera del scroll horizontal: con doscientos
              productos el Guardar tiene que estar a la vista sin volver
              arriba, y no tiene que correrse al mover la tabla de costado. */}
          {cuantosCambios > 0 && (
            <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-borde bg-superficie px-4 py-3">
              <span className="text-sm">
                <span className="f-m font-semibold">{cuantosCambios}</span>
                {cuantosCambios === 1 ? " cambio sin guardar" : " cambios sin guardar"}
                <span className="text-texto-tenue">
                  {" en "}{nf.format(Object.keys(borrador).length)}
                  {Object.keys(borrador).length === 1 ? " producto" : " productos"}
                </span>
              </span>
              <div className="ml-auto flex items-center gap-2">
                <Boton size="sm" variant="ghost" onClick={descartar} disabled={guardando}>Descartar</Boton>
                <Boton size="sm" onClick={guardarBorrador} disabled={guardando}>
                  {guardando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {guardando ? "Guardando…" : "Guardar cambios"}
                </Boton>
              </div>
            </div>
          )}
          </>
        ) : (
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-texto-tenue border-b border-borde bg-superficie-2">
                <th className="px-4 py-2.5 font-semibold">Producto</th>
                <th className="px-2 py-2.5 font-semibold">Categoría</th>
                <th className="px-2 py-2.5 font-semibold text-right">Stock</th>
                <th className="px-2 py-2.5 font-semibold text-right">Costo</th>
                <th className="px-2 py-2.5 font-semibold text-right">Precio</th>
                <th className="px-2 py-2.5 font-semibold text-right">Margen</th>
                <th className="px-4 py-2.5 font-semibold text-right">30 días</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {visibles.map((p) => {
                const m = (p.precio - p.costo) / p.precio;
                const cob = p.vel > 0 ? p.stock / p.vel : 99;
                const subio = p.costo > p.costoPrev * 1.005;
                return (
                  <tr key={p.id} onClick={() => setAbierto(p.id)} className="hover:bg-acento-suave/50 cursor-pointer">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-texto flex items-center gap-1.5">
                        {p.nombre}
                        {faltantesProducto(p).length > 0 && (
                          <span title={`Falta: ${faltantesProducto(p).join(", ")}`}
                            className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border bg-ojo-suave text-ojo border-ojo">incompleta</span>
                        )}
                      </div>
                      <div className="f-m text-[11px] text-texto-tenue">{p.sku} · {p.barcode || "sin código"}</div>
                    </td>
                    <td className="px-2 py-2.5 text-texto-suave text-xs">{p.categoria}</td>
                    <td className="px-2 py-2.5 text-right f-m">
                      <span className={cob < 4 ? "text-mal font-semibold" : cob < 8 ? "text-ojo" : "text-texto"}>
                        {formatoCantidad(p.unidad, p.stock)}
                      </span>
                      <div className="text-[10px] text-texto-tenue">{cob > 90 ? "+90 d" : `${Math.round(cob)} d`}</div>
                    </td>
                    <td className="px-2 py-2.5 text-right f-m text-texto-suave">
                      {money(p.costo)}
                      {subio && <div className="text-[10px] text-mal">+{pct(p.costo / p.costoPrev - 1, 0)}</div>}
                    </td>
                    <td className="px-2 py-2.5 text-right f-m font-semibold">
                      {money(p.precio)}
                      {Object.entries(p.precios || {}).slice(0, 2).map(([k, v]) => (
                        <div key={k} className="text-[10px] text-bien font-normal">{money(v)}</div>
                      ))}
                    </td>
                    <td className="px-2 py-2.5 text-right f-m">
                      <span className={m < 0.14 ? "text-mal" : m < 0.22 ? "text-ojo" : "text-bien"}>{pct(m, 0)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right f-m text-texto-suave">{nf.format(p.u30)} <span className="text-[10px] text-texto-tenue">u</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
        {lista.length === 0 && <Vacio>No hay productos con esos filtros. Probá con otra búsqueda.</Vacio>}
        {paginas > 1 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-borde text-xs text-texto-suave">
            <span>Página {p0 + 1} de {paginas}</span>
            <div className="flex gap-1">
              <Boton size="sm" variant="ghost" onClick={() => setPag(Math.max(0, p0 - 1))} disabled={p0 === 0}><ChevronLeft size={14} /></Boton>
              <Boton size="sm" variant="ghost" onClick={() => setPag(Math.min(paginas - 1, p0 + 1))} disabled={p0 >= paginas - 1}><ChevronRight size={14} /></Boton>
            </div>
          </div>
        )}
      </Card>

      <FichaProducto p={productos.find((x) => x.id === abierto)} onClose={() => setAbierto(null)} actualizar={actualizar} ajustes={ajustes} editar={(p) => { setAbierto(null); setAlta(p); }} productos={productos} empresaId={empresaId} toast={toast} borrar={borrarProducto} />

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
              unidad: unidadDesdeTexto(f.unidad), iva: num(f.iva) || 21, bulto: num(f.bulto) || 1,
              stock: num(f.stock) || 0, stockMin: num(f.stock_minimo) || 0,
              costo: num(f.costo) || 0, precio: num(f.precio) || 0, precios: preciosDe(f, {}),
            }, null);
          }
          toast(`Planilla aplicada: ${cambios.length} actualizados, ${nuevos.length} nuevos.`);
        }} />

      <CapturaConPistola abierto={captura} productos={productos} onCrear={agregarProducto}
        onClose={() => {
          setCaptura(false);
          /* Se sale mirando lo que falta completar: es el paso siguiente y
             el único motivo por el que se escaneó. */
          setFiltro("sinNombre"); setQ(""); setCat("Todas");
          /* Y en la tabla, que es donde se completan de a muchos. */
          setModoPrecios(true);
        }} />

      <FormProducto abierto={!!alta} inicial={alta} productos={productos} provs={provs} ajustes0={ajustes} onClose={() => setAlta(null)}
        onGuardar={(d, faltan) => {
          if (d.id) {
            /* Los campos se enumeran uno por uno a propósito —el formulario
               trae cosas calculadas que no son columnas—, así que un campo
               nuevo hay que sumarlo también acá o se guarda en silencio
               todo menos ese. */
            actualizarProducto(d.id, {
              nombre: d.nombre, categoria: d.categoria, marca: d.marca, unidad: d.unidad,
              barcode: String(d.barcode || "").replace(/\D/g, ""),
              costo: Number(d.costo) || 0, precio: Number(d.precio) || 0,
              stockMin: Number(d.stockMin) || 0, bulto: Number(d.bulto) || 1, iva: Number(d.iva) || 21,
              descripcion: d.descripcion || null, imagen: d.imagen || null,
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
      <div className="sticky top-0 bg-superficie border-b border-borde px-5 py-3.5 flex items-center justify-between">
        <div>
          <h3 className="f-d text-lg">Revisá antes de aplicar</h3>
          <p className="text-xs text-texto-suave">{nombre}</p>
        </div>
        <button onClick={onCerrar} className="text-texto-tenue hover:text-texto"><X size={18} /></button>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[["Se actualizan", cambios.length, "text-ojo bg-ojo-suave border-ojo"],
            ["Se crean", nuevos.length, "text-bien bg-bien-suave border-bien"],
            ["Con problemas", errores.length, errores.length ? "text-mal bg-mal-suave border-mal" : "text-texto-suave bg-superficie-2 border-borde"]]
            .map(([t, n, cls]) => (
            <div key={t} className={`rounded-xl border p-3 text-center ${cls}`}>
              <div className="f-d text-2xl">{nf.format(n)}</div>
              <div className="text-[10px] uppercase tracking-widest font-bold">{t}</div>
            </div>
          ))}
        </div>

        {errores.length > 0 && (
          <div className="text-sm text-red-800 bg-mal-suave border border-mal rounded-xl p-3">
            <p className="font-semibold">Estas filas no se van a aplicar:</p>
            <ul className="list-disc ml-5 mt-1 space-y-0.5">{errores.slice(0, 6).map((e, i) => <li key={i}>{e}</li>)}</ul>
            {errores.length > 6 && <p className="mt-1">y {errores.length - 6} más.</p>}
          </div>
        )}

        {cambios.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold mb-2">Qué cambia</div>
            <ul className="border border-borde rounded-xl divide-y divide-borde max-h-64 overflow-auto text-sm">
              {cambios.slice(0, 40).map((c) => (
                <li key={c.fila} className="px-3 py-2">
                  <div className="font-medium truncate">{c.p.nombre}</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                    {c.dif.map((d, i) => (
                      <span key={i} className="f-m text-[11px] text-texto-suave">
                        {d.campo}: <span className="line-through text-texto-tenue">{typeof d.antes === "number" ? nf.format(d.antes) : String(d.antes).slice(0, 22)}</span>
                        {" → "}
                        <span className="text-texto">{typeof d.ahora === "number" ? nf.format(d.ahora) : String(d.ahora).slice(0, 22)}</span>
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            {cambios.length > 40 && <p className="text-xs text-texto-tenue mt-1">Se muestran los primeros 40 de {cambios.length}.</p>}
          </div>
        )}

        {nuevos.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold mb-2">Productos nuevos</div>
            <ul className="border border-borde rounded-xl divide-y divide-borde max-h-40 overflow-auto text-sm">
              {nuevos.slice(0, 20).map((n) => (
                <li key={n.fila} className="px-3 py-1.5 flex justify-between gap-3">
                  <span className="truncate">{n.datos.nombre}</span>
                  <span className="f-m text-xs text-texto-tenue shrink-0">{n.datos.precio ? money(Number(n.datos.precio)) : "sin precio"}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-texto-suave">
          Las columnas vacías no se tocan: si borrás el contenido de una celda, ese dato queda como estaba.
          Para quitar el precio de una lista, poné un cero.
        </p>

        <div className="flex justify-end gap-2 pt-3 border-t border-borde">
          <Boton variant="quiet" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={onAplicar} disabled={total === 0}><Check size={15} /> Aplicar {nf.format(total)} cambios</Boton>
        </div>
      </div>
    </Modal>
  );
}

function FichaProducto({ p, onClose, actualizar, editar, ajustes, productos, empresaId, toast, borrar }) {
  const [precio, setPrecio] = useState("");
  const [costo, setCosto] = useState("");
  const [receta, setReceta] = useState(false);

  /* Qué arrastra este producto. Se pregunta al abrir la ficha y no al
     apretar Eliminar: lo que hay que decidir es si conviene eliminarlo o
     darlo de baja, y esa decisión se toma antes de apretar nada. */
  const [uso, setUso] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [borrando, setBorrando] = useState(false);

  /* La ficha está montada siempre, con o sin producto abierto: `p` llega
     undefined la mayor parte del tiempo. Por eso nada de `p.id` antes del
     `if (!p)` de abajo, tampoco en la lista de dependencias, que se
     evalúa al dibujar. Así estuvo y dejó Productos en negro para
     cualquiera que refrescara: la pantalla se rompía al entrar, sin
     haber abierto nada. */
  const pid = p ? p.id : null;
  useEffect(() => {
    if (!pid) return undefined;
    let vigente = true;
    setUso(null); setConfirmando(false);
    usoDelProducto(pid)
      .then((u) => { if (vigente) setUso(u); })
      /* Si no se puede averiguar, no se ofrece eliminar: mejor no dar el
         botón que darlo sin saber qué se lleva puesto. */
      .catch(() => { if (vigente) setUso({ error: true }); });
    return () => { vigente = false; };
  }, [pid]);

  const tieneHistoria = uso && !uso.error && (uso.vendido > 0 || uso.movimientos > 0);
  const enReceta = uso && !uso.error && uso.enRecetas > 0;
  useEffect(() => { if (p) { setPrecio(String(p.precio)); setCosto(String(p.costo)); } }, [p && p.id]);
  if (!p) return null;

  const m = (p.precio - p.costo) / p.precio;
  const mAntes = (p.precio - p.costoPrev) / p.precio;
  const subio = p.costo > p.costoPrev * 1.005;
  const precioSug = Math.round(p.costo / (1 - mAntes) / 10) * 10;
  const serie = p.historial.map((h) => ({ label: fdate(h.fecha), costo: h.costo }));

  return (
    <Modal open onClose={onClose} ancho="max-w-2xl">
      <div className="sticky top-0 bg-superficie border-b border-borde px-5 py-3.5 flex items-start justify-between gap-4">
        <div>
          <h3 className="f-d text-lg leading-tight">{p.nombre}</h3>
          <div className="f-m text-[11px] text-texto-tenue mt-0.5">{p.sku} · {p.barcode} · {p.proveedor}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Boton size="sm" variant="ghost" onClick={() => setReceta(true)}>Receta</Boton>
          {editar && <Boton size="sm" variant="ghost" onClick={() => editar(p)}>Editar ficha</Boton>}
          <button onClick={onClose} className="text-texto-tenue hover:text-texto"><X size={18} /></button>
        </div>
      </div>

      {/* DAR DE BAJA Y ELIMINAR, SEPARADOS

          Un producto que pasó por la caja tiene historia colgando —stock,
          costos, precios— y eliminarlo se la lleva. La baja lo saca del
          mostrador y conserva todo, que es lo que casi siempre se quiere.
          Eliminar queda para el error: lo que se escaneó de más, lo que se
          cargó dos veces.

          Por eso la pantalla dice qué arrastra cada uno antes de que se
          apriete nada, en vez de pedir confirmación después. */}
      <div className="px-5 py-3 border-b border-borde flex flex-wrap items-center gap-2">
        <Boton size="sm" variant="ghost"
          onClick={() => actualizar(p.id, { activo: !p.activo },
            p.activo ? `${p.nombre} dado de baja. Ya no aparece al vender.` : `${p.nombre} volvió al mostrador.`)}>
          {p.activo ? <><Ban size={14} /> Dar de baja</> : <><Check size={14} /> Reactivar</>}
        </Boton>

        {enReceta ? (
          <span className="text-xs text-texto-tenue">
            Es insumo de una receta: para eliminarlo, sacalo de la receta primero.
          </span>
        ) : uso && !uso.error && !confirmando && (
          <Boton size="sm" variant="ghost" onClick={() => setConfirmando(true)}>
            <Trash2 size={14} /> Eliminar
          </Boton>
        )}

        {!p.activo && <span className="text-xs text-texto-tenue">No aparece al vender.</span>}

        {confirmando && (
          <div className="basis-full border border-mal rounded-xl p-3 mt-1">
            <p className="text-sm">
              {tieneHistoria ? (
                <>
                  Se vendió <b className="f-m">{uso.vendido}</b>{uso.vendido === 1 ? " vez" : " veces"} y tiene{" "}
                  <b className="f-m">{uso.movimientos}</b> movimientos de stock. Al eliminarlo se pierden
                  su historial de costos, el de precios y esos movimientos. Las ventas quedan.{" "}
                  <b>Darlo de baja conserva todo</b> y también lo saca del mostrador.
                </>
              ) : (
                <>No tiene ventas ni movimientos de stock. Se elimina sin perder nada.</>
              )}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Boton size="sm" variant="ghost" onClick={() => setConfirmando(false)}>Cancelar</Boton>
              <Boton size="sm" disabled={borrando} onClick={async () => {
                setBorrando(true);
                const ok = await borrar(p.id);
                setBorrando(false);
                if (ok) { toast(`${p.nombre} eliminado.`); onClose(); }
                else setConfirmando(false);
              }}>
                {borrando ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {borrando ? "Eliminando…" : "Eliminar igual"}
              </Boton>
            </div>
          </div>
        )}
      </div>

      {receta && (
        <RecetaModal producto={p} productos={productos} empresaId={empresaId} toast={toast}
          onClose={() => setReceta(false)} />
      )}

      <div className="p-5 space-y-5">
        {faltantesProducto(p).length > 0 && (
          <div className="text-sm text-amber-800 bg-ojo-suave border border-ojo rounded-xl p-3">
            Ficha incompleta. Falta: <strong>{faltantesProducto(p).join(", ")}</strong>.
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[["Costo (PPP)", money(p.costo)],
            ["Costo reposición", money(p.costoReposicion), p.costoReposicion > p.costo ? "text-ojo" : ""],
            ["Lista 1", money(p.precio)],
            ["Otras listas", Object.keys(p.precios || {}).length || "—"],
            ["Margen", pct(m), p.precio < p.costoReposicion ? "text-mal" : ""]].map(([l, v, tono]) => (
            <div key={l} className="bg-superficie-2 rounded-xl p-3">
              <div className="text-[10px] uppercase tracking-widest text-texto-tenue font-semibold">{l}</div>
              <div className={`f-m text-lg mt-0.5 ${tono || ""}`}>{v}</div>
            </div>
          ))}
        </div>

        {p.precio > 0 && p.precio < p.costoReposicion && (
          <div className="border border-mal bg-mal-suave rounded-xl p-4">
            <p className="font-semibold text-mal">
              Vendés por debajo de lo que cuesta reponer este producto hoy.
            </p>
            <p className="text-sm text-mal mt-1">
              Precio {money(p.precio)} contra {money(p.costoReposicion)} de la última compra
              {p.costoReposicionFecha ? ` (${fdate(p.costoReposicionFecha)})` : ""}. Cada unidad vendida deja
              {" " + money(p.precio - p.costoReposicion)} de pérdida si tenés que reponer a ese costo.
            </p>
          </div>
        )}

        {subio && (
          <div className="border border-ojo bg-ojo-suave rounded-xl p-4">
            <div className="flex items-start gap-2">
              <TrendingDown size={16} className="text-ojo mt-0.5 shrink-0" />
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
          <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold mb-2">Historial de costo</div>
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
          <div className="border border-borde rounded-xl p-4">
            <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold mb-2">Precios por lista</div>
            <ul className="divide-y divide-borde">
              <li className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">Precio general</div>
                  <div className="text-[11px] text-texto-tenue">siempre · margen {pct(m, 0)}</div>
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
                      <div className="text-[11px] text-texto-tenue">
                        desde {l.umbral} u
                        {mv != null && <span className={mv < 0.08 ? " text-mal" : ""}> · margen {pct(mv, 0)}</span>}
                        {!v && p.precio > 0 && (
                          <button onClick={() => actualizar(p.id, { precios: { ...(p.precios || {}), [l.id]: sug } }, `${l.nombre}: ${money(sug)}`)}
                            className="ml-1 font-semibold text-acento hover:underline">poner {money(sug)}</button>
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
                      className="f-m w-28 text-right border border-borde rounded-lg px-2 py-1.5 text-sm outline-none focus:border-acento" />
                  </li>
                );
              })}
            </ul>
            <p className="text-[11px] text-texto-tenue mt-2">Vacío significa que este producto no entra en esa lista.</p>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div className="border border-borde rounded-xl p-4">
            <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold mb-2">Costo y precio general</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[11px] text-texto-suave">Costo</span>
                <input value={costo} onChange={(e) => setCosto(e.target.value.replace(/\D/g, ""))}
                  className="f-m w-full text-right border border-borde rounded-lg px-3 py-2 text-sm mt-0.5 outline-none focus:border-acento" />
              </label>
              <label className="block">
                <span className="text-[11px] text-texto-suave">Precio</span>
                <input value={precio} onChange={(e) => setPrecio(e.target.value.replace(/\D/g, ""))}
                  className="f-m w-full text-right border border-borde rounded-lg px-3 py-2 text-sm mt-0.5 outline-none focus:border-acento" />
              </label>
            </div>
            <p className="text-xs text-texto-suave mt-2">
              Margen resultante: <strong>{pct(((Number(precio) || p.precio) - (Number(costo) || p.costo)) / (Number(precio) || p.precio))}</strong>
              {Number(costo) > 0 && Number(costo) !== p.costo && (
                <span className="block text-ojo mt-1">
                  El costo pasa de {money(p.costo)} a {money(Number(costo))}: queda registrado en el historial.
                </span>
              )}
            </p>
            <Boton size="sm" className="w-full mt-2" onClick={() => actualizar(p.id, {
              precio: Number(precio) || p.precio,
              costo: Number(costo) || p.costo,
            }, "Costo y precio actualizados.")}>Guardar</Boton>
          </div>
          <div className="border border-borde rounded-xl p-4">
            <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold mb-2">Movimiento</div>
            <ul className="text-sm text-texto-suave space-y-1">
              <li className="flex justify-between"><span>Vendidas 30 días</span><span className="f-m">{nf.format(p.u30)}</span></li>
              <li className="flex justify-between"><span>Mes anterior</span><span className="f-m">{nf.format(p.u30p)}</span></li>
              <li className="flex justify-between"><span>Última venta</span><span className="f-m">{diasDesde(p.ultimaVenta) === 0 ? "hoy" : `hace ${diasDesde(p.ultimaVenta)} d`}</span></li>
              <li className="flex justify-between"><span>Compra por bulto</span><span className="f-m">{p.bulto} u</span></li>
              {p.vence && <li className="flex justify-between"><span>Vence</span><span className={`f-m ${diasHasta(p.vence) <= 7 ? "text-mal" : ""}`}>{fdatel(p.vence)}</span></li>}
            </ul>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------
   RECETA · costo por lote y producción
   ------------------------------------------------------------
   El costo se muestra calculado en el momento con el costo que cada
   insumo ya tiene en `productos` — no hace falta guardar la receta para
   ver cuánto va a salir. Recién al producir se le pregunta a la base
   (`producir_lote`), que es quien de verdad mueve stock y promedia el
   costo del producto final; acá nunca se calcula ese promedio, para no
   tener dos lugares que puedan decir un número distinto. */
function RecetaModal({ producto, productos, empresaId, toast, onClose }) {
  const [cargando, setCargando] = useState(true);
  const [recetaId, setRecetaId] = useState(null);
  const [tamanoLote, setTamanoLote] = useState("1");
  const [insumos, setInsumos] = useState([]);
  const [buscar, setBuscar] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [lotes, setLotes] = useState("1");
  const [produciendo, setProduciendo] = useState(false);

  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        const todas = await cargarRecetas(empresaId);
        const mia = todas.find((r) => r.itemId === producto.id && r.activa);
        if (mia) {
          const detalle = await cargarReceta(mia.id);
          if (!vigente) return;
          setRecetaId(detalle.id);
          setTamanoLote(String(detalle.tamanoLote));
          setInsumos(detalle.insumos.map((i) => ({ itemId: i.itemId, nombre: i.nombre, cantidad: String(i.cantidad), unidad: i.unidad })));
        }
      } catch (e) {
        toast(e.message || "No pudimos cargar la receta.", "mal");
      } finally {
        if (vigente) setCargando(false);
      }
    })();
    return () => { vigente = false; };
  }, [producto.id, empresaId]);

  const candidatos = useMemo(() => {
    if (buscar.trim().length < 2) return [];
    const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const t = norm(buscar.trim());
    return productos
      .filter((p) => p.id !== producto.id && !insumos.some((i) => i.itemId === p.id) && norm(p.nombre).includes(t))
      .slice(0, 6);
  }, [buscar, productos, insumos, producto.id]);

  const agregarInsumo = (p) => {
    setInsumos((ls) => [...ls, { itemId: p.id, nombre: p.nombre, cantidad: "1", unidad: p.unidad }]);
    setBuscar("");
  };
  const quitarInsumo = (itemId) => setInsumos((ls) => ls.filter((i) => i.itemId !== itemId));
  const setCantidad = (itemId, v) => setInsumos((ls) => ls.map((i) => (i.itemId === itemId ? { ...i, cantidad: v } : i)));

  const costoLote = insumos.reduce((s, i) => {
    const prod = productos.find((p) => p.id === i.itemId);
    return s + (Number(i.cantidad) || 0) * (prod ? prod.costo : 0);
  }, 0);
  const costoUnidad = Number(tamanoLote) > 0 ? costoLote / Number(tamanoLote) : 0;
  const margenConEsteCosto = producto.precio > 0 ? (producto.precio - costoUnidad) / producto.precio : null;

  async function guardar() {
    setGuardando(true);
    try {
      const id = await guardarReceta({
        id: recetaId, empresaId, itemId: producto.id,
        nombre: `Receta de ${producto.nombre}`,
        tamanoLote: Number(tamanoLote) || 1,
        insumos: insumos.map((i) => ({ itemId: i.itemId, cantidad: Number(i.cantidad) || 0 })),
      });
      setRecetaId(id);
      toast("Receta guardada.");
    } catch (e) {
      toast(e.message || "No se pudo guardar la receta.", "mal");
    } finally {
      setGuardando(false);
    }
  }

  async function producir() {
    setProduciendo(true);
    try {
      await producirLote(recetaId, null, Number(lotes) || 1);
      toast(`Producidos ${lotes} lote(s) de ${producto.nombre}. Stock y costo actualizados.`);
      onClose();
    } catch (e) {
      toast(e.message || "No se pudo producir.", "mal");
    } finally {
      setProduciendo(false);
    }
  }

  return (
    <Modal open onClose={onClose} ancho="max-w-lg">
      <div className="sticky top-0 bg-superficie border-b border-borde px-5 py-3.5 flex items-center justify-between">
        <h3 className="f-d text-lg flex items-center gap-2"><ChefHat size={18} className="text-acento" /> Receta de {producto.nombre}</h3>
        <button onClick={onClose} className="text-texto-tenue hover:text-texto"><X size={18} /></button>
      </div>

      {cargando ? (
        <div className="p-5 text-sm text-texto-suave">Cargando…</div>
      ) : (
        <div className="p-5 space-y-4">
          <Campo label={`De un lote salen (en ${nombreUnidad(producto.unidad).toLowerCase()}s)`}>
            <input value={tamanoLote} onChange={(e) => setTamanoLote(e.target.value.replace(/[^\d.]/g, ""))} className={inputCls} />
          </Campo>

          <div>
            <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold mb-2">Insumos por lote</div>
            {insumos.length === 0 && <p className="text-sm text-texto-tenue">Todavía no agregaste ningún insumo.</p>}
            <ul className="space-y-2">
              {insumos.map((i) => (
                <li key={i.itemId} className="flex items-center gap-2">
                  <span className="text-sm flex-1 min-w-0 truncate">{i.nombre}</span>
                  <input value={i.cantidad} onChange={(e) => setCantidad(i.itemId, e.target.value.replace(/[^\d.]/g, ""))}
                    className={`${inputCls} !w-20 text-right`} />
                  <span className="text-xs text-texto-tenue w-6">{i.unidad}</span>
                  <button onClick={() => quitarInsumo(i.itemId)} className="text-texto-tenue hover:text-mal shrink-0"><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>

            <div className="relative mt-2">
              <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar un producto para sumarlo como insumo…"
                className={inputCls} />
              {candidatos.length > 0 && (
                <ul className="absolute z-10 left-0 right-0 mt-1 bg-superficie border border-borde rounded-xl shadow-sm overflow-hidden">
                  {candidatos.map((p) => (
                    <li key={p.id}>
                      <button onClick={() => agregarInsumo(p)} className="w-full text-left px-3 py-2 text-sm hover:bg-superficie-2 flex justify-between">
                        <span>{p.nombre}</span><span className="text-texto-tenue">{money(p.costo)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="bg-superficie-2 rounded-xl p-3.5 grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-texto-tenue font-semibold">Costo del lote</div>
              <div className="f-m text-lg mt-0.5">{money(costoLote)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-texto-tenue font-semibold">Costo por unidad</div>
              <div className="f-m text-lg mt-0.5">{money(costoUnidad)}</div>
              {margenConEsteCosto != null && (
                <div className={`text-[11px] mt-0.5 ${margenConEsteCosto < 0.15 ? "text-mal" : "text-texto-tenue"}`}>
                  margen {pct(margenConEsteCosto, 0)} contra el precio de venta actual
                </div>
              )}
            </div>
          </div>

          <Boton className="w-full" disabled={guardando || !insumos.length} onClick={guardar}>
            {guardando ? "Guardando…" : recetaId ? "Guardar cambios" : "Guardar receta"}
          </Boton>

          {recetaId && (
            <div className="border-t border-borde pt-4 flex items-end gap-2">
              <Campo label="Producir">
                <input value={lotes} onChange={(e) => setLotes(e.target.value.replace(/[^\d.]/g, ""))} className={`${inputCls} !w-24`} />
              </Campo>
              <span className="text-sm text-texto-suave pb-2">lote(s) — consume los insumos y da de alta {(Number(lotes) || 0) * (Number(tamanoLote) || 0)} {producto.nombre}</span>
              <Boton variant="ghost" disabled={produciendo} onClick={producir} className="ml-auto shrink-0">
                {produciendo ? "Produciendo…" : "Producir"}
              </Boton>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ============================================================
   CAPTURA CON PISTOLA
   ============================================================

   Para cargar una góndola entera. La pistola da el código de barras y nada
   más: el nombre hay que escribirlo, y con quinientos productos eso son
   quinientas veces abrir un cuadro, tipear y confirmar.

   Acá no se escribe nada. Se dispara, suena, y sigue el siguiente. Cada
   código crea la ficha con el código como nombre provisorio, y después se
   completan todas juntas desde el filtro "Incompletos" y la grilla de
   precios, que es donde conviene hacerlo: una pantalla con todo a la vista
   en vez de un formulario por producto.

   Se probó sacar el nombre del código contra Open Food Facts —la base
   pública más grande— y da 8% sobre este catálogo: es una base de
   alimentos, y un minimercado es mitad limpieza y perfumería. Por eso el
   nombre provisorio es el código y no una adivinanza.

   Pensado para dos computadoras: una escanea, la otra completa. Desde la
   migración 0081 el catálogo avisa cuando cambia, así que la segunda ve lo
   que entra sin refrescar.
   ============================================================ */
function CapturaConPistola({ abierto, productos, onCrear, onClose }) {
  const [capturas, setCapturas] = useState([]);
  /* Sincrónico a propósito: dos disparos seguidos del mismo código llegan
     antes de que el alta termine, y mirar `productos` no alcanza porque
     todavía no está. */
  const vistos = useRef(new Set());

  useEffect(() => {
    if (abierto) { setCapturas([]); vistos.current = new Set(); }
  }, [abierto]);

  const anotar = (c) => setCapturas((cs) => [c, ...cs].slice(0, 50));

  useScanHandler(async (cod) => {
    if (vistos.current.has(cod)) {
      beep(false, true);
      return anotar({ cod, estado: "repetido", detalle: "Ya lo escaneaste recién" });
    }
    const existente = productos.find((p) => p.barcode === cod);
    if (existente) {
      vistos.current.add(cod);
      beep(false, true);
      return anotar({ cod, estado: "ya-estaba", detalle: existente.nombre });
    }
    vistos.current.add(cod);
    /* `null` en el mensaje: el alta no avisa de a una. Con cien productos
       serían cien carteles tapando la pantalla. */
    const creado = await onCrear({ nombre: cod, barcode: cod }, null);
    if (!creado) {
      vistos.current.delete(cod);
      beep(false, true);
      return anotar({ cod, estado: "error", detalle: "No se pudo crear" });
    }
    beep(true, true);
    anotar({ cod, estado: "nuevo", detalle: "Listo para completar" });
  }, abierto);

  if (!abierto) return null;

  const nuevos = capturas.filter((c) => c.estado === "nuevo").length;
  const repetidos = capturas.filter((c) => c.estado !== "nuevo").length;

  const TONO = {
    nuevo: "text-bien",
    "ya-estaba": "text-texto-tenue",
    repetido: "text-texto-tenue",
    error: "text-mal",
  };

  return (
    <Modal open onClose={onClose} ancho="max-w-lg">
      <div className="p-5">
        <h3 className="f-d text-lg">Captura con pistola</h3>
        <p className="text-sm text-texto-suave mt-0.5">
          Pasá los productos por el lector. No hace falta escribir nada: se crean con el código
          y después los completás desde <b>Incompletos</b>.
        </p>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="border border-borde rounded-xl p-3 text-center">
            <div className="f-m text-3xl text-bien">{nuevos}</div>
            <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-bold mt-0.5">Nuevos</div>
          </div>
          <div className="border border-borde rounded-xl p-3 text-center">
            <div className="f-m text-3xl text-texto-tenue">{repetidos}</div>
            <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-bold mt-0.5">Ya estaban</div>
          </div>
        </div>

        <ul className="mt-4 border border-borde rounded-xl divide-y divide-borde max-h-64 overflow-auto">
          {capturas.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-texto-tenue">
              Esperando el primer disparo…
            </li>
          )}
          {capturas.map((c, i) => (
            <li key={`${c.cod}-${i}`} className="px-3 py-2 flex items-center justify-between gap-3">
              <span className="f-m text-xs text-texto-suave shrink-0">{c.cod}</span>
              <span className={`text-xs truncate text-right ${TONO[c.estado]}`}>{c.detalle}</span>
            </li>
          ))}
        </ul>

        <Boton className="w-full mt-4" onClick={onClose}>
          {nuevos > 0 ? `Terminar · ${nuevos} para completar` : "Cerrar"}
        </Boton>
      </div>
    </Modal>
  );
}
