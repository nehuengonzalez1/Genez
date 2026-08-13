/* ============================================================
   16. CENTRO DE PEDIDOS · take away y mostrador
   ============================================================

   El tablero donde se pasa el día en un local que vende por mostrador,
   por delivery y por aplicaciones. Cinco columnas por estado, la barra
   de canales a la izquierda y los totales abajo.

   Dos cosas que hay que tener presentes al tocar este archivo:

   El color de una tarjeta es su ESTADO, no su canal. A un metro de
   distancia lo que hay que ver es qué falta hacer; de dónde vino el
   pedido se lee después, en el ícono y el nombre del canal. Si algún día
   las tarjetas se pintan por canal, el tablero deja de servir para
   trabajar y pasa a ser una decoración.

   Y los estados son de la base, no de la pantalla. Mover una tarjeta
   llama a `mover_pedido`, que valida contra el flujo del canal, despacha
   a la cocina y deja historial. Acá no se decide nada: si la base dice
   que no, la tarjeta vuelve a su lugar.

   El pedido en sí —cargar platos, descuento, cobrar— se edita en la
   pantalla de comanda, que es la misma para una mesa y para un delivery.
   Este módulo la abre y no la duplica.
   ============================================================ */

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  ArrowLeft, Clock, Check, CheckCircle2, Plus, Search, X, RefreshCw, ChefHat,
  ShoppingBag, UtensilsCrossed, Timer, BellRing, Truck, ChevronDown, ChevronRight,
  BarChart3, Settings, Zap, ClipboardList, History, Filter, Ban, Phone, MapPin,
  StickyNote, Pencil, CreditCard, Loader2, Wifi, WifiOff,
} from "lucide-react";
import { money, nf, hora } from "../utils/helpers.js";
import {
  ESTADOS, estadoPorK, cargarPedidos, buscarPedidos, historialDe, pagosDe,
  moverPedido, cancelarPedido, estadisticas, escucharPedidos,
  cargarCanales, crearCanal, guardarCanal, siguientes, toca_cobrar, anterior,
} from "../datos/pedidos.js";
import { abrirPedido } from "../datos/comandas.js";
import { Boton, Modal, Vacio, campanita } from "../ui/Base.jsx";
import { Campo, inputCls } from "../ui/Campos.jsx";
import { tonoCanal, IconoCanal, SelloCanal, FilaLateral, ChipCanal, ICONOS_DISPONIBLES, COLORES_DISPONIBLES } from "../ui/canales.jsx";

/* Los cinco carriles del tablero. Cancelado no tiene columna: un pedido
   que se cayó no es trabajo pendiente, y ocuparía un quinto de la
   pantalla con lo único que ya no hay que hacer. Se ve en el historial y
   en el detalle. */
const CARRILES = ESTADOS.filter((e) => e.k !== "cancelado");

const TONO = {
  pendiente:      { txt: "text-mal",         punto: "bg-mal",         suave: "bg-mal-suave",    borde: "border-mal",          tarjeta: "border-mal/35",    icono: Timer },
  en_preparacion: { txt: "text-acento",      punto: "bg-acento",      suave: "bg-acento-suave", borde: "border-acento",       tarjeta: "border-acento/35", icono: ChefHat },
  listo:          { txt: "text-ojo",         punto: "bg-ojo",         suave: "bg-ojo-suave",    borde: "border-ojo",          tarjeta: "border-ojo/40",    icono: BellRing },
  en_camino:      { txt: "text-bien",        punto: "bg-bien",        suave: "bg-bien-suave",   borde: "border-bien",         tarjeta: "border-bien/35",   icono: Truck },
  completado:     { txt: "text-texto-suave", punto: "bg-texto-suave", suave: "bg-superficie-2", borde: "border-borde-fuerte", tarjeta: "border-borde",     icono: CheckCircle2 },
  cancelado:      { txt: "text-texto-tenue", punto: "bg-texto-tenue", suave: "bg-superficie-2", borde: "border-borde",        tarjeta: "border-borde",     icono: Ban },
};

const tonoEstado = (k) => TONO[k] || TONO.pendiente;

const horaLarga = (f) => hora(f, true);
const fecha = (f) => (f ? f.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : "—");
const espera = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);
const aISO = (d) => (d ? new Date(d).toISOString() : null);

/* El día del negocio arranca a la medianoche del reloj de la computadora
   y no en UTC: un pedido de las diez de la noche es de hoy. */
function delDia(cuantos = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - cuantos);
  return d;
}

const aCampo = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

function Rotulo({ children, className = "" }) {
  return (
    <div className={`text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold ${className}`}>
      {children}
    </div>
  );
}

/* ============================================================
   LA PANTALLA
   ============================================================ */

