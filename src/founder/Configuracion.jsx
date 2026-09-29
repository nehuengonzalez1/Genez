/* ============================================================
   GENEZ FOUNDER · Configuración
   ============================================================

   Las etapas del pipeline y las listas (zonas, rubros, fuentes, motivos
   de pérdida, tipos de actividad y de evento, categorías, etiquetas).
   Nada se borra: se desactiva, así lo que ya las usa no queda apuntando
   a la nada. La base exige el área 'config' (0113), no esta pantalla.
   ============================================================ */

import React, { useEffect, useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { Card, Boton, Tabs, Cargando, ErrorEstado, Vacio } from "../ui/Base.jsx";
import { inputCls, TextoDiferido } from "../ui/Campos.jsx";
import { cargarModelo, guardarPasoModelo } from "../datos/internoClientes.js";
import {
  cargarEtapas, crearEtapa, editarEtapa, cargarListas, crearItemDeLista, editarItemDeLista, cargarMiembros, TIPOS_DE_LISTA,
} from "../datos/interno.js";

const TIPO_ETAPA = { abierta: "Abierta", ganada: "Ganada", perdida: "Perdida", pausada: "Pausada" };

export function ConfiguracionFounder({ interno, toast }) {
  const [pestana, setPestana] = useState("pipeline");
  return (
    <div className="space-y-5">
      <header>
        <h1 className="f-d text-3xl">Configuración</h1>
        <p className="text-sm text-texto-suave mt-1">Cómo está armado Founder. Lo que se cambia acá lo ven todas las pantallas.</p>
      </header>
      <Tabs value={pestana} onChange={setPestana} items={[{ k: "pipeline", n: "Pipeline" }, { k: "listas", n: "Listas" }, { k: "implementacion", n: "Implementación" }, { k: "equipo", n: "Equipo" }]} />
      {pestana === "pipeline" && <Etapas toast={toast} />}
      {pestana === "listas" && <Listas toast={toast} />}
      {pestana === "implementacion" && <ModeloImplementacion toast={toast} />}
      {pestana === "equipo" && <Equipo interno={interno} />}
    </div>
  );
}

/* ---------- Pipeline ---------- */
function Etapas({ toast }) {
  const [etapas, setEtapas] = useState(null);
  const [error, setError] = useState("");
  const [nueva, setNueva] = useState("");
  const leer = useCallback(() => cargarEtapas().then(setEtapas).catch((e) => setError(e.message)), []);
  useEffect(() => { leer(); }, [leer]);
  /* Los dos órdenes se leen antes de escribir: si no, el segundo cambio
     usaría el valor que ya pisó el primero. */
  const intercambiar = async (a, b) => {
    const [oa, ob] = [a.orden, b.orden];
    await editarEtapa(a.id, { orden: ob });
    await editarEtapa(b.id, { orden: oa });
  };
  const hacer = async (fn, ok) => { try { await fn(); await leer(); if (ok) toast(ok); } catch (e) { toast(e.message, "mal"); } };

  if (error) return <Card><ErrorEstado onReintentar={() => { setError(""); leer(); }}>{error}</ErrorEstado></Card>;
  if (!etapas) return <Card><Cargando /></Card>;
  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-4 border-b border-borde">
        <h2 className="f-d text-lg">Etapas</h2>
        <p className="text-sm text-texto-suave mt-1">
          La probabilidad es la que se usa para el valor ponderado del pipeline, que no es plata cobrada. Las ganadas, perdidas y pausadas no suman.
        </p>
      </div>
      <ul className="divide-y divide-borde">
        {etapas.map((e, i) => <FilaEtapa key={e.id} e={e} primera={i === 0} ultima={i === etapas.length - 1}
          subir={() => hacer(() => intercambiar(e, etapas[i - 1]))}
          bajar={() => hacer(() => intercambiar(e, etapas[i + 1]))}
          guardar={(c) => hacer(() => editarEtapa(e.id, c), "Etapa guardada.")} />)}
      </ul>
      <form className="flex gap-2 px-5 py-3 border-t border-borde" onSubmit={(ev) => {
        ev.preventDefault();
        if (!nueva.trim()) return;
        hacer(() => crearEtapa({ nombre: nueva, orden: Math.max(0, ...etapas.map((x) => x.orden)) + 1, probabilidad: 20 }), `"${nueva.trim()}" agregada.`).then(() => setNueva(""));
      }}>
        <input value={nueva} onChange={(e) => setNueva(e.target.value.slice(0, 60))} placeholder="Nombre de una etapa nueva" className={inputCls} />
        <Boton disabled={!nueva.trim()}><Plus size={14} /> Agregar</Boton>
      </form>
    </Card>
  );
}

