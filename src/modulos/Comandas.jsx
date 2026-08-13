/* ============================================================
   15. COMANDAS · la pantalla del día de un negocio gastronómico
   ============================================================

   La otra forma de vender. En el mostrador el cobro nace y muere en el
   mismo acto; acá el pedido se abre, junta consumos durante un rato y
   recién al final se cobra.

   Lo que manda es el orden real de un bar: la mayoría de las ventas
   entran por el mostrador y por las aplicaciones, no por mesa. Por eso
   `PantallaComandas` arranca lista para tomar un pedido y el salón es un
   camino más, al que se entra cuando llega alguien.

   Cuatro pantallas para manos distintas: la de inicio (canales, salón y
   lo que está en curso), la del pedido —la misma para una mesa y para un
   delivery—, el tablero de mostrador y la cocina, que es una pantalla
   colgada en la pared que nadie va a tocar.

   Los totales, los tiempos y los estados los calcula la base (ver
   src/datos/comandas.js). Este archivo dibuja y traduce, no decide.
   ============================================================ */

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  ArrowLeft, Clock, Check, Plus, Minus, Trash2, Search,
  StickyNote, X, RefreshCw, ChefHat, Store, History, Filter,
  UtensilsCrossed, ChevronRight,
  Users, MoreVertical, Pencil, CreditCard, Percent, Printer, Split,
  Receipt, FileText,
  Pizza, Beef, Sandwich, Salad, Soup, Fish, Drumstick, Coffee, Wine, Beer,
  CupSoda, IceCream, Cake, Croissant, Cookie, Milk, Flame, Utensils,
} from "lucide-react";
import { money, hora, mediosDe, conRecargo, FISCAL_INICIAL } from "../utils/helpers.js";
import { siguienteNumero } from "../datos/ventas.js";
import {
  cargarSalon, cargarRecursos, abrirComanda, cargarComanda, cargarCarta, agregarLinea,
  anularLinea, cambiarCantidad, enviarACocina, cargarCocina, moverComanda, cerrarComanda,
  abrirPedido, cargarElementosPlano, cambiarCanal,
  aplicarDescuento, quitarDescuento, guardarComensales,
} from "../datos/comandas.js";
import { cargarPedidos, cargarCanales } from "../datos/pedidos.js";
import { Card, Boton, Modal, Vacio, Apagado, imprimirComandera, preCuenta } from "../ui/Base.jsx";
import { Campo, inputCls } from "../ui/Campos.jsx";
import { tonoCanal, IconoCanal } from "../ui/canales.jsx";
import { CentroPedidos, ModalNuevoPedido } from "./CentroPedidos.jsx";
import { PlanoSalon } from "./PlanoSalon.jsx";

/* Los minutos se calculan contra el reloj real y no contra HOY: acá no se
   está mirando una serie histórica, se está mirando una mesa que espera. */
const minutosDesde = (fecha) =>
  fecha ? Math.max(0, Math.round((Date.now() - fecha.getTime()) / 60000)) : 0;

const espera = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);

const activas = (lineas) => (lineas || []).filter((l) => l.estado !== "anulada");

/* Cómo se ve cada canal está en src/ui/canales.jsx, y qué canales hay
   sale de la base (migración 0020). Acá no hay una lista de canales a
   propósito: era el lugar donde había que acordarse de agregar cada
   aplicación nueva, y nadie se acuerda. */

/* La pantalla del pedido es una sola y atiende dos cosas distintas: una
   mesa del salón y un pedido que no ocupa lugar. Lo único que cambia son
   las palabras, así que van acá y no duplicadas en dos componentes. */
const VOZ_MESA = {
  volver: "Salón",
  abriendo: "Abriendo la mesa…",
  panel: "Lo que lleva la mesa",
  sinNada: "Todavía no pidieron nada. Tocá un plato de la carta.",
  cobrar: "Cobrar la mesa",
  cobrarYCerrar: "Cobrar y liberar la mesa",
  soltar: "Liberar la mesa",
  /* En la grilla de acciones el rótulo entra en un tercio del panel:
     "Cancelar el pedido" se cortaba en "Cancelar el ...". El largo va en
     el title, que es donde se puede leer entero. */
  soltarCorto: "Liberar",
  soltado: "quedó libre",
};

const VOZ_CANAL = {
  volver: "Pedidos",
  abriendo: "Abriendo el pedido…",
  panel: "Lo que lleva el pedido",
  sinNada: "Todavía no cargaste nada. Tocá un plato de la carta.",
  cobrar: "Cobrar el pedido",
  cobrarYCerrar: "Cobrar y cerrar el pedido",
  soltar: "Cancelar el pedido",
  soltarCorto: "Cancelar",
  soltado: "quedó cancelado",
};

/* El nombre del canal sale de su fila, no de una constante: si el
   comercio le puso "Pedidos por WhatsApp", eso es lo que tiene que
   leerse arriba del pedido. */
function rotuloCanal(p, canales = []) {
  if (p.canalNombre) return p.canalNombre;
  const c = canales.find((x) => x.clave === p.canal);
  return c ? c.nombre : p.canal;
}

function encabezadoDe(p, canales = []) {
  const cli = p.cliente || {};
  return {
    titulo: [rotuloCanal(p, canales), p.referencia ? `#${p.referencia}` : null].filter(Boolean).join(" · "),
    sub: [cli.nombre, cli.telefono].filter(Boolean).join(" · "),
  };
}

/* El salón con las uniones puestas.
   `cargarSalon` mapea la vista con `aMesa`, que no expone `unida_a` aunque
   la vista sí lo trae: sin ese dato el plano no puede dibujar dos mesas
   juntas como un bloque ni sumar la capacidad. Hasta que el mapeo lo
   exponga, se completa con los recursos crudos, que sí lo tienen. */
async function leerSalon(empresaId) {
  const [mesas, recursos] = await Promise.all([cargarSalon(empresaId), cargarRecursos(empresaId)]);

  const jefa = new Map();
  const sumadas = new Map();   // id de la principal -> { cuantas, lugares }
  for (const r of recursos) {
    jefa.set(r.id, r.unida_a || null);
    if (!r.unida_a) continue;
    const acum = sumadas.get(r.unida_a) || { cuantas: 0, lugares: 0 };
    acum.cuantas += 1;
    acum.lugares += Number(r.capacidad) || 0;
    sumadas.set(r.unida_a, acum);
  }

  return mesas.map((m) => {
    const acum = sumadas.get(m.id) || { cuantas: 0, lugares: 0 };
    return {
      ...m,
      unidaA: jefa.get(m.id) || null,
      unidas: acum.cuantas,
      capacidadTotal: (Number(m.capacidad) || 0) + acum.lugares,
    };
  });
}

function Rotulo({ children, className = "" }) {
  return (
    <div className={`text-[11px] uppercase tracking-widest text-texto-tenue font-bold ${className}`}>
      {children}
    </div>
  );
}

/* ============================================================
   1. LA PANTALLA · canales, salón y lo que está en curso
   ============================================================

   Es lo que "Cobrar" es para el minimercado: la pantalla donde se pasa el
   día. Se entra lista para tomar un pedido, y lo que ya está andando se
   ve de un vistazo para poder retomarlo de un toque.
   ============================================================ */

