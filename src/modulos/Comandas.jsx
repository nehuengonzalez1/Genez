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
  StickyNote, X, RefreshCw, ChefHat, Wallet, Store, ShoppingBag, Bike, Smartphone,
  UtensilsCrossed, ChevronRight,
} from "lucide-react";
import { money, mediosDe, conRecargo, FISCAL_INICIAL } from "../utils/helpers.js";
import { siguienteNumero } from "../datos/ventas.js";
import {
  cargarSalon, abrirComanda, cargarComanda, cargarCarta, agregarLinea,
  anularLinea, cambiarEstadoLinea, cargarPendientes, cerrarComanda,
  CANALES, abrirPedido, cargarPedidos, cargarElementosPlano, cambiarCanal,
} from "../datos/comandas.js";
import { Card, Boton, Modal, Vacio } from "../ui/Base.jsx";
import { Campo, inputCls } from "../ui/Campos.jsx";
import { PlanoSalon } from "./PlanoSalon.jsx";

/* Los minutos se calculan contra el reloj real y no contra HOY: acá no se
   está mirando una serie histórica, se está mirando una mesa que espera. */
const minutosDesde = (fecha) =>
  fecha ? Math.max(0, Math.round((Date.now() - fecha.getTime()) / 60000)) : 0;

const espera = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);

const activas = (lineas) => (lineas || []).filter((l) => l.estado !== "anulada");

/* Cada canal tiene su color y su ícono: a un metro de distancia hay que
   saber si el pedido sale por la puerta o lo viene a buscar un cadete,
   sin leer la etiqueta. */
const TONO = {
  mostrador: { i: Store, pill: "bg-info-suave text-info border-info", borde: "border-info" },
  takeaway: { i: ShoppingBag, pill: "bg-acento-suave text-acento-vivo border-acento", borde: "border-acento" },
  delivery: { i: Bike, pill: "bg-bien-suave text-bien border-bien", borde: "border-bien" },
  app: { i: Smartphone, pill: "bg-ojo-suave text-ojo border-ojo", borde: "border-ojo" },
  salon: { i: UtensilsCrossed, pill: "bg-superficie-2 text-texto-suave border-borde-fuerte", borde: "border-borde-fuerte" },
};

const APLICACIONES = ["PedidosYa", "Rappi", "Uber Eats", "Otra"];

const tonoDe = (canal) => TONO[canal] || TONO.mostrador;

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
  soltado: "quedó cancelado",
};

/* En un pedido de aplicación lo que importa es cuál, no la palabra
   "Aplicación": el que arma mira la pantalla y tiene que ver PedidosYa. */
function rotuloCanal(p) {
  const c = CANALES.find((x) => x.k === p.canal);
  const app = p.cliente && p.cliente.app;
  if (p.canal === "app" && app) return app;
  return c ? c.n : p.canal;
}

