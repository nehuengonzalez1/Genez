/* ============================================================
   15b. EL MAPA DE MESAS
   ============================================================

   Un salón no es una lista de mesas: es un lugar. La mesa 8 está contra
   la ventana y la 3 al lado de la barra, y el mozo no busca un nombre en
   una grilla ordenada, mira dónde está parado. Por eso el plano se
   dibuja, y por eso cada local tiene que poder dibujar el suyo: su
   barra donde la tiene, su cocina, sus paredes y la puerta por donde
   entra la gente. Sin eso el plano es una grilla decorativa.

   Las coordenadas viven en una grilla propia (enteros), nunca en
   píxeles: el mismo plano tiene que entrar en un celular y en el monitor
   de la caja. El tamaño de celda se calcula acá, contra el espacio
   disponible, y es lo único que cambia entre una pantalla y la otra.

   Tres zonas: los pisos y las vistas a la izquierda, el plano al centro,
   las acciones a la derecha, y abajo el recuento por estado. En celular
   los dos costados se pliegan y queda el plano solo.
   ============================================================ */

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
/* `Map` viene renombrado a propósito: importarlo con su nombre tapa el
   Map de JavaScript y `new Map()` pasa a construir un ícono. */
import {
  Clock, Pencil, Plus, Trash2, X, Save, RefreshCw, Filter, Map as Mapa, List,
  CalendarClock, Link2, Unlink, DoorOpen, ChefHat, Sprout, ArrowLeft, History, Layers,
  Type, Bath, GlassWater, Grid3x3, Square, Search, ClipboardList, Receipt,
} from "lucide-react";
import { money, hora } from "../utils/helpers.js";
import {
  guardarPlano, guardarElementos, borrarElemento, crearRecurso, borrarRecurso,
  unirMesas, separarMesa,
} from "../datos/comandas.js";
import {
  cargarReservas, crearReserva, cambiarEstadoReserva, sentarReserva, nombreEstadoReserva,
} from "../datos/reservas.js";
import { escucharPedidos } from "../datos/pedidos.js";
import { Card, Boton, Modal, Vacio } from "../ui/Base.jsx";
import { Campo, inputCls } from "../ui/Campos.jsx";

/* Una fecha como la espera un <input type="date">, en hora local: con
   toISOString, a las nueve de la noche el día ya cambió. */
