/* ============================================================
   15b. PLANO DEL SALÓN
   ============================================================

   Un salón no es una lista de mesas: es un lugar. La mesa 8 está contra
   la ventana y la 3 al lado de la barra, y el mozo no busca un nombre en
   una grilla ordenada, mira dónde está parado. Por eso el plano se
   dibuja, y por eso cada dueño tiene que poder dibujar el suyo.

   Las coordenadas viven en una grilla propia (enteros), nunca en
   píxeles: el mismo plano tiene que entrar en un celular y en el monitor
   de la caja. El tamaño de celda se calcula acá, contra el ancho
   disponible, y es lo único que cambia entre una pantalla y la otra.
   ============================================================ */

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Users, Clock, Flame, Check, Pencil, Plus, Trash2, X, Save, Grid3x3, RefreshCw,
} from "lucide-react";
import { money } from "../utils/helpers.js";
import {
  guardarPlano, guardarElementos, crearRecurso, borrarRecurso,
} from "../datos/comandas.js";
import { Card, Boton, Tabs, Vacio } from "../ui/Base.jsx";
import { Campo, inputCls } from "../ui/Campos.jsx";

const espera = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);

const CELDA_MIN = 22;
const CELDA_MAX = 58;

const FORMAS = [
  { k: "rectangulo", n: "Rectangular" },
  { k: "redonda", n: "Redonda" },
  { k: "barra", n: "Barra" },
];

/* Lo que ubica sin venderse. El tamaño por defecto es el que tiene la
   cosa en un local de verdad: una barra es larga y angosta, la cocina es
   un bloque. */
const ELEMENTOS = [
  { k: "barra", n: "Barra", ancho: 5, alto: 1 },
  { k: "cocina", n: "Cocina", ancho: 4, alto: 3 },
  { k: "entrada", n: "Entrada", ancho: 2, alto: 1 },
  { k: "bano", n: "Baño", ancho: 2, alto: 2 },
  { k: "pared", n: "Pared", ancho: 6, alto: 1 },
  { k: "planta", n: "Planta", ancho: 1, alto: 1 },
  { k: "texto", n: "Texto", ancho: 3, alto: 1 },
];

const nombreElemento = (t) => (ELEMENTOS.find((e) => e.k === t) || { n: "Elemento" }).n;

const ESTADOS = {
  libre: { n: "Libre", caja: "bg-superficie border-borde-fuerte text-texto", punto: "bg-superficie border border-borde-fuerte" },
  ocupada: { n: "Ocupada", caja: "bg-acento-suave border-acento text-acento", punto: "bg-acento-vivo" },
  entregar: { n: "Por entregar", caja: "bg-bien-suave border-bien text-bien", punto: "bg-bien" },
  cuenta: { n: "Con cuenta", caja: "bg-info-suave border-info text-info", punto: "bg-info" },
};

/* La cuenta pedida todavía no la informa la base. El estado queda armado
   y el día que llegue el dato entra por acá, sin tocar el dibujo. */
