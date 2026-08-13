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
  CalendarClock, Store, ShoppingBag, Link2, Unlink, DoorOpen, ChefHat, Sprout,
  Type, Bath, GlassWater, Layers, Grid3x3, Square,
} from "lucide-react";
import { money } from "../utils/helpers.js";
import {
  guardarPlano, guardarElementos, borrarElemento, crearRecurso, borrarRecurso,
  unirMesas, separarMesa,
} from "../datos/comandas.js";
import { Card, Boton, Vacio, Apagado } from "../ui/Base.jsx";
import { Campo, inputCls } from "../ui/Campos.jsx";

const espera = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${m}m`);

const CELDA_MIN = 20;
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

/* Los cinco estados de la maqueta. Para "reservada" no hay violeta en el
   sistema de diseño, así que va en `info` igual que la cuenta pedida: las
   dos están apagadas, así que nunca se pintan sobre una mesa al mismo
   tiempo. */
const ESTADOS = {
  libre: { n: "Libre", plural: "Libre", caja: "bg-bien-suave border-bien text-bien", punto: "bg-bien" },
  ocupada: { n: "Ocupada", plural: "Ocupadas", caja: "bg-mal-suave border-mal text-mal", punto: "bg-mal" },
  entregar: { n: "Por entregar", plural: "Por entregar", caja: "bg-ojo-suave border-ojo text-ojo", punto: "bg-ojo" },
  reservada: { n: "Reservada", plural: "Reservadas", caja: "bg-info-suave border-info text-info", punto: "bg-info" },
  cuenta: { n: "Cuenta / Pagada", plural: "Cuenta / Pagada", caja: "bg-info-suave border-info text-info", punto: "bg-info" },
};

const ORDEN_ESTADOS = ["libre", "ocupada", "entregar", "reservada", "cuenta"];

/* Lo que la maqueta muestra y el modelo de datos todavía no tiene. Se ve
   apagado y con el motivo en el título; nunca un control que parece andar
   y no hace nada. */
const SIN_DATO = {
  reservada: "Las reservas",
  cuenta: "La cuenta pedida",
};

/* La cuenta pedida todavía no la informa la base. El estado queda armado
   y el día que llegue el dato entra por acá, sin tocar el dibujo. */
function estadoDe(m) {
  if (m.cuentaPedida) return "cuenta";
  if (m.listos > 0) return "entregar";
  if (m.ocupada) return "ocupada";
  return "libre";
}

/* El mozo lee el número, no la palabra "Mesa": adentro va grande el
   número solo, con dos dígitos como en la maqueta. Si la mesa se llama de
   otra forma —"Vereda", "VIP"— se muestra el nombre y listo. */
function numeroDe(nombre) {
  const d = String(nombre || "").match(/\d+/);
  return d ? d[0].padStart(2, "0") : String(nombre || "?").slice(0, 6);
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
  onMostrador = null, onTakeAway = null, pleno = false,
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

  const arrastre = useRef(null);
  const observador = useRef(null);

  /* Ref de función y no useRef: el contenedor del plano se desmonta al
     entrar en edición (cambia de lugar en el árbol) y un efecto de montaje
     se quedaría midiendo un nodo que ya no existe. */
  const cont = useCallback((el) => {
    if (observador.current) { observador.current.disconnect(); observador.current = null; }
    if (!el) return;
    setCaja({ ancho: el.clientWidth, alto: el.clientHeight });
    if (!window.ResizeObserver) return;
    observador.current = new ResizeObserver((e) => {
      const r = e[0].contentRect;
      setCaja({ ancho: r.width, alto: r.height });
    });
    observador.current.observe(el);
  }, []);

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
    onTocarMesa(m);
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

      <div className="flex-1 min-h-0 grid gap-2.5 lg:grid-cols-[14rem_minmax(0,1fr)_13rem]">

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
                <Opcion icono={Mapa} activa>Plano</Opcion>
                <Apagado motivo="La lista de mesas" className="w-full">
                  <Opcion icono={List}>Lista de mesas</Opcion>
                </Apagado>
                <Apagado motivo="Las reservas" className="w-full">
                  <Opcion icono={CalendarClock}>Reservas</Opcion>
                </Apagado>
              </div>
            </div>
          )}

          {/* Solo mostrador. El canal —para llevar, delivery, aplicación— se
              elige al comandar, así que ofrecerlo también acá era pedir dos
              veces la misma decisión, y una de ellas antes de tiempo. */}
          <div className="mt-auto pt-3">
            <Canal icono={Store} rotulo="Mostrador" motivo="Tomar un pedido de mostrador" onTocar={onMostrador} />
          </div>
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
              <Apagado motivo="Filtrar las mesas">
                <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border border-borde bg-superficie text-texto whitespace-nowrap">
                  <Filter size={15} /> Filtros
                </span>
              </Apagado>
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

          {cargando ? <Vacio>Cargando el salón…</Vacio> : plano}

          <div className="shrink-0 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-texto-suave px-1">
            {ORDEN_ESTADOS.map((k) => {
              const s = ESTADOS[k];
              const marca = (
                <span className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${s.punto}`} /> {s.n}
                </span>
              );
              return SIN_DATO[k]
                ? <Apagado key={k} motivo={SIN_DATO[k]}>{marca}</Apagado>
                : <React.Fragment key={k}>{marca}</React.Fragment>;
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
      <div className="shrink-0 grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {ORDEN_ESTADOS.map((k) => {
          const s = ESTADOS[k];
          const cuadro = (
            <div className={`w-full rounded-xl border px-3 py-2 ${s.caja}`}>
              <div className="text-[10px] uppercase tracking-widest font-bold truncate">{s.plural}</div>
              <div className="f-d text-2xl leading-none mt-1">{recuento[k]}</div>
            </div>
          );
          return SIN_DATO[k]
            ? <Apagado key={k} motivo={SIN_DATO[k]} className="block w-full">{cuadro}</Apagado>
            : <React.Fragment key={k}>{cuadro}</React.Fragment>;
        })}
      </div>
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

/* Mostrador y take away: el mozo que está mirando el salón también toma
   pedidos que no ocupan mesa. Donde la pantalla no sabe abrirlos, el botón
   se ve apagado en vez de desaparecer. */
function Canal({ icono: Icono, rotulo, motivo, onTocar, alto = false }) {
  const forma = `w-full h-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-borde-fuerte bg-superficie-2 text-texto font-bold uppercase tracking-widest ${
    alto ? "px-3 py-2 text-[11px]" : "px-3 py-3 text-[11px]"}`;
  if (!onTocar) {
    return <Apagado motivo={motivo} className="block w-full"><span className={forma}><Icono size={16} /> {rotulo}</span></Apagado>;
  }
  return (
    <button onClick={onTocar} title={motivo} className={`${forma} hover:bg-superficie-3 transition-colors`}>
      <Icono size={16} /> {rotulo}
    </button>
  );
}

/* ------------------------------------------------------------
   Las piezas del plano
   ------------------------------------------------------------ */

function PiezaMesa({ m, celda, editando, elegida, marcada, abriendo, estado, onTocar, onBajar, onMover, onSoltar }) {
  const est = ESTADOS[estado];
  const w = m.ancho * celda, h = m.alto * celda;
  const redonda = m.forma === "redonda";
  const grande = numeroDe(m.nombre);
  const gente = m.capacidadTotal || m.capacidad || 0;
  const cuerpo = w >= 96 && h >= 84;   // abajo de esto solo entra el número
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
      className={`absolute z-10 border-2 flex flex-col items-center justify-center px-1 text-center transition-colors disabled:opacity-50 ${est.caja} ${
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