const aCampoFecha = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const espera = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${m}m`);

/* El mínimo existe para que una celda no quede impracticable de tocar,
   pero cuando pisa al cálculo de alto el plano deja de entrar y se corta
   por abajo, que es peor: un salón que no se ve entero no sirve. En 16 px
   una mesa de tres celdas sigue midiendo 48 y se toca bien. */
const CELDA_MIN = 16;
const CELDA_MAX = 64;

const PISO_POR_DEFECTO = "Planta baja";

const FORMAS = [
  { k: "rectangulo", n: "Cuadrada" },
  { k: "redonda", n: "Redonda" },
  { k: "barra", n: "Alargada" },
];

/* Lo que ubica sin venderse. El tamaño por defecto es el que tiene la
   cosa en un local de verdad: una barra es larga y angosta, la cocina es
   un bloque, una pared es una línea. */
const ELEMENTOS = [
  { k: "pared", n: "Pared", ancho: 6, alto: 1, i: Square },
  { k: "barra", n: "Barra", ancho: 6, alto: 2, i: GlassWater },
  { k: "cocina", n: "Cocina", ancho: 4, alto: 3, i: ChefHat },
  { k: "entrada", n: "Entrada", ancho: 3, alto: 1, i: DoorOpen },
  { k: "bano", n: "Baño", ancho: 2, alto: 2, i: Bath },
  { k: "planta", n: "Planta", ancho: 1, alto: 1, i: Sprout },
  { k: "texto", n: "Texto", ancho: 3, alto: 1, i: Type },
];

const nombreElemento = (t) => (ELEMENTOS.find((e) => e.k === t) || { n: "Elemento" }).n;

/* Cómo se dibuja cada cosa del fondo. La pared es un trazo macizo, la
   entrada es un hueco marcado, la planta no lleva rótulo: nadie necesita
   que le escriban "planta" al lado de una planta. */
const PINTA = {
  pared: { caja: "bg-borde-fuerte", texto: "text-texto-tenue", rotulo: false },
  barra: { caja: "bg-superficie-3 border border-borde-fuerte", texto: "text-texto-suave", rotulo: true },
  cocina: { caja: "bg-superficie-3 border border-borde-fuerte", texto: "text-texto-suave", rotulo: true },
  entrada: { caja: "border-2 border-dashed border-acento", texto: "text-acento", rotulo: true },
  bano: { caja: "bg-superficie-2 border border-borde-fuerte", texto: "text-texto-suave", rotulo: true },
  planta: { caja: "bg-bien-suave border border-bien", texto: "text-bien", rotulo: false },
  texto: { caja: "", texto: "text-texto-tenue", rotulo: true },
};

/* Los cinco estados. El violeta de la reserva es color propio: una mesa
   comprometida no es "algo que mirar" ni "algo que está bien", y
   confundirla con la que ya pidió la cuenta manda a levantar una mesa
   donde en un rato se sienta gente. */
const ESTADOS = {
  libre: { n: "Libre", plural: "Libre", caja: "bg-bien-suave border-bien text-bien", punto: "bg-bien" },
  ocupada: { n: "Ocupada", plural: "Ocupadas", caja: "bg-mal-suave border-mal text-mal", punto: "bg-mal" },
  entregar: { n: "Por entregar", plural: "Por entregar", caja: "bg-ojo-suave border-ojo text-ojo", punto: "bg-ojo" },
  reservada: { n: "Reservada", plural: "Reservadas", caja: "bg-reserva-suave border-reserva text-reserva", punto: "bg-reserva" },
  cuenta: { n: "Cuenta / Pagada", plural: "Cuenta / Pagada", caja: "bg-info-suave border-info text-info", punto: "bg-info" },
};

const ORDEN_ESTADOS = ["libre", "ocupada", "entregar", "reservada", "cuenta"];

/* El estado lo resuelve `salon_vista` y no esta pantalla: el mapa, la
   lista de mesas y el recuento de abajo tienen que decir lo mismo, y si
   cada uno lo dedujera por su cuenta, un día dejan de coincidir. */
const estadoDe = (m) => m.estado || "libre";

/* El mozo lee el número, no la palabra "Mesa": adentro va grande el
   número solo, con dos dígitos como en la maqueta. Si la mesa se llama de
   otra forma —"Vereda", "VIP"— se muestra el nombre y listo. */
/* La mesa 1 y la banqueta 1 de la barra son dos lugares distintos, y con
   el número pelado las dos dicen "01". Cuando el nombre no empieza con
   "Mesa", su inicial va adelante: B1 la banqueta, T3 la de la terraza. */
function numeroDe(nombre) {
  const texto = String(nombre || "").trim();
  const d = texto.match(/\d+/);
  if (!d) return texto.slice(0, 6) || "?";

  const palabra = texto.split(/[\s-]+/)[0];
  if (/^mesa$/i.test(palabra) || /^\d/.test(palabra)) return d[0].padStart(2, "0");
  return palabra.charAt(0).toUpperCase() + d[0];
}

function idNuevo() {
  try {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  } catch (e) { /* sin crypto */ }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const chocan = (a, b) =>
  a.x < b.x + b.ancho && a.x + a.ancho > b.x && a.y < b.y + b.alto && a.y + a.alto > b.y;

/* ------------------------------------------------------------ */

export function PlanoSalon({
  mesas, elementos, cargando, abriendo, puedeEditar,
  empresaId, sucursalId = null, toast, onTocarMesa, onActualizar, onGuardado,
  /* El estado del cajón viaja como `cajaAbierta` y no como `caja`: acá
     `caja` ya es el tamaño medido del contenedor del plano, y dos cosas
     distintas con el mismo nombre en el mismo componente es cómo se
     rompe algo sin que el compilador diga nada. */
  empleado = "", cajaAbierta = false, onVolver = null, onHistorial = null, pleno = false,
}) {
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(null);   // { mesas, elementos, borradas, elemBorrados }
  const [sel, setSel] = useState(null);             // { tipo, id }
  const [guardando, setGuardando] = useState(false);
  const [piso, setPiso] = useState(null);
  const [pisosExtra, setPisosExtra] = useState([]); // los que todavía no tienen ninguna mesa
  const [nombrandoPiso, setNombrandoPiso] = useState(false);
  const [nuevoPiso, setNuevoPiso] = useState("");
  const [sector, setSector] = useState("*");
  const [caja, setCaja] = useState({ ancho: 0, alto: 0 });
  const [modo, setModo] = useState(null);           // null | unir | separar
  const [elegidas, setElegidas] = useState([]);
  const [trabajando, setTrabajando] = useState(false);
  const [lateral, setLateral] = useState(false);    // en celular los costados se pliegan
  const [vista, setVista] = useState("plano");      // plano | lista | reservas
  const [mesaTocada, setMesaTocada] = useState(null);
  const [reservando, setReservando] = useState(null);
  const [verFiltros, setVerFiltros] = useState(false);
  const [filtros, setFiltros] = useState({ estados: [], sectores: [], capacidad: "" });
  /* El reloj de la barra de abajo. Va por minuto: es la hora que mira el
     que atiende, no un cronómetro. */
  const [reloj, setReloj] = useState(() => new Date());

  const arrastre = useRef(null);
  const observador = useRef(null);

  /* Ref de función y no useRef: el contenedor del plano se desmonta al
     entrar en edición (cambia de lugar en el árbol) y un efecto de montaje
     se quedaría midiendo un nodo que ya no existe. */
  const nodo = useRef(null);

  const cont = useCallback((el) => {
    if (observador.current) { observador.current.disconnect(); observador.current = null; }
    nodo.current = el;
    if (!el) return;
    setCaja({ ancho: el.clientWidth, alto: el.clientHeight });
    if (!window.ResizeObserver) return;
    observador.current = new ResizeObserver((e) => {
      const r = e[0].contentRect;
      setCaja({ ancho: r.width, alto: r.height });
    });
    observador.current.observe(el);
  }, []);

  /* Y se vuelve a medir después de cada render. La primera medición sale
     antes de que se acomoden el recuento y la barra de abajo, así que el
     plano quedaba calculado contra un alto que después no existía y se
     pasaba por abajo del recuento. El observador no lo arregla solo: en
     ese momento el contenedor todavía no cambió de tamaño, lo hacen los
     hermanos que se agregan debajo. */
  useEffect(() => {
    const el = nodo.current;
    if (!el) return;
    const ancho = el.clientWidth, alto = el.clientHeight;
    setCaja((c) => (c.ancho === ancho && c.alto === alto ? c : { ancho, alto }));
  });

  const mesasVista = editando && borrador ? borrador.mesas : mesas;
  const elemVista = editando && borrador ? borrador.elementos : elementos;

  const pisos = useMemo(() => {
    const s = new Set(pisosExtra);
    for (const m of mesasVista) s.add(m.piso || PISO_POR_DEFECTO);
    for (const e of elemVista) s.add(e.piso || PISO_POR_DEFECTO);
    if (!s.size) s.add(PISO_POR_DEFECTO);
    return [...s].sort();
  }, [mesasVista, elemVista, pisosExtra]);

  useEffect(() => {
    if (!piso || !pisos.includes(piso)) setPiso(pisos[0]);
  }, [pisos, piso]);

  const pisoActivo = piso && pisos.includes(piso) ? piso : pisos[0];

  const sectores = useMemo(() => {
    const s = new Set();
    for (const m of mesasVista) if ((m.piso || PISO_POR_DEFECTO) === pisoActivo && m.sector) s.add(m.sector);
    for (const e of elemVista) if ((e.piso || PISO_POR_DEFECTO) === pisoActivo && e.sector) s.add(e.sector);
    return [...s].sort();
  }, [mesasVista, elemVista, pisoActivo]);

  useEffect(() => {
    if (sector !== "*" && !sectores.includes(sector)) setSector("*");
  }, [sectores, sector]);

  const delPiso = (x) => (x.piso || PISO_POR_DEFECTO) === pisoActivo;
  const delSector = (x) => sector === "*" || (x.sector || "") === sector;

  const mesasPiso = mesasVista.filter(delPiso);
  const mesasPlano = mesasPiso.filter(delSector);

  /* Un elemento sin sector es del piso entero: las paredes y la cocina
     siguen estando aunque se mire solo la terraza. */
  const elemPlano = elemVista.filter((e) => delPiso(e) && (!e.sector || delSector(e)));

  /* Una mesa unida no tiene cuenta propia: muestra la de la principal, y
     la principal muestra la capacidad de todas. */
  const principales = useMemo(() => new Map(mesasVista.map((m) => [m.id, m])), [mesasVista]);
  const estadoReal = (m) => {
    const jefa = m.unidaA ? principales.get(m.unidaA) : null;
    return estadoDe(jefa || m);
  };

  /* La grilla se estira hasta donde llega lo dibujado. En edición sobra
     un poco de aire para poder sacar una mesa del montón. */
  const holgura = editando ? 4 : 1;
  const cols = Math.max(16, ...mesasPlano.map((m) => m.x + m.ancho), ...elemPlano.map((e) => e.x + e.ancho)) + holgura;
  const filas = Math.max(10, ...mesasPlano.map((m) => m.y + m.alto), ...elemPlano.map((e) => e.y + e.alto)) + holgura;

  /* Contra el ancho y contra el alto: un plano que entra a lo ancho pero
     se corta abajo obliga a scrollear para ver el fondo del salón. */
  const porAncho = Math.floor((caja.ancho || 320) / cols);
  const porAlto = caja.alto ? Math.floor(caja.alto / filas) : CELDA_MAX;
  const celda = Math.max(CELDA_MIN, Math.min(CELDA_MAX, Math.min(porAncho, porAlto)));

  const recuento = { libre: 0, ocupada: 0, entregar: 0, reservada: 0, cuenta: 0 };
  for (const m of mesasPiso) recuento[estadoReal(m)] += 1;

  /* El filtro no esconde mesas: las apaga. Una mesa que desaparece del
     dibujo rompe la referencia espacial, que es lo único que el plano
     hace mejor que una lista. */
  const hayFiltro = !!(filtros.estados.length || filtros.sectores.length || filtros.capacidad);
  const pasaFiltro = useCallback((m) => {
    if (filtros.estados.length && !filtros.estados.includes(estadoReal(m))) return false;
    if (filtros.sectores.length && !filtros.sectores.includes(m.sector || "")) return false;
    if (filtros.capacidad && (m.capacidadTotal || m.capacidad || 0) < Number(filtros.capacidad)) return false;
    return true;
  }, [filtros, principales]);

  /* La hora de abajo y el refresco por reloj. Realtime avisa cuando algo
     cambia de verdad; esto es solo el minutero. */
  useEffect(() => {
    const id = setInterval(() => setReloj(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  /* El salón se entera solo. Una mesa cambia de estado desde la comanda,
     desde la cocina o desde la caja, y el que mira el plano no tiene por
     qué apretar "actualizar" para enterarse. */
  useEffect(() => {
    if (!empresaId || !onActualizar || editando) return undefined;
    const dejar = escucharPedidos(empresaId, () => onActualizar());
    return dejar;
  }, [empresaId, onActualizar, editando]);

  const consumido = mesasPiso.reduce((s, m) => s + (m.consumido || 0), 0);

  /* --- edición ------------------------------------------------------ */

  const entrarAEditar = () => {
    setBorrador({
      mesas: mesas.map((m) => ({ ...m })),
      elementos: elementos.map((e) => ({ ...e })),
      borradas: [],
      elemBorrados: [],
    });
    setSel(null);
    setModo(null);
    setElegidas([]);
    setEditando(true);
    setLateral(true);   // en celular, sin el panel abierto no hay dónde editar
  };

  const cancelar = () => {
    setEditando(false);
    setBorrador(null);
    setSel(null);
  };

  const tocarMesa = (id, campos) =>
    setBorrador((b) => ({ ...b, mesas: b.mesas.map((m) => (m.id === id ? { ...m, ...campos } : m)) }));

  const tocarElemento = (id, campos) =>
    setBorrador((b) => ({ ...b, elementos: b.elementos.map((e) => (e.id === id ? { ...e, ...campos } : e)) }));

  /* El primer hueco libre de arriba a la izquierda, para que lo nuevo no
     nazca encima de otra mesa. */
  const huecoLibre = (ancho_, alto_) => {
    const cajas = [...mesasPlano, ...elemPlano];
    for (let y = 0; y < filas + 6; y++) {
      for (let x = 0; x < cols; x++) {
        const c = { x, y, ancho: ancho_, alto: alto_ };
        if (!cajas.some((o) => chocan(c, o))) return { x, y };
      }
    }
    return { x: 0, y: filas };
  };

  const agregarMesa = () => {
    const numeros = borrador.mesas
      .map((m) => Number(String(m.nombre).replace(/\D/g, "")))
      .filter((n) => !Number.isNaN(n) && n > 0);
    const nombre = `Mesa ${(numeros.length ? Math.max(...numeros) : 0) + 1}`;
    const hueco = huecoLibre(2, 2);
    const nueva = {
      id: `nueva-${idNuevo()}`, nueva: true, nombre, tipo: "mesa",
      piso: pisoActivo, sector: sector === "*" ? "" : sector,
      capacidad: 4, forma: "rectangulo", ancho: 2, alto: 2, ...hueco,
      ocupada: false, comandaId: null, consumido: 0, items: 0, enCocina: 0, listos: 0,
      minutos: null, unidaA: null, unidas: 0, capacidadTotal: 4,
    };
    setBorrador((b) => ({ ...b, mesas: [...b.mesas, nueva] }));
    setSel({ tipo: "mesa", id: nueva.id });
  };

  const nuevoElemento = (tipo, medidas) => {
    const def = ELEMENTOS.find((e) => e.k === tipo);
    return {
      id: idNuevo(), nuevo: true, empresa_id: empresaId, sucursal_id: sucursalId,
      piso: pisoActivo, sector: sector === "*" ? null : sector,
      tipo, etiqueta: null,
      ancho: def.ancho, alto: def.alto, x: 0, y: 0, ...medidas,
    };
  };

  const agregarElemento = (tipo) => {
    const def = ELEMENTOS.find((e) => e.k === tipo);
    const nuevo = nuevoElemento(tipo, huecoLibre(def.ancho, def.alto));
    setBorrador((b) => ({ ...b, elementos: [...b.elementos, nuevo] }));
    setSel({ tipo: "elemento", id: nuevo.id });
  };

  /* Las cuatro paredes de una sola vez, con el hueco de la entrada abajo
     al centro. Dibujar el contorno pared por pared son seis arrastres
     antes de poder empezar a poner mesas. */
  const dibujarContorno = () => {
    const an = Math.max(14, ...mesasPlano.map((m) => m.x + m.ancho), ...elemPlano.map((e) => e.x + e.ancho)) + 2;
    const al = Math.max(9, ...mesasPlano.map((m) => m.y + m.alto), ...elemPlano.map((e) => e.y + e.alto)) + 2;
    const hueco = 3;
    const izq = Math.floor((an - hueco) / 2);
    const nuevos = [
      nuevoElemento("pared", { x: 0, y: 0, ancho: an, alto: 1 }),
      nuevoElemento("pared", { x: 0, y: al - 1, ancho: izq, alto: 1 }),
      nuevoElemento("pared", { x: izq + hueco, y: al - 1, ancho: an - izq - hueco, alto: 1 }),
      nuevoElemento("pared", { x: 0, y: 1, ancho: 1, alto: al - 2 }),
      nuevoElemento("pared", { x: an - 1, y: 1, ancho: 1, alto: al - 2 }),
      nuevoElemento("entrada", { x: izq, y: al - 1, ancho: hueco, alto: 1 }),
    ];
    setBorrador((b) => ({ ...b, elementos: [...b.elementos, ...nuevos] }));
    setSel(null);
  };

  const agregarPiso = () => {
    const nombre = nuevoPiso.trim();
    setNombrandoPiso(false);
    setNuevoPiso("");
    if (!nombre || pisos.includes(nombre)) return;
    setPisosExtra((p) => [...p, nombre]);
    setPiso(nombre);
    /* Un piso vacío no existe para la base: existe recién cuando tiene una
       mesa. Por eso se entra derecho a dibujarlo. */
    if (!editando && puedeEditar) entrarAEditar();
  };

  const borrarMesa = (m) => {
    setBorrador((b) => ({
      ...b,
      mesas: b.mesas.filter((x) => x.id !== m.id),
      borradas: m.nueva ? b.borradas : [...b.borradas, m.id],
    }));
    setSel(null);
  };

  const quitarElemento = (e) => {
    setBorrador((b) => ({
      ...b,
      elementos: b.elementos.filter((x) => x.id !== e.id),
      elemBorrados: e.nuevo ? b.elemBorrados : [...b.elemBorrados, e.id],
    }));
    setSel(null);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      /* Primero las bajas: el nombre de una mesa es único por comercio, y
         si alguien borra la 5 para volver a dibujarla, crearla antes de
         borrar la vieja choca contra la restricción. */
      for (const id of borrador.borradas) await borrarRecurso(id);
      for (const id of borrador.elemBorrados) await borrarElemento(id);

      /* Las mesas nuevas necesitan existir antes de poder guardarles la
         posición: guardarPlano actualiza por id y una fila sin id no
         tiene dónde caer. */
      const ids = new Map();
      for (const m of borrador.mesas.filter((x) => x.nueva)) {
        const fila = await crearRecurso({
          empresaId, sucursalId, nombre: m.nombre, tipo: "mesa", piso: m.piso,
          sector: m.sector || null, capacidad: Number(m.capacidad) || null,
          x: m.x, y: m.y, forma: m.forma,
        });
        ids.set(m.id, fila.id);
      }

      await guardarPlano(borrador.mesas.map((m) => ({ ...m, id: ids.get(m.id) || m.id })));

      if (borrador.elementos.length) {
        await guardarElementos(empresaId, borrador.elementos.map((e) => ({
          id: e.id,
          sucursal_id: e.sucursal_id || sucursalId || null,
          piso: e.piso || PISO_POR_DEFECTO,
          sector: e.sector || null,
          tipo: e.tipo,
          etiqueta: e.etiqueta || null,
          x: Math.round(e.x), y: Math.round(e.y),
          ancho: Math.round(e.ancho), alto: Math.round(e.alto),
        })));
      }

      setEditando(false);
      setBorrador(null);
      setSel(null);
      setPisosExtra([]);
      toast("Plano guardado.");
      onGuardado && onGuardado();
    } catch (e) {
      toast(e.message || "No se pudo guardar el plano.", "mal");
    } finally {
      setGuardando(false);
    }
  };

  /* --- juntar y separar ---------------------------------------------- */

  const arrancarModo = (k) => {
    setElegidas([]);
    setModo((m) => (m === k ? null : k));
  };

  const unir = async (a, b) => {
    setTrabajando(true);
    try {
      await unirMesas(a, b);
      toast("Mesas unidas.");
      setModo(null);
      setElegidas([]);
      onGuardado && onGuardado();
    } catch (e) {
      toast(e.message || "No se pudieron unir las mesas.", "mal");
      setElegidas([]);
    } finally {
      setTrabajando(false);
    }
  };

  const separar = async (m) => {
    if (!m.unidaA && !m.unidas) {
      return toast("Esa mesa no está unida a ninguna otra.", "mal");
    }
    setTrabajando(true);
    try {
      await separarMesa(m.id);
      toast("Mesas separadas.");
      setModo(null);
      onGuardado && onGuardado();
    } catch (e) {
      toast(e.message || "No se pudo separar la mesa.", "mal");
    } finally {
      setTrabajando(false);
    }
  };

  const tocarPieza = (m) => {
    if (trabajando) return;
    if (modo === "unir") {
      if (elegidas.includes(m.id)) return setElegidas(elegidas.filter((x) => x !== m.id));
      const juntas = [...elegidas, m.id];
      if (juntas.length < 2) return setElegidas(juntas);
      return unir(juntas[0], juntas[1]);
    }
    if (modo === "separar") return separar(m);

    /* Tocar una mesa abre lo que esa mesa admite, no siempre la comanda:
       una libre se puede reservar, una que ya pagó lo que necesita es que
       la levanten. Una mesa unida no tiene cuenta propia, así que se
       abre la de la principal. */
    const jefa = m.unidaA ? principales.get(m.unidaA) : null;
    setMesaTocada(jefa || m);
  };

  /* --- arrastre ------------------------------------------------------
     Eventos de puntero y no arrastrar-y-soltar de HTML5: esto lo usa
     alguien con una tablet, y el drag nativo no existe en el dedo. */

  const alBajar = (e, tipo, pieza, accion = "mover") => {
    if (!editando) return;
    if (accion === "estirar") e.stopPropagation();
    setSel({ tipo, id: pieza.id });
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
    arrastre.current = {
      accion, tipo, id: pieza.id, celda,
      cx: e.clientX, cy: e.clientY, ox: pieza.x, oy: pieza.y,
      ancho: pieza.ancho, alto: pieza.alto,
    };
  };

  const alMover = (e) => {
    const a = arrastre.current;
    if (!a) return;
    const dx = Math.round((e.clientX - a.cx) / a.celda);
    const dy = Math.round((e.clientY - a.cy) / a.celda);
    const cambiar = a.tipo === "mesa" ? tocarMesa : tocarElemento;

    if (a.accion === "estirar") {
      return cambiar(a.id, { ancho: Math.max(1, a.ancho + dx), alto: Math.max(1, a.alto + dy) });
    }

    const x = Math.max(0, a.ox + dx);
    const y = Math.max(0, a.oy + dy);

    if (a.tipo === "mesa") {
      /* Dos mesas en la misma celda no existen en el local. Si el destino
         está tomado, la mesa se queda donde estaba y sigue el dedo. */
      const c = { x, y, ancho: a.ancho, alto: a.alto };
      if (mesasPlano.some((m) => m.id !== a.id && chocan(c, m))) return;
    }
    cambiar(a.id, { x, y });
  };

  const alSoltar = (e) => {
    if (!arrastre.current) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
    arrastre.current = null;
  };

  const mesaSel = sel && sel.tipo === "mesa" && borrador ? borrador.mesas.find((m) => m.id === sel.id) : null;
  const elemSel = sel && sel.tipo === "elemento" && borrador ? borrador.elementos.find((x) => x.id === sel.id) : null;

  /* --- las mesas unidas se ven pegadas -------------------------------
     Un conector chico entre los centros de las dos: sin eso, dos mesas
     pegadas y dos mesas unidas se ven igual. */
  const puestas = new Map(mesasPlano.map((m) => [m.id, m]));
  const conectores = [];
  for (const m of mesasPlano) {
    const jefa = m.unidaA ? puestas.get(m.unidaA) : null;
    if (!jefa) continue;
    const ax = (m.x + m.ancho / 2) * celda, ay = (m.y + m.alto / 2) * celda;
    const bx = (jefa.x + jefa.ancho / 2) * celda, by = (jefa.y + jefa.alto / 2) * celda;
    const horizontal = Math.abs(ax - bx) >= Math.abs(ay - by);
    conectores.push({
      id: m.id,
      left: (ax + bx) / 2 - (horizontal ? 9 : 5),
      top: (ay + by) / 2 - (horizontal ? 5 : 9),
      ancho: horizontal ? 18 : 10,
      alto: horizontal ? 10 : 18,
    });
  }

  /* --- pantalla ------------------------------------------------------ */

  /* La caja del plano va sin relleno: lo que se mide tiene que ser
     exactamente lo dibujable, si no la grilla se pasa de largo y aparece
     una barra de scroll que no hace falta. */
  const plano = (
    <div ref={cont}
      onPointerDown={(e) => { if (editando && e.target === e.currentTarget) setSel(null); }}
      className="flex-1 min-h-0 overflow-auto [-webkit-overflow-scrolling:touch] rounded-2xl border border-borde bg-superficie-2">
      <div
        className="relative mx-auto"
        onPointerDown={(e) => { if (editando && e.target === e.currentTarget) setSel(null); }}
        style={{
          width: cols * celda,
          height: filas * celda,
          backgroundImage: editando
            ? "linear-gradient(to right, rgb(var(--borde-fuerte) / .55) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--borde-fuerte) / .55) 1px, transparent 1px)"
            : undefined,
          backgroundSize: `${celda}px ${celda}px`,
        }}
      >
        {elemPlano.map((e) => (
          <PiezaElemento key={e.id} e={e} celda={celda} editando={editando}
            elegida={sel && sel.tipo === "elemento" && sel.id === e.id}
            onBajar={(ev, accion) => alBajar(ev, "elemento", e, accion)}
            onMover={alMover} onSoltar={alSoltar} />
        ))}

        {conectores.map((c) => (
          <span key={c.id} className="absolute z-[5] rounded bg-borde-fuerte"
            style={{ left: c.left, top: c.top, width: c.ancho, height: c.alto }} />
        ))}

        {mesasPlano.map((m) => (
          <PiezaMesa key={m.id} m={m} celda={celda} editando={editando}
            estado={estadoReal(m)}
            apagada={hayFiltro && !editando && !pasaFiltro(m)}
            abriendo={abriendo === m.id}
            elegida={sel && sel.tipo === "mesa" && sel.id === m.id}
            marcada={elegidas.includes(m.id)}
            onTocar={() => tocarPieza(m)}
            onBajar={(ev, accion) => alBajar(ev, "mesa", m, accion)}
            onMover={alMover} onSoltar={alSoltar} />
        ))}

        {!cargando && !mesasPlano.length && !elemPlano.length && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-texto-tenue px-6 text-center">
            {editando
              ? "Dibujá las paredes y agregá la primera mesa."
              : "No hay nada dibujado en este sector."}
          </div>
        )}
      </div>
    </div>
  );

  const solapas = [{ k: "*", n: sectores.length ? "Todo el piso" : "Salón" }, ...sectores.map((s) => ({ k: s, n: s }))];
  const lados = lateral ? "flex" : "hidden lg:flex";

  return (
    <div className={`flex flex-col gap-2.5 ${pleno ? "h-full min-h-0" : "min-h-[40rem]"}`}>

      {/* En celular no entran las tres zonas: los costados se pliegan. */}
      <div className="lg:hidden shrink-0 flex items-center gap-2">
        <Boton size="md" variant={lateral ? "dark" : "ghost"} onClick={() => setLateral((v) => !v)}>
          <Layers size={15} /> Pisos y acciones
        </Boton>
        <span className="f-d text-sm tracking-[0.2em] text-texto-suave ml-auto">MAPA DE MESAS</span>
      </div>

      {/* `minmax(0,1fr)` también en la fila: sin eso la fila del grid se
          estira hasta lo que mida su contenido, el plano se pasa de alto
          y el recuento de abajo termina dibujado encima. */}
      <div className="flex-1 min-h-0 grid gap-2.5 grid-rows-[minmax(0,1fr)] lg:grid-cols-[14rem_minmax(0,1fr)_13rem]">

        {/* --- Los pisos y las vistas ---------------------------------- */}
        <Card className={`${lados} flex-col min-h-0 overflow-auto p-3 gap-4`}>
          <div className="hidden lg:block f-d text-sm tracking-[0.2em] text-texto">MAPA DE MESAS</div>

          <div>
            <Rotulo>Pisos</Rotulo>
            <div className="mt-1.5 space-y-0.5">
              {pisos.map((p) => (
                <button key={p} onClick={() => setPiso(p)}
                  className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-sm font-semibold text-left transition-colors ${
                    p === pisoActivo ? "bg-superficie-2 text-texto" : "text-texto-suave hover:bg-superficie-2"}`}>
                  <span className={`w-3.5 h-3.5 rounded-full shrink-0 border-2 ${
                    p === pisoActivo ? "bg-acento border-acento" : "border-borde-fuerte"}`} />
                  <span className="truncate">{p}</span>
                </button>
              ))}

              {puedeEditar ? (
                nombrandoPiso ? (
                  <div className="flex items-center gap-1 pt-1">
                    <input className={inputCls} autoFocus value={nuevoPiso} placeholder="Terraza"
                      onChange={(e) => setNuevoPiso(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") agregarPiso();
                        if (e.key === "Escape") { setNombrandoPiso(false); setNuevoPiso(""); }
                      }} />
                    <Boton size="sm" onClick={agregarPiso}><Plus size={14} /></Boton>
                  </div>
                ) : (
                  <button onClick={() => setNombrandoPiso(true)}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-xl text-sm font-semibold text-texto-tenue hover:bg-superficie-2 hover:text-texto transition-colors">
                    <Plus size={14} /> Agregar piso
                  </button>
                )
              ) : null}
            </div>
          </div>

          {editando ? (
            <div>
              <Rotulo>Agregar</Rotulo>
              <div className="mt-1.5 space-y-0.5">
                <Opcion icono={Grid3x3} activa onTocar={agregarMesa}>Mesa</Opcion>
                {ELEMENTOS.map((e) => (
                  <Opcion key={e.k} icono={e.i} onTocar={() => agregarElemento(e.k)}>{e.n}</Opcion>
                ))}
                <Opcion icono={Square} onTocar={dibujarContorno}>Paredes del local</Opcion>
              </div>
            </div>
          ) : (
            <div>
              <Rotulo>Vistas</Rotulo>
              <div className="mt-1.5 space-y-0.5">
                <Opcion icono={Mapa} activa={vista === "plano"} onTocar={() => setVista("plano")}>Plano</Opcion>
                <Opcion icono={List} activa={vista === "lista"} onTocar={() => setVista("lista")}>Lista de mesas</Opcion>
                <Opcion icono={CalendarClock} activa={vista === "reservas"} onTocar={() => setVista("reservas")}>Reservas</Opcion>
              </div>
            </div>
          )}

          {/* Mostrador y para llevar no viven acá: son otro flujo y tienen
              su propia pantalla. Desde el salón solo se vuelve. */}
          {onVolver && (
            <div className="mt-auto pt-3">
              <Boton size="md" variant="ghost" className="w-full" onClick={onVolver}>
                <ArrowLeft size={16} /> Volver
              </Boton>
            </div>
          )}
        </Card>

        {/* --- El plano ------------------------------------------------- */}
        <div className="min-w-0 flex flex-col gap-2.5">
          <div className="shrink-0 flex items-center gap-1.5">
            <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto [-webkit-overflow-scrolling:touch]">
              {solapas.map((s) => (
                <button key={s.k} onClick={() => setSector(s.k)}
                  className={`shrink-0 px-3.5 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                    s.k === sector
                      ? "bg-acento text-sobre-acento border-acento"
                      : "bg-superficie text-texto-suave border-borde hover:bg-superficie-2"}`}>
                  {s.n}
                </button>
              ))}
            </div>

            <div className="shrink-0 flex items-center gap-1.5">
              {!editando && onActualizar && (
                <Boton size="md" variant="ghost" onClick={onActualizar} title="Volver a leer el salón">
                  <RefreshCw size={15} />
                </Boton>
              )}
              {!editando && puedeEditar && (
                <Boton size="md" variant="ghost" onClick={entrarAEditar}><Pencil size={15} /> Editar salón</Boton>
              )}
              {editando && (
                <>
                  <Boton size="md" variant="ghost" onClick={cancelar} disabled={guardando}>
                    <X size={15} /> Cancelar
                  </Boton>
                  <Boton size="md" onClick={guardar} disabled={guardando}>
                    <Save size={15} /> {guardando ? "Guardando…" : "Guardar"}
                  </Boton>
                </>
              )}
              {!editando && (
                <Boton size="md" variant={hayFiltro ? "dark" : "ghost"} onClick={() => setVerFiltros(true)}>
                  <Filter size={15} /> Filtros{hayFiltro ? " ·" : ""}
                </Boton>
              )}
            </div>
          </div>

          {modo && (
            <div className="shrink-0 flex items-center gap-2 rounded-xl border border-acento bg-acento-suave px-3 py-2 text-sm">
              <span className="text-texto">
                {modo === "unir"
                  ? (elegidas.length ? "Ahora tocá la mesa que se le suma." : "Tocá la mesa que manda la cuenta.")
                  : "Tocá la mesa que querés separar."}
              </span>
              <Boton size="sm" variant="quiet" className="ml-auto" onClick={() => { setModo(null); setElegidas([]); }}>
                Cancelar
              </Boton>
            </div>
          )}

          {cargando ? <Vacio>Cargando el salón…</Vacio>
            : vista === "lista" ? <ListaMesas mesas={mesasPiso} onTocar={setMesaTocada} />
            : vista === "reservas" ? (
              <VistaReservas empresaId={empresaId} mesas={mesasPiso} toast={toast}
                onAbrirComanda={(id) => onTocarMesa({ comandaId: id })}
                alCambiar={onActualizar} />
            ) : plano}

          <div className="shrink-0 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-texto-suave px-1">
            {ORDEN_ESTADOS.map((k) => {
              const s = ESTADOS[k];
              const marca = (
                <span className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${s.punto}`} /> {s.n}
                </span>
              );
              return <React.Fragment key={k}>{marca}</React.Fragment>;
            })}
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-superficie-3" /> Barra, cocina y demás
            </span>
            {consumido > 0 && (
              <span className="ml-auto">En el salón <strong className="text-texto f-m">{money(consumido)}</strong></span>
            )}
          </div>
        </div>

        {/* --- Acciones, o lo elegido si se está dibujando -------------- */}
        <Card className={`${lados} flex-col min-h-0 overflow-auto p-3`}>
          {editando ? (
            <PanelEdicion
              mesa={mesaSel} elemento={elemSel} sectores={sectores} pisos={pisos}
              onMesa={tocarMesa} onElemento={tocarElemento}
              onBorrarMesa={borrarMesa} onQuitarElemento={quitarElemento} />
          ) : (
            <>
              <Rotulo>Acciones</Rotulo>
              <div className="mt-1.5 space-y-2">
                <Boton size="md" variant={modo === "unir" ? "dark" : "ghost"} className="w-full"
                  disabled={trabajando} onClick={() => arrancarModo("unir")}>
                  <Link2 size={16} /> Juntar mesas
                </Boton>
                <Boton size="md" variant={modo === "separar" ? "dark" : "ghost"} className="w-full"
                  disabled={trabajando} onClick={() => arrancarModo("separar")}>
                  <Unlink size={16} /> Separar mesas
                </Boton>
              </div>
              <p className="text-[11px] text-texto-tenue mt-3">
                La mesa que se suma no abre cuenta propia: tocarla abre la de la principal, con la capacidad de las dos.
              </p>
            </>
          )}
        </Card>
      </div>

      {/* --- El recuento de abajo -------------------------------------- */}
      <div className="shrink-0 grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {ORDEN_ESTADOS.map((k) => {
          const s = ESTADOS[k];
          const cuadro = (
            <div className={`w-full rounded-xl border px-3 py-2 ${s.caja}`}>
              <div className="text-[10px] uppercase tracking-widest font-bold truncate">{s.plural}</div>
              <div className="f-d text-2xl leading-none mt-1">{recuento[k]}</div>
            </div>
          );
          return <React.Fragment key={k}>{cuadro}</React.Fragment>;
        })}
      </div>

      {/* --- Quién está, si hay caja y qué hora es --------------------- */}
      <Card className="shrink-0 flex flex-wrap items-center gap-x-4 gap-y-1 px-3.5 py-2 text-xs text-texto-suave">
        <span>Empleado: <strong className="text-texto font-semibold">{empleado || "—"}</strong></span>
        <span className="inline-flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${cajaAbierta ? "bg-bien" : "bg-mal"}`} />
          {cajaAbierta ? "Caja abierta" : "Caja cerrada"}
        </span>
        <span className="f-m">{hora(reloj)}</span>
        {onHistorial && (
          <button onClick={onHistorial}
            className="ml-auto inline-flex items-center gap-1.5 font-semibold text-texto-suave hover:text-texto transition-colors">
            <History size={14} /> Historial de comandas
          </button>
        )}
      </Card>

      <MenuMesa mesa={mesaTocada} onCerrar={() => setMesaTocada(null)}
        onComanda={() => { const m = mesaTocada; setMesaTocada(null); onTocarMesa(m); }}
        onCuenta={() => { const m = mesaTocada; setMesaTocada(null); onTocarMesa(m); }}
        onReservar={() => { setReservando(mesaTocada); setMesaTocada(null); }}
        onVerReserva={() => { setMesaTocada(null); setVista("reservas"); }}
        onSentar={async () => {
          const m = mesaTocada;
          setMesaTocada(null);
          try {
            const comanda = await sentarReserva(m.reserva.id);
            onActualizar && onActualizar();
            onTocarMesa({ ...m, comandaId: comanda });
          } catch (e) {
            toast(e.message || "No se pudo sentar la reserva.", "mal");
          }
        }}
        onLiberar={() => { const m = mesaTocada; setMesaTocada(null); onTocarMesa(m); }} />

      <FormReserva abierto={!!reservando} mesas={mesasPiso} mesaFija={reservando}
        dia={aCampoFecha(new Date())} trabajando={trabajando}
        onCerrar={() => setReservando(null)}
        onGuardar={async (datos) => {
          setTrabajando(true);
          try {
            await crearReserva(empresaId, { ...datos, sucursalId, recursoId: reservando.id });
            setReservando(null);
            onActualizar && onActualizar();
            toast("Reserva guardada.");
          } catch (e) {
            toast(e.message || "No se pudo guardar la reserva.", "mal");
          } finally {
            setTrabajando(false);
          }
        }} />

      <ModalFiltros abierto={verFiltros} filtros={filtros} sectores={sectores}
        onCerrar={() => setVerFiltros(false)}
        onAplicar={(x) => { setFiltros(x); setVerFiltros(false); }} />
    </div>
  );
}

/* ------------------------------------------------------------
   Piezas chicas de la barra lateral
   ------------------------------------------------------------ */

function Rotulo({ children }) {
  return <div className="text-[10px] uppercase tracking-widest text-texto-tenue font-bold">{children}</div>;
}

function Opcion({ icono: Icono, children, activa = false, onTocar }) {
  const forma = `w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-sm font-semibold text-left transition-colors ${
    activa ? "bg-superficie-2 text-texto" : "text-texto-suave hover:bg-superficie-2"}`;
  if (!onTocar) return <span className={forma}><Icono size={16} className="shrink-0" /> {children}</span>;
  return (
    <button onClick={onTocar} className={forma}>
      <Icono size={16} className="shrink-0" /> {children}
    </button>
  );
}

/* ------------------------------------------------------------
   Las piezas del plano
   ------------------------------------------------------------ */

function PiezaMesa({ m, celda, editando, elegida, marcada, abriendo, estado, apagada = false, onTocar, onBajar, onMover, onSoltar }) {
  const est = ESTADOS[estado];
  const w = m.ancho * celda, h = m.alto * celda;
  const redonda = m.forma === "redonda";
  const grande = numeroDe(m.nombre);
  const gente = m.capacidadTotal || m.capacidad || 0;
  /* Abajo de esto solo entra el número. El umbral es el que de verdad
     hace falta para dos renglones —el número grande y la capacidad—, no
     uno redondo: con el anterior, un salón entero se quedaba sin mostrar
     para cuánta gente es cada mesa. */
  const cuerpo = w >= 76 && h >= 62;
  const tipo = Math.max(13, Math.min(30, Math.round(Math.min(w, h) * 0.42)));

  return (
    <button
      type="button"
      disabled={abriendo}
      onPointerDown={editando ? (e) => onBajar(e, "mover") : undefined}
      onPointerMove={editando ? onMover : undefined}
      onPointerUp={editando ? onSoltar : undefined}
      onPointerCancel={editando ? onSoltar : undefined}
      onClick={editando ? undefined : onTocar}
      title={`${m.nombre}${gente ? ` · ${gente} lugares` : ""}${m.unidas ? ` · ${m.unidas} unida${m.unidas === 1 ? "" : "s"}` : ""}`}
      style={{
        left: m.x * celda + 3, top: m.y * celda + 3,
        width: Math.max(0, w - 6), height: Math.max(0, h - 6),
        touchAction: editando ? "none" : undefined,
        borderRadius: redonda ? "9999px" : m.forma === "barra" ? 8 : 14,
      }}
      /* La que no pasa el filtro se apaga en su lugar y no desaparece:
         el plano sirve porque cada mesa está siempre donde está. */
      className={`absolute z-10 border-2 flex flex-col items-center justify-center px-1 text-center transition-all disabled:opacity-50 ${est.caja} ${
        apagada ? "opacity-20 saturate-0" : ""} ${
        elegida || marcada ? "ring-2 ring-acento ring-offset-2 ring-offset-fondo" : ""} ${
        editando ? "cursor-move" : "cursor-pointer"}`}
    >
      <span className="f-d leading-none" style={{ fontSize: tipo }}>{grande}</span>

      {gente > 0 && (
        <span className="text-[10px] font-semibold leading-none mt-1 opacity-80">{gente}p</span>
      )}

      {!editando && m.ocupada && cuerpo && (
        <span className="flex items-center gap-2 mt-1.5 leading-none text-[10px] opacity-90">
          <span className="f-m">{money(m.consumido)}</span>
          <span className="flex items-center gap-0.5"><Clock size={9} /> {espera(m.minutos == null ? 0 : m.minutos)}</span>
        </span>
      )}

      {m.unidas > 0 && (
        <span className="absolute top-1 right-1"><Link2 size={11} /></span>
      )}

      {abriendo && <span className="text-[10px] mt-1">Abriendo…</span>}

      {editando && elegida && (
        <span
          onPointerDown={(e) => onBajar(e, "estirar")}
          onPointerMove={onMover}
          onPointerUp={onSoltar}
          onPointerCancel={onSoltar}
          style={{ touchAction: "none" }}
          title="Estirar"
          className="absolute -right-1.5 -bottom-1.5 w-5 h-5 rounded-full bg-acento border-2 border-fondo cursor-nwse-resize z-30" />
      )}
    </button>
  );
}

/* Fondo del plano: ubican pero no se tocan. En modo mirar ni siquiera
   reciben el click, así un dedo torpe sobre la barra no roba el toque de
   la mesa que está al lado. */
function PiezaElemento({ e, celda, editando, elegida, onBajar, onMover, onSoltar }) {
  const p = PINTA[e.tipo] || PINTA.texto;
  const etiqueta = e.etiqueta || (e.tipo === "texto" ? "Texto" : nombreElemento(e.tipo).toUpperCase());
  const w = e.ancho * celda, h = e.alto * celda;
  const tipo = Math.max(9, Math.min(15, Math.round(Math.min(w, h) * 0.34)));
  const planta = e.tipo === "planta";

  return (
    <div
      onPointerDown={editando ? (ev) => onBajar(ev, "mover") : undefined}
      onPointerMove={editando ? onMover : undefined}
      onPointerUp={editando ? onSoltar : undefined}
      onPointerCancel={editando ? onSoltar : undefined}
      title={etiqueta}
      style={{
        left: e.x * celda + 1, top: e.y * celda + 1,
        width: Math.max(0, w - 2), height: Math.max(0, h - 2),
        touchAction: editando ? "none" : undefined,
        borderRadius: planta ? "9999px" : 6,
      }}
      className={`absolute z-0 flex items-center justify-center overflow-hidden ${p.caja} ${p.texto} ${
        elegida ? "ring-2 ring-acento" : ""} ${editando ? "cursor-move" : "pointer-events-none"}`}
    >
      {planta && <Sprout size={Math.max(11, Math.min(22, Math.round(Math.min(w, h) * 0.6)))} />}

      {p.rotulo && (
        <span className="uppercase tracking-widest font-bold truncate px-1" style={{ fontSize: tipo }}>
          {etiqueta}
        </span>
      )}

      {editando && elegida && (
        <span
          onPointerDown={(ev) => onBajar(ev, "estirar")}
          onPointerMove={onMover}
          onPointerUp={onSoltar}
          onPointerCancel={onSoltar}
          style={{ touchAction: "none" }}
          title="Estirar"
          className="absolute right-0 bottom-0 w-5 h-5 rounded-full bg-acento border-2 border-fondo cursor-nwse-resize z-30" />
      )}
    </div>
  );
}

/* ------------------------------------------------------------
   Panel de edición
   ------------------------------------------------------------ */

function PanelEdicion({ mesa, elemento, sectores, pisos, onMesa, onElemento, onBorrarMesa, onQuitarElemento }) {
  if (!mesa && !elemento) {
    return (
      <div className="text-sm text-texto-suave">
        <Rotulo>Dibujando</Rotulo>
        <p className="font-semibold text-texto mt-2 mb-1">Nada elegido</p>
        <p className="text-[13px]">
          Tocá una mesa o un elemento para cambiarle el nombre, el tamaño o la forma.
          Arrastralo para moverlo y usá el tirador de la esquina para estirarlo.
        </p>
      </div>
    );
  }

  if (mesa) {
    return (
      <div className="space-y-3">
        <Rotulo>Mesa</Rotulo>

        <Campo label="Nombre">
          <input className={inputCls} value={mesa.nombre || ""}
            onChange={(ev) => onMesa(mesa.id, { nombre: ev.target.value })} />
        </Campo>

        <div className="grid grid-cols-2 gap-2">
          <Campo label="Lugares">
            <input className={inputCls} inputMode="numeric" value={mesa.capacidad || ""}
              onChange={(ev) => onMesa(mesa.id, { capacidad: Number(ev.target.value.replace(/\D/g, "")) || 0 })} />
          </Campo>
          <Campo label="Forma">
            <select className={inputCls} value={mesa.forma}
              onChange={(ev) => onMesa(mesa.id, { forma: ev.target.value })}>
              {FORMAS.map((f) => <option key={f.k} value={f.k}>{f.n}</option>)}
            </select>
          </Campo>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Campo label="Ancho">
            <input className={inputCls} inputMode="numeric" value={mesa.ancho}
              onChange={(ev) => onMesa(mesa.id, { ancho: Math.max(1, Number(ev.target.value.replace(/\D/g, "")) || 1) })} />
          </Campo>
          <Campo label="Alto">
            <input className={inputCls} inputMode="numeric" value={mesa.alto}
              onChange={(ev) => onMesa(mesa.id, { alto: Math.max(1, Number(ev.target.value.replace(/\D/g, "")) || 1) })} />
          </Campo>
        </div>

        <Campo label="Sector">
          <input className={inputCls} value={mesa.sector || ""} list="sectores-plano"
            placeholder="Salón, Barra, Terraza…"
            onChange={(ev) => onMesa(mesa.id, { sector: ev.target.value })} />
        </Campo>

        <Campo label="Piso">
          <input className={inputCls} value={mesa.piso || ""} list="pisos-plano"
            onChange={(ev) => onMesa(mesa.id, { piso: ev.target.value })} />
        </Campo>

        <Listas sectores={sectores} pisos={pisos} />

        <div className="pt-1">
          {mesa.ocupada ? (
            <p className="text-xs text-texto-tenue">Tiene una comanda abierta: cobrala antes de borrarla.</p>
          ) : (
            <Boton variant="danger" size="md" className="w-full" onClick={() => onBorrarMesa(mesa)}>
              <Trash2 size={15} /> Borrar la mesa
            </Boton>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Rotulo>Elemento</Rotulo>

      <Campo label="Qué es">
        <select className={inputCls} value={elemento.tipo}
          onChange={(ev) => onElemento(elemento.id, { tipo: ev.target.value })}>
          {ELEMENTOS.map((e) => <option key={e.k} value={e.k}>{e.n}</option>)}
        </select>
      </Campo>

      <Campo label="Etiqueta">
        <input className={inputCls} value={elemento.etiqueta || ""}
          placeholder={nombreElemento(elemento.tipo)}
          onChange={(ev) => onElemento(elemento.id, { etiqueta: ev.target.value })} />
      </Campo>

      <div className="grid grid-cols-2 gap-2">
        <Campo label="Ancho">
          <input className={inputCls} inputMode="numeric" value={elemento.ancho}
            onChange={(ev) => onElemento(elemento.id, { ancho: Math.max(1, Number(ev.target.value.replace(/\D/g, "")) || 1) })} />
        </Campo>
        <Campo label="Alto">
          <input className={inputCls} inputMode="numeric" value={elemento.alto}
            onChange={(ev) => onElemento(elemento.id, { alto: Math.max(1, Number(ev.target.value.replace(/\D/g, "")) || 1) })} />
        </Campo>
      </div>

      <Campo label="Sector">
        <input className={inputCls} value={elemento.sector || ""} list="sectores-plano"
          placeholder="Todo el piso"
          onChange={(ev) => onElemento(elemento.id, { sector: ev.target.value })} />
      </Campo>

      <Listas sectores={sectores} pisos={pisos} />

      <div className="pt-1">
        <Boton variant="danger" size="md" className="w-full" onClick={() => onQuitarElemento(elemento)}>
          <Trash2 size={15} /> Borrar
        </Boton>
      </div>
    </div>
  );
}

function Listas({ sectores, pisos }) {
  return (
    <>
      <datalist id="sectores-plano">
        {sectores.map((s) => <option key={s} value={s} />)}
      </datalist>
      <datalist id="pisos-plano">
        {pisos.map((p) => <option key={p} value={p} />)}
      </datalist>
    </>
  );
}

/* ============================================================
   LO QUE SE ABRE AL TOCAR UNA MESA
   ============================================================

   Nunca las cinco acciones juntas: una mesa libre no se cobra y una
   pagada no se reserva. Se ofrece lo que ese estado admite y nada más,
   que es la diferencia entre elegir y buscar.
   ============================================================ */

function MenuMesa({ mesa, onCerrar, onComanda, onCuenta, onReservar, onVerReserva, onSentar, onLiberar }) {
  if (!mesa) return null;

  const e = estadoDe(mesa);
  const s = ESTADOS[e];

  const acciones = [];
  if (e === "libre") {
    acciones.push({ i: ClipboardList, n: "Abrir comanda", f: onComanda, fuerte: true });
    acciones.push({ i: CalendarClock, n: "Reservar", f: onReservar });
  } else if (e === "reservada") {
    acciones.push({ i: ClipboardList, n: "Sentar la reserva", f: onSentar, fuerte: true });
    acciones.push({ i: CalendarClock, n: "Ver la reserva", f: onVerReserva });
  } else if (e === "cuenta") {
    acciones.push({ i: Unlink, n: "Liberar la mesa", f: onLiberar, fuerte: true });
    acciones.push({ i: Receipt, n: "Ver la cuenta", f: onCuenta });
  } else {
    acciones.push({ i: ClipboardList, n: "Abrir comanda", f: onComanda, fuerte: true });
    acciones.push({ i: Receipt, n: "Ver la cuenta", f: onCuenta });
  }

  return (
    <Modal open onClose={onCerrar} ancho="max-w-sm">
      <div className="p-5">
        <div className="flex items-start gap-3">
          <span className={`shrink-0 w-12 h-12 rounded-lg border grid place-items-center f-d text-lg ${s.caja}`}>
            {numeroDe(mesa.nombre)}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="f-d text-lg leading-tight">{mesa.nombre}</h3>
            <div className="text-xs text-texto-suave">
              {mesa.capacidadTotal || mesa.capacidad} personas
              {mesa.sector ? ` · ${mesa.sector}` : ""}
              {mesa.unidas > 0 ? ` · ${mesa.unidas} unida${mesa.unidas === 1 ? "" : "s"}` : ""}
            </div>
          </div>
          <span className={`shrink-0 text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-md border ${s.caja}`}>
            {s.n}
          </span>
        </div>

        {mesa.ocupada && (
          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
            {[["Consumido", money(mesa.consumido)],
              ["Hace", mesa.minutos == null ? "—" : espera(mesa.minutos)],
              ["Ítems", String(mesa.items || 0)]].map(([r, v]) => (
              <div key={r} className="rounded-md border border-borde bg-superficie-2 px-2 py-1.5">
                <div className="text-[9px] uppercase tracking-widest text-texto-tenue font-bold">{r}</div>
                <div className="f-m text-sm">{v}</div>
              </div>
            ))}
          </div>
        )}

        {mesa.mozo && mesa.ocupada && (
          <div className="text-[11px] text-texto-tenue mt-2">La abrió {mesa.mozo}</div>
        )}

        {mesa.reserva && (
          <div className="flex items-start gap-2 mt-4 rounded-md border border-reserva bg-reserva-suave px-3 py-2 text-xs text-reserva">
            <CalendarClock size={14} className="shrink-0 mt-0.5" />
            <span>
              <strong>{mesa.reserva.nombre}</strong> · {mesa.reserva.personas} personas
              {mesa.reserva.desde ? ` · ${hora(mesa.reserva.desde)}` : ""}
            </span>
          </div>
        )}

        <div className="mt-5 space-y-2">
          {acciones.map((a) => (
            <Boton key={a.n} size="lg" className="w-full justify-start"
              variant={a.fuerte ? "primary" : "ghost"} onClick={a.f}>
              <a.i size={17} /> {a.n}
            </Boton>
          ))}
          <Boton variant="quiet" className="w-full" onClick={onCerrar}>Cerrar</Boton>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================
   LA LISTA DE MESAS
   ============================================================

   El mismo salón sin el plano. Contesta lo que el dibujo contesta mal:
   qué mesa de seis está libre, cuál lleva dos horas abierta, cuánto
   acumuló cada una.
   ============================================================ */

function ListaMesas({ mesas, onTocar }) {
  const [orden, setOrden] = useState("nombre");
  const [q, setQ] = useState("");

  const filas = useMemo(() => {
    const t = q.trim().toLowerCase();
    const puestas = mesas.filter((m) => !t
      || `${m.nombre} ${m.sector || ""} ${ESTADOS[estadoDe(m)].n} ${m.mozo || ""}`.toLowerCase().includes(t));

    /* Por estado no es alfabético: primero lo que reclama una mano
       —algo listo esperando, una cuenta pagada sin levantar— y al final
       lo que no necesita nada. */
    const peso = { entregar: 0, cuenta: 1, ocupada: 2, reservada: 3, libre: 4 };
    return [...puestas].sort((a, b) => {
      if (orden === "estado") return peso[estadoDe(a)] - peso[estadoDe(b)];
      if (orden === "capacidad") return (b.capacidadTotal || b.capacidad || 0) - (a.capacidadTotal || a.capacidad || 0);
      if (orden === "consumido") return (b.consumido || 0) - (a.consumido || 0);
      if (orden === "tiempo") return (b.minutos || 0) - (a.minutos || 0);
      return String(a.nombre).localeCompare(String(b.nombre), "es", { numeric: true });
    });
  }, [mesas, q, orden]);

  return (
    <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="shrink-0 flex flex-wrap items-center gap-2 p-2.5 border-b border-borde">
        <label className="flex-1 min-w-[180px] flex items-center gap-2 rounded-md border border-borde bg-superficie-2 px-3 py-2">
          <Search size={15} className="text-texto-tenue shrink-0" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mesa, sector, estado, mozo"
            className="w-full text-sm bg-transparent outline-none" />
        </label>
        <div className="flex items-center gap-1">
          {[["nombre", "Número"], ["estado", "Estado"], ["capacidad", "Capacidad"],
            ["tiempo", "Tiempo"], ["consumido", "Consumido"]].map(([k, n]) => (
            <button key={k} onClick={() => setOrden(k)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                orden === k ? "border-acento bg-acento-suave text-texto" : "border-borde text-texto-suave hover:bg-superficie-2"}`}>
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {!filas.length ? <Vacio>Ninguna mesa con ese filtro.</Vacio> : (
          <ul className="divide-y divide-borde">
            {filas.map((m) => {
              const s = ESTADOS[estadoDe(m)];
              return (
                <li key={m.id}>
                  <button onClick={() => onTocar(m)}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-superficie-2 transition-colors">
                    <span className={`shrink-0 w-10 h-10 rounded-md border grid place-items-center f-d ${s.caja}`}>
                      {numeroDe(m.nombre)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold truncate">{m.nombre}</span>
                      <span className="block text-[11px] text-texto-tenue truncate">
                        {m.capacidadTotal || m.capacidad} personas{m.sector ? ` · ${m.sector}` : ""}
                        {m.mozo && m.ocupada ? ` · ${m.mozo}` : ""}
                      </span>
                    </span>
                    <span className={`shrink-0 text-[10px] uppercase tracking-widest font-bold ${s.punto.replace("bg-", "text-")}`}>
                      {s.n}
                    </span>
                    <span className="shrink-0 w-20 text-right">
                      {m.ocupada && <span className="block f-m text-sm">{money(m.consumido)}</span>}
                      {m.minutos != null && <span className="block f-m text-[11px] text-texto-tenue">{espera(m.minutos)}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

/* ============================================================
   LAS RESERVAS
   ============================================================

   Lo comprometido para hoy, en orden de llegada. Sentar una reserva abre
   la mesa y la marca en el mismo acto: separado queda a medias, con la
   mesa abierta y la reserva figurando pendiente toda la noche.
   ============================================================ */

function VistaReservas({ empresaId, mesas, toast, onAbrirComanda, alCambiar }) {
  const [dia, setDia] = useState(() => aCampoFecha(new Date()));
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [alta, setAlta] = useState(false);
  const [trabajando, setTrabajando] = useState(false);

  const avisar = useRef(toast);
  avisar.current = toast;

  const releer = useCallback(async () => {
    setCargando(true);
    try {
      const desde = new Date(`${dia}T00:00:00`);
      const hasta = new Date(desde);
      hasta.setDate(hasta.getDate() + 1);
      setFilas(await cargarReservas(empresaId, { desde, hasta }));
    } catch (e) {
      avisar.current(e.message || "No pudimos leer las reservas.", "mal");
    } finally {
      setCargando(false);
    }
  }, [empresaId, dia]);

  useEffect(() => { releer(); }, [releer]);

  const mover = async (r, estado) => {
    setTrabajando(true);
    try {
      await cambiarEstadoReserva(r.id, estado);
      await releer();
      alCambiar && alCambiar();
    } catch (e) {
      avisar.current(e.message || "No se pudo cambiar la reserva.", "mal");
    } finally {
      setTrabajando(false);
    }
  };

  const sentar = async (r) => {
    setTrabajando(true);
    try {
      const comanda = await sentarReserva(r.id);
      await releer();
      alCambiar && alCambiar();
      onAbrirComanda && onAbrirComanda(comanda);
    } catch (e) {
      avisar.current(e.message || "No se pudo sentar la reserva.", "mal");
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="shrink-0 flex flex-wrap items-center gap-2 p-2.5 border-b border-borde">
        <input type="date" value={dia} onChange={(e) => setDia(e.target.value)}
          className={`${inputCls} f-m w-auto`} />
        <span className="text-xs text-texto-tenue">
          {filas.filter((r) => r.estado === "pendiente").length} pendientes de {filas.length}
        </span>
        <Boton size="md" className="ml-auto" onClick={() => setAlta(true)}>
          <Plus size={15} /> Nueva reserva
        </Boton>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {cargando && <Vacio>Cargando…</Vacio>}
        {!cargando && !filas.length && <Vacio>No hay reservas para ese día.</Vacio>}

        {!cargando && filas.length > 0 && (
          <ul className="divide-y divide-borde">
            {filas.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-3.5 py-3">
                <span className="shrink-0 w-14 text-center">
                  <span className="block f-m text-lg leading-none">{hora(r.desde)}</span>
                  <span className="block text-[10px] text-texto-tenue mt-0.5">{r.duracion} min</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold truncate">{r.nombre}</span>
                  <span className="block text-[11px] text-texto-tenue truncate">
                    {r.personas} personas{r.mesa ? ` · ${r.mesa}` : " · sin mesa"}
                    {r.telefono ? ` · ${r.telefono}` : ""}
                    {r.notas ? ` · ${r.notas}` : ""}
                  </span>
                </span>

                <span className={`shrink-0 text-[10px] uppercase tracking-widest font-bold ${
                  r.estado === "pendiente" ? "text-reserva"
                  : r.estado === "sentada" ? "text-bien"
                  : r.estado === "ausente" ? "text-mal" : "text-texto-tenue"}`}>
                  {nombreEstadoReserva(r.estado)}
                </span>

                {r.estado === "pendiente" && (
                  <span className="shrink-0 flex items-center gap-1.5">
                    <Boton size="sm" disabled={trabajando || !r.recursoId} onClick={() => sentar(r)}
                      title={r.recursoId ? "Abrir la mesa y marcarla sentada" : "Asignale una mesa primero"}>
                      Sentar
                    </Boton>
                    <Boton size="sm" variant="quiet" disabled={trabajando} onClick={() => mover(r, "ausente")}>
                      No vino
                    </Boton>
                    <Boton size="sm" variant="quiet" disabled={trabajando} onClick={() => mover(r, "cancelada")}>
                      Cancelar
                    </Boton>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <FormReserva abierto={alta} mesas={mesas} dia={dia} trabajando={trabajando}
        onCerrar={() => setAlta(false)}
        onGuardar={async (datos) => {
          setTrabajando(true);
          try {
            await crearReserva(empresaId, datos);
            setAlta(false);
            await releer();
            alCambiar && alCambiar();
          } catch (e) {
            avisar.current(e.message || "No se pudo guardar la reserva.", "mal");
          } finally {
            setTrabajando(false);
          }
        }} />
    </Card>
  );
}

function FormReserva({ abierto, mesas, dia, trabajando, mesaFija = null, onCerrar, onGuardar }) {
  const [d, setD] = useState({});

  useEffect(() => {
    if (!abierto) return;
    const ahora = new Date();
    setD({
      nombre: "", telefono: "", personas: 2,
      hora: `${String(ahora.getHours()).padStart(2, "0")}:00`,
      duracion: 90, notas: "",
      recursoId: mesaFija ? mesaFija.id : "",
    });
  }, [abierto, mesaFija]);

  if (!abierto) return null;

  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const libres = mesas.filter((m) => !m.unidaA);

  return (
    <Modal open onClose={onCerrar} ancho="max-w-md">
      <div className="p-5">
        <h3 className="f-d text-lg">Nueva reserva</h3>
        {mesaFija && <p className="text-xs text-texto-suave mt-0.5">{mesaFija.nombre}</p>}

        <div className="space-y-3 mt-4">
          <Campo label="A nombre de">
            <input value={d.nombre || ""} onChange={(e) => set("nombre", e.target.value)} autoFocus className={inputCls} />
          </Campo>

          <div className="grid grid-cols-3 gap-3">
            <Campo label="Hora">
              <input type="time" value={d.hora || ""} onChange={(e) => set("hora", e.target.value)} className={`${inputCls} f-m`} />
            </Campo>
            <Campo label="Personas">
              <input value={d.personas} inputMode="numeric"
                onChange={(e) => set("personas", e.target.value.replace(/\D/g, ""))} className={`${inputCls} f-m`} />
            </Campo>
            <Campo label="Minutos">
              <input value={d.duracion} inputMode="numeric"
                onChange={(e) => set("duracion", e.target.value.replace(/\D/g, ""))} className={`${inputCls} f-m`} />
            </Campo>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Teléfono">
              <input value={d.telefono || ""} onChange={(e) => set("telefono", e.target.value)} className={`${inputCls} f-m`} />
            </Campo>
            {!mesaFija && (
              <Campo label="Mesa">
                <select value={d.recursoId || ""} onChange={(e) => set("recursoId", e.target.value)} className={inputCls}>
                  <option value="">Sin asignar</option>
                  {libres.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre} · {m.capacidadTotal || m.capacidad}p
                    </option>
                  ))}
                </select>
              </Campo>
            )}
          </div>

          <Campo label="Nota">
            <input value={d.notas || ""} onChange={(e) => set("notas", e.target.value)}
              placeholder="Cumpleaños · junto a la ventana" className={inputCls} />
          </Campo>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <Boton variant="quiet" onClick={onCerrar}>Cancelar</Boton>
          <Boton disabled={trabajando || !String(d.nombre || "").trim()}
            onClick={() => onGuardar({
              nombre: d.nombre,
              telefono: d.telefono,
              personas: Number(d.personas) || 2,
              duracion: Number(d.duracion) || 90,
              notas: d.notas,
              recursoId: d.recursoId || null,
              desde: new Date(`${dia}T${d.hora || "20:00"}:00`),
            })}>
            <Plus size={15} /> Guardar
          </Boton>
        </div>
      </div>
    </Modal>
  );
}

/* Filtrar el salón. No esconde mesas del plano —una mesa que desaparece
   del dibujo rompe la referencia espacial, que es para lo que existe el
   plano— sino que apaga las que no cumplen y deja ver las que sí. */
function ModalFiltros({ abierto, filtros, sectores, onCerrar, onAplicar }) {
  const [d, setD] = useState(filtros);
  useEffect(() => { if (abierto) setD(filtros); }, [abierto, filtros]);
  if (!abierto) return null;

  const alternar = (k, v) => setD((x) => ({
    ...x, [k]: (x[k] || []).includes(v) ? x[k].filter((y) => y !== v) : [...(x[k] || []), v],
  }));

  return (
    <Modal open onClose={onCerrar} ancho="max-w-sm">
      <div className="p-5">
        <h3 className="f-d text-lg">Filtrar el salón</h3>
        <p className="text-xs text-texto-suave mt-1">
          Las que no entran quedan apagadas, no desaparecen: el plano sirve porque cada mesa está siempre en el mismo lugar.
        </p>

        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-widest text-texto-tenue font-bold mb-1.5">Estado</div>
          <div className="flex flex-wrap gap-1.5">
            {ORDEN_ESTADOS.map((k) => (
              <button key={k} onClick={() => alternar("estados", k)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-md border transition-colors ${
                  (d.estados || []).includes(k)
                    ? `${ESTADOS[k].caja}`
                    : "border-borde text-texto-suave hover:bg-superficie-2"}`}>
                {ESTADOS[k].n}
              </button>
            ))}
          </div>
        </div>

        {sectores.length > 0 && (
          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-widest text-texto-tenue font-bold mb-1.5">Sector</div>
            <div className="flex flex-wrap gap-1.5">
              {sectores.map((s) => (
                <button key={s} onClick={() => alternar("sectores", s)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-md border transition-colors ${
                    (d.sectores || []).includes(s)
                      ? "border-acento bg-acento-suave text-texto"
                      : "border-borde text-texto-suave hover:bg-superficie-2"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4">
          <Campo label="Para cuánta gente (mínimo)">
            <input value={d.capacidad || ""} inputMode="numeric"
              onChange={(e) => setD({ ...d, capacidad: e.target.value.replace(/\D/g, "") })}
              placeholder="Cualquiera" className={`${inputCls} f-m`} />
          </Campo>
        </div>

        <div className="flex justify-between gap-2 mt-5">
          <Boton variant="quiet" onClick={() => onAplicar({ estados: [], sectores: [], capacidad: "" })}>Limpiar</Boton>
          <Boton onClick={() => onAplicar(d)}>Aplicar</Boton>
        </div>
      </div>
    </Modal>
  );
}
