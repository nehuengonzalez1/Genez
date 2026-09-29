/* ============================================================
   GENEZ FOUNDER · Prospectos
   ============================================================

   La base comercial: cada negocio que se identificó, con su etapa y su
   próximo paso. Dos vistas: la tabla (buscar, filtrar, ordenar) y el
   seguimiento (qué se venció, qué toca hoy, qué viene, qué no tiene
   próximo paso). El alta pide lo esencial y deja lo demás plegado, y
   antes de guardar pregunta a la base si ya existe (teléfono, mail, o
   nombre y localidad): muestra el que coincide y deja abrirlo o crear
   igual. No fusiona nada solo.
   ============================================================ */

import React, { useEffect, useMemo, useState } from "react";
import { Plus, Search, Download, Upload } from "lucide-react";
import { Card, Boton, Modal, Tabs, Cargando, ErrorEstado, Vacio } from "../ui/Base.jsx";
import { inputCls } from "../ui/Campos.jsx";
import { money } from "../utils/helpers.js";
import { bajarExcel } from "../utils/planilla.js";
import { ImportarProspectos } from "./Importar.jsx";
import { cargarProspectos, crearProspecto, posiblesDuplicados, PROSPECTO_VACIO } from "../datos/internoCrm.js";
import { useConfig, fechaHora, relativo, vencido, diaAR, hoyAR, INTERES, soloDigitos, fecha } from "./util.js";

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function Prospectos({ abrir, toast, nuevoAlAbrir = false }) {
  const { cfg, de, nombre } = useConfig();
  const [lista, setLista] = useState(null);
  const [error, setError] = useState("");
  const [vista, setVista] = useState("tabla");
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState({ zona: "", rubro: "", etapa: "", interes: "", fuente: "" });
  const [orden, setOrden] = useState("proximo");
  const [archivados, setArchivados] = useState(false);
  const [alta, setAlta] = useState(nuevoAlAbrir);
  const [importar, setImportar] = useState(false);

  const leer = () => cargarProspectos({ archivados }).then(setLista).catch((e) => setError(e.message));
  useEffect(() => { setLista(null); leer(); }, [archivados]);

  const visibles = useMemo(() => {
    if (!lista) return [];
    const t = norm(q.trim()), dig = soloDigitos(q);
    let r = lista.filter((p) => (!t || norm(p.nombre).includes(t) || norm(p.localidad).includes(t) || norm(p.razonSocial).includes(t)
        || (dig.length >= 4 && (soloDigitos(p.telefono).includes(dig) || soloDigitos(p.whatsapp).includes(dig))) || norm(p.email).includes(t))
      && (!filtro.zona || p.zona === filtro.zona) && (!filtro.rubro || p.rubro === filtro.rubro)
      && (!filtro.etapa || p.etapaId === filtro.etapa) && (!filtro.interes || p.interes === filtro.interes)
      && (!filtro.fuente || p.fuente === filtro.fuente));
    const por = {
      proximo: (a, b) => (a.proximoContacto ? a.proximoContacto.getTime() : Infinity) - (b.proximoContacto ? b.proximoContacto.getTime() : Infinity),
      alta: (a, b) => b.creadoEn - a.creadoEn,
      potencial: (a, b) => (Number(b.valor) || 0) * (b.probabilidad || 0) - (Number(a.valor) || 0) * (a.probabilidad || 0),
      nombre: (a, b) => a.nombre.localeCompare(b.nombre, "es"),
    }[orden];
    return [...r].sort(por);
  }, [lista, q, filtro, orden]);

  /* Lo que se ve, con los filtros aplicados: exporta la búsqueda, no todo. */
  const exportar = async () => {
    const objetos = visibles.map((p) => ({
        Nombre: p.nombre, Rubro: nombre("rubro", p.rubro), Zona: nombre("zona", p.zona), Localidad: p.localidad || "", Dirección: p.direccion || "",
        Teléfono: p.telefono || "", WhatsApp: p.whatsapp || "", Email: p.email || "", Instagram: p.instagram || "",
        Etapa: p.etapaNombre || "", Interés: INTERES[p.interes] || "", Fuente: nombre("fuente", p.fuente), "Próximo contacto": fechaHora(p.proximoContacto),
        "Próxima acción": p.proximaAccion || "", "Último contacto": fechaHora(p.ultimoContacto), Alta: fecha(p.creadoEn), Notas: p.notas || "",
    }));
    const titulos = Object.keys(objetos[0] || { Nombre: "" });
    await bajarExcel(`prospectos-${hoyAR()}`, [{ nombre: "Prospectos", filas: [titulos, ...objetos.map((o) => titulos.map((k) => o[k]))] }]);
  };

  const sel = (k, opciones, todos) => (
    <select value={filtro[k]} onChange={(e) => setFiltro({ ...filtro, [k]: e.target.value })} className={`${inputCls} w-auto text-sm`}>
      <option value="">{todos}</option>
      {opciones.map((o) => <option key={o.v} value={o.v}>{o.n}</option>)}
    </select>
  );

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="f-d text-3xl">Prospectos</h1>
          <p className="text-sm text-texto-suave mt-1">{lista ? `${lista.length} ${archivados ? "archivados" : "en seguimiento"}` : " "}</p>
        </div>
        <div className="flex gap-2">
          {lista && lista.length > 0 && <Boton variant="ghost" onClick={exportar}><Download size={14} /> Exportar</Boton>}
          <Boton variant="ghost" onClick={() => setImportar(true)}><Upload size={14} /> Importar</Boton>
          <Boton onClick={() => setAlta(true)}><Plus size={14} /> Nuevo prospecto</Boton>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[14rem]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-tenue" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, teléfono, mail o localidad" className={`${inputCls} pl-9`} />
        </div>
        {cfg && sel("zona", de("zona").map((z) => ({ v: z.clave, n: z.nombre })), "Todas las zonas")}
        {cfg && sel("rubro", de("rubro").map((z) => ({ v: z.clave, n: z.nombre })), "Todos los rubros")}
        {cfg && sel("etapa", cfg.etapas.map((e) => ({ v: e.id, n: e.nombre })), "Todas las etapas")}
        {sel("interes", Object.entries(INTERES).map(([v, n]) => ({ v, n })), "Cualquier interés")}
        {cfg && sel("fuente", de("fuente").map((z) => ({ v: z.clave, n: z.nombre })), "Cualquier fuente")}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={vista} onChange={setVista} items={[{ k: "tabla", n: "Tabla" }, { k: "seguimiento", n: "Seguimiento" }]} />
        <div className="flex items-center gap-3 text-sm">
          {vista === "tabla" && (
            <select value={orden} onChange={(e) => setOrden(e.target.value)} className={`${inputCls} w-auto text-sm`}>
              <option value="proximo">Próximo contacto</option>
              <option value="alta">Más nuevos</option>
              <option value="potencial">Mayor potencial</option>
              <option value="nombre">Nombre</option>
            </select>
          )}
          <label className="flex items-center gap-1.5 text-texto-suave cursor-pointer">
            <input type="checkbox" checked={archivados} onChange={(e) => setArchivados(e.target.checked)} className="accent-acento" /> Archivados
          </label>
        </div>
      </div>

      {error ? <Card><ErrorEstado onReintentar={() => { setError(""); leer(); }}>{error}</ErrorEstado></Card>
        : !lista ? <Card><Cargando /></Card>
        : lista.length === 0 && !archivados ? (
          <Card><Vacio>
            Todavía no cargaste ningún prospecto. Empezá por los comercios de tus zonas: con el nombre y un teléfono alcanza, lo demás se completa después.
            <div className="mt-3"><Boton onClick={() => setAlta(true)}><Plus size={14} /> Cargar el primero</Boton></div>
          </Vacio></Card>
        ) : vista === "tabla" ? <Tabla filas={visibles} abrir={abrir} nombre={nombre} />
        : <Seguimiento filas={visibles} abrir={abrir} />}

      {importar && cfg && <ImportarProspectos de={de} toast={toast} onCerrar={() => setImportar(false)} onListo={() => { setImportar(false); setArchivados(false); leer(); }} />}
      {alta && cfg && (
        <AltaProspecto de={de} onCerrar={() => setAlta(false)} abrir={abrir} toast={toast}
          onCreado={(id) => { setAlta(false); leer(); abrir(id); }} />
      )}
    </div>
  );
}