export function PantallaComandas({ empresaId, sucursalId = null, config = {}, ajustes, caja, permisos = {}, sesion = null, toast }) {
  const [donde, setDonde] = useState("inicio");     // inicio | salon
  const [abierta, setAbierta] = useState(null);     // la comanda que se está atendiendo
  const [pedidos, setPedidos] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [elementos, setElementos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [nuevo, setNuevo] = useState(null);         // canal elegido, esperando los datos
  const [cambiando, setCambiando] = useState(false);
  const [abriendo, setAbriendo] = useState(null);   // id de mesa o clave de canal
  const [canales, setCanales] = useState([]);

  /* toast se redefine en cada render de Sistema. Si entra como dependencia,
     el efecto de carga se vuelve a disparar para siempre. */
  const avisar = useRef(toast);
  avisar.current = toast;
  const releer = useRef(() => {});

  useEffect(() => {
    let vivo = true;
    cargarCanales(empresaId)
      .then((cs) => { if (vivo) setCanales(cs); })
      .catch((e) => avisar.current(e.message || "No pudimos leer los canales.", "mal"));
    return () => { vivo = false; };
  }, [empresaId]);

  /* Mientras se está adentro de un pedido no se refresca nada: la pantalla
     no se ve y la lectura vieja no sirve para nada. */
  useEffect(() => {
    if (abierta) return undefined;
    let vivo = true;
    const leer = async () => {
      try {
        const [p, m, e] = await Promise.all([
          cargarPedidos(empresaId), leerSalon(empresaId), cargarElementosPlano(empresaId),
        ]);
        if (!vivo) return;
        setPedidos(p); setMesas(m); setElementos(e);
      } catch (err) {
        if (vivo) avisar.current(err.message || "No pudimos leer los pedidos.", "mal");
      } finally {
        if (vivo) setCargando(false);
      }
    };
    releer.current = leer;
    leer();
    const id = setInterval(leer, 20000);
    return () => { vivo = false; clearInterval(id); };
  }, [empresaId, abierta]);

  /* `volverA` es de dónde salió el pedido: quien está mirando el salón y
     toma un take away tiene que volver al salón, no a la pantalla de
     inicio. */
  const abrirCanal = async (datos, volverA = "inicio") => {
    if (abriendo) return;
    setAbriendo(datos.canal);
    try {
      const id = await abrirPedido({ empresaId, sucursalId, ...datos });
      setNuevo(null);
      setAbierta({ id, voz: VOZ_CANAL, datos, encabezado: encabezadoDe(datos, canales), volverA });
    } catch (e) {
      avisar.current(e.message || "No se pudo abrir el pedido.", "mal");
    } finally {
      setAbriendo(null);
    }
  };

  /* Mostrador lleva al tablero, no a una comanda en blanco. Quien atiende
     necesita ver primero qué hay pendiente —cuántos esperan, hace cuánto,
     de qué aplicación— y recién desde ahí decide si toma uno nuevo. */
  const tocarCanal = (k) => (k === "mostrador" ? setDonde("mostrador") : setNuevo(k));

  /* Los datos del pedido viajan enteros para poder corregirle el canal sin
     perder de quién era ni con qué número entró. */
  const retomar = (p, volverA = "inicio") => {
    const datos = { canal: p.canal, referencia: p.referencia || null, cliente: p.cliente || null };
    setAbierta({ id: p.id, voz: VOZ_CANAL, datos, encabezado: encabezadoDe(p, canales), volverA });
  };

  const entrarAMesa = async (mesa, volverA) => {
    if (abriendo) return;
    if (mesa.comandaId) {
      return setAbierta({ id: mesa.comandaId, voz: VOZ_MESA, encabezado: null, volverA });
    }
    setAbriendo(mesa.id);
    try {
      const id = await abrirComanda({ empresaId, sucursalId, recursoId: mesa.id });
      setAbierta({ id, voz: VOZ_MESA, encabezado: null, volverA });
    } catch (e) {
      avisar.current(e.message || "No se pudo abrir la mesa.", "mal");
    } finally {
      setAbriendo(null);
    }
  };

  /* El canal se corrige mientras se carga el pedido. Una mesa no: ya se
     sabe de dónde viene. */
  const corregirCanal = async (datos) => {
    try {
      await cambiarCanal(abierta.id, datos);
      setAbierta((a) => ({ ...a, datos, encabezado: encabezadoDe(datos, canales) }));
      setCambiando(false);
    } catch (e) {
      avisar.current(e.message || "No se pudo cambiar el canal.", "mal");
    }
  };

  if (abierta) {
    /* Es una mesa por su voz y no por dónde vuelve: desde el salón también
       se toma un take away, y ese vuelve al salón sin ser una mesa. */
    const esMesa = abierta.voz === VOZ_MESA;
    const volver = abierta.volverA === "salon" ? "Salón" : "Pedidos";
    return (
      <>
        <Pedido
          pleno comandaId={abierta.id} empresaId={empresaId} config={config}
          ajustes={ajustes} caja={caja} toast={toast}
          empleado={sesion ? sesion.nombre : ""}
          voz={esMesa ? VOZ_MESA : { ...abierta.voz, volver }}
          encabezado={abierta.encabezado}
          onCambiarCanal={esMesa ? null : (otro) =>
            (otro ? corregirCanal({ ...(abierta.datos || {}), ...otro }) : setCambiando(true))}
          onVolver={() => { setDonde(abierta.volverA); setAbierta(null); }} />

        <ModalNuevoPedido abierto={cambiando} canales={canales} rotulo="¿Para dónde es?"
          onCerrar={() => setCambiando(false)} onCrear={corregirCanal} />
      </>
    );
  }

  /* El tablero ocupa la pantalla entera, con su propia barra lateral. Antes
     se mostraba como una pestaña del panel y quedaba una ventana adentro
     de otra: dos barras laterales compitiendo por el mismo trabajo. */
  if (donde === "mostrador") {
    return (
      <CentroPedidos
        empresaId={empresaId} sucursalId={sucursalId}
        ajustes={ajustes} permisos={permisos} toast={toast}
        onVolver={() => setDonde("inicio")}
        onSalon={() => setDonde("salon")}
        /* El centro de pedidos no sabe cargar un plato ni cobrar: para eso
           está la pantalla del pedido, que es la misma para una mesa y para
           un delivery. Se la abre desde acá en vez de duplicarla adentro. */
        onAbrirPedido={(p) => retomar(p, "mostrador")}
      />
    );
  }

  if (donde === "salon") {
    return (
      <div className="h-full flex flex-col min-h-0">
        <div className="shrink-0 flex items-center gap-3 pb-3">
          <Boton variant="ghost" size="lg" onClick={() => setDonde("inicio")}>
            <ArrowLeft size={18} /> Pedidos
          </Boton>
          <h2 className="f-d text-lg">Salón</h2>
        </div>
        <div className="flex-1 min-h-0">
          <PlanoSalon
            pleno mesas={mesas} elementos={elementos} cargando={cargando} abriendo={abriendo}
            puedeEditar={!!permisos.ajustes} empresaId={empresaId} sucursalId={sucursalId}
            toast={toast} onTocarMesa={(m) => entrarAMesa(m, "salon")}
            onMostrador={() => abrirCanal({ canal: "mostrador" }, "salon")}
            onTakeAway={() => setNuevo("takeaway")}
            onActualizar={() => releer.current()} onGuardado={() => releer.current()} />
        </div>

        <ModalNuevoPedido abierto={!!nuevo} canales={canales} canalInicial={nuevo} trabajando={!!abriendo}
          onCerrar={() => setNuevo(null)} onCrear={(datos) => abrirCanal(datos, "salon")} />
      </div>
    );
  }

  const enCurso = pedidos.filter((p) => p.estado !== "completado" && p.estado !== "cancelado");
  const ocupadas = mesas.filter((m) => m.ocupada);
  const haySalon = mesas.length > 0 || elementos.length > 0 || !!permisos.ajustes;
  const activos = enCurso.length + ocupadas.length;

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-6xl space-y-5 pb-6">
        {/* Dos caminos y no cinco. Lo que se decide acá es dónde se atiende
            —una mesa o el mostrador—, no por qué canal entró el pedido. El
            canal recién importa al comandar: quien está en el mostrador
            todavía no sabe si le van a pedir para llevar o si es un pedido
            de aplicación que acaba de sonar. */}
        <section>
          <Rotulo className="mb-2">Tomar un pedido</Rotulo>
          <div className="grid sm:grid-cols-2 gap-3">
            {haySalon && (
              <button onClick={() => setDonde("salon")}
                className="flex items-center gap-4 rounded-2xl border border-borde bg-superficie p-5 text-left transition-colors hover:bg-superficie-2 hover:border-borde-fuerte">
                <span className="w-14 h-14 rounded-2xl bg-superficie-2 border border-borde-fuerte text-texto-suave flex items-center justify-center shrink-0">
                  <UtensilsCrossed size={26} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="f-d text-xl leading-tight block">Salón</span>
                  <span className="text-xs text-texto-tenue block mt-0.5">
                    {mesas.length
                      ? `${ocupadas.length} ocupadas de ${mesas.length} mesas`
                      : "Todavía no hay mesas dibujadas"}
                  </span>
                </span>
                {ocupadas.length > 0 && (
                  <span className="f-m text-lg shrink-0">
                    {money(ocupadas.reduce((s, m) => s + (m.consumido || 0), 0))}
                  </span>
                )}
                <ChevronRight size={20} className="text-texto-tenue shrink-0" />
              </button>
            )}

            <button onClick={() => tocarCanal("mostrador")} disabled={!!abriendo}
              className="flex items-center gap-4 rounded-2xl border border-acento bg-acento-suave p-5 text-left transition-colors hover:bg-superficie-2 disabled:opacity-40">
              <span className="w-14 h-14 rounded-2xl bg-acento text-sobre-acento flex items-center justify-center shrink-0">
                <Store size={26} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="f-d text-xl leading-tight block">Mostrador</span>
                <span className="text-xs text-texto-suave block mt-0.5">
                  {abriendo === "mostrador" ? "Abriendo…" : "Para llevar, delivery o aplicación"}
                </span>
              </span>
              <ChevronRight size={20} className="text-texto-suave shrink-0" />
            </button>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <Rotulo>En curso · {activos}</Rotulo>
            <Boton size="sm" variant="quiet" onClick={() => releer.current()}>
              <RefreshCw size={14} /> Actualizar
            </Boton>
          </div>

          {cargando && <Vacio>Cargando lo que está abierto…</Vacio>}

          {!cargando && !activos && (
            <Vacio>No hay nada abierto. Tocá un canal para arrancar un pedido.</Vacio>
          )}

          {activos > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {enCurso.map((p) => (
                <TarjetaEnCurso key={p.id} canal={p} nombreCanal={rotuloCanal(p, canales)}
                  titulo={p.cliente.nombre || (p.referencia ? `#${p.referencia}` : rotuloCanal(p, canales))}
                  sub={p.cliente.nombre && p.referencia ? `#${p.referencia}` : null}
                  minutos={minutosDesde(p.abiertaEn)} total={p.total}
                  estado={estadoPedido(p)} onTocar={() => retomar(p)} />
              ))}
              {ocupadas.map((m) => (
                <TarjetaEnCurso key={m.id} canal={{ color: "salon" }} nombreCanal="Salón"
                  titulo={m.nombre} sub={m.sector || null}
                  minutos={m.minutos == null ? 0 : m.minutos} total={m.consumido}
                  estado={estadoMesa(m)}
                  abriendo={abriendo === m.id}
                  onTocar={() => entrarAMesa(m, "inicio")} />
              ))}
            </div>
          )}
        </section>
      </div>

      <ModalNuevoPedido abierto={!!nuevo} canales={canales} canalInicial={nuevo} trabajando={!!abriendo}
        onCerrar={() => setNuevo(null)} onCrear={abrirCanal} />
    </div>
  );
}