function encabezadoDe(p) {
  const cli = p.cliente || {};
  return {
    titulo: [rotuloCanal(p), p.referencia ? `#${p.referencia}` : null].filter(Boolean).join(" · "),
    sub: [cli.nombre, cli.telefono].filter(Boolean).join(" · "),
  };
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

export function PantallaComandas({ empresaId, sucursalId = null, config = {}, ajustes, caja, permisos = {}, toast }) {
  const [donde, setDonde] = useState("inicio");     // inicio | salon
  const [abierta, setAbierta] = useState(null);     // la comanda que se está atendiendo
  const [pedidos, setPedidos] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [elementos, setElementos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [nuevo, setNuevo] = useState(null);         // canal elegido, esperando los datos
  const [cambiando, setCambiando] = useState(false);
  const [abriendo, setAbriendo] = useState(null);   // id de mesa o clave de canal

  /* toast se redefine en cada render de Sistema. Si entra como dependencia,
     el efecto de carga se vuelve a disparar para siempre. */
  const avisar = useRef(toast);
  avisar.current = toast;
  const releer = useRef(() => {});

  /* Mientras se está adentro de un pedido no se refresca nada: la pantalla
     no se ve y la lectura vieja no sirve para nada. */
  useEffect(() => {
    if (abierta) return undefined;
    let vivo = true;
    const leer = async () => {
      try {
        const [p, m, e] = await Promise.all([
          cargarPedidos(empresaId), cargarSalon(empresaId), cargarElementosPlano(empresaId),
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

  const abrirCanal = async (datos) => {
    if (abriendo) return;
    setAbriendo(datos.canal);
    try {
      const id = await abrirPedido({ empresaId, sucursalId, ...datos });
      setNuevo(null);
      setAbierta({ id, voz: VOZ_CANAL, encabezado: encabezadoDe(datos), volverA: "inicio" });
    } catch (e) {
      avisar.current(e.message || "No se pudo abrir el pedido.", "mal");
    } finally {
      setAbriendo(null);
    }
  };

  const tocarCanal = (k) => (k === "mostrador" ? abrirCanal({ canal: "mostrador" }) : setNuevo(k));

  const retomar = (p) =>
    setAbierta({ id: p.id, voz: VOZ_CANAL, encabezado: encabezadoDe(p), volverA: "inicio" });

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
      setAbierta((a) => ({ ...a, encabezado: encabezadoDe(datos) }));
      setCambiando(false);
    } catch (e) {
      avisar.current(e.message || "No se pudo cambiar el canal.", "mal");
    }
  };

  if (abierta) {
    const esMesa = abierta.volverA === "salon";
    return (
      <>
        <Pedido
          pleno comandaId={abierta.id} empresaId={empresaId} config={config}
          ajustes={ajustes} caja={caja} toast={toast}
          voz={esMesa ? VOZ_MESA : { ...abierta.voz, volver: "Pedidos" }}
          encabezado={abierta.encabezado}
          onCambiarCanal={esMesa ? null : () => setCambiando(true)}
          onVolver={() => { setDonde(abierta.volverA); setAbierta(null); }} />

        <ModalNuevoPedido abierto={cambiando} rotulo="¿Para dónde es?"
          onCerrar={() => setCambiando(false)} onCrear={corregirCanal} />
      </>
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
        <div className="flex-1 min-h-0 overflow-auto">
          <PlanoSalon
            mesas={mesas} elementos={elementos} cargando={cargando} abriendo={abriendo}
            puedeEditar={!!permisos.ajustes} empresaId={empresaId} sucursalId={sucursalId}
            toast={toast} onTocarMesa={(m) => entrarAMesa(m, "salon")}
            onActualizar={() => releer.current()} onGuardado={() => releer.current()} />
        </div>
      </div>
    );
  }

  const enCurso = pedidos.filter((p) => p.etapa !== "cerrado");
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
                <TarjetaEnCurso key={p.id} tono={tonoDe(p.canal)} canal={rotuloCanal(p)}
                  titulo={(p.cliente && p.cliente.nombre) || (p.referencia ? `#${p.referencia}` : rotuloCanal(p))}
                  sub={p.cliente && p.cliente.nombre && p.referencia ? `#${p.referencia}` : null}
                  minutos={minutosDesde(p.abiertaEn)} total={p.total}
                  estado={estadoPedido(p)} onTocar={() => retomar(p)} />
              ))}
              {ocupadas.map((m) => (
                <TarjetaEnCurso key={m.id} tono={TONO.salon} canal="Salón"
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

      <ModalNuevoPedido abierto={!!nuevo} canalInicial={nuevo} trabajando={!!abriendo}
        onCerrar={() => setNuevo(null)} onCrear={abrirCanal} />
    </div>
  );
}

/* El estado se lee sin leer: lo que está listo y nadie retiró es lo único
   que tiene que gritar. */
function estadoPedido(p) {
  if (p.etapa === "listo") return { n: "Listo para entregar", tono: "text-bien" };
  if (p.etapa === "preparando") return { n: "En preparación", tono: "text-ojo" };
  const items = p.lineas.reduce((s, l) => s + l.cantidad, 0);
  return { n: items ? `${items} item${items === 1 ? "" : "s"} sin enviar` : "Sin cargar", tono: "text-texto-tenue" };
}

function estadoMesa(m) {
  if (m.listos > 0) return { n: `${m.listos} para servir`, tono: "text-bien" };
  if (m.enCocina > 0) return { n: `${m.enCocina} en cocina`, tono: "text-ojo" };
  return { n: m.items ? `${m.items} item${m.items === 1 ? "" : "s"}` : "Recién abierta", tono: "text-texto-tenue" };
}

function TarjetaEnCurso({ tono, canal, titulo, sub, minutos, total, estado, abriendo, onTocar }) {
  const Icono = tono.i;
  return (
    <button onClick={onTocar} disabled={abriendo}
      className={`w-full text-left rounded-2xl border-2 bg-superficie p-3.5 transition-colors hover:bg-superficie-2 disabled:opacity-50 ${tono.borde}`}>
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg border ${tono.pill}`}>
          <Icono size={12} /> {canal}
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

export function Comandas({ empresaId, sucursalId = null, config = {}, ajustes, caja, permisos = {}, toast }) {
  const [mesas, setMesas] = useState([]);
  const [elementos, setElementos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [comandaId, setComandaId] = useState(null);
  const [abriendo, setAbriendo] = useState(null);

  const avisar = useRef(toast);
  avisar.current = toast;

  const leerSalon = useCallback(async () => {
    try {
      const [m, e] = await Promise.all([cargarSalon(empresaId), cargarElementosPlano(empresaId)]);
      setMesas(m);
      setElementos(e);
    } catch (e) {
      avisar.current(e.message || "No pudimos cargar el salón.", "mal");
    } finally {
      setCargando(false);
    }
  }, [empresaId]);

  useEffect(() => { leerSalon(); }, [leerSalon]);

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

  const volver = () => { setComandaId(null); leerSalon(); };

  if (comandaId) {
    return (
      <Pedido comandaId={comandaId} empresaId={empresaId} config={config}
        ajustes={ajustes} caja={caja} toast={toast} onVolver={volver} />
    );
  }

  /* Sin nada dibujado y sin permiso para dibujarlo, un plano vacío no
     dice nada: mejor la frase. */
  if (!cargando && !mesas.length && !elementos.length && !permisos.ajustes) {
    return <Vacio>Todavía no hay mesas cargadas para este comercio.</Vacio>;
  }

  return (
    <PlanoSalon
      mesas={mesas} elementos={elementos} cargando={cargando} abriendo={abriendo}
      puedeEditar={!!permisos.ajustes} empresaId={empresaId} sucursalId={sucursalId}
      toast={toast} onTocarMesa={entrar} onActualizar={leerSalon} onGuardado={leerSalon} />
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
   mostrador. Sin ellos se comporta como siempre: la mesa que abrió el mozo. */
function Pedido({ comandaId, empresaId, config, ajustes, caja, toast, onVolver, onCambiarCanal = null, encabezado = null, voz = VOZ_MESA, pleno = false }) {
  const [comanda, setComanda] = useState(null);
  const [carta, setCarta] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(null);           // categoría elegida en las solapas
  const [detalle, setDetalle] = useState(null);   // item al que se le cargan modificadores
  const [cobrando, setCobrando] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [panel, setPanel] = useState("carta");    // solo manda en pantalla chica

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
  const reenviar = async () => {
    if (trabajando || !comanda) return;
    const vuelven = activas(comanda.lineas).filter((l) => l.estado === "preparando" || l.estado === "listo");
    if (!vuelven.length) {
      return avisar.current("No hay nada para reenviar: la cocina todavía no lo tocó.", "mal");
    }
    setTrabajando(true);
    try {
      await Promise.all(vuelven.map((l) => cambiarEstadoLinea(l.id, "pedido")));
      avisar.current(vuelven.length === 1 ? "1 plato volvió a la cocina." : `${vuelven.length} platos volvieron a la cocina.`);
      await leerComanda();
    } catch (e) {
      avisar.current(e.message || "No se pudo reenviar a cocina.", "mal");
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

  return (
    <div className={pleno ? "h-full min-h-0 flex flex-col gap-3" : "flex flex-col gap-3"}>
      <div className="shrink-0 flex items-center gap-3">
        <Boton variant="ghost" size="lg" onClick={onVolver}><ArrowLeft size={18} /> {voz.volver}</Boton>
        {/* En un pedido sin mesa el rótulo es un botón: quien está en el
            mostrador arranca la comanda y recién después se entera de si es
            para llevar o si entró por una aplicación. */}
        <div className="min-w-0">
          {onCambiarCanal ? (
            <button onClick={onCambiarCanal}
              className="text-left group max-w-full">
              <span className="f-d text-lg leading-tight truncate block group-hover:text-acento transition-colors">
                {rotulo} <span className="text-xs font-normal text-texto-tenue group-hover:text-acento">cambiar</span>
              </span>
              <span className="text-[11px] text-texto-tenue truncate block">
                {sub}{comanda.abiertaEn ? `${sub ? " · " : ""}hace ${espera(minutosDesde(comanda.abiertaEn))}` : ""}
              </span>
            </button>
          ) : (
            <>
              <div className="f-d text-lg leading-tight truncate">{rotulo}</div>
              <div className="text-[11px] text-texto-tenue truncate">
                {sub}{comanda.abiertaEn ? `${sub ? " · " : ""}hace ${espera(minutosDesde(comanda.abiertaEn))}` : ""}
              </div>
            </>
          )}
        </div>
        <div className="ml-auto text-right">
          <Rotulo>Total</Rotulo>
          <div className="f-m text-xl">{money(comanda.total)}</div>
        </div>
      </div>

      {/* En el celular no entran las dos cosas: se muestra una y se cambia
          con un botón grande, sin menús. */}
      <div className="lg:hidden shrink-0 grid grid-cols-2 gap-2">
        <Boton size="lg" variant={panel === "comanda" ? "dark" : "ghost"} onClick={() => setPanel("comanda")}>
          Comanda {cuantos > 0 ? `(${cuantos})` : ""}
        </Boton>
        <Boton size="lg" variant={panel === "carta" ? "dark" : "ghost"} onClick={() => setPanel("carta")}>Carta</Boton>
      </div>

      <div className={`grid lg:grid-cols-[minmax(320px,380px)_1fr] gap-3 ${
        pleno ? "flex-1 min-h-0" : "lg:h-[70vh]"}`}>

        {/* --- La comanda ------------------------------------------------ */}
        <Card className={`flex flex-col min-h-0 overflow-hidden ${panel === "comanda" ? "" : "hidden lg:flex"}`}>
          <div className="shrink-0 px-4 py-3 border-b border-borde flex items-center justify-between">
            <h3 className="f-d">{voz.panel}</h3>
            <span className="text-[11px] text-texto-tenue">{cuantos} item{cuantos === 1 ? "" : "s"}</span>
          </div>

          {!lineas.length ? (
            <div className="flex-1 min-h-0 overflow-auto"><Vacio>{voz.sinNada}</Vacio></div>
          ) : (
            <ul className="flex-1 min-h-0 overflow-auto divide-y divide-borde">
              {lineas.map((l) => (
                <li key={l.id} className="flex items-start gap-2 px-3 py-2.5">
                  <span className="f-m text-sm font-bold text-texto-suave shrink-0 w-7 pt-0.5">{l.cantidad}×</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm leading-tight">{l.nombre}</div>
                    {(l.modificadores || []).map((m, x) => (
                      <div key={x} className="text-[11px] text-texto-suave">
                        · {m.nombre}{m.precio ? ` (+${money(m.precio)})` : ""}
                      </div>
                    ))}
                    {l.notas && <div className="text-[11px] text-ojo italic">{l.notas}</div>}
                    {ESTADO_LINEA[l.estado] && (
                      <div className={`text-[10px] uppercase tracking-wider font-bold mt-0.5 ${ESTADO_LINEA[l.estado].tono}`}>
                        {ESTADO_LINEA[l.estado].n}
                      </div>
                    )}
                  </div>
                  <span className="f-m text-sm shrink-0">{money(l.total)}</span>
                  <button onClick={() => anular(l)} disabled={trabajando} title="Anular"
                    className="shrink-0 text-texto-tenue hover:text-mal disabled:opacity-40 p-1">
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="shrink-0 border-t border-borde p-3">
            <div className="flex items-baseline justify-between text-sm text-texto-suave">
              <span>Subtotal</span>
              <span className="f-m">{money(comanda.total)}</span>
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-sm text-texto-suave">Total</span>
              <span className="f-m text-3xl">{money(comanda.total)}</span>
            </div>

            {lineas.length ? (
              <>
                <Boton size="lg" className="w-full mt-3" onClick={() => setCobrando(true)}>
                  <Wallet size={17} /> {voz.cobrar}
                </Boton>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Boton size="lg" variant="ghost" disabled={trabajando} onClick={reenviar}>
                    <ChefHat size={17} /> A cocina
                  </Boton>
                  <Boton size="lg" variant="ghost" onClick={onVolver}>
                    <ArrowLeft size={17} /> {voz.volver}
                  </Boton>
                </div>
              </>
            ) : (
              <Boton size="lg" variant="ghost" className="w-full mt-3" disabled={trabajando} onClick={liberar}>
                {voz.soltar}
              </Boton>
            )}
          </div>
        </Card>

        {/* --- La carta -------------------------------------------------- */}
        <Card className={`flex flex-col min-h-0 overflow-hidden ${panel === "carta" ? "" : "hidden lg:flex"}`}>
          <div className="shrink-0 px-3 py-2.5 border-b border-borde flex items-center gap-2">
            <Search size={16} className="text-texto-tenue shrink-0" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en la carta"
              className="w-full text-base outline-none bg-transparent" />
            {q && <button onClick={() => setQ("")} className="text-texto-tenue shrink-0"><X size={16} /></button>}
          </div>

          {categorias.length > 1 && (
            <div className="shrink-0 flex gap-1.5 overflow-x-auto px-3 py-2 border-b border-borde">
              {categorias.map((c) => (
                <button key={c} onClick={() => { setCat(c); setQ(""); }}
                  className={`shrink-0 px-3.5 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                    !q && c === cat
                      ? "bg-superficie-3 text-texto border-borde-fuerte"
                      : "bg-superficie text-texto-suave border-borde hover:bg-superficie-2"}`}>
                  {c}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-auto p-2.5">
            {!items.length ? (
              <Vacio>{q ? "Ningún plato con ese nombre." : "Esta categoría está vacía."}</Vacio>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-2">
                {items.map((i) => (
                  <div key={i.id} className="relative">
                    <button onClick={() => agregar(i)}
                      className="w-full h-full min-h-[92px] flex flex-col justify-between gap-2 text-left rounded-2xl border border-borde bg-superficie-2 p-3 pr-9 transition-colors hover:border-acento hover:bg-superficie-3 active:bg-superficie-3">
                      <span className="text-sm md:text-base leading-tight line-clamp-3">{i.nombre}</span>
                      <span className="f-m text-base text-acento-vivo">{money(i.precio)}</span>
                    </button>
                    <button onClick={() => setDetalle(i)} title="Cómo lo quieren"
                      className="absolute top-1.5 right-1.5 p-1.5 rounded-lg text-texto-tenue hover:text-texto hover:bg-superficie">
                      <StickyNote size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <ModalDetalle item={detalle} onCerrar={() => setDetalle(null)}
        onAgregar={(extra) => { const i = detalle; setDetalle(null); agregar(i, extra); }} />

      <ModalCobro abierto={cobrando} comanda={comanda} comandaId={comandaId} empresaId={empresaId}
        config={config} ajustes={ajustes} caja={caja} toast={toast} rotulo={rotulo} voz={voz}
        onCerrar={() => setCobrando(false)} onCobrada={onVolver} />
    </div>
  );
}

/* "pedido" no se muestra: es el estado normal de una línea recién cargada
   y repetirlo en todas las filas no dice nada. */
const ESTADO_LINEA = {
  preparando: { n: "En cocina", tono: "text-ojo" },
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
   4. MOSTRADOR · el tablero de los pedidos que no ocupan mesa
   ============================================================

   Lo que se pide en la barra, lo que pasan a buscar, lo que sale en moto
   y lo que entra por una aplicación, ordenado por etapa. La pantalla de
   comandas alcanza para tomarlos y retomarlos; esto es para el que arma,
   que mira todo el día lo mismo y necesita verlo por columna.
   ============================================================ */

const ETAPAS = [
  { k: "pendiente", n: "Pendientes" },
  { k: "preparando", n: "En preparación" },
  { k: "listo", n: "Listos" },
];

export function Mostrador({ empresaId, sucursalId = null, config = {}, ajustes, caja, toast }) {
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState(null);   // el pedido que se está atendiendo
  const [nuevo, setNuevo] = useState(false);
  const [abriendo, setAbriendo] = useState(false);
  const [canal, setCanal] = useState(null);       // filtro
  const [q, setQ] = useState("");

  const avisar = useRef(toast);
  avisar.current = toast;
  const releer = useRef(() => {});

  /* Mientras se está adentro de un pedido no se refresca el tablero: la
     pantalla no se ve y la lectura vieja no sirve para nada. */
  useEffect(() => {
    if (abierto) return undefined;
    let vivo = true;
    const leer = async () => {
      try {
        const d = await cargarPedidos(empresaId);
        if (vivo) setPedidos(d);
      } catch (e) {
        if (vivo) avisar.current(e.message || "No pudimos leer los pedidos.", "mal");
      } finally {
        if (vivo) setCargando(false);
      }
    };
    releer.current = leer;
    leer();
    const id = setInterval(leer, 20000);
    return () => { vivo = false; clearInterval(id); };
  }, [empresaId, abierto]);

  const crear = async (datos) => {
    if (abriendo) return;
    setAbriendo(true);
    try {
      const id = await abrirPedido({ empresaId, sucursalId, ...datos });
      setNuevo(false);
      setAbierto({ id, canal: datos.canal, referencia: datos.referencia || null, cliente: datos.cliente || null });
    } catch (e) {
      avisar.current(e.message || "No se pudo abrir el pedido.", "mal");
    } finally {
      setAbriendo(false);
    }
  };

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return pedidos.filter((p) => {
      if (canal && p.canal !== canal) return false;
      if (!t) return true;
      const cli = p.cliente || {};
      return [p.referencia, cli.nombre, cli.app].filter(Boolean).join(" ").toLowerCase().includes(t);
    });
  }, [pedidos, canal, q]);

  if (abierto) {
    return (
      <Pedido comandaId={abierto.id} empresaId={empresaId} config={config} ajustes={ajustes}
        caja={caja} toast={toast} voz={VOZ_CANAL} encabezado={encabezadoDe(abierto)}
        onVolver={() => setAbierto(null)} />
    );
  }

  const completados = visibles.filter((p) => p.etapa === "cerrado");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Boton size="lg" onClick={() => setNuevo(true)} disabled={abriendo}>
          <Plus size={18} /> Nuevo pedido
        </Boton>
        <span className="text-sm text-texto-suave">
          <strong className="text-texto f-m">{visibles.filter((p) => p.etapa !== "cerrado").length}</strong> en curso
        </span>
        <Boton size="sm" variant="ghost" className="ml-auto" onClick={() => releer.current()}>
          <RefreshCw size={14} /> Actualizar
        </Boton>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Boton size="md" variant={canal === null ? "dark" : "ghost"} onClick={() => setCanal(null)}>Todos</Boton>
        {CANALES.map((c) => {
          const Icono = tonoDe(c.k).i;
          return (
            <Boton key={c.k} size="md" variant={canal === c.k ? "dark" : "ghost"} onClick={() => setCanal(c.k)}>
              <Icono size={15} /> {c.n}
            </Boton>
          );
        })}
        <div className="flex items-center gap-2 border border-borde bg-superficie rounded-xl px-3 py-2 min-w-[200px] flex-1 md:flex-none md:w-64">
          <Search size={16} className="text-texto-tenue shrink-0" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Referencia o cliente"
            className="w-full text-sm outline-none bg-transparent" />
          {q && <button onClick={() => setQ("")} className="text-texto-tenue shrink-0"><X size={15} /></button>}
        </div>
      </div>

      {cargando && <Vacio>Cargando los pedidos…</Vacio>}
      {!cargando && !pedidos.length && (
        <Vacio>Todavía no entró ningún pedido hoy. Tocá "Nuevo pedido" para arrancar.</Vacio>
      )}
      {!cargando && pedidos.length > 0 && !visibles.length && (
        <Vacio>Ningún pedido con ese filtro.</Vacio>
      )}

      <div className="grid md:grid-cols-3 gap-3 items-start">
        {ETAPAS.map((et) => {
          const suyos = visibles.filter((p) => p.etapa === et.k);
          return (
            <div key={et.k}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="f-d text-base">{et.n}</h3>
                <span className="f-m text-sm text-texto-tenue">{suyos.length}</span>
              </div>
              <div className="space-y-2">
                {suyos.map((p) => <TarjetaPedido key={p.id} p={p} onTocar={() => setAbierto(p)} />)}
                {!suyos.length && (
                  <div className="rounded-2xl border-2 border-dashed border-borde py-6 text-center text-xs text-texto-tenue">
                    vacío
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {completados.length > 0 && (
        <section>
          <Rotulo className="mb-2">Completados · {completados.length}</Rotulo>
          <ul className="flex flex-wrap gap-2">
            {completados.map((p) => (
              <li key={p.id}>
                <button onClick={() => setAbierto(p)}
                  className="flex items-center gap-2 text-left border border-borde bg-superficie rounded-xl px-3 py-2 hover:bg-superficie-2">
                  <Check size={14} className="text-texto-tenue shrink-0" />
                  <span className="text-sm text-texto-suave truncate max-w-[180px]">{encabezadoDe(p).titulo}</span>
                  <span className="f-m text-sm">{money(p.total)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ModalNuevoPedido abierto={nuevo} trabajando={abriendo}
        onCerrar={() => setNuevo(false)} onCrear={crear} />
    </div>
  );
}

function TarjetaPedido({ p, onTocar }) {
  const t = tonoDe(p.canal);
  const Icono = t.i;
  const min = minutosDesde(p.abiertaEn);
  const cli = p.cliente || {};
  const primeras = p.lineas.slice(0, 3);

  return (
    <button onClick={onTocar}
      className={`w-full text-left rounded-2xl border-2 bg-superficie p-3 hover:bg-superficie-2 transition-colors ${t.borde}`}>
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg border ${t.pill}`}>
          <Icono size={12} /> {rotuloCanal(p)}
        </span>
        {p.referencia && <span className="f-m text-sm font-bold truncate">#{p.referencia}</span>}
        <span className="ml-auto flex items-center gap-1 text-[11px] text-texto-suave shrink-0">
          <Clock size={11} /> {espera(min)}
        </span>
      </div>

      {cli.nombre && <div className="text-base leading-tight mt-1.5 truncate">{cli.nombre}</div>}

      {primeras.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {primeras.map((l) => (
            <div key={l.id} className="text-sm text-texto-suave leading-tight truncate">
              <span className="f-m font-bold">{l.cantidad}×</span> {l.nombre}
            </div>
          ))}
          {p.lineas.length > primeras.length && (
            <div className="text-[11px] text-texto-tenue">y {p.lineas.length - primeras.length} más</div>
          )}
        </div>
      )}

      <div className="f-m text-xl mt-2">{money(p.total)}</div>
    </button>
  );
}

/* --- Nuevo pedido ------------------------------------------------------
   El que está parado en el mostrador no puede esperar a que alguien
   complete un formulario: elegir "Mostrador" abre la comanda y listo. Los
   demás canales sí necesitan un dato, porque después hay que saber a quién
   entregarle qué.

   `canalInicial` es para cuando el canal ya se eligió antes de abrir el
   diálogo, que es lo que pasa en la pantalla de comandas: preguntar dos
   veces lo mismo es un toque de más con gente esperando.               */
function ModalNuevoPedido({ abierto, trabajando, canalInicial = null, onCerrar, onCrear }) {
  const [canal, setCanal] = useState(null);
  const [app, setApp] = useState(APLICACIONES[0]);
  const [otraApp, setOtraApp] = useState("");
  const [referencia, setReferencia] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");

  useEffect(() => {
    if (!abierto) return;
    setCanal(canalInicial); setApp(APLICACIONES[0]); setOtraApp("");
    setReferencia(""); setNombre(""); setTelefono("");
  }, [abierto, canalInicial]);

  if (!abierto) return null;

  const elegir = (k) => (k === "mostrador" ? onCrear({ canal: "mostrador" }) : setCanal(k));

  const confirmar = () => {
    if (canal === "app") {
      const cual = (app === "Otra" ? otraApp.trim() : app) || "Aplicación";
      return onCrear({ canal: "app", referencia: referencia.trim() || null, cliente: { app: cual } });
    }
    const n = nombre.trim(), tel = telefono.trim();
    onCrear({ canal, cliente: n || tel ? { nombre: n, telefono: tel } : null });
  };

  return (
    <Modal open onClose={onCerrar} ancho="max-w-md">
      <div className="p-5">
        {!canal ? (
          <>
            <h3 className="f-d text-lg">¿Por dónde entró?</h3>
            <div className="mt-4 space-y-2">
              {CANALES.map((c) => {
                const Icono = tonoDe(c.k).i;
                return (
                  <button key={c.k} onClick={() => elegir(c.k)} disabled={trabajando}
                    className="w-full flex items-center gap-3 text-left px-4 py-3.5 rounded-xl border-2 border-borde hover:bg-superficie-2 disabled:opacity-40">
                    <Icono size={20} className="text-texto-suave shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-base font-semibold">{c.n}</span>
                      {c.d && <span className="block text-xs text-texto-suave">{c.d}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
            <Boton variant="quiet" className="w-full mt-4" onClick={onCerrar}>Cancelar</Boton>
          </>
        ) : (
          <>
            <h3 className="f-d text-lg">{(CANALES.find((c) => c.k === canal) || {}).n}</h3>

            {canal === "app" ? (
              <>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {APLICACIONES.map((a) => (
                    <button key={a} onClick={() => setApp(a)}
                      className={`px-3 py-3 rounded-xl border-2 text-base font-semibold ${
                        app === a ? "border-acento bg-acento-suave" : "border-borde hover:bg-superficie-2"}`}>
                      {a}
                    </button>
                  ))}
                </div>
                {app === "Otra" && (
                  <Campo label="Cuál">
                    <input value={otraApp} onChange={(e) => setOtraApp(e.target.value)}
                      placeholder="Nombre de la aplicación" className={inputCls} />
                  </Campo>
                )}
                <div className="mt-3">
                  <Campo label="Número de pedido">
                    <input value={referencia} onChange={(e) => setReferencia(e.target.value)}
                      placeholder="El que muestra la aplicación" className={inputCls} />
                  </Campo>
                </div>
              </>
            ) : (
              <div className="mt-4 space-y-3">
                <Campo label="Nombre">
                  <input value={nombre} onChange={(e) => setNombre(e.target.value)}
                    placeholder="Para llamarlo cuando esté" className={inputCls} autoFocus />
                </Campo>
                <Campo label="Teléfono">
                  <input value={telefono} onChange={(e) => setTelefono(e.target.value.replace(/[^\d\s+-]/g, ""))}
                    placeholder="Opcional" className={inputCls} />
                </Campo>
              </div>
            )}

            <Boton size="lg" className="w-full mt-5" disabled={trabajando} onClick={confirmar}>
              {trabajando ? "Abriendo…" : "Abrir el pedido"}
            </Boton>
            {canalInicial ? (
              <Boton variant="quiet" className="w-full mt-1.5" onClick={onCerrar}>Cancelar</Boton>
            ) : (
              <Boton variant="quiet" className="w-full mt-1.5" onClick={() => setCanal(null)}>Cambiar el canal</Boton>
            )}
          </>
        )}
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
  const [lineas, setLineas] = useState([]);
  const [cargando, setCargando] = useState(true);

  const avisar = useRef(toast);
  avisar.current = toast;
  const releer = useRef(() => {});

  useEffect(() => {
    let vivo = true;
    const leer = async () => {
      try {
        const d = await cargarPendientes(empresaId, destino);
        if (vivo) setLineas(d);
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

  /* El cambio se pinta antes de que conteste el servidor: el que cocina
     tocó el botón y necesita ver que pasó, no esperar a la red. */
  const mover = async (l, estado) => {
    setLineas((xs) => estado === "entregado"
      ? xs.filter((x) => x.id !== l.id)
      : xs.map((x) => (x.id === l.id ? { ...x, estado } : x)));
    try {
      await cambiarEstadoLinea(l.id, estado);
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
      {!cargando && !lineas.length && <Vacio>No hay nada esperando. Cocina al día.</Vacio>}

      <div className="grid md:grid-cols-3 gap-3 items-start">
        {COLUMNAS.map((col) => {
          const suyas = lineas.filter((l) => l.estado === col.k);
          return (
            <div key={col.k}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="f-d text-base">{col.n}</h3>
                <span className="f-m text-sm text-texto-tenue">{suyas.length}</span>
              </div>
              <div className="space-y-2">
                {suyas.map((l) => <Comanda key={l.id} l={l} col={col} onMover={mover} />)}
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

function Comanda({ l, col, onMover }) {
  const min = minutosDesde(l.enviadaEn || l.desde);
  // Lo que espera hace rato tiene que gritar desde el otro lado de la cocina.
  const tono = min >= 20 ? "border-mal bg-mal-suave" : min >= 10 ? "border-ojo bg-ojo-suave" : "border-borde bg-superficie";

  return (
    <div className={`rounded-2xl border-2 p-3 ${tono}`}>
      <div className="flex items-baseline justify-between gap-2">
        {/* Un pedido de mostrador no tiene mesa, y la cocina igual tiene que
            saber que eso hay que prepararlo. */}
        <span className="f-d text-xl leading-none">{l.mesa || "Pedido"}</span>
        <span className="f-m text-xs text-texto-suave shrink-0">{espera(min)}</span>
      </div>
      <div className="text-base mt-2 leading-tight">
        <span className="f-m font-bold">{l.cantidad}×</span> {l.nombre}
      </div>
      {(l.modificadores || []).map((m, i) => (
        <div key={i} className="text-sm text-texto-suave">· {m.nombre}</div>
      ))}
      {l.notas && <div className="text-sm italic text-ojo mt-1">{l.notas}</div>}
      {l.destino && <div className="text-[10px] uppercase tracking-widest text-texto-tenue font-bold mt-1">{l.destino}</div>}
      <Boton size="lg" className="w-full mt-3" variant={col.k === "listo" ? "dark" : "primary"}
        onClick={() => onMover(l, col.sig)}>
        {col.accion}
      </Boton>
    </div>
  );
}