function Tabla({ filas, abrir, nombre }) {
  if (!filas.length) return <Card><Vacio>Ninguno coincide con la búsqueda o los filtros.</Vacio></Card>;
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-texto-tenue border-b border-borde">
              <th className="px-4 py-2.5 font-semibold">Negocio</th>
              <th className="px-4 py-2.5 font-semibold">Etapa</th>
              <th className="px-4 py-2.5 font-semibold">Próximo paso</th>
              <th className="px-4 py-2.5 font-semibold">Interés</th>
              <th className="px-4 py-2.5 font-semibold text-right">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {filas.map((p) => (
              <tr key={p.id} onClick={() => abrir(p.id)} className="cursor-pointer hover:bg-superficie-2">
                <td className="px-4 py-2.5">
                  <div className="font-medium">{p.nombre}</div>
                  <div className="text-[11px] text-texto-tenue">{[nombre("rubro", p.rubro), p.localidad || nombre("zona", p.zona)].filter(Boolean).join(" · ")}</div>
                </td>
                <td className="px-4 py-2.5 text-texto-suave">{p.etapaNombre || "—"}</td>
                <td className="px-4 py-2.5">
                  {p.proximoContacto ? (
                    <>
                      <span className={vencido(p.proximoContacto) ? "text-mal font-medium" : diaAR(p.proximoContacto) === hoyAR() ? "text-acento font-medium" : "text-texto-suave"}>
                        {relativo(p.proximoContacto)}
                      </span>
                      {p.proximaAccion && <span className="text-texto-tenue"> · {p.proximaAccion}</span>}
                    </>
                  ) : <span className="text-texto-tenue">sin próximo paso</span>}
                </td>
                <td className="px-4 py-2.5 text-texto-suave">{INTERES[p.interes] || ""}</td>
                <td className="px-4 py-2.5 text-right f-m">{Number(p.valor) ? money(Number(p.valor)) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* Lo que hay que hacer, agrupado por cuándo. */
function Seguimiento({ filas, abrir }) {
  const hoy = hoyAR();
  const abiertos = filas.filter((p) => !p.oportunidadEstado || p.oportunidadEstado === "abierta");
  const grupos = [
    { k: "vencidos", n: "Vencidos", tono: "text-mal", items: abiertos.filter((p) => p.proximoContacto && diaAR(p.proximoContacto) < hoy) },
    { k: "hoy", n: "Hoy", tono: "text-acento", items: abiertos.filter((p) => p.proximoContacto && diaAR(p.proximoContacto) === hoy) },
    { k: "proximos", n: "Próximos 7 días", tono: "text-texto", items: abiertos.filter((p) => p.proximoContacto && diaAR(p.proximoContacto) > hoy && (p.proximoContacto - new Date()) < 7 * 86400000) },
    { k: "sin", n: "Sin próximo paso", tono: "text-ojo", items: abiertos.filter((p) => !p.proximoContacto) },
  ];
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {grupos.map((g) => (
        <Card key={g.k} className="overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-borde">
            <h3 className={`font-semibold text-sm ${g.tono}`}>{g.n}</h3>
            <span className="f-m text-xs text-texto-tenue">{g.items.length}</span>
          </div>
          {g.items.length === 0 ? <p className="px-4 py-4 text-sm text-texto-tenue">Nada.</p> : (
            <ul className="divide-y divide-borde max-h-80 overflow-auto">
              {g.items.map((p) => (
                <li key={p.id}>
                  <button onClick={() => abrir(p.id)} className="w-full text-left px-4 py-2.5 hover:bg-superficie-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium text-sm truncate">{p.nombre}</span>
                      {p.proximoContacto && <span className="text-[11px] text-texto-tenue shrink-0">{relativo(p.proximoContacto)}</span>}
                    </div>
                    <div className="text-[11px] text-texto-tenue truncate">{p.proximaAccion || p.etapaNombre || ""}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}
    </div>
  );
}

/* ---------- El alta ---------- */
function AltaProspecto({ de, onCerrar, onCreado, abrir, toast }) {
  const [d, setD] = useState({ ...PROSPECTO_VACIO, contactoNombre: "" });
  const [mas, setMas] = useState(false);
  const [dup, setDup] = useState(null);       // coincidencias encontradas
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });

  const guardar = async (igual = false) => {
    if (!d.nombre.trim()) return toast("Poné el nombre del negocio.", "mal");
    setGuardando(true);
    try {
      if (!igual) {
        const m = await posiblesDuplicados({ nombre: d.nombre, localidad: d.localidad || d.zona, telefono: d.telefono || d.whatsapp, email: d.email });
        if (m.length) { setDup(m); setGuardando(false); return; }
      }
      const id = await crearProspecto({
        ...d, nombre: d.nombre.trim(),
        sucursales: d.sucursales ? Number(d.sucursales) : undefined, usuarios: d.usuarios ? Number(d.usuarios) : undefined,
        presupuesto: d.presupuesto ? Number(d.presupuesto) : undefined,
        modulos: d.modulos ? String(d.modulos).split(",").map((x) => x.trim()).filter(Boolean) : undefined,
        etiquetas: d.etiquetas ? String(d.etiquetas).split(",").map((x) => x.trim()).filter(Boolean) : undefined,
      });
      toast(`${d.nombre.trim()} cargado.`);
      onCreado(id);
    } catch (e) {
      toast(e.message, "mal");
      setGuardando(false);
    }
  };

  const campo = (k, label, props = {}) => (
    <label className="block text-xs text-texto-suave">{label}
      <input value={d[k] || ""} onChange={set(k)} className={`${inputCls} mt-1`} {...props} />
    </label>
  );
  const lista = (k, label, tipo) => (
    <label className="block text-xs text-texto-suave">{label}
      <select value={d[k] || ""} onChange={set(k)} className={`${inputCls} mt-1`}>
        <option value="">—</option>
        {de(tipo).map((i) => <option key={i.clave} value={i.clave}>{i.nombre}</option>)}
      </select>
    </label>
  );

  return (
    <Modal open onClose={onCerrar} ancho="max-w-2xl">
      <div className="p-5 space-y-4">
        <h3 className="f-d text-xl">Nuevo prospecto</h3>
        {dup ? (
          <div className="space-y-3">
            <p className="text-sm">Ya hay {dup.length === 1 ? "uno parecido" : `${dup.length} parecidos`}. Revisalo antes de crear otro:</p>
            <ul className="border border-borde rounded-lg divide-y divide-borde">
              {dup.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="flex-1 min-w-0">
                    <span className="font-medium">{m.nombre}</span>
                    <span className="block text-[11px] text-texto-tenue">{[m.localidad, m.telefono, m.email].filter(Boolean).join(" · ")} — coincide por {m.motivo}</span>
                  </span>
                  <Boton size="sm" variant="ghost" onClick={() => { onCerrar(); abrir(m.id); }}>Abrir</Boton>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <Boton variant="quiet" onClick={() => setDup(null)}>Volver</Boton>
              <Boton variant="ghost" disabled={guardando} onClick={() => guardar(true)}>Es otro: crear igual</Boton>
            </div>
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-3">
              {campo("nombre", "Nombre del negocio *", { autoFocus: true, maxLength: 120 })}
              {campo("contactoNombre", "Con quién hablar")}
              {lista("rubro", "Rubro", "rubro")}
              {lista("zona", "Zona", "zona")}
              {campo("localidad", "Localidad")}
              {campo("direccion", "Dirección")}
              {campo("telefono", "Teléfono", { inputMode: "tel" })}
              {campo("whatsapp", "WhatsApp", { inputMode: "tel" })}
              {campo("email", "Email", { type: "email" })}
              {campo("instagram", "Instagram")}
              {lista("fuente", "Cómo lo conociste", "fuente")}
              <label className="block text-xs text-texto-suave">Interés
                <select value={d.interes} onChange={set("interes")} className={`${inputCls} mt-1`}>
                  <option value="">—</option>
                  {Object.entries(INTERES).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                </select>
              </label>
            </div>
            <label className="block text-xs text-texto-suave">Notas
              <textarea value={d.notas} onChange={set("notas")} rows={2} className={`${inputCls} mt-1`} />
            </label>
            <button type="button" onClick={() => setMas(!mas)} className="text-sm font-semibold text-acento hover:underline">
              {mas ? "Menos datos" : "Más datos: sistema actual, problemas, tamaño, presupuesto…"}
            </button>
            {mas && (
              <div className="grid sm:grid-cols-2 gap-3">
                {campo("razonSocial", "Razón social")}
                {campo("subrubro", "Subrubro")}
                {campo("sucursales", "Sucursales", { inputMode: "numeric" })}
                {campo("usuarios", "Usuarios aproximados", { inputMode: "numeric" })}
                {campo("web", "Sitio web")}
                {campo("sistemaActual", "Sistema que usa hoy")}
                {campo("competidor", "Competidor mencionado")}
                {campo("presupuesto", "Presupuesto estimado", { inputMode: "numeric" })}
                {campo("campania", "Campaña")}
                <label className="block text-xs text-texto-suave">Tamaño
                  <select value={d.tamano || ""} onChange={set("tamano")} className={`${inputCls} mt-1`}>
                    <option value="">—</option><option value="chico">Chico</option><option value="mediano">Mediano</option><option value="grande">Grande</option>
                  </select>
                </label>
                {campo("modulos", "Módulos que le pueden interesar (separados por coma)")}
                {campo("etiquetas", "Etiquetas (separadas por coma)")}
                <label className="block text-xs text-texto-suave sm:col-span-2">Problemas que tiene
                  <textarea value={d.problemas || ""} onChange={set("problemas")} rows={2} className={`${inputCls} mt-1`} />
                </label>
                <label className="block text-xs text-texto-suave sm:col-span-2">Objeciones
                  <textarea value={d.objeciones || ""} onChange={set("objeciones")} rows={2} className={`${inputCls} mt-1`} />
                </label>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Boton variant="quiet" onClick={onCerrar}>Cancelar</Boton>
              <Boton disabled={guardando || !d.nombre.trim()} onClick={() => guardar(false)}>{guardando ? "Guardando…" : "Guardar"}</Boton>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