function FilaEtapa({ e, primera, ultima, subir, bajar, guardar }) {
  const [d, setD] = useState({ nombre: e.nombre, probabilidad: String(e.probabilidad), tipo: e.tipo });
  useEffect(() => setD({ nombre: e.nombre, probabilidad: String(e.probabilidad), tipo: e.tipo }), [e.nombre, e.probabilidad, e.tipo]);
  const cambio = d.nombre.trim() && (d.nombre.trim() !== e.nombre || Number(d.probabilidad) !== e.probabilidad || d.tipo !== e.tipo);
  return (
    <li className={`flex flex-wrap items-center gap-2 px-5 py-2.5 ${e.activa ? "" : "opacity-50"}`}>
      <div className="flex flex-col">
        <button disabled={primera} onClick={subir} aria-label="Subir" className="text-texto-tenue hover:text-texto disabled:opacity-30 leading-none text-xs">▲</button>
        <button disabled={ultima} onClick={bajar} aria-label="Bajar" className="text-texto-tenue hover:text-texto disabled:opacity-30 leading-none text-xs">▼</button>
      </div>
      <input value={d.nombre} onChange={(ev) => setD({ ...d, nombre: ev.target.value.slice(0, 60) })} className={`${inputCls} flex-1 min-w-[10rem]`} />
      <label className="flex items-center gap-1 text-xs text-texto-suave">
        <input value={d.probabilidad} onChange={(ev) => setD({ ...d, probabilidad: ev.target.value.replace(/\D/g, "").slice(0, 3) })} className={`${inputCls} f-m w-16 text-right`} />%
      </label>
      <select value={d.tipo} onChange={(ev) => setD({ ...d, tipo: ev.target.value })} className={`${inputCls} w-auto`}>
        {Object.entries(TIPO_ETAPA).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
      </select>
      {cambio && <Boton size="sm" onClick={() => {
        const p = Number(d.probabilidad);
        if (!(p >= 0 && p <= 100)) return;
        guardar({ nombre: d.nombre, probabilidad: p, tipo: d.tipo });
      }}>Guardar</Boton>}
      <Boton size="sm" variant="ghost" onClick={() => guardar({ activa: !e.activa })}>{e.activa ? "Desactivar" : "Activar"}</Boton>
    </li>
  );
}

/* ---------- Listas ---------- */
function Listas({ toast }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [tipo, setTipo] = useState("zona");
  const [nuevo, setNuevo] = useState("");
  const leer = useCallback(() => cargarListas().then(setItems).catch((e) => setError(e.message)), []);
  useEffect(() => { leer(); }, [leer]);
  const hacer = async (fn, ok) => { try { await fn(); await leer(); if (ok) toast(ok); return true; } catch (e) { toast(e.message, "mal"); return false; } };

  if (error) return <Card><ErrorEstado onReintentar={() => { setError(""); leer(); }}>{error}</ErrorEstado></Card>;
  if (!items) return <Card><Cargando /></Card>;
  const delTipo = items.filter((i) => i.tipo === tipo);
  return (
    <div className="grid md:grid-cols-[14rem_1fr] gap-4">
      <Card className="p-2 h-fit">
        {TIPOS_DE_LISTA.map((t) => (
          <button key={t.k} onClick={() => setTipo(t.k)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm ${tipo === t.k ? "bg-acento-suave font-semibold" : "text-texto-suave hover:bg-superficie-2"}`}>
            {t.n} <span className="f-m text-xs text-texto-tenue">{items.filter((i) => i.tipo === t.k && i.activo).length}</span>
          </button>
        ))}
      </Card>
      <Card className="overflow-hidden">
        {delTipo.length === 0 ? <Vacio>Todavía no hay ninguno. Agregá el primero abajo.</Vacio> : (
          <ul className="divide-y divide-borde">
            {delTipo.map((i) => <FilaItem key={i.id} i={i}
              guardar={(nombre) => hacer(() => editarItemDeLista(i.id, { nombre }), "Guardado.")}
              alternar={() => hacer(() => editarItemDeLista(i.id, { activo: !i.activo }))} />)}
          </ul>
        )}
        <form className="flex gap-2 px-5 py-3 border-t border-borde" onSubmit={async (ev) => {
          ev.preventDefault();
          if (!nuevo.trim()) return;
          if (await hacer(() => crearItemDeLista(tipo, nuevo, Math.max(0, ...delTipo.map((x) => x.orden)) + 1), `"${nuevo.trim()}" agregado.`)) setNuevo("");
        }}>
          <input value={nuevo} onChange={(e) => setNuevo(e.target.value.slice(0, 80))} placeholder="Agregar a esta lista" className={inputCls} />
          <Boton disabled={!nuevo.trim()}><Plus size={14} /> Agregar</Boton>
        </form>
      </Card>
    </div>
  );
}

function FilaItem({ i, guardar, alternar }) {
  const [nombre, setNombre] = useState(i.nombre);
  useEffect(() => setNombre(i.nombre), [i.nombre]);
  return (
    <li className={`flex items-center gap-2 px-5 py-2 ${i.activo ? "" : "opacity-50"}`}>
      <input value={nombre} onChange={(e) => setNombre(e.target.value.slice(0, 80))} className={`${inputCls} flex-1`} />
      {nombre.trim() && nombre.trim() !== i.nombre && <Boton size="sm" onClick={() => guardar(nombre)}>Guardar</Boton>}
      <Boton size="sm" variant="ghost" onClick={alternar}>{i.activo ? "Desactivar" : "Activar"}</Boton>
    </li>
  );
}

/* ---------- Equipo ---------- */
function Equipo({ interno }) {
  const [miembros, setMiembros] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { cargarMiembros().then(setMiembros).catch((e) => setError(e.message)); }, []);
  if (error) return <Card><ErrorEstado>{error}</ErrorEstado></Card>;
  if (!miembros) return <Card><Cargando /></Card>;
  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-4 border-b border-borde">
        <h2 className="f-d text-lg">Equipo interno</h2>
        <p className="text-sm text-texto-suave mt-1">
          Quién entra a Founder y a qué áreas. Ser del equipo no da acceso a los datos de ningún comercio. Por ahora el alta de un miembro nuevo se hace desde la base; la pantalla para sumar gente llega cuando haya a quién sumar.
        </p>
      </div>
      <ul className="divide-y divide-borde">
        {miembros.map((m) => (
          <li key={m.perfil_id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
            <span className="flex-1 min-w-0">
              <span className="font-medium">{m.nombre || m.email}</span>
              <span className="block text-[11px] text-texto-tenue">{m.email}</span>
            </span>
            <span className="text-xs uppercase tracking-wider text-texto-suave">{m.rol}</span>
            <span className="f-m text-xs text-texto-tenue">{m.areas.includes("*") ? "todas las áreas" : m.areas.join(", ")}</span>
            {!m.activo && <span className="text-xs text-mal">desactivado</span>}
          </li>
        ))}
      </ul>
      <p className="px-5 py-3 border-t border-borde text-[11px] text-texto-tenue">Tu rol: {interno.rol}.</p>
    </Card>
  );
}

/* ---------- El modelo de implementación ---------- */
/* Los pasos que se le arman a cada cliente nuevo, por etapa. Un paso con
   módulos marcados toca solo a quien tiene alguno de esos módulos en su
   comercio; con rubros, solo a esos rubros. Sin nada marcado, a todos.
   Cambiar el modelo no toca a los clientes que ya están: en su ficha,
   "Sumar los pasos que falten" trae lo nuevo. */
const MODULOS_DEL_SISTEMA = [["cobro", "Cobro"], ["caja", "Caja"], ["productos", "Productos"], ["stock", "Stock"], ["compras", "Compras"],
  ["comandas", "Salón"], ["pedidos", "Pedidos"], ["clientes", "Clientes y facturación"], ["cuentas", "Cuenta corriente"], ["agenda", "Agenda"],
  ["servicios", "Servicios"], ["ventas", "Ventas y abonos"], ["finanzas", "Finanzas"], ["equipo", "Equipo"], ["comunicaciones", "Avisos"]];

function ModeloImplementacion({ toast }) {
  const [pasos, setPasos] = useState(null);
  const [listas, setListas] = useState(null);
  const [error, setError] = useState("");
  const [editando, setEditando] = useState(null);
  const leer = useCallback(() => Promise.all([cargarModelo(), cargarListas()])
    .then(([m, l]) => { setPasos(m); setListas(l); }).catch((e) => setError(e.message)), []);
  useEffect(() => { leer(); }, [leer]);
  if (error) return <Card><ErrorEstado onReintentar={() => { setError(""); leer(); }}>{error}</ErrorEstado></Card>;
  if (!pasos || !listas) return <Card><Cargando /></Card>;
  const etapas = listas.filter((l) => l.tipo === "etapa_implementacion" && l.activo).sort((a, b) => a.orden - b.orden);
  const rubros = listas.filter((l) => l.tipo === "rubro" && l.activo);
  const guardar = async (p, cambios) => {
    try { await guardarPasoModelo({ ...p, ...cambios }); leer(); } catch (e) { toast(e.message, "mal"); }
  };
  const alternar = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-texto-suave">
        Los pasos que se le arman a cada cliente nuevo. Con módulos marcados, el paso toca solo a quien tiene alguno de esos módulos en su comercio;
        con rubros, solo a esos rubros; sin nada, a todos. Los clientes que ya están no cambian: en su ficha, "Sumar los pasos que falten" trae lo nuevo.
      </p>
      {etapas.map((e) => {
        const deEsta = pasos.filter((p) => p.etapa === e.clave).sort((a, b) => a.orden - b.orden);
        return (
          <Card key={e.clave} className="overflow-hidden">
            <h2 className="px-5 py-3 font-semibold border-b border-borde">{e.nombre}</h2>
            <ul className="divide-y divide-borde">
              {deEsta.map((p) => (
                <li key={p.id} className={`px-5 py-2.5 text-sm ${p.activo ? "" : "opacity-50"}`}>
                  <div className="flex items-center gap-3">
                    <TextoDiferido valor={p.titulo} onGuardar={(t) => t && guardar(p, { titulo: t })} className={`${inputCls} mt-0 flex-1`} />
                    <button onClick={() => setEditando(editando === p.id ? null : p.id)} className="text-[11px] text-texto-suave hover:text-texto whitespace-nowrap">
                      {p.modulos.length || p.rubros.length ? [...p.modulos.map((m) => (MODULOS_DEL_SISTEMA.find(([k]) => k === m) || [m, m])[1]), ...p.rubros.map((r) => (rubros.find((x) => x.clave === r) || {}).nombre || r)].join(", ") : "para todos"}
                    </button>
                    <button onClick={() => guardar(p, { activo: !p.activo })} className="text-[11px] text-texto-suave hover:text-texto">{p.activo ? "Desactivar" : "Activar"}</button>
                  </div>
                  {editando === p.id && (
                    <div className="mt-2 space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[11px] text-texto-tenue w-16">Módulos</span>
                        {MODULOS_DEL_SISTEMA.map(([k, n]) => (
                          <button key={k} onClick={() => guardar(p, { modulos: alternar(p.modulos, k) })}
                            className={`text-[11px] px-2 py-0.5 rounded-md border ${p.modulos.includes(k) ? "border-acento bg-acento-suave" : "border-borde text-texto-suave"}`}>{n}</button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[11px] text-texto-tenue w-16">Rubros</span>
                        {rubros.map((r) => (
                          <button key={r.clave} onClick={() => guardar(p, { rubros: alternar(p.rubros, r.clave) })}
                            className={`text-[11px] px-2 py-0.5 rounded-md border ${p.rubros.includes(r.clave) ? "border-acento bg-acento-suave" : "border-borde text-texto-suave"}`}>{r.nombre}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <div className="px-5 py-2.5 border-t border-borde">
              <Boton size="sm" variant="ghost" onClick={() => {
                const t = window.prompt(`Paso nuevo en "${e.nombre}":`);
                if (t && t.trim()) guardar({}, { etapa: e.clave, titulo: t.trim().slice(0, 200), orden: deEsta.length + 1, rubros: [], modulos: [], activo: true });
              }}><Plus size={13} /> Paso</Boton>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