export function CentroPedidos({
  empresaId, sucursalId = null, ajustes = {}, permisos = {}, toast,
  onVolver = null, onSalon = null, onAbrirPedido = null,
}) {
  const [pantalla, setPantalla] = useState("tablero");   // tablero | historial | estadisticas | canales
  const [pedidos, setPedidos] = useState([]);
  const [canales, setCanales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [ultima, setUltima] = useState(null);
  const [envivo, setEnvivo] = useState(false);

  const [canal, setCanal] = useState(null);             // filtro de canal, clave o null
  const [q, setQ] = useState("");
  const [filtros, setFiltros] = useState({ estado: null, desde: null, hasta: null });
  const [verFiltros, setVerFiltros] = useState(false);
  const [acciones, setAcciones] = useState(false);
  const [nuevo, setNuevo] = useState(false);
  const [abriendo, setAbriendo] = useState(false);
  const [detalle, setDetalle] = useState(null);          // id del pedido abierto
  /* Cambiar de pantalla cierra el detalle: si no, el pedido queda abierto
     encima del historial o de las estadísticas, tapando la pantalla a la
     que la persona quiso ir. */
  const irA = (p) => { setDetalle(null); setPantalla(p); };
  const [moviendo, setMoviendo] = useState(null);
  const [arrastrando, setArrastrando] = useState(null);
  const [desplegado, setDesplegado] = useState({});
  const [lateral, setLateral] = useState(false);         // la barra plegada, en pantalla chica
  /* "Actualizar" tiene que actualizar lo que se está mirando. Sin esto
     releía el tablero estando en estadísticas: el botón parecía roto. */
  const [refresco, setRefresco] = useState(0);
  const actualizar = () => { setRefresco((n) => n + 1); releer(); };

  /* toast se redefine en cada render del contenedor: si entra como
     dependencia de un efecto, el efecto se vuelve a disparar para
     siempre. */
  const avisar = useRef(toast);
  avisar.current = toast;

  const releer = useCallback(async ({ callado = false } = {}) => {
    try {
      const p = await cargarPedidos(empresaId);
      setPedidos(p);
      setUltima(new Date());
    } catch (e) {
      if (!callado) avisar.current(e.message || "No pudimos leer los pedidos.", "mal");
    } finally {
      setCargando(false);
    }
  }, [empresaId]);

  useEffect(() => {
    let vivo = true;
    cargarCanales(empresaId)
      .then((cs) => { if (vivo) setCanales(cs); })
      .catch((e) => avisar.current(e.message || "No pudimos leer los canales.", "mal"));
    return () => { vivo = false; };
  }, [empresaId]);

  /* Tiempo real, con el sondeo atrás por las dudas.

     Lo que manda es el aviso de Postgres: cuando la cocina marca un
     plato listo, el mostrador lo ve en el momento. El reloj queda como
     red de contención cada minuto —no cada quince segundos— para el caso
     en que el proyecto no tenga Realtime habilitado o la conexión se
     haya caído sin avisar. */
  useEffect(() => {
    let vivo = true;
    releer();

    const dejar = escucharPedidos(empresaId, (novedad) => {
      if (!vivo) return;
      releer({ callado: true });
      if (novedad && novedad.nuevo) {
        campanita(ajustes.sonido);
        avisar.current("Entró un pedido nuevo.");
      }
    }, { alEstado: (ok) => vivo && setEnvivo(ok) });

    const reloj = setInterval(() => releer({ callado: true }), 60000);
    const alVolver = () => { if (document.visibilityState === "visible") releer({ callado: true }); };
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      vivo = false;
      dejar();
      clearInterval(reloj);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [empresaId, releer]);

  /* ---------- lo que se ve ---------- */

  const activos = useMemo(
    () => pedidos.filter((p) => p.estado !== "completado" && p.estado !== "cancelado"),
    [pedidos]
  );

  const porCanal = useMemo(() => {
    const m = new Map();
    for (const p of activos) m.set(p.canal, (m.get(p.canal) || 0) + 1);
    return m;
  }, [activos]);

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return pedidos.filter((p) => {
      if (canal && p.canal !== canal) return false;
      if (filtros.estado && p.estado !== filtros.estado) return false;
      if (filtros.desde && p.abiertaEn && p.abiertaEn < new Date(filtros.desde)) return false;
      if (filtros.hasta && p.abiertaEn && p.abiertaEn > new Date(filtros.hasta)) return false;
      if (!t) return true;
      return [p.referencia, p.numero, p.cliente.nombre, p.cliente.telefono, p.canalNombre,
        ...p.lineas.map((l) => l.nombre)]
        .filter(Boolean).join(" ").toLowerCase().includes(t);
    });
  }, [pedidos, canal, q, filtros]);

  const enCarril = useCallback((k) => visibles.filter((p) => p.estado === k), [visibles]);
  const hayFiltro = !!(filtros.estado || filtros.desde || filtros.hasta);

  /* ---------- mover ---------- */

  const mover = async (pedido, estado) => {
    if (moviendo) return;
    if (estado === "completado" || (estado === pedido.estado)) return;
    setMoviendo(pedido.id);
    /* Se pinta primero y se confirma después: con gente esperando, medio
       segundo de tarjeta quieta se siente como que el toque no entró. Si
       la base rechaza, la relectura la devuelve a su lugar. */
    setPedidos((ps) => ps.map((x) => (x.id === pedido.id ? { ...x, estado } : x)));
    try {
      await moverPedido(pedido.id, estado);
      await releer({ callado: true });
    } catch (e) {
      avisar.current(e.message || "No se pudo mover el pedido.", "mal");
      await releer({ callado: true });
    } finally {
      setMoviendo(null);
    }
  };

  const cobrar = (pedido) => {
    setDetalle(null);
    if (onAbrirPedido) onAbrirPedido(pedido);
    else avisar.current("El cobro se hace desde la pantalla del pedido.", "mal");
  };

  const cancelar = async (pedido, motivo) => {
    try {
      await cancelarPedido(pedido.id, motivo);
      await releer({ callado: true });
      avisar.current("Pedido cancelado.");
    } catch (e) {
      avisar.current(e.message || "No se pudo cancelar.", "mal");
    }
  };

  const crear = async (datos) => {
    if (abriendo) return;
    setAbriendo(true);
    try {
      const id = await abrirPedido({ empresaId, sucursalId, ...datos });
      setNuevo(false);
      if (onAbrirPedido) onAbrirPedido({ id, canal: datos.canal, referencia: datos.referencia, cliente: datos.cliente });
      else await releer({ callado: true });
    } catch (e) {
      avisar.current(e.message || "No se pudo abrir el pedido.", "mal");
    } finally {
      setAbriendo(false);
    }
  };

  /* ---------- el encabezado ---------- */

  const elegido = canal ? canales.find((c) => c.clave === canal) : null;
  const titulo = pantalla === "historial" ? "Historial"
    : pantalla === "estadisticas" ? "Estadísticas"
    : pantalla === "canales" ? "Configuración"
    : elegido ? elegido.nombre : "Pedidos activos";

  const abierto = detalle ? pedidos.find((p) => p.id === detalle) || null : null;

  return (
    <div className="h-full min-h-0 flex bg-fondo text-texto">

      {/* ============ BARRA LATERAL ============
          Se angosta antes que el tablero. En una notebook de 1250 los 36 px
          que cede la barra son la diferencia entre ver las cinco columnas y
          tener que scrollear de costado para saber cuánto se lleva vendido. */}
      <aside className={`${lateral ? "flex" : "hidden"} lg:flex shrink-0 w-[192px] xl:w-[220px] flex-col
        border-r border-borde bg-superficie h-full overflow-y-auto`}>
        <div className="flex items-center gap-3 px-3 xl:px-4 pt-5 pb-4">
          <span className="w-9 h-9 shrink-0 grid place-items-center rounded-lg border border-acento text-acento">
            <ShoppingBag size={19} />
          </span>
          <span className="f-d text-[13px] leading-[1.25] tracking-wide">
            TAKE AWAY /<br />MOSTRADOR
          </span>
        </div>

        <nav className="px-2 xl:px-2.5 space-y-0.5">
          <FilaLateral icono={ClipboardList} tinte="text-acento" nombre="Pedidos activos"
            cuantos={activos.length}
            activo={pantalla === "tablero" && canal === null}
            onTocar={() => { irA("tablero"); setCanal(null); }} />
          {canales.filter((c) => c.activo).map((c) => (
            <FilaLateral key={c.clave} canal={c} nombre={c.nombre} cuantos={porCanal.get(c.clave) || 0}
              activo={pantalla === "tablero" && canal === c.clave}
              onTocar={() => { irA("tablero"); setCanal(canal === c.clave ? null : c.clave); }} />
          ))}
        </nav>

        <div className="mx-2 xl:mx-2.5 mt-3 pt-3 border-t border-borde space-y-0.5">
          <FilaLateral icono={History} nombre="Historial"
            activo={pantalla === "historial"} onTocar={() => irA("historial")} />
          {permisos.verCostos && (
            <FilaLateral icono={BarChart3} nombre="Estadísticas"
              activo={pantalla === "estadisticas"} onTocar={() => irA("estadisticas")} />
          )}
          {permisos.ajustes && (
            <FilaLateral icono={Settings} nombre="Configuración"
              activo={pantalla === "canales"} onTocar={() => irA("canales")} />
          )}
        </div>

        <div className="mx-2.5 mt-3 pt-3 border-t border-borde space-y-0.5">
          {onVolver && <FilaLateral icono={ArrowLeft} nombre="Volver" onTocar={onVolver} />}
          {onSalon && <FilaLateral icono={UtensilsCrossed} nombre="Salón" onTocar={onSalon} />}
          <FilaLateral icono={Zap} nombre="Acciones rápidas" onTocar={() => setAcciones(true)} />
        </div>

        <div className="mx-2 xl:mx-2.5 mt-auto pt-3 border-t border-borde space-y-0.5 pb-1">
          <FilaLateral icono={Filter} nombre="Filtros" activo={hayFiltro}
            onTocar={() => { irA("tablero"); setVerFiltros(true); }} />
          <FilaLateral icono={RefreshCw} nombre="Actualizar" onTocar={actualizar} />
        </div>

        <div className="px-3 xl:px-4 py-3.5">
          <Rotulo>Última actualización</Rotulo>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="f-m text-xs text-texto-suave">{ultima ? horaLarga(ultima) : "—"}</span>
            <span title={envivo ? "Los cambios llegan en el momento" : "Actualizando por reloj"}
              className={envivo ? "text-bien" : "text-texto-tenue"}>
              {envivo ? <Wifi size={12} /> : <WifiOff size={12} />}
            </span>
          </div>
        </div>
      </aside>

      {/* ============ EL CUERPO ============ */}
      <div className="flex-1 min-w-0 flex flex-col h-full">

        <header className="shrink-0 flex flex-wrap items-center gap-2.5 px-4 xl:px-6 pt-5 pb-3">
          <button onClick={() => setLateral((v) => !v)}
            className="lg:hidden shrink-0 grid place-items-center w-10 h-10 rounded-md border border-borde text-texto-suave">
            <ShoppingBag size={17} />
          </button>
          <h1 className="f-d text-[26px] leading-none uppercase tracking-[0.01em] truncate">{titulo}</h1>

          {/* El buscador y los filtros solo donde hay algo que buscar o
              filtrar. En estadísticas no filtran nada, y un control que
              está pero no hace es peor que uno que falta. */}
          <div className="ml-auto flex items-center gap-2 w-full md:w-auto">
            {(pantalla === "tablero" || pantalla === "historial") && (
              <label className="flex-1 md:w-[320px] flex items-center gap-2.5 rounded-md border border-borde bg-superficie px-3.5 py-2.5">
                <Search size={16} className="text-texto-tenue shrink-0" />
                <input value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar pedido, cliente, N°…"
                  className="w-full text-sm bg-transparent outline-none placeholder:text-texto-tenue" />
                {q && <button onClick={() => setQ("")} title="Limpiar" className="text-texto-tenue hover:text-texto"><X size={15} /></button>}
              </label>
            )}

            {pantalla === "tablero" && (
              <button onClick={() => setVerFiltros(true)} title="Filtrar el tablero"
                className={`shrink-0 grid place-items-center w-[42px] h-[42px] rounded-md border transition-colors ${
                  hayFiltro ? "border-acento text-acento bg-acento-suave" : "border-borde bg-superficie text-texto-suave hover:text-texto"}`}>
                <Filter size={17} />
              </button>
            )}

            {/* En una notebook el rótulo se va y queda el ícono: es el
                botón que menos se toca —el tablero se actualiza solo— y el
                lugar lo necesita "Nuevo pedido", que es el que más. */}
            <Boton variant="ghost" size="md" title="Actualizar" className="shrink-0 h-[42px]" onClick={actualizar}>
              <RefreshCw size={15} className={cargando ? "animate-spin" : ""} />
              <span className="hidden xl:inline">Actualizar</span>
            </Boton>

            {/* Tomar un pedido es lo que más se hace en esta pantalla, así
                que está a la vista y no adentro de un menú. La maqueta no
                lo tiene, pero una pantalla de mostrador sin forma visible
                de arrancar un pedido no se puede usar. */}
            <Boton size="md" className="shrink-0 h-[42px]" onClick={() => setNuevo(true)} disabled={abriendo}>
              <Plus size={16} /> Nuevo pedido
            </Boton>
          </div>
        </header>

        {pantalla === "tablero" && (
          <>
            <div className="shrink-0 flex items-center gap-2 px-4 xl:px-6 pb-3 overflow-x-auto">
              <ChipCanal nombre="Todos" cuantos={activos.length}
                activo={canal === null} onTocar={() => setCanal(null)} />
              {canales.filter((c) => c.activo).map((c) => (
                <ChipCanal key={c.clave} canal={c} nombre={c.nombre} cuantos={porCanal.get(c.clave) || 0}
                  activo={canal === c.clave} onTocar={() => setCanal(canal === c.clave ? null : c.clave)} />
              ))}
            </div>

            <div className="flex-1 min-h-0 overflow-auto px-4 xl:px-6">
              {cargando && !pedidos.length && <Vacio>Cargando los pedidos…</Vacio>}

              {!cargando && !pedidos.length && (
                <div className="text-center py-16">
                  <p className="text-sm text-texto-tenue">Todavía no entró ningún pedido hoy.</p>
                  <Boton className="mt-3" onClick={() => setNuevo(true)}><Plus size={16} /> Tomar un pedido</Boton>
                </div>
              )}

              {pedidos.length > 0 && (
                /* El ancho mínimo lo pone cada columna, no este contenedor:
                   con un mínimo acá las cinco entraban justo en la maqueta
                   y se cortaban en una notebook de 1440. */
                <div className="flex gap-3 items-start pb-4">
                  {CARRILES.map((c) => (
                    <Columna key={c.k} carril={c} pedidos={enCarril(c.k)}
                      todo={!!desplegado[c.k]}
                      onDesplegar={(v) => setDesplegado((d) => ({ ...d, [c.k]: v }))}
                      moviendo={moviendo}
                      arrastrando={arrastrando}
                      onArrastrar={setArrastrando}
                      onSoltar={(p) => {
                        setArrastrando(null);
                        if (c.k === "completado") return cobrar(p);
                        mover(p, c.k);
                      }}
                      onTocar={(p) => setDetalle(p.id)} />
                  ))}
                </div>
              )}
            </div>

            <Totales pedidos={canal ? pedidos.filter((p) => p.canal === canal) : pedidos} />
          </>
        )}

        {pantalla === "historial" && (
          <Historial empresaId={empresaId} canales={canales} texto={q} refresco={refresco} toast={toast} />
        )}

        {pantalla === "estadisticas" && <Estadisticas empresaId={empresaId} refresco={refresco} toast={toast} />}

        {pantalla === "canales" && (
          <Canales empresaId={empresaId} canales={canales} setCanales={setCanales} toast={toast} />
        )}
      </div>

      {/* ============ LO QUE SE ABRE ENCIMA ============ */}
      <PanelDetalle pedido={abierto} onCerrar={() => setDetalle(null)}
        permisos={permisos} moviendo={moviendo === (abierto && abierto.id)}
        onMover={(e) => mover(abierto, e)} onCobrar={() => cobrar(abierto)}
        onEditar={() => { setDetalle(null); onAbrirPedido && onAbrirPedido(abierto); }}
        onCancelar={(motivo) => { setDetalle(null); cancelar(abierto, motivo); }} />

      <ModalNuevoPedido abierto={nuevo} canales={canales} trabajando={abriendo}
        onCerrar={() => setNuevo(false)} onCrear={crear} />

      <ModalFiltros abierto={verFiltros} filtros={filtros} onCerrar={() => setVerFiltros(false)}
        onAplicar={(f) => { setFiltros(f); setVerFiltros(false); }} />

      <Modal open={acciones} onClose={() => setAcciones(false)} ancho="max-w-sm">
        <div className="p-6">
          <h3 className="f-d text-lg">Acciones rápidas</h3>
          <div className="mt-4 space-y-2">
            {[
              { i: Plus, n: "Nuevo pedido", d: "Tomar uno por mostrador, delivery o aplicación", f: () => setNuevo(true) },
              { i: RefreshCw, n: "Actualizar el tablero", d: "Volver a leer todo ahora mismo", f: actualizar },
              { i: History, n: "Ver el historial", d: "Buscar un pedido de otro día", f: () => irA("historial") },
              ...(onSalon ? [{ i: UtensilsCrossed, n: "Ir al salón", d: "El mapa de mesas", f: onSalon }] : []),
            ].map((a) => (
              <button key={a.n} onClick={() => { setAcciones(false); a.f(); }}
                className="w-full flex items-center gap-3 text-left px-4 py-3 rounded-md border border-borde hover:bg-superficie-2 transition-colors">
                <a.i size={18} className="text-acento shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{a.n}</span>
                  <span className="block text-[11px] text-texto-tenue">{a.d}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ============================================================
   EL TABLERO
   ============================================================ */

/* Cuántas tarjetas entran en una columna antes de que la pantalla se
   vuelva una lista infinita. Lo que sobra se despliega a pedido. */
const TOPE = 4;

function Columna({ carril, pedidos, todo, onDesplegar, moviendo, arrastrando, onArrastrar, onSoltar, onTocar }) {
  const [encima, setEncima] = useState(false);
  const t = tonoEstado(carril.k);
  const Icono = t.icono;
  const puestas = todo ? pedidos : pedidos.slice(0, TOPE);
  const angosto = carril.k === "completado";

  /* Solo se puede soltar donde el canal del pedido pasa. Un pedido de
     mostrador arrastrado a "en camino" no tiene que aceptarse y volver
     atrás: no tiene que aceptarse, y punto. */
  const acepta = arrastrando && (
    carril.k === "completado"
      ? toca_cobrar(arrastrando)
      : (arrastrando.flujo || []).includes(carril.k) && arrastrando.estado !== carril.k
  );

  return (
    <section
      onDragOver={(e) => { if (acepta) { e.preventDefault(); setEncima(true); } }}
      onDragLeave={() => setEncima(false)}
      onDrop={(e) => { e.preventDefault(); setEncima(false); if (acepta) onSoltar(arrastrando); }}
      /* Las cinco columnas tienen que entrar sin scroll lateral en las dos
         medidas que existen de verdad: la notebook de 1250 y el monitor de
         1440 para arriba. Por eso hay dos juegos de mínimos y no uno.

         Más abajo de 1100 no se achica más: apretar una tarjeta hasta que
         el nombre del cliente no entre no es adaptarse, es romperla. Ahí
         sí scrollea de costado. */
      className={`grow shrink-0 basis-0 ${angosto
        ? "min-w-[166px] max-w-[196px] xl:min-w-[200px] xl:max-w-[228px]"
        : "min-w-[188px] xl:min-w-[224px]"}`}>

      <div className={`flex items-center gap-2 rounded-lg border px-3.5 py-2.5 ${t.suave} ${t.borde}`}>
        <Icono size={15} className={`shrink-0 ${t.txt}`} />
        <span className={`text-[11px] uppercase tracking-[0.1em] font-bold truncate ${t.txt}`}>{carril.n}</span>
        {angosto && <span className="text-[10px] text-texto-tenue shrink-0">Hoy</span>}
        <span className={`ml-auto f-m text-sm font-bold shrink-0 ${t.txt}`}>{pedidos.length}</span>
      </div>

      <div className={`mt-2.5 space-y-2.5 rounded-lg transition-colors ${
        encima && acepta ? "outline outline-1 outline-dashed outline-acento bg-acento-suave/30" : ""}`}>
        {puestas.map((p) => (angosto
          ? <TarjetaCerrada key={p.id} p={p} onTocar={() => onTocar(p)} />
          : <TarjetaPedido key={p.id} p={p} moviendo={moviendo === p.id}
              onTocar={() => onTocar(p)}
              onArrastrar={(v) => onArrastrar(v ? p : null)} />
        ))}

        {pedidos.length > puestas.length && (
          <BotonColumna onClick={() => onDesplegar(true)}>
            Ver todos ({pedidos.length}) <ChevronDown size={14} />
          </BotonColumna>
        )}
        {todo && pedidos.length > TOPE && (
          <BotonColumna onClick={() => onDesplegar(false)}>
            Ver menos <ChevronDown size={14} className="rotate-180" />
          </BotonColumna>
        )}

        {!pedidos.length && (
          <div className="rounded-lg border border-dashed border-borde py-9 text-center text-[11px] text-texto-tenue">
            Nada por acá
          </div>
        )}
      </div>
    </section>
  );
}

function BotonColumna({ children, onClick }) {
  return (
    <button onClick={onClick}
      className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-borde bg-superficie py-2.5 text-xs font-semibold text-texto-suave hover:bg-superficie-2 hover:text-texto transition-colors">
      {children}
    </button>
  );
}

/* La tarjeta. El borde y la línea de abajo son del estado; el sello y el
   nombre de arriba, del canal. Esas dos cosas juntas contestan "qué
   falta hacer" y "de dónde vino" sin leer nada más. */
function TarjetaPedido({ p, onTocar, onArrastrar, moviendo }) {
  const t = tonoEstado(p.estado);
  const c = tonoCanal(p);
  const primeras = p.lineas.slice(0, 3);

  return (
    <article draggable={!moviendo}
      onDragStart={() => onArrastrar(true)}
      onDragEnd={() => onArrastrar(false)}
      onClick={onTocar}
      className={`w-full text-left rounded-lg border bg-superficie p-3.5 cursor-pointer transition-colors
        hover:bg-superficie-2 hover:shadow-sm ${t.tarjeta} ${moviendo ? "opacity-50" : ""}`}>

      <div className="flex items-start gap-2">
        <SelloCanal canal={p} size={26} />
        <span className="min-w-0 flex-1">
          <span className={`block text-[12.5px] font-bold leading-tight truncate ${c.txt}`}>{p.canalNombre}</span>
          <span className="block f-m text-[11px] text-texto-tenue leading-tight">
            {p.referencia ? `#${p.referencia}` : p.numero || "Sin número"}
          </span>
        </span>
        <span className="f-m text-[11px] text-texto-tenue shrink-0">{hora(p.abiertaEn)}</span>
      </div>

      <div className="flex items-baseline justify-between gap-3 mt-2.5">
        <span className="text-[15px] font-bold leading-tight truncate">
          {p.cliente.nombre || (p.familia === "mostrador" ? "Cliente en local" : p.canalNombre)}
        </span>
        <span className="f-m text-[15px] font-bold shrink-0">{money(p.total)}</span>
      </div>

      {primeras.length > 0 && (
        <div className="mt-2 space-y-1">
          {primeras.map((l) => (
            <div key={l.id} className="text-xs text-texto-suave leading-tight truncate">
              <span className="f-m">{l.cantidad}x</span> {l.nombre}
            </div>
          ))}
          {p.lineas.length > primeras.length && (
            <div className="text-[11px] text-texto-tenue">y {p.lineas.length - primeras.length} más</div>
          )}
        </div>
      )}

      <div className="mt-3 pt-2.5 border-t border-borde flex items-center gap-1.5 text-[11px]">
        {moviendo
          ? <><Loader2 size={12} className="shrink-0 animate-spin text-texto-tenue" /><span className="text-texto-tenue">Guardando…</span></>
          : p.estado === "listo"
            ? <><BellRing size={12} className={`shrink-0 ${t.txt}`} /><span className={`font-semibold ${t.txt}`}>Listo hace {espera(p.minutosEstado)}</span></>
            : p.estado === "en_camino"
              ? <><Truck size={12} className={`shrink-0 ${t.txt}`} /><span className={`font-semibold ${t.txt}`}>En camino</span></>
              : <><Clock size={12} className={`shrink-0 ${t.txt}`} /><span className={t.txt}>Hace {espera(p.minutos)}</span></>}
        {p.sinEnviar > 0 && p.estado !== "pendiente" && (
          <span className="ml-auto text-[10px] text-ojo font-semibold shrink-0">{p.sinEnviar} sin enviar</span>
        )}
      </div>
    </article>
  );
}

/* La de completados es más chica a propósito: ya no hay nada que hacer
   con ella, solo se consulta. */
function TarjetaCerrada({ p, onTocar }) {
  const c = tonoCanal(p);
  return (
    <button onClick={onTocar}
      className="w-full text-left rounded-lg border border-borde bg-superficie px-3 py-2.5 transition-colors hover:bg-superficie-2">
      <div className="flex items-start gap-2">
        <SelloCanal canal={p} size={24} />
        <span className="min-w-0 flex-1">
          <span className={`block text-[11.5px] font-bold truncate ${p.cancelada ? "text-texto-tenue line-through" : c.txt}`}>
            {p.canalNombre}
          </span>
          <span className="block f-m text-[11px] text-texto-tenue leading-tight truncate">
            {p.referencia ? `#${p.referencia}` : p.numero || "—"}
          </span>
        </span>
        <span className="text-right shrink-0">
          <span className="block f-m text-[11px] text-texto-tenue">{hora(p.cerradaEn || p.abiertaEn)}</span>
          <span className={`block f-m text-[13px] font-bold ${p.cancelada ? "text-texto-tenue" : ""}`}>
            {p.cancelada ? "Cancelado" : money(p.total)}
          </span>
        </span>
      </div>
    </button>
  );
}

/* ============================================================
   LOS TOTALES DE ABAJO
   ============================================================ */

function Totales({ pedidos }) {
  const de = (k) => pedidos.filter((p) => p.estado === k);
  const activos = pedidos.filter((p) => p.estado !== "completado" && p.estado !== "cancelado");
  const suma = (l) => l.reduce((s, p) => s + p.total, 0);

  const tiles = [
    { k: "todos", n: "Total activos", i: ShoppingBag, txt: "text-acento", lista: activos, sinPlata: true },
    ...CARRILES.map((c) => ({
      k: c.k, n: c.k === "completado" ? "Completados hoy" : c.n === "Listo para retirar" ? "Listos" : c.n,
      i: tonoEstado(c.k).icono, txt: tonoEstado(c.k).txt, lista: de(c.k),
    })),
  ];

  return (
    <div className="shrink-0 grid grid-cols-3 lg:grid-cols-6 gap-2 xl:gap-2.5 px-4 xl:px-6 py-3 border-t border-borde bg-superficie">
      {tiles.map((r) => {
        const Icono = r.i;
        return (
          /* El rótulo va abajo del número y no al lado: en una notebook
             cada recuadro tiene 190 px y "En preparación $160.700" en un
             renglón terminaba cortado justo en la plata, que es la mitad
             de para qué está la barra. */
          <div key={r.k} className="flex items-center gap-3 rounded-lg border border-borde bg-fondo px-3.5 py-2.5">
            <Icono size={20} className={`shrink-0 ${r.txt}`} />
            <div className="min-w-0">
              <div className="f-d text-[22px] leading-none">{nf.format(r.lista.length)}</div>
              <div className="text-[10px] uppercase tracking-[0.1em] text-texto-tenue font-bold leading-tight mt-1">{r.n}</div>
              {!r.sinPlata && <div className="f-m text-[11px] text-texto-suave leading-tight">{money(suma(r.lista))}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   EL DETALLE
   ============================================================ */

function PanelDetalle({ pedido, onCerrar, permisos = {}, moviendo, onMover, onCobrar, onEditar, onCancelar, soloLectura = false }) {
  const [historial, setHistorial] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");

  /* Se relee cuando cambia `estadoDesde` y no cuando cambia el estado: el
     estado se pinta antes de que conteste el servidor, así que releer con
     eso trae el historial de un instante antes del cambio y la última
     etapa nunca aparece. `estadoDesde` sale de la base, o sea que se
     mueve recién cuando el cambio ya está escrito. */
  useEffect(() => {
    if (!pedido) return;
    setCancelando(false); setMotivo("");
    let vivo = true;
    Promise.all([historialDe(pedido.id), pedido.cerrada ? pagosDe(pedido.id) : Promise.resolve([])])
      .then(([h, p]) => { if (vivo) { setHistorial(h); setPagos(p); } })
      .catch(() => { /* el detalle igual sirve sin el historial */ });
    return () => { vivo = false; };
  }, [pedido && pedido.id, pedido && pedido.estadoDesde && pedido.estadoDesde.getTime()]);

  if (!pedido) return null;

  const t = tonoEstado(pedido.estado);
  const c = tonoCanal(pedido);
  const puedeCobrar = toca_cobrar(pedido);
  const atras = anterior(pedido);
  const cerrado = pedido.estado === "completado" || pedido.estado === "cancelado";

  return (
    <Modal open onClose={onCerrar} ancho="max-w-2xl">
      <div className="p-6">
        <div className="flex items-start gap-3">
          <SelloCanal canal={pedido} size={40} />
          <div className="min-w-0 flex-1">
            <div className={`text-sm font-bold ${c.txt}`}>{pedido.canalNombre}</div>
            <h3 className="f-d text-2xl leading-tight">
              {pedido.referencia ? `#${pedido.referencia}` : pedido.numero || "Sin número"}
            </h3>
          </div>
          <span className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.1em] font-bold
            px-2.5 py-1 rounded-md border ${t.suave} ${t.borde} ${t.txt}`}>
            {estadoPorK(pedido.estado).corto}
          </span>
          <button onClick={onCerrar} className="shrink-0 text-texto-tenue hover:text-texto"><X size={20} /></button>
        </div>

        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mt-5 text-sm">
          <Dato rotulo="Cliente" valor={pedido.cliente.nombre || "—"} />
          <Dato rotulo="Entró" valor={`${fecha(pedido.abiertaEn)} · ${hora(pedido.abiertaEn)} · hace ${espera(pedido.minutos)}`} />
          {pedido.cliente.telefono && <Dato rotulo="Teléfono" icono={Phone} valor={pedido.cliente.telefono} />}
          {pedido.cliente.domicilio && <Dato rotulo="Dirección" icono={MapPin} valor={pedido.cliente.domicilio} />}
          {pedido.mesa && <Dato rotulo="Mesa" valor={`${pedido.mesa}${pedido.sector ? ` · ${pedido.sector}` : ""}`} />}
          {pedido.usuario && <Dato rotulo="Lo tomó" valor={pedido.usuario} />}
        </div>

        <div className="mt-5 rounded-lg border border-borde overflow-hidden">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-borde">
              {pedido.lineas.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2.5 w-10 align-top"><span className="f-m text-texto-tenue">{l.cantidad}x</span></td>
                  <td className="px-1 py-2.5">
                    <div className="leading-tight">{l.nombre}</div>
                    {(l.modificadores || []).length > 0 && (
                      <div className="text-[11px] text-texto-suave">
                        {l.modificadores.map((m) => m.nombre).join(" · ")}
                      </div>
                    )}
                    {l.notas && (
                      <div className="flex items-center gap-1 text-[11px] text-ojo mt-0.5">
                        <StickyNote size={11} /> {l.notas}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right f-m align-top">{money(l.total)}</td>
                </tr>
              ))}
              {!pedido.lineas.length && (
                <tr><td className="px-4 py-6 text-center text-texto-tenue text-sm">Todavía no se cargó nada.</td></tr>
              )}
            </tbody>
          </table>
          <div className="border-t border-borde px-4 py-3 space-y-1 bg-superficie-2">
            <Renglon rotulo="Subtotal" valor={money(pedido.subtotal)} />
            {pedido.descuento > 0 && (
              <Renglon rotulo={`Descuento${pedido.descuentoPct != null ? ` ${pedido.descuentoPct}%` : ""}`}
                valor={`- ${money(pedido.descuento)}`} />
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold">Total</span>
              <span className="f-m text-xl font-bold">{money(pedido.total)}</span>
            </div>
          </div>
        </div>

        {pagos.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-texto-suave">
            <CreditCard size={14} className="text-texto-tenue" />
            {pagos.map((p) => (
              <span key={p.id} className="f-m">{p.medio} {money(p.monto)}</span>
            ))}
          </div>
        )}

        {historial.length > 0 && (
          <div className="mt-5">
            <Rotulo className="mb-2">Cómo fue</Rotulo>
            <ol className="space-y-1.5">
              {historial.map((h) => {
                const th = tonoEstado(h.estado);
                return (
                  <li key={h.id} className="flex items-center gap-2.5 text-[13px]">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${th.punto}`} />
                    <span className={`font-semibold ${th.txt}`}>{estadoPorK(h.estado).corto}</span>
                    <span className="f-m text-xs text-texto-tenue">{hora(h.fecha)}</span>
                    {h.quien && <span className="text-xs text-texto-tenue truncate">· {h.quien}</span>}
                    {h.motivo && <span className="text-xs text-texto-suave truncate">· {h.motivo}</span>}
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* Solo las acciones que este pedido admite ahora. Un botón que
            la base va a rechazar es peor que no tener el botón. */}
        {!cerrado && !cancelando && !soloLectura && (
          <div className="flex flex-wrap items-center gap-2 mt-6">
            {siguientes(pedido).map((s) => (
              <Boton key={s.k} size="lg" disabled={moviendo} onClick={() => onMover(s.k)}>
                {moviendo ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />} {s.n}
              </Boton>
            ))}
            {puedeCobrar && (
              <Boton size="lg" variant={siguientes(pedido).length ? "ghost" : "primary"} onClick={onCobrar}>
                <CreditCard size={16} /> Cobrar y completar
              </Boton>
            )}
            <Boton variant="ghost" onClick={onEditar}><Pencil size={15} /> Editar el pedido</Boton>
            {atras && (
              <Boton variant="quiet" disabled={moviendo} onClick={() => onMover(atras)}>
                Volver a {estadoPorK(atras).corto.toLowerCase()}
              </Boton>
            )}
            {permisos.anular && (
              <Boton variant="danger" className="ml-auto" onClick={() => setCancelando(true)}>
                <Ban size={15} /> Cancelar
              </Boton>
            )}
          </div>
        )}

        {cancelando && (
          <div className="mt-6 rounded-lg border border-mal p-4">
            <div className="text-sm font-semibold text-mal">Cancelar el pedido</div>
            <p className="text-xs text-texto-suave mt-1">
              Se anulan sus platos y el pedido se cierra. No se puede deshacer.
            </p>
            <Campo label="Por qué">
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus
                placeholder="El cliente no atendió el teléfono" className={inputCls} />
            </Campo>
            <div className="flex justify-end gap-2 mt-3">
              <Boton variant="quiet" onClick={() => setCancelando(false)}>Volver</Boton>
              <Boton variant="danger" disabled={!motivo.trim()} onClick={() => onCancelar(motivo.trim())}>
                <Ban size={15} /> Cancelar el pedido
              </Boton>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Dato({ rotulo, valor, icono: Icono }) {
  return (
    <div className="min-w-0">
      <Rotulo>{rotulo}</Rotulo>
      <div className="flex items-center gap-1.5 truncate">
        {Icono && <Icono size={13} className="text-texto-tenue shrink-0" />}
        <span className="truncate">{valor}</span>
      </div>
    </div>
  );
}

function Renglon({ rotulo, valor }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-texto-suave">{rotulo}</span>
      <span className="f-m">{valor}</span>
    </div>
  );
}

/* ============================================================
   NUEVO PEDIDO
   ============================================================

   El que está parado en el mostrador no puede esperar a que alguien
   complete un formulario: elegir "Mostrador" abre el pedido y listo. Los
   canales que traen número de afuera sí piden ese número, porque después
   hay que saber qué bolsa entregarle a qué cadete.
   ============================================================ */

export function ModalNuevoPedido({ abierto, canales, trabajando, canalInicial = null, rotulo = "¿Por dónde entró?", onCerrar, onCrear }) {
  const [canal, setCanal] = useState(null);
  const [referencia, setReferencia] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [domicilio, setDomicilio] = useState("");

  useEffect(() => {
    if (!abierto) return;
    setCanal((canales || []).find((c) => c.clave === canalInicial) || null);
    setReferencia(""); setNombre(""); setTelefono(""); setDomicilio("");
  }, [abierto, canalInicial, canales]);

  if (!abierto) return null;

  const lista = (canales || []).filter((c) => c.activo && c.familia !== "salon");

  const elegir = (c) => (c.familia === "mostrador" ? onCrear({ canal: c.clave }) : setCanal(c));

  const confirmar = () => {
    const cliente = {};
    if (nombre.trim()) cliente.nombre = nombre.trim();
    if (telefono.trim()) cliente.telefono = telefono.trim();
    if (domicilio.trim()) cliente.domicilio = domicilio.trim();
    onCrear({
      canal: canal.clave,
      referencia: referencia.trim() || null,
      cliente: Object.keys(cliente).length ? cliente : null,
    });
  };

  return (
    <Modal open onClose={onCerrar} ancho="max-w-md">
      <div className="p-6">
        {!canal ? (
          <>
            <h3 className="f-d text-lg">{rotulo}</h3>
            <div className="mt-4 space-y-2">
              {lista.map((c) => {
                const t = tonoCanal(c);
                return (
                  <button key={c.clave} onClick={() => elegir(c)} disabled={trabajando}
                    className="w-full flex items-center gap-3 text-left px-4 py-3 rounded-md border border-borde hover:bg-superficie-2 disabled:opacity-40 transition-colors">
                    <SelloCanal canal={c} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold">{c.nombre}</span>
                      <span className="block text-[11px] text-texto-tenue">
                        {c.externo ? "Trae su propio número de pedido" : c.familia === "reparto" ? "Lo lleva el local" : c.familia === "retiro" ? "Pasa a buscar" : "Se atiende acá"}
                      </span>
                    </span>
                    <ChevronRight size={17} className={`shrink-0 ${t.txt}`} />
                  </button>
                );
              })}
              {!lista.length && <Vacio>No hay canales activos. Prendé alguno en Configuración.</Vacio>}
            </div>
            <Boton variant="quiet" className="w-full mt-4" onClick={onCerrar}>Cancelar</Boton>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <SelloCanal canal={canal} size={34} />
              <h3 className="f-d text-lg">{canal.nombre}</h3>
            </div>

            <div className="space-y-3 mt-4">
              {canal.externo && (
                <Campo label="Número del pedido">
                  <input value={referencia} onChange={(e) => setReferencia(e.target.value)} autoFocus
                    placeholder="5893" className={`${inputCls} f-m text-lg`} />
                </Campo>
              )}
              <Campo label="Nombre de quien lo retira">
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus={!canal.externo}
                  className={inputCls} />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Teléfono">
                  <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className={`${inputCls} f-m`} />
                </Campo>
                {canal.familia === "reparto" && (
                  <Campo label="Dirección">
                    <input value={domicilio} onChange={(e) => setDomicilio(e.target.value)} className={inputCls} />
                  </Campo>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <Boton variant="quiet" onClick={() => (canalInicial ? onCerrar() : setCanal(null))}>Volver</Boton>
              <Boton size="lg" disabled={trabajando} onClick={confirmar}>
                {trabajando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Abrir el pedido
              </Boton>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ============================================================
   FILTROS
   ============================================================ */

function ModalFiltros({ abierto, filtros, onCerrar, onAplicar }) {
  const [d, setD] = useState(filtros);
  useEffect(() => { if (abierto) setD(filtros); }, [abierto, filtros]);
  if (!abierto) return null;

  return (
    <Modal open onClose={onCerrar} ancho="max-w-sm">
      <div className="p-6">
        <h3 className="f-d text-lg">Filtrar el tablero</h3>
        <p className="text-xs text-texto-suave mt-1">El canal se elige en la barra de la izquierda.</p>

        <div className="mt-4">
          <Rotulo className="mb-1.5">Estado</Rotulo>
          <div className="flex flex-wrap gap-1.5">
            {[{ k: null, n: "Todos" }, ...ESTADOS].map((e) => (
              <button key={e.k || "todos"} onClick={() => setD({ ...d, estado: e.k })}
                className={`text-xs font-semibold px-3 py-1.5 rounded-md border transition-colors ${
                  d.estado === e.k ? "border-acento bg-acento-suave text-texto" : "border-borde text-texto-suave hover:bg-superficie-2"}`}>
                {e.corto || e.n}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <Campo label="Desde">
            <input type="datetime-local" value={d.desde || ""} onChange={(e) => setD({ ...d, desde: e.target.value || null })} className={inputCls} />
          </Campo>
          <Campo label="Hasta">
            <input type="datetime-local" value={d.hasta || ""} onChange={(e) => setD({ ...d, hasta: e.target.value || null })} className={inputCls} />
          </Campo>
        </div>

        <div className="flex justify-between gap-2 mt-5">
          <Boton variant="quiet" onClick={() => onAplicar({ estado: null, desde: null, hasta: null })}>Limpiar</Boton>
          <Boton onClick={() => onAplicar(d)}><Check size={15} /> Aplicar</Boton>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================
   HISTORIAL
   ============================================================ */

function Historial({ empresaId, canales, texto, refresco, toast }) {
  const [desde, setDesde] = useState(() => aCampo(delDia(7)));
  const [hasta, setHasta] = useState(() => aCampo(new Date()));
  const [canal, setCanal] = useState("");
  const [estado, setEstado] = useState("");
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState(null);

  const avisar = useRef(toast);
  avisar.current = toast;

  /* La búsqueda espera a que dejen de escribir: sin eso, "hamburguesa"
     son once consultas y la que contesta última no es la última pedida. */
  useEffect(() => {
    let vivo = true;
    setCargando(true);
    const tarea = setTimeout(() => {
      /* Con "2026-08-13" a secas el navegador entiende medianoche UTC, o
         sea las nueve de la noche del día anterior en Argentina: el
         historial de un día traía los pedidos de la noche del otro. */
      const fin = new Date(`${hasta}T00:00:00`);
      fin.setDate(fin.getDate() + 1);
      buscarPedidos(empresaId, {
        desde: aISO(new Date(`${desde}T00:00:00`)), hasta: aISO(fin),
        canal: canal || null, estado: estado || null, texto,
      })
        .then((r) => { if (vivo) setFilas(r); })
        .catch((e) => avisar.current(e.message || "No pudimos leer el historial.", "mal"))
        .finally(() => { if (vivo) setCargando(false); });
    }, texto ? 300 : 0);
    return () => { vivo = false; clearTimeout(tarea); };
  }, [empresaId, desde, hasta, canal, estado, texto, refresco]);

  const total = filas.filter((f) => f.estado === "completado").reduce((s, f) => s + f.total, 0);

  return (
    <div className="flex-1 min-h-0 overflow-auto px-4 xl:px-6 pb-6">
      <div className="flex flex-wrap items-end gap-3 pb-4">
        <Campo label="Desde"><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={`${inputCls} f-m`} /></Campo>
        <Campo label="Hasta"><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={`${inputCls} f-m`} /></Campo>
        <Campo label="Canal">
          <select value={canal} onChange={(e) => setCanal(e.target.value)} className={inputCls}>
            <option value="">Todos</option>
            {canales.map((c) => <option key={c.clave} value={c.clave}>{c.nombre}</option>)}
          </select>
        </Campo>
        <Campo label="Estado">
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className={inputCls}>
            <option value="">Todos</option>
            {ESTADOS.map((e) => <option key={e.k} value={e.k}>{e.corto}</option>)}
          </select>
        </Campo>
        <div className="ml-auto text-right">
          <Rotulo>{filas.length} pedido{filas.length === 1 ? "" : "s"}</Rotulo>
          <div className="f-m text-lg">{money(total)}</div>
        </div>
      </div>

      {cargando && <Vacio>Buscando…</Vacio>}
      {!cargando && !filas.length && <Vacio>Ningún pedido con esos filtros.</Vacio>}

      {!cargando && filas.length > 0 && (
        <div className="rounded-lg border border-borde overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.1em] text-texto-tenue border-b border-borde bg-superficie-2">
                <th className="px-4 py-2.5 font-bold">Fecha</th>
                <th className="px-4 py-2.5 font-bold">Canal</th>
                <th className="px-4 py-2.5 font-bold">Número</th>
                <th className="px-4 py-2.5 font-bold">Cliente</th>
                <th className="px-4 py-2.5 font-bold">Quién</th>
                <th className="px-4 py-2.5 font-bold">Estado</th>
                <th className="px-4 py-2.5 font-bold text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {filas.map((p) => {
                const t = tonoEstado(p.estado);
                const c = tonoCanal(p);
                return (
                  <tr key={p.id} onClick={() => setAbierto(p)} className="cursor-pointer hover:bg-superficie-2">
                    <td className="px-4 py-2.5 f-m text-xs text-texto-suave whitespace-nowrap">{fecha(p.abiertaEn)} {hora(p.abiertaEn)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 font-semibold ${c.txt}`}>
                        <IconoCanal canal={p} size={14} /> {p.canalNombre}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 f-m text-xs">{p.referencia ? `#${p.referencia}` : p.numero || "—"}</td>
                    <td className="px-4 py-2.5 truncate max-w-[200px]">{p.cliente.nombre || "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-texto-suave truncate max-w-[140px]">{p.usuario || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[11px] font-bold uppercase tracking-wide ${t.txt}`}>{estadoPorK(p.estado).corto}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right f-m">{money(p.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Desde el historial se mira, no se trabaja: un pedido de la
          semana pasada no se despacha, y un botón que no hace nada es
          peor que no tener el botón. */}
      <PanelDetalle pedido={abierto} soloLectura onCerrar={() => setAbierto(null)} />
    </div>
  );
}

/* ============================================================
   ESTADÍSTICAS
   ============================================================

   Las cuentas las hace la base (`estadisticas_pedidos`), que es la única
   que puede mirar el historial completo sin traérselo entero al
   navegador. Acá se dibuja.
   ============================================================ */

function Estadisticas({ empresaId, refresco, toast }) {
  const [dias, setDias] = useState(7);
  const [d, setD] = useState(null);
  const [cargando, setCargando] = useState(true);

  const avisar = useRef(toast);
  avisar.current = toast;

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    const hasta = new Date();
    hasta.setDate(hasta.getDate() + 1);
    estadisticas(empresaId, delDia(dias - 1), hasta)
      .then((r) => { if (vivo) setD(r); })
      .catch((e) => avisar.current(e.message || "No pudimos calcular las estadísticas.", "mal"))
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [empresaId, dias, refresco]);

  if (cargando && !d) return <Vacio>Calculando…</Vacio>;
  if (!d) return <Vacio>No hay datos para ese período.</Vacio>;

  const horas = (d.por_hora || []).map((h) => ({ ...h, label: `${String(h.hora).padStart(2, "0")}h` }));
  const dias_ = (d.por_dia || []).map((x) => ({
    ...x,
    label: new Date(`${x.dia}T12:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }),
  }));
  const maxCanal = Math.max(1, ...(d.por_canal || []).map((c) => Number(c.ventas)));

  const min = (v) => (v == null ? "—" : `${Math.round(Number(v))} min`);

  return (
    <div className="flex-1 min-h-0 overflow-auto px-4 xl:px-6 pb-6 space-y-4">
      <div className="flex items-center gap-1.5">
        {[1, 7, 30].map((n) => (
          <button key={n} onClick={() => setDias(n)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-md border transition-colors ${
              dias === n ? "border-acento bg-acento-suave text-texto" : "border-borde bg-superficie text-texto-suave hover:bg-superficie-2"}`}>
            {n === 1 ? "Hoy" : `${n} días`}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Indicador rotulo="Pedidos" valor={nf.format(d.pedidos || 0)} sub={`${d.completados || 0} completados`} />
        <Indicador rotulo="Vendido" valor={money(d.ventas || 0)} />
        <Indicador rotulo="Ticket promedio" valor={money(d.ticket || 0)} />
        <Indicador rotulo="Cancelados" valor={nf.format(d.cancelados || 0)}
          sub={d.pedidos ? `${Math.round((d.cancelados / d.pedidos) * 100)}% de los pedidos` : null}
          tono={d.cancelados > 0 ? "mal" : "neutro"} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Indicador rotulo="Preparación" valor={min(d.minutos_preparacion)} sub="De aceptado a listo" />
        <Indicador rotulo="Entrega" valor={min(d.minutos_entrega)} sub="De listo a completado" />
        <Indicador rotulo="Total" valor={min(d.minutos_total)} sub="Lo que espera el cliente" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-borde bg-superficie p-5">
          <Rotulo className="mb-3">Por canal</Rotulo>
          <ul className="space-y-2.5">
            {(d.por_canal || []).map((c) => (
              <li key={c.canal}>
                <div className="flex justify-between text-sm gap-3">
                  <span className="truncate">{c.nombre}</span>
                  <span className="f-m shrink-0">{money(c.ventas)} <span className="text-texto-tenue text-xs">· {c.pedidos}</span></span>
                </div>
                <div className="h-1.5 bg-superficie-2 rounded-full mt-1 overflow-hidden">
                  <div className={`h-full rounded-full ${tonoCanal({ color: c.color }).punto}`}
                    style={{ width: `${(Number(c.ventas) / maxCanal) * 100}%` }} />
                </div>
              </li>
            ))}
            {!(d.por_canal || []).length && (
              <li className="text-center py-8 text-sm text-texto-tenue">Sin pedidos en el período.</li>
            )}
          </ul>
        </div>

        <div className="rounded-lg border border-borde bg-superficie p-5">
          <Rotulo className="mb-3">Por hora del día</Rotulo>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={horas} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgb(var(--borde))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "rgb(var(--texto-tenue))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "rgb(var(--texto-tenue))" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip formatter={(v, n) => [n === "ventas" ? money(v) : v, n === "ventas" ? "Vendido" : "Pedidos"]}
                contentStyle={{ fontSize: 12, borderRadius: 8, background: "rgb(var(--superficie))", border: "1px solid rgb(var(--borde))" }} />
              <Bar dataKey="pedidos" fill="rgb(var(--acento))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {dias > 1 && (
        <div className="rounded-lg border border-borde bg-superficie p-5">
          <Rotulo className="mb-3">Día a día</Rotulo>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={dias_} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="gPed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(var(--acento))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="rgb(var(--acento))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="rgb(var(--borde))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "rgb(var(--texto-tenue))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "rgb(var(--texto-tenue))" }} axisLine={false} tickLine={false} width={70}
                tickFormatter={(v) => money(v)} />
              <Tooltip formatter={(v) => money(v)} labelFormatter={(l) => `Día ${l}`}
                contentStyle={{ fontSize: 12, borderRadius: 8, background: "rgb(var(--superficie))", border: "1px solid rgb(var(--borde))" }} />
              <Area type="monotone" dataKey="ventas" stroke="rgb(var(--acento))" strokeWidth={2} fill="url(#gPed)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function Indicador({ rotulo, valor, sub, tono = "neutro" }) {
  return (
    <div className="rounded-lg border border-borde bg-superficie p-5">
      <Rotulo>{rotulo}</Rotulo>
      <div className={`f-d text-[34px] leading-none mt-1.5 ${tono === "mal" ? "text-mal" : ""}`}>{valor}</div>
      {sub && <div className="text-xs text-texto-tenue mt-1">{sub}</div>}
    </div>
  );
}

/* ============================================================
   CONFIGURACIÓN · los canales

   Es la pantalla que hace verdad lo que dice la migración 0020: agregar
   WhatsApp o un marketplace nuevo es cargar una fila, no tocar código.
   ============================================================ */

const FLUJO_LOCAL = ["pendiente", "en_preparacion", "listo", "completado"];
const FLUJO_REPARTO = ["pendiente", "en_preparacion", "listo", "en_camino", "completado"];

function Canales({ empresaId, canales, setCanales, toast }) {
  const [alta, setAlta] = useState(false);
  const [editando, setEditando] = useState(null);

  const avisar = useRef(toast);
  avisar.current = toast;

  const releer = async () => {
    try { setCanales(await cargarCanales(empresaId)); }
    catch (e) { avisar.current(e.message || "No pudimos leer los canales.", "mal"); }
  };

  const apagar = async (c) => {
    try {
      await guardarCanal(c.id, { activo: !c.activo });
      await releer();
    } catch (e) { avisar.current(e.message || "No se pudo guardar.", "mal"); }
  };

  return (
    <div className="flex-1 min-h-0 overflow-auto px-4 md:px-6 pb-6">
      <div className="flex items-center justify-between pb-3">
        <p className="text-sm text-texto-suave max-w-xl">
          Por dónde entran los pedidos. Un canal apagado deja de ofrecerse al tomar
          un pedido, pero los que ya entraron por ahí siguen siendo suyos.
        </p>
        <Boton onClick={() => setAlta(true)}><Plus size={16} /> Nuevo canal</Boton>
      </div>

      <div className="rounded-lg border border-borde overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.1em] text-texto-tenue border-b border-borde bg-superficie-2">
              <th className="px-4 py-2.5 font-bold">Canal</th>
              <th className="px-4 py-2.5 font-bold">Clave</th>
              <th className="px-4 py-2.5 font-bold">Recorrido</th>
              <th className="px-4 py-2.5 font-bold">Número</th>
              <th className="px-4 py-2.5 font-bold text-right">Activo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {canales.map((c) => {
              const t = tonoCanal(c);
              return (
                <tr key={c.id} className={`hover:bg-superficie-2 ${c.activo ? "" : "opacity-50"}`}>
                  <td className="px-4 py-3">
                    <button onClick={() => setEditando(c)} className="flex items-center gap-2.5 text-left">
                      <SelloCanal canal={c} size={30} />
                      <span className={`font-semibold ${t.txt}`}>{c.nombre}</span>
                      <Pencil size={13} className="text-texto-tenue" />
                    </button>
                  </td>
                  <td className="px-4 py-3 f-m text-xs text-texto-tenue">{c.clave}</td>
                  <td className="px-4 py-3 text-xs text-texto-suave">
                    {c.flujo.map((e) => estadoPorK(e).corto).join(" → ")}
                  </td>
                  <td className="px-4 py-3 text-xs text-texto-suave">{c.externo ? "Lo trae el canal" : "Lo pone Genez"}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => apagar(c)} title={c.activo ? "Apagar" : "Prender"}
                      className={`w-9 h-5 rounded-full relative transition-colors ${c.activo ? "bg-acento" : "bg-superficie-3"}`}>
                      <span className="absolute top-0.5 w-4 h-4 rounded-full bg-superficie transition-all"
                        style={{ left: c.activo ? 18 : 2 }} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <FormCanal abierto={alta || !!editando} inicial={editando}
        onCerrar={() => { setAlta(false); setEditando(null); }}
        onGuardar={async (d) => {
          try {
            if (editando) await guardarCanal(editando.id, d);
            else await crearCanal(empresaId, d);
            setAlta(false); setEditando(null);
            await releer();
            avisar.current("Canal guardado.");
          } catch (e) { avisar.current(e.message || "No se pudo guardar el canal.", "mal"); }
        }} />
    </div>
  );
}

function FormCanal({ abierto, inicial, onCerrar, onGuardar }) {
  const [d, setD] = useState({});

  useEffect(() => {
    if (!abierto) return;
    setD(inicial ? { ...inicial } : {
      nombre: "", clave: "", familia: "app", flujo: FLUJO_REPARTO,
      externo: true, color: "app", icono: "Globe",
    });
  }, [abierto, inicial]);

  if (!abierto) return null;

  const enCamino = (d.flujo || []).includes("en_camino");

  return (
    <Modal open onClose={onCerrar} ancho="max-w-lg">
      <div className="p-6">
        <h3 className="f-d text-lg">{inicial ? "Editar el canal" : "Nuevo canal"}</h3>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <Campo label="Nombre">
            <input value={d.nombre || ""} autoFocus
              onChange={(e) => setD({
                ...d, nombre: e.target.value,
                /* La clave se arma sola sacando tildes y espacios: quien
                   carga un canal no tiene por qué saber qué es una clave. */
                clave: inicial ? d.clave : e.target.value.toLowerCase()
                  .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, ""),
              })}
              placeholder="WhatsApp" className={inputCls} />
          </Campo>
          <Campo label="Clave">
            <input value={d.clave || ""} disabled={!!inicial}
              onChange={(e) => setD({ ...d, clave: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
              className={`${inputCls} f-m disabled:opacity-50`} />
          </Campo>
        </div>

        <div className="mt-4">
          <Rotulo className="mb-1.5">Recorrido del pedido</Rotulo>
          <div className="grid grid-cols-2 gap-2">
            {[
              { f: FLUJO_LOCAL, n: "Se retira acá", d: "Pendiente → preparación → listo → completado" },
              { f: FLUJO_REPARTO, n: "Sale a la calle", d: "Suma la etapa 'en camino'" },
            ].map((o) => (
              <button key={o.n} onClick={() => setD({ ...d, flujo: o.f })}
                className={`text-left px-3.5 py-3 rounded-md border transition-colors ${
                  (enCamino ? o.f === FLUJO_REPARTO : o.f === FLUJO_LOCAL)
                    ? "border-acento bg-acento-suave" : "border-borde hover:bg-superficie-2"}`}>
                <div className="text-sm font-semibold">{o.n}</div>
                <div className="text-[11px] text-texto-tenue leading-tight mt-0.5">{o.d}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <Campo label="Color">
            <select value={d.color || "app"} onChange={(e) => setD({ ...d, color: e.target.value })} className={inputCls}>
              {COLORES_DISPONIBLES.filter((c) => c !== "salon").map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Campo>
          <Campo label="Ícono">
            <select value={d.icono || "Globe"} onChange={(e) => setD({ ...d, icono: e.target.value })} className={inputCls}>
              {ICONOS_DISPONIBLES.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </Campo>
        </div>

        <label className="flex items-center gap-2.5 mt-4 text-sm cursor-pointer">
          <input type="checkbox" checked={!!d.externo} onChange={(e) => setD({ ...d, externo: e.target.checked })}
            className="accent-[rgb(var(--acento))] w-4 h-4" />
          El número del pedido lo pone el canal, no Genez
        </label>

        <div className="flex items-center gap-3 mt-5 rounded-md border border-borde bg-superficie-2 px-4 py-3">
          <SelloCanal canal={d} size={34} />
          <span className={`font-semibold ${tonoCanal(d).txt}`}>{d.nombre || "Así se va a ver"}</span>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <Boton variant="quiet" onClick={onCerrar}>Cancelar</Boton>
          {/* La familia sale del recorrido y no se pregunta aparte: es
              lo mismo dicho dos veces, y preguntado dos veces termina
              contestado distinto. */}
          <Boton disabled={!d.nombre || !d.clave} onClick={() => onGuardar({
            nombre: d.nombre.trim(), clave: d.clave,
            familia: enCamino ? "reparto" : "retiro",
            flujo: d.flujo, externo: !!d.externo, color: d.color, icono: d.icono,
          })}>
            <Check size={15} /> Guardar
          </Boton>
        </div>
      </div>
    </Modal>
  );
}