function estadoDe(m) {
  if (m.cuentaPedida) return "cuenta";
  if (m.listos > 0) return "entregar";
  if (m.ocupada) return "ocupada";
  return "libre";
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
}) {
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(null);   // { mesas, elementos, borradas }
  const [sel, setSel] = useState(null);             // { tipo, id }
  const [guardando, setGuardando] = useState(false);
  const [piso, setPiso] = useState(null);
  const [sector, setSector] = useState("*");
  const [ancho, setAncho] = useState(0);

  const arrastre = useRef(null);
  const observador = useRef(null);

  /* Ref de función y no useRef: el contenedor del plano se desmonta al
     entrar en edición (cambia de lugar en el árbol) y un efecto de montaje
     se quedaría midiendo un nodo que ya no existe. */
  const cont = useCallback((el) => {
    if (observador.current) { observador.current.disconnect(); observador.current = null; }
    if (!el) return;
    setAncho(el.clientWidth);
    if (!window.ResizeObserver) return;
    observador.current = new ResizeObserver((e) => setAncho(e[0].contentRect.width));
    observador.current.observe(el);
  }, []);

  const mesasVista = editando && borrador ? borrador.mesas : mesas;
  const elemVista = editando && borrador ? borrador.elementos : elementos;

  const pisos = useMemo(() => {
    const s = new Set();
    for (const m of mesasVista) s.add(m.piso || "Planta baja");
    for (const e of elemVista) s.add(e.piso || "Planta baja");
    return [...s].sort();
  }, [mesasVista, elemVista]);

  useEffect(() => {
    if (!pisos.length) return;
    if (!piso || !pisos.includes(piso)) setPiso(pisos[0]);
  }, [pisos, piso]);

  const pisoActivo = piso && pisos.includes(piso) ? piso : pisos[0] || "Planta baja";

  const sectores = useMemo(() => {
    const s = new Set();
    for (const m of mesasVista) if ((m.piso || "Planta baja") === pisoActivo && m.sector) s.add(m.sector);
    return [...s].sort();
  }, [mesasVista, pisoActivo]);

  useEffect(() => {
    if (sector !== "*" && !sectores.includes(sector)) setSector("*");
  }, [sectores, sector]);

  const delPiso = (x) => (x.piso || "Planta baja") === pisoActivo;
  const delSector = (x) => sector === "*" || (x.sector || "") === sector;

  const mesasPlano = mesasVista.filter((m) => delPiso(m) && delSector(m));
  const elemPlano = elemVista.filter((e) => delPiso(e) && delSector(e));

  /* La grilla se estira hasta donde llega lo dibujado. En edición sobra
     un poco de aire para poder sacar una mesa del montón. */
  const holgura = editando ? 4 : 1;
  const cols = Math.max(16, ...mesasPlano.map((m) => m.x + m.ancho), ...elemPlano.map((e) => e.x + e.ancho)) + holgura;
  const filas = Math.max(10, ...mesasPlano.map((m) => m.y + m.alto), ...elemPlano.map((e) => e.y + e.alto)) + holgura;

  const celda = Math.max(CELDA_MIN, Math.min(CELDA_MAX, Math.floor((ancho || 320) / cols)));

  const ocupadas = mesasVista.filter((m) => m.ocupada).length;
  const consumido = mesasVista.reduce((s, m) => s + (m.consumido || 0), 0);

  /* --- edición ------------------------------------------------------ */

  const entrarAEditar = () => {
    setBorrador({
      mesas: mesas.map((m) => ({ ...m })),
      elementos: elementos.map((e) => ({ ...e })),
      borradas: [],
    });
    setSel(null);
    setEditando(true);
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
        const caja = { x, y, ancho: ancho_, alto: alto_ };
        if (!cajas.some((c) => chocan(caja, c))) return { x, y };
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
      ocupada: false, comandaId: null, consumido: 0, items: 0, enCocina: 0, listos: 0, minutos: null,
    };
    setBorrador((b) => ({ ...b, mesas: [...b.mesas, nueva] }));
    setSel({ tipo: "mesa", id: nueva.id });
  };

  const agregarElemento = (tipo) => {
    const def = ELEMENTOS.find((e) => e.k === tipo);
    const hueco = huecoLibre(def.ancho, def.alto);
    const nuevo = {
      id: idNuevo(), nuevo: true, empresa_id: empresaId, sucursal_id: sucursalId,
      piso: pisoActivo, sector: sector === "*" ? null : sector,
      tipo, etiqueta: null, ancho: def.ancho, alto: def.alto, ...hueco,
    };
    setBorrador((b) => ({ ...b, elementos: [...b.elementos, nuevo] }));
    setSel({ tipo: "elemento", id: nuevo.id });
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
    setBorrador((b) => ({ ...b, elementos: b.elementos.filter((x) => x.id !== e.id) }));
    setSel(null);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      /* Primero las bajas: el nombre de una mesa es único por comercio, y
         si alguien borra la 5 para volver a dibujarla, crearla antes de
         borrar la vieja choca contra la restricción. */
      for (const id of borrador.borradas) await borrarRecurso(id);

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
          piso: e.piso || "Planta baja",
          sector: e.sector || null,
          tipo: e.tipo,
          etiqueta: e.etiqueta || null,
          x: Math.round(e.x), y: Math.round(e.y),
          ancho: Math.round(e.ancho), alto: Math.round(e.alto),
        })));
      }

      /* guardarPlano solo escribe posición, tamaño, forma, piso y sector.
         El nombre y la capacidad de una mesa que ya existía se quedan en
         el borrador, así que hay que decirlo en vez de simular que se
         guardó. */
      const previas = new Map(mesas.map((m) => [m.id, m]));
      const perdidos = borrador.mesas.some((m) => {
        const p = previas.get(m.id);
        return p && (p.nombre !== m.nombre || Number(p.capacidad || 0) !== Number(m.capacidad || 0));
      });

      setEditando(false);
      setBorrador(null);
      setSel(null);
      toast("Plano guardado.", "ok");
      if (perdidos) toast("El nombre y la capacidad de las mesas que ya existían todavía no se pueden cambiar desde acá.", "mal");
      onGuardado && onGuardado();
    } catch (e) {
      toast(e.message || "No se pudo guardar el plano.", "mal");
    } finally {
      setGuardando(false);
    }
  };

  /* --- arrastre ------------------------------------------------------
     Eventos de puntero y no arrastrar-y-soltar de HTML5: esto lo usa
     alguien con una tablet, y el drag nativo no existe en el dedo. */

  const alBajar = (e, tipo, pieza) => {
    if (!editando) return;
    setSel({ tipo, id: pieza.id });
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
    arrastre.current = {
      tipo, id: pieza.id, celda,
      cx: e.clientX, cy: e.clientY, ox: pieza.x, oy: pieza.y,
      ancho: pieza.ancho, alto: pieza.alto,
    };
  };

  const alMover = (e) => {
    const a = arrastre.current;
    if (!a) return;
    const x = Math.max(0, a.ox + Math.round((e.clientX - a.cx) / a.celda));
    const y = Math.max(0, a.oy + Math.round((e.clientY - a.cy) / a.celda));

    if (a.tipo === "mesa") {
      /* Dos mesas en la misma celda no existen en el local. Si el destino
         está tomado, la mesa se queda donde estaba y sigue el dedo. */
      const caja = { x, y, ancho: a.ancho, alto: a.alto };
      if (mesasPlano.some((m) => m.id !== a.id && chocan(caja, m))) return;
      tocarMesa(a.id, { x, y });
    } else {
      tocarElemento(a.id, { x, y });
    }
  };

  const alSoltar = (e) => {
    if (!arrastre.current) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
    arrastre.current = null;
  };

  const seleccionada = sel && sel.tipo === "mesa" ? borrador.mesas.find((m) => m.id === sel.id) : null;
  const elemSel = sel && sel.tipo === "elemento" ? borrador.elementos.find((x) => x.id === sel.id) : null;

  /* --- pantalla ------------------------------------------------------ */

  const plano = (
    <div ref={cont} className="overflow-x-auto [-webkit-overflow-scrolling:touch] rounded-2xl border border-borde bg-superficie-2 p-2">
      <div
        className="relative mx-auto"
        style={{
          width: cols * celda,
          height: filas * celda,
          backgroundImage: editando
            ? "linear-gradient(to right, rgba(120,113,108,.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(120,113,108,.22) 1px, transparent 1px)"
            : undefined,
          backgroundSize: `${celda}px ${celda}px`,
        }}
      >
        {elemPlano.map((e) => (
          <PiezaElemento key={e.id} e={e} celda={celda} editando={editando}
            elegida={sel && sel.tipo === "elemento" && sel.id === e.id}
            onBajar={(ev) => alBajar(ev, "elemento", e)} onMover={alMover} onSoltar={alSoltar} />
        ))}

        {mesasPlano.map((m) => (
          <PiezaMesa key={m.id} m={m} celda={celda} editando={editando}
            abriendo={abriendo === m.id}
            elegida={sel && sel.tipo === "mesa" && sel.id === m.id}
            onTocar={() => onTocarMesa(m)}
            onBajar={(ev) => alBajar(ev, "mesa", m)} onMover={alMover} onSoltar={alSoltar} />
        ))}

        {!cargando && !mesasPlano.length && !elemPlano.length && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-texto-tenue px-6 text-center">
            {editando ? "Agregá la primera mesa para empezar a dibujar el salón." : "No hay nada dibujado en este sector."}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-texto-suave"><strong className="text-texto f-m">{ocupadas}</strong> ocupadas</span>
          <span className="text-texto-suave"><strong className="text-texto f-m">{mesasVista.length - ocupadas}</strong> libres</span>
          {consumido > 0 && (
            <span className="text-texto-suave"><strong className="text-texto f-m">{money(consumido)}</strong> en el salón</span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {!editando && onActualizar && (
            <Boton size="md" variant="ghost" onClick={onActualizar}><RefreshCw size={15} /> Actualizar</Boton>
          )}
          {!editando && puedeEditar && (
            <Boton size="md" variant="ghost" onClick={entrarAEditar}><Pencil size={15} /> Editar salón</Boton>
          )}
          {editando && (
            <>
              <Boton size="md" variant="ghost" onClick={cancelar} disabled={guardando}><X size={15} /> Cancelar</Boton>
              <Boton size="md" onClick={guardar} disabled={guardando}>
                <Save size={15} /> {guardando ? "Guardando…" : "Guardar plano"}
              </Boton>
            </>
          )}
        </div>
      </div>

      {/* Un local de un solo piso no tiene por qué enterarse de que existen
          los pisos. */}
      {pisos.length > 1 && (
        <Tabs items={pisos.map((p) => ({ k: p, n: p }))} value={pisoActivo} onChange={setPiso} />
      )}

      {sectores.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {[{ k: "*", n: "Todo el piso" }, ...sectores.map((s) => ({ k: s, n: s }))].map((s) => (
            <button key={s.k} onClick={() => setSector(s.k)}
              className={`px-3.5 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                s.k === sector
                  ? "bg-superficie-3 text-texto border-superficie-3"
                  : "bg-superficie text-texto-suave border-borde hover:bg-superficie-2"}`}>
              {s.n}
            </button>
          ))}
        </div>
      )}

      {editando && (
        <Card className="p-3 flex flex-wrap items-center gap-2">
          <Boton size="md" onClick={agregarMesa}><Plus size={15} /> Agregar mesa</Boton>
          <span className="text-xs uppercase tracking-widest text-texto-tenue font-bold ml-2">Elementos</span>
          {ELEMENTOS.map((e) => (
            <Boton key={e.k} size="md" variant="ghost" onClick={() => agregarElemento(e.k)}>{e.n}</Boton>
          ))}
          <span className="text-xs text-texto-tenue ml-auto flex items-center gap-1.5">
            <Grid3x3 size={13} /> Arrastrá para mover, tocá para editar
          </span>
        </Card>
      )}

      {cargando ? <Vacio>Cargando el salón…</Vacio> : (
        editando
          ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_20rem] items-start">
              {plano}
              <PanelEdicion
                mesa={seleccionada} elemento={elemSel} sectores={sectores}
                onMesa={tocarMesa} onElemento={tocarElemento}
                onBorrarMesa={borrarMesa} onQuitarElemento={quitarElemento} />
            </div>
          )
          : plano
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-texto-suave">
        {Object.values(ESTADOS).map((s) => (
          <span key={s.n} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded ${s.punto}`} /> {s.n}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-superficie-3" /> Barra, cocina y demás
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   Las piezas
   ------------------------------------------------------------ */

function PiezaMesa({ m, celda, editando, elegida, abriendo, onTocar, onBajar, onMover, onSoltar }) {
  const est = ESTADOS[estadoDe(m)];
  const w = m.ancho * celda, h = m.alto * celda;
  const redonda = m.forma === "redonda";
  const cuerpo = w >= 84 && h >= 66;   // abajo de esto solo entra el nombre
  const tipo = Math.max(11, Math.min(20, Math.round(celda * 0.52)));

  return (
    <button
      type="button"
      disabled={abriendo}
      onPointerDown={editando ? onBajar : undefined}
      onPointerMove={editando ? onMover : undefined}
      onPointerUp={editando ? onSoltar : undefined}
      onPointerCancel={editando ? onSoltar : undefined}
      onClick={editando ? undefined : onTocar}
      style={{
        left: m.x * celda + 2, top: m.y * celda + 2,
        width: Math.max(0, w - 4), height: Math.max(0, h - 4),
        touchAction: editando ? "none" : undefined,
        borderRadius: redonda ? "9999px" : m.forma === "barra" ? 8 : 14,
      }}
      className={`absolute z-10 overflow-hidden border-2 flex flex-col items-center justify-center px-1 text-center transition-colors disabled:opacity-50 ${est.caja} ${
        elegida ? "ring-2 ring-acento" : ""} ${editando ? "cursor-move" : "cursor-pointer"}`}
    >
      <span className="f-d leading-none truncate max-w-full" style={{ fontSize: tipo }}>{m.nombre}</span>

      {m.capacidad ? (
        <span className="flex items-center gap-0.5 text-[10px] text-texto-tenue leading-none mt-1">
          <Users size={10} /> {m.capacidad}
        </span>
      ) : null}

      {!editando && m.ocupada && cuerpo && (
        <>
          <span className="f-m text-xs mt-1 leading-none">{money(m.consumido)}</span>
          <span className="flex items-center gap-1 text-[10px] text-texto-suave leading-none mt-1">
            <Clock size={10} /> {espera(m.minutos == null ? 0 : m.minutos)}
          </span>
          {(m.enCocina > 0 || m.listos > 0) && (
            <span className="flex items-center gap-1.5 mt-1 leading-none">
              {m.enCocina > 0 && <span className="flex items-center gap-0.5 text-[10px] font-bold text-ojo"><Flame size={9} /> {m.enCocina}</span>}
              {m.listos > 0 && <span className="flex items-center gap-0.5 text-[10px] font-bold text-bien"><Check size={9} /> {m.listos}</span>}
            </span>
          )}
        </>
      )}

      {abriendo && <span className="text-[10px] text-texto-suave mt-1">Abriendo…</span>}
    </button>
  );
}

/* Fondo del plano: ubican pero no se tocan. En modo mirar ni siquiera
   reciben el click, así un dedo torpe sobre la barra no roba el toque de
   la mesa que está al lado. */
function PiezaElemento({ e, celda, editando, elegida, onBajar, onMover, onSoltar }) {
  const texto = e.tipo === "texto";
  const etiqueta = e.etiqueta || (texto ? "Texto" : nombreElemento(e.tipo));

  return (
    <div
      onPointerDown={editando ? onBajar : undefined}
      onPointerMove={editando ? onMover : undefined}
      onPointerUp={editando ? onSoltar : undefined}
      onPointerCancel={editando ? onSoltar : undefined}
      style={{
        left: e.x * celda, top: e.y * celda,
        width: e.ancho * celda, height: e.alto * celda,
        touchAction: editando ? "none" : undefined,
      }}
      className={`absolute z-0 flex items-center justify-center overflow-hidden rounded-lg ${
        texto ? "text-texto-tenue" : "bg-superficie-3 text-texto-suave"} ${
        elegida ? "ring-2 ring-acento" : ""} ${editando ? "cursor-move" : "pointer-events-none"}`}
    >
      <span className="text-[10px] uppercase tracking-widest font-bold truncate px-1">{etiqueta}</span>
    </div>
  );
}

/* ------------------------------------------------------------
   Panel de edición
   ------------------------------------------------------------ */

function PanelEdicion({ mesa, elemento, sectores, onMesa, onElemento, onBorrarMesa, onQuitarElemento }) {
  if (!mesa && !elemento) {
    return (
      <Card className="p-4 text-sm text-texto-suave">
        <p className="font-semibold text-texto mb-1">Nada elegido</p>
        <p>Tocá una mesa o un elemento del plano para cambiarle el nombre, el tamaño o la forma. Arrastralo para moverlo.</p>
      </Card>
    );
  }

  if (mesa) {
    return (
      <Card className="p-4 space-y-3">
        <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-bold">Mesa</div>

        <Campo label="Nombre">
          <input className={inputCls} value={mesa.nombre || ""}
            onChange={(ev) => onMesa(mesa.id, { nombre: ev.target.value })} />
        </Campo>

        {!mesa.nueva && (
          <p className="text-[11px] text-texto-tenue -mt-1">
            El nombre y la capacidad de una mesa que ya existe todavía no se guardan.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Campo label="Capacidad">
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
            placeholder="Salón, Patio, Vereda…"
            onChange={(ev) => onMesa(mesa.id, { sector: ev.target.value })} />
        </Campo>
        <datalist id="sectores-plano">
          {sectores.map((s) => <option key={s} value={s} />)}
        </datalist>

        <div className="pt-1">
          {mesa.ocupada ? (
            <p className="text-xs text-texto-tenue">Tiene una comanda abierta: cobrala antes de borrarla.</p>
          ) : (
            <Boton variant="danger" size="md" className="w-full" onClick={() => onBorrarMesa(mesa)}>
              <Trash2 size={15} /> Borrar la mesa
            </Boton>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-bold">Elemento</div>

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

      <div className="pt-1">
        {elemento.nuevo ? (
          <Boton variant="danger" size="md" className="w-full" onClick={() => onQuitarElemento(elemento)}>
            <Trash2 size={15} /> Quitar
          </Boton>
        ) : (
          <p className="text-xs text-texto-tenue">
            Los elementos ya guardados todavía no se pueden borrar. Movelo fuera de la vista o cambiale el tipo.
          </p>
        )}
      </div>
    </Card>
  );
}