/* El estado se lee sin leer: lo que está listo y nadie retiró es lo único
   que tiene que gritar. */
function estadoPedido(p) {
  if (p.estado === "en_camino") return { n: "En camino", tono: "text-bien" };
  if (p.estado === "listo") return { n: "Listo para entregar", tono: "text-ojo" };
  if (p.estado === "en_preparacion") return { n: "En preparación", tono: "text-acento" };
  return { n: p.items ? `${p.items} item${p.items === 1 ? "" : "s"} sin enviar` : "Sin cargar", tono: "text-texto-tenue" };
}

function estadoMesa(m) {
  if (m.listos > 0) return { n: `${m.listos} para servir`, tono: "text-bien" };
  if (m.enCocina > 0) return { n: `${m.enCocina} en cocina`, tono: "text-ojo" };
  return { n: m.items ? `${m.items} item${m.items === 1 ? "" : "s"}` : "Recién abierta", tono: "text-texto-tenue" };
}

function TarjetaEnCurso({ canal, nombreCanal, titulo, sub, minutos, total, estado, abriendo, onTocar }) {
  const t = tonoCanal(canal);
  return (
    <button onClick={onTocar} disabled={abriendo}
      className={`w-full text-left rounded-xl border bg-superficie p-3.5 transition-colors hover:bg-superficie-2 disabled:opacity-50 ${t.borde}`}>
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${t.suave} ${t.txt} ${t.borde}`}>
          <IconoCanal canal={canal} size={12} /> {nombreCanal}
        </span>
        <span className="ml-auto flex items-center gap-1 text-[11px] text-texto-suave shrink-0">
          <Clock size={11} /> {espera(minutos)}
        </span>
      </div>

      <div className="f-d text-lg leading-tight mt-2 truncate">{titulo}</div>
      <div className="text-xs text-texto-tenue truncate h-4">{abriendo ? "Abriendo…" : sub || ""}</div>

      <div className="flex items-end justify-between gap-2 mt-2">
        <span className="f-m text-xl">{money(total)}</span>
        <span className={`text-xs font-semibold text-right ${estado.tono}`}>{estado.n}</span>
      </div>
    </button>
  );
}

/* ============================================================
   2. SALÓN · la misma pantalla, adentro del panel
   ============================================================ */

export function Comandas({ empresaId, sucursalId = null, config = {}, ajustes, caja, permisos = {}, sesion = null, toast }) {
  const [mesas, setMesas] = useState([]);
  const [elementos, setElementos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [comandaId, setComandaId] = useState(null);
  const [abriendo, setAbriendo] = useState(null);
  const [nuevo, setNuevo] = useState(null);   // canal elegido, esperando los datos

  const avisar = useRef(toast);
  avisar.current = toast;

  const releerSalon = useCallback(async () => {
    try {
      const [m, e] = await Promise.all([leerSalon(empresaId), cargarElementosPlano(empresaId)]);
      setMesas(m);
      setElementos(e);
    } catch (e) {
      avisar.current(e.message || "No pudimos cargar el salón.", "mal");
    } finally {
      setCargando(false);
    }
  }, [empresaId]);

  useEffect(() => { releerSalon(); }, [releerSalon]);

  const entrar = async (mesa) => {
    if (abriendo) return;
    if (mesa.comandaId) return setComandaId(mesa.comandaId);
    setAbriendo(mesa.id);
    try {
      const id = await abrirComanda({ empresaId, sucursalId, recursoId: mesa.id });
      setComandaId(id);
    } catch (e) {
      avisar.current(e.message || "No se pudo abrir la mesa.", "mal");
    } finally {
      setAbriendo(null);
    }
  };

  /* Del salón también salen pedidos que no ocupan mesa: el que atiende ve
     el mapa y le piden un café para llevar. */
  const abrirCanal = async (datos) => {
    if (abriendo) return;
    setAbriendo(datos.canal);
    try {
      const id = await abrirPedido({ empresaId, sucursalId, ...datos });
      setNuevo(null);
      setComandaId(id);
    } catch (e) {
      avisar.current(e.message || "No se pudo abrir el pedido.", "mal");
    } finally {
      setAbriendo(null);
    }
  };

  const volver = () => { setComandaId(null); releerSalon(); };

  if (comandaId) {
    return (
      <Pedido comandaId={comandaId} empresaId={empresaId} config={config}
        ajustes={ajustes} caja={caja} toast={toast}
        empleado={sesion ? sesion.nombre : ""} onVolver={volver} />
    );
  }

  /* Sin nada dibujado y sin permiso para dibujarlo, un plano vacío no
     dice nada: mejor la frase. */
  if (!cargando && !mesas.length && !elementos.length && !permisos.ajustes) {
    return <Vacio>Todavía no hay mesas cargadas para este comercio.</Vacio>;
  }

  return (
    <>
      <PlanoSalon
        mesas={mesas} elementos={elementos} cargando={cargando} abriendo={abriendo}
        puedeEditar={!!permisos.ajustes} empresaId={empresaId} sucursalId={sucursalId}
        toast={toast} onTocarMesa={entrar}
        onMostrador={() => abrirCanal({ canal: "mostrador" })}
        onTakeAway={() => setNuevo("takeaway")}
        onActualizar={releerSalon} onGuardado={releerSalon} />

      <ModalNuevoPedido abierto={!!nuevo} canalInicial={nuevo} trabajando={!!abriendo}
        onCerrar={() => setNuevo(null)} onCrear={abrirCanal} />
    </>
  );
}

/* ============================================================
   3. PEDIDO
   ============================================================

   La comanda a la izquierda y la carta a la derecha. La comanda es lo que
   se mira mientras la persona habla, así que no se mueve de lugar aunque
   la carta cambie de categoría.

   `pleno` es la diferencia entre vivir a pantalla completa —donde cada
   panel scrollea por su cuenta y la página no se mueve— y estar metida
   adentro del panel, que scrollea como cualquier otra pestaña.
   ============================================================ */

/* `encabezado` y `voz` son lo único que distingue una mesa de un pedido de
   mostrador. Sin ellos se comporta como siempre: la mesa que abrió el mozo.

   `onCambiarCanal` recibe un canal para pasar el pedido derecho a
   mostrador o para llevar, o nada para preguntar por el canal completo. */
function Pedido({ comandaId, empresaId, config, ajustes = {}, caja = {}, toast, onVolver, onCambiarCanal = null, encabezado = null, voz = VOZ_MESA, empleado = "", pleno = false }) {
  const [comanda, setComanda] = useState(null);
  const [carta, setCarta] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(null);           // categoría elegida en las solapas
  const [detalle, setDetalle] = useState(null);   // item al que se le cargan modificadores
  const [cobrando, setCobrando] = useState(false);
  const [descontando, setDescontando] = useState(false);
  const [contando, setContando] = useState(false);  // cuánta gente hay en la mesa
  const [trabajando, setTrabajando] = useState(false);
  const [panel, setPanel] = useState("carta");    // solo manda en pantalla chica

  /* La hora de la barra de abajo es la del reloj de verdad y no HOY: el
     que atiende la usa para saber cuánto hace que espera la mesa. */
  const [reloj, setReloj] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setReloj(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const avisar = useRef(toast);
  avisar.current = toast;

  /* Un mozo carga cuatro platos más rápido de lo que contesta el servidor.
     Las respuestas pueden volver desordenadas, así que solo se pinta la
     última pedida: si no, una lectura vieja borra de pantalla lo recién
     agregado. */
  const turno = useRef(0);

  const leerComanda = useCallback(async () => {
    const mio = ++turno.current;
    try {
      const c = await cargarComanda(comandaId);
      if (mio === turno.current) setComanda(c);
    } catch (e) {
      avisar.current(e.message || "No pudimos leer la comanda.", "mal");
    }
  }, [comandaId]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    Promise.all([cargarComanda(comandaId), cargarCarta(empresaId)])
      .then(([c, ca]) => { if (vigente) { setComanda(c); setCarta(ca); } })
      .catch((e) => { if (vigente) avisar.current(e.message || "No pudimos abrir la mesa.", "mal"); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [comandaId, empresaId]);

  const categorias = useMemo(() => carta.map((g) => g.categoria), [carta]);

  useEffect(() => {
    if (!categorias.length) return;
    if (!cat || !categorias.includes(cat)) setCat(categorias[0]);
  }, [categorias, cat]);

  /* Buscando no mandan las solapas: quien escribe "milanesa" no sabe ni le
     importa en qué categoría la cargaron. */
  const items = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t) {
      return carta.flatMap((g) => g.items).filter((i) => i.nombre.toLowerCase().includes(t));
    }
    const g = carta.find((x) => x.categoria === cat) || carta[0];
    return g ? g.items : [];
  }, [carta, q, cat]);

  /* Agregar no se bloquea a sí mismo: quien toma el pedido no puede quedar
     esperando al servidor entre plato y plato. */
  const agregar = async (item, extra = {}) => {
    try {
      await agregarLinea({
        comandaId, empresaId, item,
        cantidad: extra.cantidad || 1,
        modificadores: extra.modificadores || [],
        notas: extra.notas || "",
        destino: item.destino,
      });
      await leerComanda();
    } catch (e) {
      avisar.current(e.message || "No se pudo agregar el pedido.", "mal");
    }
  };

  const anular = async (linea) => {
    if (trabajando) return;
    setTrabajando(true);
    try {
      await anularLinea(linea.id);
      await leerComanda();
    } catch (e) {
      avisar.current(e.message || "No se pudo anular.", "mal");
    } finally {
      setTrabajando(false);
    }
  };

  const cambiarCant = async (linea, cantidad) => {
    if (trabajando) return;
    setTrabajando(true);
    try {
      await cambiarCantidad(linea.id, cantidad);
      await leerComanda();
    } catch (e) {
      avisar.current(e.message || "No se pudo cambiar la cantidad.", "mal");
    } finally {
      setTrabajando(false);
    }
  };

  /* Una mesa que se tocó por error queda ocupada para siempre si no hay
     forma de soltarla. Sin líneas se cierra sin pagos: no hay venta que
     registrar, pero la mesa se libera igual. */
  const liberar = async () => {
    if (!caja.sesionId) return avisar.current("Abrí la caja antes de cerrar la cuenta.", "mal");
    setTrabajando(true);
    try {
      await cerrarComanda({ comandaId, sesionId: caja.sesionId, pagos: [] });
      avisar.current(`${rotulo} ${voz.soltado}.`);
      onVolver();
    } catch (e) {
      avisar.current(e.message || "No se pudo cerrar la cuenta.", "mal");
      setTrabajando(false);
    }
  };

  /* La comanda impresa se perdió o la cocina nunca la vio: lo que ya salió
     de la cola vuelve al principio, sin tener que cargar todo de nuevo. */
  /* Lo cargado no sale solo: el cliente pide, se arrepiente y agrega, y el
     mozo corrige. Nada de eso tiene por qué llegar a la plancha. Sale
     cuando alguien despacha, y sale solo lo que todavía no había salido:
     agregar papas a la media hora no vuelve a mandar las hamburguesas. */
  const sinEnviar = activas(comanda ? comanda.lineas : []).filter((l) => l.estado === "borrador");

  const despachar = async () => {
    if (trabajando || !comanda) return;
    setTrabajando(true);
    try {
      const n = await enviarACocina(comandaId);
      avisar.current(n === 0
        ? "Ya estaba todo en la cocina."
        : n === 1 ? "1 plato salió a la cocina." : `${n} platos salieron a la cocina.`,
        n === 0 ? "mal" : "bien");
      await leerComanda();
    } catch (e) {
      avisar.current(e.message || "No se pudo mandar a la cocina.", "mal");
    } finally {
      setTrabajando(false);
    }
  };

  /* El monto lo devuelve la base y se relee la comanda igual: un
     porcentaje sigue al subtotal, así que el número que hay que mostrar es
     el que quedó allá y no el que se tipeó acá. */
  const ponerDescuento = async (datos) => {
    if (trabajando) return;
    setTrabajando(true);
    try {
      await aplicarDescuento(comandaId, datos);
      await leerComanda();
      setDescontando(false);
    } catch (e) {
      avisar.current(e.message || "No se pudo aplicar el descuento.", "mal");
    } finally {
      setTrabajando(false);
    }
  };

  const sacarDescuento = async () => {
    if (trabajando) return;
    setTrabajando(true);
    try {
      await quitarDescuento(comandaId);
      await leerComanda();
      setDescontando(false);
    } catch (e) {
      avisar.current(e.message || "No se pudo quitar el descuento.", "mal");
    } finally {
      setTrabajando(false);
    }
  };

  const ponerComensales = async (cantidad) => {
    if (trabajando) return;
    setTrabajando(true);
    try {
      await guardarComensales(comandaId, cantidad);
      await leerComanda();
      setContando(false);
    } catch (e) {
      avisar.current(e.message || "No se pudo guardar los comensales.", "mal");
    } finally {
      setTrabajando(false);
    }
  };

  const rotulo = encabezado ? encabezado.titulo : (comanda ? comanda.mesa : "");

  if (cargando || !comanda) {
    return (
      <div>
        <Boton variant="quiet" onClick={onVolver}><ArrowLeft size={16} /> {voz.volver}</Boton>
        <Vacio>{voz.abriendo}</Vacio>
      </div>
    );
  }

  const lineas = activas(comanda.lineas);
  const cuantos = lineas.reduce((s, l) => s + l.cantidad, 0);
  const sub = encabezado ? encabezado.sub : comanda.sector;
  const hace = comanda.abiertaEn ? `hace ${espera(minutosDesde(comanda.abiertaEn))}` : "";
  const ahora = hora(reloj);
  const W = ajustes.ancho === 58 ? 32 : 48;

  /* Los comensales son de la mesa: un delivery o un pedido de mostrador no
     tiene gente sentada que dividir. */
  const esSalon = comanda.canal === "salon";
  const porPersona = esSalon && comanda.comensales > 0
    ? Math.round(comanda.total / comanda.comensales) : null;

  const imprimirPreCuenta = () => {
    imprimirComandera(preCuenta({
      titulo: rotulo,
      fecha: reloj.toLocaleDateString("es-AR"),
      hora,
      items: lineas,
      subtotal: comanda.subtotal,
      descuento: comanda.descuento,
      descuentoPct: comanda.descuentoPct,
      total: comanda.total,
      comensales: esSalon ? comanda.comensales : null,
    }, ajustes, W), ajustes.ancho, null, toast);
  };

  return (
    <div className={`flex flex-col gap-2.5 ${pleno ? "h-full min-h-0" : "h-[80vh]"}`}>
      {/* En el celular no entran las dos cosas: se muestra una y se cambia
          con un botón grande, sin menús. */}
      <div className="lg:hidden shrink-0 grid grid-cols-2 gap-2">
        <Boton size="lg" variant={panel === "comanda" ? "dark" : "ghost"} onClick={() => setPanel("comanda")}>
          Comanda {cuantos > 0 ? `(${cuantos})` : ""}
        </Boton>
        <Boton size="lg" variant={panel === "carta" ? "dark" : "ghost"} onClick={() => setPanel("carta")}>Carta</Boton>
      </div>

      <div className="flex-1 min-h-0 grid gap-2.5 lg:grid-cols-[minmax(300px,30%)_1fr]">

        {/* --- La comanda ------------------------------------------------ */}
        <Card className={`flex flex-col min-h-0 overflow-hidden ${panel === "comanda" ? "" : "hidden lg:flex"}`}>
          <div className="shrink-0 px-3.5 pt-3 pb-2.5 border-b border-borde">
            <div className="flex items-center gap-2">
              <h3 className="f-d text-lg font-bold tracking-wider">COMANDA</h3>
              <div className="ml-auto flex items-center gap-2 min-w-0">
                {/* En un pedido sin mesa el rótulo es un botón: quien está en
                    el mostrador arranca la comanda y recién después se entera
                    de si es para llevar o si entró por una aplicación. */}
                {onCambiarCanal ? (
                  <button onClick={() => onCambiarCanal()} title="Cambiar el canal del pedido"
                    className="text-acento hover:text-acento-vivo font-bold text-sm truncate transition-colors">
                    {rotulo}
                  </button>
                ) : (
                  <span className="text-acento font-bold text-sm truncate">{rotulo}</span>
                )}
                {esSalon ? (
                  <button onClick={() => setContando(true)} title="Cuánta gente hay en la mesa"
                    className="inline-flex items-center gap-1 text-acento hover:text-acento-vivo shrink-0 transition-colors">
                    <Users size={15} />
                    <span className="f-m text-sm">{comanda.comensales > 0 ? comanda.comensales : "—"}</span>
                  </button>
                ) : (
                  <Apagado motivo="Contar los comensales" className="gap-1 text-acento shrink-0">
                    <Users size={15} /><span className="f-m text-sm">—</span>
                  </Apagado>
                )}
                <Apagado motivo="El menú de la comanda" className="text-acento shrink-0">
                  <MoreVertical size={17} />
                </Apagado>
              </div>
            </div>
            {(sub || hace) && (
              <div className="text-[11px] text-texto-tenue truncate mt-0.5">
                {[sub, hace].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            {!lineas.length ? (
              <Vacio>{voz.sinNada}</Vacio>
            ) : (
              <ul className="p-3 space-y-1">
                {lineas.map((l) => (
                  <li key={l.id} className="flex items-start gap-3 rounded-xl px-2.5 py-3 hover:bg-superficie-2">
                    <span className="shrink-0 w-9 h-9 rounded-lg bg-superficie-2 border border-borde grid place-items-center f-m text-base font-bold">
                      {l.cantidad}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold leading-tight">{l.nombre}</div>
                      {(l.modificadores || []).map((m, x) => (
                        <div key={x} className="text-[11px] text-texto-tenue leading-tight">
                          {m.nombre}{m.precio ? ` (+${money(m.precio)})` : ""}
                        </div>
                      ))}
                      {l.notas && <div className="text-[11px] text-ojo italic leading-tight">{l.notas}</div>}
                      {ESTADO_LINEA[l.estado] && (
                        <div className={`text-[10px] uppercase tracking-wider font-bold mt-0.5 ${ESTADO_LINEA[l.estado].tono}`}>
                          {ESTADO_LINEA[l.estado].n}
                        </div>
                      )}
                    </div>
                    <span className="f-m text-sm shrink-0 pt-1">{money(l.total)}</span>
                    {/* El más y el menos solo mientras no salió: si la cocina
                        ya lo tiene, cambiar la cantidad acá haría que el
                        ticket y la plancha digan cosas distintas. */}
                    {l.estado === "borrador" ? (
                      <span className="shrink-0 flex items-center gap-0.5 pt-0.5">
                        <button onClick={() => cambiarCant(l, l.cantidad - 1)} disabled={trabajando}
                          title="Sacar uno" className="p-1.5 rounded-lg text-texto-tenue hover:text-texto hover:bg-superficie-3 disabled:opacity-40">
                          <Minus size={16} />
                        </button>
                        <button onClick={() => cambiarCant(l, l.cantidad + 1)} disabled={trabajando}
                          title="Agregar uno" className="p-1.5 rounded-lg text-texto-tenue hover:text-texto hover:bg-superficie-3 disabled:opacity-40">
                          <Plus size={16} />
                        </button>
                      </span>
                    ) : (
                      <Apagado motivo="Cambiar algo que ya salió a la cocina" className="shrink-0 pt-1">
                        <Pencil size={15} />
                      </Apagado>
                    )}
                    <button onClick={() => anular(l)} disabled={trabajando} title="Sacar de la comanda"
                      className="shrink-0 mt-1 text-mal/70 hover:text-mal disabled:opacity-40">
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="px-2 pb-2">
              <Apagado motivo="Agregar una observación" className="w-full">
                <span className="w-full text-center rounded-xl border border-dashed border-borde-fuerte py-2.5 text-xs font-semibold text-texto-suave">
                  + Agregar observación
                </span>
              </Apagado>
            </div>
          </div>

          {/* El total no scrollea nunca: es lo que se mira antes de cobrar. */}
          <div className="shrink-0 border-t border-borde px-3.5 py-3">
            <div className="flex items-baseline justify-between text-sm text-texto-suave">
              <span>Subtotal</span>
              <span className="f-m">{money(comanda.subtotal)}</span>
            </div>
            {/* El porcentaje va al lado del monto: quien mira la cuenta
                pactó un diez por ciento, no dos mil cien pesos. */}
            {comanda.descuento > 0 && (
              <div className="flex items-baseline justify-between text-sm text-acento mt-0.5">
                <span>Descuento{comanda.descuentoPct != null ? ` (${comanda.descuentoPct}%)` : ""}</span>
                <span className="f-m">-{money(comanda.descuento)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <span className="f-d text-sm font-bold tracking-wider">TOTAL</span>
              <span className="f-m text-2xl font-bold text-acento leading-none">{money(comanda.total)}</span>
            </div>
            {porPersona > 0 && (
              <div className="text-[11px] text-texto-tenue text-right mt-0.5 f-m">
                {money(porPersona)} por persona
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 mt-4">
              {/* El número dice cuánto falta despachar: es la diferencia
                  entre "ya salió" y "el cliente sigue esperando y nadie
                  en la cocina lo sabe". */}
              <Accion icono={ChefHat} tono="acento" disabled={trabajando || !sinEnviar.length}
                onClick={despachar}
                title={sinEnviar.length ? `Mandar a la cocina ${sinEnviar.length} sin despachar` : "Ya está todo en la cocina"}>
                A cocina{sinEnviar.length ? ` · ${sinEnviar.length}` : ""}
              </Accion>
              <Accion icono={Receipt} disabled={!lineas.length} onClick={imprimirPreCuenta}
                title="Imprimir la pre cuenta para llevar a la mesa">
                Pre cuenta
              </Accion>

              <Accion icono={CreditCard} tono="bien" disabled={!lineas.length} onClick={() => setCobrando(true)}
                title={voz.cobrar}>
                Cobrar
              </Accion>
              <Accion icono={FileText} pronto="La cuenta">Cuenta</Accion>

              {/* Con descuento puesto el botón queda en acento: es la única
                  forma de que se note desde la grilla que la cuenta no es
                  la suma de lo pedido. */}
              <Accion icono={Percent} tono={comanda.descuento > 0 ? "acento" : "oscuro"}
                disabled={trabajando} onClick={() => setDescontando(true)}
                title={comanda.descuento > 0
                  ? `Descuento aplicado: -${money(comanda.descuento)}`
                  : "Aplicar un descuento a la cuenta"}>
                {comanda.descuento > 0
                  ? (comanda.descuentoPct != null ? `Desc · ${comanda.descuentoPct}%` : `Desc · ${money(comanda.descuento)}`)
                  : "Descuento"}
              </Accion>
              <Accion icono={StickyNote} pronto="La observación">Observación</Accion>

              <Accion icono={Split} pronto="Dividir la cuenta">Dividir cuenta</Accion>
              <Accion icono={Printer} pronto="Imprimir la comanda">Imprimir</Accion>

              <Accion icono={ArrowLeft} onClick={onVolver} title={`Volver a ${voz.volver}`}>
                {voz.volver}
              </Accion>

              {/* Siempre visible aunque no siempre se pueda usar. Un botón que
                  aparece y desaparece según lo que haya cargado hace que la
                  grilla se mueva abajo de la mano: se va a tocar otra cosa.
                  Con líneas cargadas queda apagado porque soltar la mesa así
                  perdería lo que ya se pidió. */}
              <Accion icono={X} disabled={trabajando || !!lineas.length} onClick={liberar}
                pronto={lineas.length ? "Anular un pedido que ya tiene cosas cargadas" : null}
                title={voz.soltar}>
                {voz.soltarCorto || voz.soltar}
              </Accion>
            </div>
          </div>
        </Card>

        {/* --- La carta -------------------------------------------------- */}
        <Card className={`flex flex-col min-h-0 overflow-hidden ${panel === "carta" ? "" : "hidden lg:flex"}`}>
          <div className="shrink-0 p-2.5 border-b border-borde flex items-center gap-2">
            <div className="flex-1 min-w-0 flex items-center gap-2 rounded-xl border border-borde bg-superficie-2 px-3 py-2.5">
              <Search size={17} className="text-texto-tenue shrink-0" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar productos…"
                className="w-full text-base outline-none bg-transparent" />
              {q && <button onClick={() => setQ("")} title="Limpiar" className="text-texto-tenue shrink-0"><X size={16} /></button>}
            </div>
            <Apagado motivo="Filtrar la carta" className="shrink-0">
              <span className="grid place-items-center w-11 h-11 rounded-xl border border-borde bg-superficie-2 text-texto-suave">
                <Filter size={17} />
              </span>
            </Apagado>
          </div>

          <div className="shrink-0 flex gap-1.5 overflow-x-auto px-2.5 py-2 border-b border-borde">
            {categorias.map((c) => {
              const Icono = iconoDeCategoria(c);
              const puesta = !q && c === cat;
              return (
                <button key={c} onClick={() => { setCat(c); setQ(""); }}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                    puesta
                      ? "bg-acento text-sobre-acento border-acento"
                      : "bg-superficie text-texto-suave border-borde hover:bg-superficie-2"}`}>
                  <Icono size={15} className="shrink-0" /> {c}
                </button>
              );
            })}
            <Apagado motivo="Los extras" className="shrink-0">
              <span className="px-3.5 py-2 rounded-xl text-sm font-semibold border border-borde bg-superficie text-texto-suave whitespace-nowrap">
                + Extras
              </span>
            </Apagado>
          </div>

          <div className="flex-1 min-h-0 overflow-auto p-2.5">
            {!items.length ? (
              <Vacio>{q ? "Ningún plato con ese nombre." : "Esta categoría está vacía."}</Vacio>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {items.map((i) => (
                  <FichaCarta key={i.id} item={i}
                    onTocar={() => setDetalle(i)} onSumar={() => agregar(i)} />
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* --- La barra de abajo ------------------------------------------- */}
      <Card className="shrink-0 flex flex-wrap items-center gap-x-4 gap-y-1 px-3.5 py-2 text-xs text-texto-suave">
        <span>Empleado: <strong className="text-texto font-semibold">{empleado || "—"}</strong></span>
        <span className="inline-flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${caja.abierta ? "bg-bien" : "bg-mal"}`} />
          {caja.abierta ? "Caja abierta" : "Caja cerrada"}
        </span>
        <span className="f-m">{ahora}</span>
        <Apagado motivo="El historial de comandas" className="ml-auto gap-1.5 font-semibold">
          <History size={14} /> Historial de comandas
        </Apagado>
      </Card>

      <ModalDetalle item={detalle} onCerrar={() => setDetalle(null)}
        onAgregar={(extra) => { const i = detalle; setDetalle(null); agregar(i, extra); }} />

      <ModalDescuento abierto={descontando} comanda={comanda} rotulo={rotulo} trabajando={trabajando}
        onCerrar={() => setDescontando(false)} onAplicar={ponerDescuento} onQuitar={sacarDescuento} />

      <ModalComensales abierto={contando} comanda={comanda} rotulo={rotulo} trabajando={trabajando}
        onCerrar={() => setContando(false)} onGuardar={ponerComensales} />

      <ModalCobro abierto={cobrando} comanda={comanda} comandaId={comandaId} empresaId={empresaId}
        config={config} ajustes={ajustes} caja={caja} toast={toast} rotulo={rotulo} voz={voz}
        onCerrar={() => setCobrando(false)} onCobrada={onVolver} />
    </div>
  );
}

/* Los botones de la comanda no son los de `Boton`: van en grilla, altos, en
   mayúsculas y con el ícono pegado al texto. `pronto` los apaga y explica
   por qué; `disabled` es para los que existen pero ahora no corresponden. */
function Accion({ icono: Icono, children, onClick, tono = "oscuro", pronto = null, disabled = false, title, className = "" }) {
  const pinta = {
    oscuro: "bg-superficie-2 text-texto border border-borde hover:bg-superficie-3",
    acento: "bg-acento text-sobre-acento hover:bg-acento-vivo",
    bien: "bg-bien text-fondo hover:bg-bien/90",
  }[tono];
  /* Bajos y en tres columnas: cada milímetro que ocupan las acciones se lo
     sacan a la lista de lo pedido, que es lo que de verdad se mira. */
  /* Ni los botones enormes del principio ni los diminutos de después. Esto
     lo toca alguien de pie, con gente esperando: el área de toque tiene que
     ser cómoda y el texto legible de un vistazo. */
  const forma = "w-full inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide leading-tight transition-colors";
  const cuerpo = (
    <>
      {Icono && <Icono size={15} className="shrink-0" />}
      <span className="truncate">{children}</span>
    </>
  );

  /* El título de un <button disabled> no lo muestra el navegador: el aviso
     va en el envoltorio, que sí recibe el mouse. */
  if (pronto) {
    return (
      <span title={`${pronto} todavía no está disponible.`} className={`block cursor-not-allowed ${className}`}>
        <span className={`${forma} ${pinta} opacity-35`}>{cuerpo}</span>
      </span>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      className={`${forma} ${pinta} disabled:opacity-40 disabled:cursor-not-allowed ${className}`}>
      {cuerpo}
    </button>
  );
}

/* No hay fotos de los platos y no vale la pena inventarlas: el cuadrado
   lleva la inicial, que a la velocidad de lectura de una carta alcanza
   para distinguir una fila de otra. */
function FichaCarta({ item, onTocar, onSumar }) {
  /* Qué lleva el plato, que es por lo que el cliente elige. Si no está
     cargado no se rellena con el destino ni con la categoría: decir
     "barra" abajo de una limonada no informa nada y ensucia la carta. */
  const desc = item.descripcion || "";
  return (
    <div className="relative">
      <button onClick={onTocar} title="Cantidad y cómo lo quieren"
        className="w-full h-full flex items-center gap-3 text-left rounded-2xl border border-borde bg-superficie-2 p-2.5 pr-12 transition-colors hover:border-acento hover:bg-superficie-3 active:bg-superficie-3">
        <span className="w-14 h-14 shrink-0 rounded-xl bg-acento-suave text-acento-vivo f-d text-2xl grid place-items-center">
          {(item.nombre || "?").trim().charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold leading-tight line-clamp-2">{item.nombre}</span>
          <span className="block f-m text-sm text-acento">{money(item.precio)}</span>
          {desc && <span className="block text-[11px] text-texto-tenue truncate">{desc}</span>}
        </span>
      </button>
      <button onClick={onSumar} title={`Agregar ${item.nombre}`}
        className="absolute top-2 right-2 w-9 h-9 rounded-full bg-acento text-sobre-acento grid place-items-center hover:bg-acento-vivo transition-colors">
        <Plus size={18} />
      </button>
    </div>
  );
}

/* Un ícono por categoría, adivinado del nombre: la carta la escribe cada
   comercio y nadie va a cargar un ícono por rubro. */
const ICONOS_CATEGORIA = [
  [/pizza|empanada|tarta/, Pizza],
  [/hamburg|carne|parrilla|lomo|choripan|chorip/, Beef],
  [/sandw|lomito|tostado|club/, Sandwich],
  [/ensalad|verdur|vegan|vegetar/, Salad],
  [/sopa|caldo|guiso|cazuela/, Soup],
  [/pescado|mariscos|sushi/, Fish],
  [/pollo|milanes|suprema/, Drumstick],
  [/pasta|fideo|noqui|ñoqui|risotto/, Utensils],
  [/caf|desayun|merienda|infusion|infusión/, Coffee],
  [/vino|trago|coctel|cóctel|aperitivo|bebida con/, Wine],
  [/cerve|birra|tap/, Beer],
  [/bebida|gaseosa|jugo|agua|refresc|sin alcohol/, CupSoda],
  [/helado|postre/, IceCream],
  [/torta|pasteler|dulce/, Cake],
  [/panader|factura|medialuna|sandwicher/, Croissant],
  [/galle|snack|picada|copetin|copetín/, Cookie],
  [/lacteo|lácteo|leche|yogur/, Milk],
  [/promo|combo|especial|del dia|del día/, Flame],
];

function iconoDeCategoria(categoria) {
  const t = String(categoria || "").toLowerCase();
  const hallado = ICONOS_CATEGORIA.find(([re]) => re.test(t));
  return hallado ? hallado[1] : UtensilsCrossed;
}

/* "pedido" no se muestra: es el estado normal de una línea recién cargada
   y repetirlo en todas las filas no dice nada. */
/* 'borrador' es el único que hay que mirar mientras se atiende: significa
   que el cliente lo pidió y la cocina todavía no se enteró. Por eso va en
   el color de aviso y no en gris como los demás. */
const ESTADO_LINEA = {
  borrador: { n: "Sin mandar", tono: "text-acento" },
  pedido: { n: "En cocina", tono: "text-texto-tenue" },
  preparando: { n: "Preparando", tono: "text-ojo" },
  listo: { n: "Listo", tono: "text-bien" },
  entregado: { n: "Entregado", tono: "text-texto-tenue" },
};

/* --- Modificadores y nota ----------------------------------------------
   No hay lista fija de modificadores a propósito: cada cocina tiene los
   suyos y cambian de una semana a la otra. El que toma el pedido escribe
   lo que le dijeron, y le pone precio solo si lo tiene.                  */
function ModalDetalle({ item, onCerrar, onAgregar }) {
  const [cantidad, setCantidad] = useState(1);
  const [mods, setMods] = useState([]);
  const [texto, setTexto] = useState("");
  const [precio, setPrecio] = useState("");
  const [notas, setNotas] = useState("");

  useEffect(() => {
    if (!item) return;
    setCantidad(1); setMods([]); setTexto(""); setPrecio(""); setNotas("");
  }, [item]);

  if (!item) return null;

  const sumarMod = () => {
    if (!texto.trim()) return;
    setMods((m) => [...m, { nombre: texto.trim(), precio: Number(precio) || 0 }]);
    setTexto(""); setPrecio("");
  };

  const extra = mods.reduce((s, m) => s + (Number(m.precio) || 0), 0);
  const unitario = item.precio + extra;

  return (
    <Modal open onClose={onCerrar} ancho="max-w-md">
      <div className="p-5">
        <h3 className="f-d text-lg leading-tight">{item.nombre}</h3>
        <div className="f-m text-sm text-texto-suave">{money(item.precio)}</div>

        <div className="flex items-center gap-3 mt-4">
          <span className="text-[10px] uppercase tracking-widest text-texto-tenue font-bold flex-1">Cantidad</span>
          <Boton variant="ghost" size="lg" onClick={() => setCantidad((c) => Math.max(1, c - 1))}><Minus size={18} /></Boton>
          <span className="f-m text-2xl w-10 text-center">{cantidad}</span>
          <Boton variant="ghost" size="lg" onClick={() => setCantidad((c) => c + 1)}><Plus size={18} /></Boton>
        </div>

        <div className="mt-4">
          <span className="text-[10px] uppercase tracking-widest text-texto-tenue font-bold">Cómo lo quieren</span>
          {mods.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 mt-1.5">
              {mods.map((m, i) => (
                <li key={i} className="flex items-center gap-1.5 text-sm bg-superficie-2 rounded-xl pl-2.5 pr-1.5 py-1">
                  {m.nombre}{m.precio ? <span className="f-m text-texto-suave">+{money(m.precio)}</span> : null}
                  <button onClick={() => setMods((xs) => xs.filter((_, x) => x !== i))} className="text-texto-tenue hover:text-mal">
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-1.5 mt-1.5">
            <input value={texto} onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sumarMod(); } }}
              placeholder="Sin cebolla, extra queso…"
              className="flex-1 min-w-0 border border-borde rounded-xl px-3 py-2.5 text-base outline-none focus:border-acento" />
            <input value={precio} onChange={(e) => setPrecio(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sumarMod(); } }}
              placeholder="$"
              className="f-m w-20 shrink-0 text-right border border-borde rounded-xl px-2 py-2.5 text-base outline-none focus:border-acento" />
            <Boton variant="ghost" size="lg" disabled={!texto.trim()} onClick={sumarMod}><Plus size={18} /></Boton>
          </div>
          <p className="text-[11px] text-texto-tenue mt-1">El precio es opcional. Si lo ponés, se suma a la línea.</p>
        </div>

        <label className="block mt-4">
          <span className="text-[10px] uppercase tracking-widest text-texto-tenue font-bold">Nota para la cocina</span>
          <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej: que salga con el resto"
            className="w-full border border-borde rounded-xl px-3 py-2.5 text-base mt-1 outline-none focus:border-acento" />
        </label>

        <Boton size="lg" className="w-full mt-5"
          onClick={() => onAgregar({ cantidad, modificadores: mods, notas: notas.trim() })}>
          Agregar · {money(unitario * cantidad)}
        </Boton>
        <Boton variant="quiet" className="w-full mt-1.5" onClick={onCerrar}>Cancelar</Boton>
      </div>
    </Modal>
  );
}

/* --- Descuento ---------------------------------------------------------
   Las dos formas se usan de verdad: el diez por ciento del convenio y los
   dos mil pesos que alguien pactó en la mesa. Lo que no puede pasar es
   confirmar sin ver el total, porque ese —y no el descuento— es el número
   que se le va a decir al cliente.                                       */
function ModalDescuento({ abierto, comanda, rotulo, trabajando, onCerrar, onAplicar, onQuitar }) {
  const [modo, setModo] = useState("pct");   // pct | monto
  const [valor, setValor] = useState("");

  /* Solo al abrir: mientras el diálogo está en pantalla la comanda se
     relee, y reaccionar a eso le pisaría al usuario lo que está tipeando. */
  useEffect(() => {
    if (!abierto) return;
    if (comanda.descuentoPct != null) { setModo("pct"); setValor(String(comanda.descuentoPct)); }
    else if (comanda.descuento > 0) { setModo("monto"); setValor(String(comanda.descuento)); }
    else { setModo("pct"); setValor(""); }
  }, [abierto]);

  if (!abierto) return null;

  const esPct = modo === "pct";
  const sub = comanda.subtotal;
  const n = Number(valor) || 0;
  const excede = esPct ? n > 100 : n > sub;
  const desc = esPct ? Math.round(sub * Math.min(n, 100) / 100) : Math.min(n, sub);
  const total = sub - desc;
  const habia = comanda.descuento > 0;

  const solapa = (k, texto) => (
    <button onClick={() => { setModo(k); setValor(""); }}
      className={`px-3 py-3 rounded-xl border-2 text-base font-semibold transition-colors ${
        modo === k ? "border-acento bg-acento-suave text-texto" : "border-borde text-texto-suave hover:bg-superficie-2"}`}>
      {texto}
    </button>
  );

  return (
    <Modal open onClose={onCerrar} ancho="max-w-md">
      <div className="p-5">
        <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-bold">Descuento</div>
        <h3 className="f-d text-lg">{rotulo}</h3>

        <div className="grid grid-cols-2 gap-2 mt-4">
          {solapa("pct", "Por porcentaje")}
          {solapa("monto", "Por importe")}
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-xl border-2 border-borde focus-within:border-acento px-4 py-3">
          {!esPct && <span className="f-m text-2xl text-texto-tenue shrink-0">$</span>}
          <input value={valor} onChange={(e) => setValor(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric" placeholder="0" autoFocus
            className="f-m flex-1 min-w-0 text-3xl bg-transparent outline-none" />
          {esPct && <span className="f-m text-2xl text-texto-tenue shrink-0">%</span>}
        </div>

        {/* Los de todos los días, para no tipear con gente esperando. */}
        {esPct && (
          <div className="grid grid-cols-4 gap-1.5 mt-2">
            {[5, 10, 15, 20].map((p) => (
              <button key={p} onClick={() => setValor(String(p))}
                className={`f-m py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                  n === p ? "border-acento bg-acento-suave text-acento" : "border-borde text-texto-suave hover:bg-superficie-2"}`}>
                {p}%
              </button>
            ))}
          </div>
        )}

        <div className="border-t border-borde mt-4 pt-3">
          <div className="flex items-baseline justify-between text-sm text-texto-suave">
            <span>Subtotal</span><span className="f-m">{money(sub)}</span>
          </div>
          <div className="flex items-baseline justify-between text-sm text-acento mt-0.5">
            <span>Descuento{esPct && n > 0 ? ` (${Math.min(n, 100)}%)` : ""}</span>
            <span className="f-m">-{money(desc)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-2 mt-1">
            <span className="f-d text-sm font-bold tracking-wider">QUEDA</span>
            <span className="f-m text-3xl font-bold text-acento leading-none">{money(total)}</span>
          </div>
        </div>

        {excede && (
          <p className="text-xs text-mal mt-2">
            {esPct ? "El porcentaje no puede pasar de 100." : "El descuento no puede ser mayor que la cuenta."}
          </p>
        )}

        <Boton size="lg" className="w-full mt-4" disabled={trabajando || excede}
          onClick={() => (n > 0 ? onAplicar(esPct ? { pct: n } : { monto: n }) : onQuitar())}>
          <Check size={18} /> {n > 0 ? `Aplicar · queda ${money(total)}` : "Dejar sin descuento"}
        </Boton>
        {habia && (
          <Boton variant="danger" className="w-full mt-1.5" disabled={trabajando} onClick={onQuitar}>
            <X size={16} /> Quitar el descuento
          </Boton>
        )}
        <Boton variant="quiet" className="w-full mt-1.5" onClick={onCerrar}>Cancelar</Boton>
      </div>
    </Modal>
  );
}

/* --- Comensales --------------------------------------------------------
   Se carga de pie y con la mesa mirando: los botones grandes ganan a
   tipear, y los números de siempre ganan a los botones.                  */
function ModalComensales({ abierto, comanda, rotulo, trabajando, onCerrar, onGuardar }) {
  const [gente, setGente] = useState(0);

  useEffect(() => { if (abierto) setGente(comanda.comensales || 0); }, [abierto]);

  if (!abierto) return null;

  const mover = (d) => setGente((g) => Math.max(0, Math.min(99, g + d)));

  return (
    <Modal open onClose={onCerrar} ancho="max-w-sm">
      <div className="p-5">
        <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-bold">Comensales</div>
        <h3 className="f-d text-lg">{rotulo}</h3>

        <div className="flex items-center gap-3 mt-5">
          <button onClick={() => mover(-1)} disabled={gente === 0} title="Uno menos"
            className="w-16 h-16 shrink-0 rounded-2xl border-2 border-borde text-texto grid place-items-center hover:bg-superficie-2 disabled:opacity-30">
            <Minus size={26} />
          </button>
          <input value={gente > 0 ? gente : ""} inputMode="numeric" placeholder="—"
            onChange={(e) => setGente(Math.min(99, Number(e.target.value.replace(/\D/g, "")) || 0))}
            className="f-m flex-1 min-w-0 text-center text-5xl bg-transparent outline-none" />
          <button onClick={() => mover(1)} title="Uno más"
            className="w-16 h-16 shrink-0 rounded-2xl border-2 border-acento bg-acento-suave text-acento grid place-items-center hover:bg-superficie-2">
            <Plus size={26} />
          </button>
        </div>

        <div className="grid grid-cols-5 gap-1.5 mt-4">
          {[1, 2, 3, 4, 6].map((g) => (
            <button key={g} onClick={() => setGente(g)}
              className={`f-m py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                gente === g ? "border-acento bg-acento-suave text-acento" : "border-borde text-texto-suave hover:bg-superficie-2"}`}>
              {g}
            </button>
          ))}
        </div>

        <Boton size="lg" className="w-full mt-5" disabled={trabajando} onClick={() => onGuardar(gente)}>
          <Check size={18} /> {gente > 0 ? `Guardar · ${gente} en la mesa` : "Sin especificar"}
        </Boton>
        <Boton variant="quiet" className="w-full mt-1.5" onClick={onCerrar}>Cancelar</Boton>
      </div>
    </Modal>
  );
}

/* --- Cobrar la mesa ---------------------------------------------------- */
function ModalCobro({ abierto, comanda, comandaId, empresaId, config, ajustes, caja, toast, rotulo, voz = VOZ_MESA, onCerrar, onCobrada }) {
  const [sel, setSel] = useState(0);
  const [cobrando, setCobrando] = useState(false);

  useEffect(() => { if (abierto) { setSel(0); setCobrando(false); } }, [abierto]);
  if (!abierto) return null;

  const medios = mediosDe(ajustes);
  const medio = medios[sel] || medios[0];
  const rec = conRecargo(comanda.total, medio);

  /* El punto de venta sale de la configuración del comercio: `ajustes`
     todavía arranca con los datos del minimercado y numeraría la mesa en
     la serie equivocada. */
  const puntoVenta =
    (config.fiscal && config.fiscal.puntoVenta) ||
    (ajustes.fiscal || FISCAL_INICIAL).puntoVenta || "0001";

  const cobrar = async () => {
    if (cobrando) return;
    if (!caja.abierta || !caja.sesionId) {
      toast("Abrí la caja antes de cobrar.", "mal");
      return;
    }
    setCobrando(true);
    try {
      await cerrarComanda({
        comandaId,
        sesionId: caja.sesionId,
        pagos: [{ medio: medio.k, monto: rec.total, recargo: rec.recargo }],
        numero: siguienteNumero(empresaId, puntoVenta),
        /* El descuento viaja explícito: quien cierra manda un monto y lo
           que mande pisa lo guardado, así que omitirlo cerraría la mesa
           en cero y cobraría de más. Es el mismo número que se está
           mostrando en pantalla. */
        descuento: comanda.descuento,
        recargo: rec.recargo,
      });
      toast(`${rotulo || "Comanda"} cobrada · ${money(rec.total)}`);
      onCobrada();
    } catch (e) {
      // La caja cerrada llega por acá con el mensaje ya escrito en claro.
      toast(e.message || "No se pudo cobrar.", "mal");
      setCobrando(false);
    }
  };

  return (
    <Modal open onClose={onCerrar} ancho="max-w-md">
      <div className="p-5">
        <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-bold">Cobrar</div>
        <h3 className="f-d text-lg">{rotulo}</h3>

        <div className="mt-4 space-y-2">
          {medios.map((m, i) => (
            <button key={m.k} onClick={() => setSel(i)}
              className={`w-full flex items-center justify-between gap-2 text-left px-4 py-3.5 rounded-xl border-2 ${
                i === sel ? "border-acento bg-acento-suave" : "border-borde hover:bg-superficie-2"}`}>
              <span className="text-base font-semibold">{m.n}</span>
              {m.recargo && m.tasa > 0 && (
                <span className="f-m text-xs text-texto-suave">+{m.tasa}%</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-baseline justify-between mt-5">
          <span className="text-sm text-texto-suave">Total a cobrar</span>
          <span className="f-m text-3xl">{money(rec.total)}</span>
        </div>
        {rec.recargo > 0 && (
          <div className="text-xs text-texto-suave text-right">
            {money(comanda.total)} + {money(rec.recargo)} de recargo
          </div>
        )}

        <Boton size="lg" className="w-full mt-4" disabled={cobrando} onClick={cobrar}>
          <Check size={18} /> {cobrando ? "Cobrando…" : voz.cobrarYCerrar}
        </Boton>
        <Boton variant="quiet" className="w-full mt-1.5" onClick={onCerrar}>Volver al pedido</Boton>
      </div>
    </Modal>
  );
}

/* ============================================================
   5. COCINA
   ============================================================

   Una pantalla colgada en la pared, mirada de lejos y con las manos
   ocupadas: texto grande, tres columnas y un solo botón por comanda.
   Se refresca sola porque nadie la va a tocar para actualizarla.
   ============================================================ */

const COLUMNAS = [
  { k: "pedido", n: "Pedido", sig: "preparando", accion: "Empezar" },
  { k: "preparando", n: "Preparando", sig: "listo", accion: "Listo" },
  { k: "listo", n: "Listo", sig: "entregado", accion: "Entregado" },
];

export function Cocina({ empresaId, config = {}, toast }) {
  const destinos = config.destinos || [];
  const [destino, setDestino] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);

  const avisar = useRef(toast);
  avisar.current = toast;
  const releer = useRef(() => {});

  useEffect(() => {
    let vivo = true;
    const leer = async () => {
      try {
        const d = await cargarCocina(empresaId, destino);
        if (vivo) setPedidos(d);
      } catch (e) {
        if (vivo) avisar.current(e.message || "No pudimos leer la cocina.", "mal");
      } finally {
        if (vivo) setCargando(false);
      }
    };
    releer.current = leer;
    leer();
    const id = setInterval(leer, 15000);
    return () => { vivo = false; clearInterval(id); };
  }, [empresaId, destino]);

  /* Se mueve el pedido entero y no línea por línea: el que cocina termina
     la comanda de la mesa 4, no la tercera línea de la mesa 4.

     El cambio se pinta antes de que conteste el servidor: tocó el botón y
     necesita ver que pasó, no esperar a la red. */
  const mover = async (p, estado) => {
    setPedidos((xs) => estado === "entregado"
      ? xs.filter((x) => x.id !== p.id)
      : xs.map((x) => (x.id === p.id ? { ...x, etapa: estado } : x)));
    try {
      await moverComanda(p.id, estado, destino);
    } catch (e) {
      avisar.current(e.message || "No se pudo cambiar el estado.", "mal");
    }
    releer.current();
  };

  return (
    <div className="space-y-4">
      {destinos.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Boton size="lg" variant={destino === null ? "dark" : "ghost"} onClick={() => setDestino(null)}>Todo</Boton>
          {destinos.map((d) => (
            <Boton key={d} size="lg" variant={destino === d ? "dark" : "ghost"} onClick={() => setDestino(d)}>
              <ChefHat size={16} /> {d}
            </Boton>
          ))}
        </div>
      )}

      {cargando && <Vacio>Cargando…</Vacio>}
      {!cargando && !pedidos.length && <Vacio>No hay nada esperando. Cocina al día.</Vacio>}

      <div className="grid md:grid-cols-3 gap-3 items-start">
        {COLUMNAS.map((col) => {
          const suyas = pedidos.filter((p) => p.etapa === col.k);
          return (
            <div key={col.k}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="f-d text-base">{col.n}</h3>
                <span className="f-m text-sm text-texto-tenue">{suyas.length}</span>
              </div>
              <div className="space-y-2">
                {suyas.map((p) => <Comanda key={p.id} p={p} col={col} onMover={mover} />)}
                {!suyas.length && (
                  <div className="rounded-2xl border-2 border-dashed border-borde py-6 text-center text-xs text-texto-tenue">
                    vacío
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Cómo se arma es lo primero que necesita saber el que cocina, antes
   incluso de qué plato es: dos hamburguesas iguales salen en plato si son
   de una mesa, en packaging si son para llevar, y en la bolsa de la
   aplicación que corresponda si entraron por una. Equivocarse acá
   significa rehacer el pedido. */
function comoSeEntrega(p) {
  if (p.familia === "salon") return { texto: "Al plato", tono: "bg-superficie-3 text-texto-suave" };
  if (p.familia === "app") return { texto: `Bolsa ${p.canalNombre}`, tono: "bg-ojo-suave text-ojo" };
  if (p.familia === "reparto") return { texto: "Packaging · delivery", tono: "bg-bien-suave text-bien" };
  return { texto: "Packaging · para llevar", tono: "bg-acento-suave text-acento" };
}

function Comanda({ p, col, onMover }) {
  const min = minutosDesde(p.desde);
  // Lo que espera hace rato tiene que gritar desde el otro lado de la cocina.
  const tono = min >= 20 ? "border-mal bg-mal-suave" : min >= 10 ? "border-ojo bg-ojo-suave" : "border-borde bg-superficie";
  const entrega = comoSeEntrega(p);

  return (
    <div className={`rounded-2xl border-2 p-3 ${tono}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="f-d text-xl leading-none truncate">{p.mesa || "Pedido"}</span>
        <span className="f-m text-xs text-texto-suave shrink-0">{espera(min)}</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${entrega.tono}`}>
          {entrega.texto}
        </span>
        {p.referencia && <span className="f-m text-[11px] text-texto-suave">#{p.referencia}</span>}
      </div>

      {/* Todo el pedido junto: lo que sale de la cocina es la comanda, no
          un plato suelto que hay que adivinar con cuál va. */}
      <ul className="mt-2.5 space-y-1.5">
        {p.lineas.map((l) => (
          <li key={l.id}>
            <div className="text-base leading-tight">
              <span className="f-m font-bold">{l.cantidad}×</span> {l.nombre}
            </div>
            {(l.modificadores || []).map((m, i) => (
              <div key={i} className="text-sm text-texto-suave leading-tight">· {m.nombre}</div>
            ))}
            {l.notas && <div className="text-sm italic text-ojo leading-tight">{l.notas}</div>}
          </li>
        ))}
      </ul>

      <Boton size="lg" className="w-full mt-3" variant={col.k === "listo" ? "dark" : "primary"}
        onClick={() => onMover(p, col.sig)}>
        {col.accion}
      </Boton>
    </div>
  );
}
