/* ============================================================
   GENEZ FOUNDER · el prospector
   ============================================================

   Buscar comercios por rubro y zona en fuentes que permiten usar sus
   datos (hoy, OpenStreetMap), revisarlos y pasar al CRM los que valgan,
   sin duplicar. Cada dato dice de dónde vino, cuándo y que no está
   verificado: un teléfono de OpenStreetMap lo cargó un voluntario.

   Encontrar un comercio no es permiso para escribirle: el prospector es
   para saber a quién visitar o llamar. WhatsApp es para quien escribe
   primero o dio su consentimiento (ver la auditoría de la extensión).

   Duplicados: se sugieren contra todo el CRM (activos y archivados), y
   nunca se vincula solo. Lo "seguro" (mismo teléfono, mail o nombre) no
   entra en el paso masivo: se decide uno por uno.
   ============================================================ */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, Map as Mapa, List, ExternalLink, X } from "lucide-react";
import { Card, Boton, Tabs, Cargando, ErrorEstado, Vacio, Modal } from "../ui/Base.jsx";
import { PedidosWeb } from "./PedidosWeb.jsx";
import { inputCls } from "../ui/Campos.jsx";
import { cargarBusquedas, buscarEnProveedor, cargarHallazgos, incorporarHallazgo, descartarHallazgo, recuperarHallazgo, cargarProveedores } from "../datos/internoProspector.js";
import { cargarProspectos } from "../datos/internoCrm.js";
import { RUBROS_OSM, ATRIBUCION } from "../utils/proveedores/osm.js";
import { duplicadoDe } from "../utils/importarProspectos.js";
import { useConfig, fechaHora, relativo } from "./util.js";

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const osmUrl = (id) => `https://www.openstreetmap.org/${id}`;

export function Prospector({ abrir, toast }) {
  const { cfg, de, nombre } = useConfig();
  const [pestana, setPestana] = useState("buscar");
  const [hallazgos, setHallazgos] = useState(null);
  const [prospectos, setProspectos] = useState([]);
  const [busquedas, setBusquedas] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [error, setError] = useState("");
  const [deBusqueda, setDeBusqueda] = useState(null);
  const leer = () => Promise.all([cargarHallazgos(), cargarProspectos(), cargarProspectos({ archivados: true }), cargarBusquedas(), cargarProveedores()])
    .then(([h, p, pa, b, pv]) => { setHallazgos(h); setProspectos([...new Map([...p, ...pa].map((x) => [x.id, x])).values()]); setBusquedas(b); setProveedores(pv); })
    .catch((e) => setError(e.message));
  useEffect(() => { leer(); }, []);

  if (error) return <Card><ErrorEstado onReintentar={() => { setError(""); leer(); }}>{error}</ErrorEstado></Card>;
  if (!hallazgos || !cfg) return <Card><Cargando /></Card>;
  const osmProv = proveedores.find((p) => p.clave === "osm");

  return (
    <div className="space-y-4">
      <header>
        <h1 className="f-d text-3xl">Prospector</h1>
        <p className="text-sm text-texto-suave mt-1">Comercios de fuentes que permiten usar sus datos. Encontrar un teléfono no es permiso para escribir con fines comerciales: es para saber a quién visitar.</p>
      </header>
      <Tabs value={pestana} onChange={setPestana} items={[{ k: "buscar", n: "Buscar" }, { k: "historial", n: "Búsquedas", badge: busquedas.filter((b) => b.error).length ? "!" : null }, { k: "web", n: "Pedidos de la web" }, { k: "fuentes", n: "Fuentes" }]} />
      {pestana === "buscar" && (
        <>
          <Buscador de={de} activo={!!(osmProv && osmProv.activo)} toast={toast} onListo={(id) => { setDeBusqueda(id); leer(); }} />
          <Resultados hallazgos={hallazgos} prospectos={prospectos} deBusqueda={deBusqueda} setDeBusqueda={setDeBusqueda} busquedas={busquedas}
            nombre={nombre} abrir={abrir} toast={toast} leer={leer} />
        </>
      )}
      {pestana === "historial" && <Historial busquedas={busquedas} nombre={nombre} ver={(id) => { setDeBusqueda(id); setPestana("buscar"); }} />}
      {pestana === "web" && <PedidosWeb abrir={abrir} toast={toast} />}
      {pestana === "fuentes" && <Fuentes proveedores={proveedores} />}
      <p className="text-[11px] text-texto-tenue">Datos de mapas: {ATRIBUCION}.</p>
    </div>
  );
}

/* ---------- Buscar ---------- */
function Buscador({ de, activo, toast, onListo }) {
  const zonas = de("zona").filter((z) => z.datos && isFinite(z.datos.lat));
  const [zona, setZona] = useState(zonas[0] ? zonas[0].clave : "");
  const [radio, setRadio] = useState(zonas[0] ? zonas[0].datos.radio || 1500 : 1500);
  const [rubros, setRubros] = useState(["almacen"]);
  const [subrubros, setSubrubros] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const z = zonas.find((x) => x.clave === zona);
  const posibles = rubros.flatMap((r) => Object.values(RUBROS_OSM[r].etiquetas).flat());
  const alternar = (arr, set, v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const buscar = async () => {
    if (!z) return toast("Elegí la zona.", "mal");
    if (!rubros.length) return toast("Elegí al menos un rubro.", "mal");
    setBuscando(true);
    try {
      const r = await buscarEnProveedor("osm", { rubros, subrubros: subrubros.filter((s) => posibles.includes(s)), centro: { lat: z.datos.lat, lng: z.datos.lng }, radio: Number(radio) }, z.clave);
      toast(r.total ? `${r.total} ${r.total === 1 ? "comercio encontrado" : "comercios encontrados"}.` : "No hay comercios cargados con esos filtros en esa zona.");
      onListo(r.busqueda);
    } catch (e) { toast(e.message, "mal"); onListo(null); }
    setBuscando(false);
  };
  if (!activo) return <Card className="p-4 text-sm text-texto-suave">OpenStreetMap está desactivado en Fuentes.</Card>;
  if (!zonas.length) return <Card className="p-4 text-sm text-texto-suave">Ninguna zona tiene su centro cargado.</Card>;
  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label><span className="block text-xs text-texto-suave">Zona</span>
          <select value={zona} onChange={(e) => { setZona(e.target.value); const n = zonas.find((x) => x.clave === e.target.value); if (n && n.datos.radio) setRadio(n.datos.radio); }} className={inputCls}>
            {zonas.map((x) => <option key={x.clave} value={x.clave}>{x.nombre}</option>)}
          </select></label>
        <label><span className="block text-xs text-texto-suave">Radio: <span className="f-m">{(radio / 1000).toLocaleString("es-AR")} km</span></span>
          <input type="range" min={300} max={5000} step={100} value={radio} onChange={(e) => setRadio(Number(e.target.value))} className="w-44 accent-acento mt-2" /></label>
        <Boton onClick={buscar} disabled={buscando}><Search size={14} /> {buscando ? "Buscando…" : "Buscar en OpenStreetMap"}</Boton>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(RUBROS_OSM).map(([k, r]) => (
          <button key={k} onClick={() => alternar(rubros, setRubros, k)}
            className={`text-xs px-2.5 py-1 rounded-md border ${rubros.includes(k) ? "border-acento bg-acento-suave" : "border-borde text-texto-suave"}`}>{r.n}</button>
        ))}
      </div>
      {posibles.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-texto-suave">Subrubros {subrubros.filter((s) => posibles.includes(s)).length ? `(${subrubros.filter((s) => posibles.includes(s)).length})` : "(todos)"}</summary>
          <div className="flex flex-wrap gap-1 mt-2">
            {posibles.map((s) => (
              <button key={s} onClick={() => alternar(subrubros, setSubrubros, s)}
                className={`f-m text-[11px] px-2 py-0.5 rounded border ${subrubros.includes(s) ? "border-acento bg-acento-suave" : "border-borde text-texto-tenue"}`}>{s}</button>
            ))}
          </div>
        </details>
      )}
      <p className="text-[11px] text-texto-tenue">Busca en el servidor público de OpenStreetMap: pocos comercios tienen teléfono cargado, y los datos pueden estar viejos.</p>
    </Card>
  );
}

/* ---------- Resultados ---------- */
function Resultados({ hallazgos, prospectos, deBusqueda, setDeBusqueda, busquedas, nombre, abrir, toast, leer }) {
  const [vista, setVista] = useState("tabla");
  const [estado, setEstado] = useState("nuevos");
  const [q, setQ] = useState("");
  const [conTel, setConTel] = useState(false);
  const [conWeb, setConWeb] = useState(false);
  const [elegidos, setElegidos] = useState([]);
  const [viendo, setViendo] = useState(null);
  const [trabajando, setTrabajando] = useState(false);

  const filas = useMemo(() => hallazgos.map((h) => ({ ...h, dup: !h.prospectoId && !h.descartadoEn ? duplicadoDe(h, prospectos) : null })), [hallazgos, prospectos]);
  const visibles = filas.filter((h) => (!deBusqueda || h.busquedaId === deBusqueda)
    && (estado === "todos" || (estado === "nuevos" ? !h.prospectoId && !h.descartadoEn : estado === "crm" ? !!h.prospectoId : !!h.descartadoEn))
    && (!conTel || h.telefono || h.whatsapp) && (!conWeb || h.web)
    && (!q.trim() || norm(`${h.nombre} ${h.direccion} ${h.subrubro}`).includes(norm(q))));
  const masivos = visibles.filter((h) => elegidos.includes(h.id) && !h.prospectoId && !h.descartadoEn && !(h.dup && h.dup.seguro));
  const b = deBusqueda && busquedas.find((x) => x.id === deBusqueda);

  const incorporar = async (h, prospectoId = null) => {
    try { await incorporarHallazgo(h.id, prospectoId); toast(prospectoId ? "Vinculado al prospecto." : "Pasó al CRM, sin verificar."); leer(); }
    catch (e) { toast(e.message, "mal"); }
  };
  const pasarElegidos = async () => {
    setTrabajando(true);
    let n = 0;
    for (const h of masivos) { try { await incorporarHallazgo(h.id); n++; } catch (e) { toast(`${h.nombre}: ${e.message}`, "mal"); } }
    toast(`${n} ${n === 1 ? "pasó" : "pasaron"} al CRM.`); setElegidos([]); setTrabajando(false); leer();
  };
  const descartar = async (h) => { try { await descartarHallazgo(h.id, null); leer(); } catch (e) { toast(e.message, "mal"); } };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={estado} onChange={setEstado} items={[{ k: "nuevos", n: "Para revisar" }, { k: "crm", n: "En el CRM" }, { k: "descartados", n: "Descartados" }, { k: "todos", n: "Todos" }]} />
        <div className="relative flex-1 min-w-[10rem]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-tenue" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar" className={`${inputCls} pl-9 mt-0`} /></div>
        <label className="flex items-center gap-1.5 text-sm text-texto-suave"><input type="checkbox" checked={conTel} onChange={(e) => setConTel(e.target.checked)} className="accent-acento" /> Con teléfono</label>
        <label className="flex items-center gap-1.5 text-sm text-texto-suave"><input type="checkbox" checked={conWeb} onChange={(e) => setConWeb(e.target.checked)} className="accent-acento" /> Con web</label>
        <span className="flex border border-borde rounded-md overflow-hidden">
          <button onClick={() => setVista("tabla")} aria-label="Ver en tabla" className={`p-1.5 ${vista === "tabla" ? "bg-superficie-2" : ""}`}><List size={15} /></button>
          <button onClick={() => setVista("mapa")} aria-label="Ver en mapa" className={`p-1.5 ${vista === "mapa" ? "bg-superficie-2" : ""}`}><Mapa size={15} /></button>
        </span>
      </div>
      {b && (
        <p className="text-sm text-texto-suave">
          De la búsqueda del {fechaHora(b.creadoEn)}{b.parametros && b.parametros.zona ? ` en ${nombre("zona", b.parametros.zona)}` : ""}.{" "}
          <button onClick={() => setDeBusqueda(null)} className="underline hover:text-texto">Ver todo lo encontrado</button>
        </p>
      )}
      {masivos.length > 0 && (
        <div className="flex items-center gap-3 text-sm">
          <Boton onClick={pasarElegidos} disabled={trabajando}>{trabajando ? "Pasando…" : `Pasar ${masivos.length} al CRM`}</Boton>
          <span className="text-[11px] text-texto-tenue">Los que ya parecen estar en el CRM no entran acá: se deciden uno por uno.</span>
        </div>
      )}
      {visibles.length === 0 ? <Card><Vacio>{hallazgos.length ? "Nada con estos filtros." : "Todavía no se buscó nada. Elegí una zona y un rubro."}</Vacio></Card>
        : vista === "mapa" ? <MapaHallazgos filas={visibles} ver={setViendo} />
        : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-borde">
            {visibles.map((h) => (
              <li key={h.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm ${h.descartadoEn ? "opacity-50" : ""}`}>
                {!h.prospectoId && !h.descartadoEn && !(h.dup && h.dup.seguro)
                  ? <input type="checkbox" aria-label="Elegir" className="accent-acento" checked={elegidos.includes(h.id)} onChange={() => setElegidos(elegidos.includes(h.id) ? elegidos.filter((x) => x !== h.id) : [...elegidos, h.id])} />
                  : <span className="w-[13px]" />}
                <button onClick={() => setViendo(h)} className="flex-1 min-w-[12rem] text-left">
                  <span className="block">{h.nombre}</span>
                  <span className="block text-[11px] text-texto-tenue">{[h.rubro ? nombre("rubro", h.rubro) : null, h.subrubro, h.direccion, h.telefono && `tel. ${h.telefono}`, h.web && "web"].filter(Boolean).join(" · ")}</span>
                  {h.dup && <span className={`block text-[11px] ${h.dup.seguro ? "text-ojo" : "text-texto-suave"}`}>{h.dup.seguro ? "Ya está en el CRM" : "Puede ser"}: {h.dup.prospecto.nombre} ({h.dup.motivo})</span>}
                </button>
                <span className="flex flex-wrap gap-1">
                  {h.prospectoId && <Boton size="sm" variant="ghost" onClick={() => abrir(h.prospectoId)}>Ver en el CRM</Boton>}
                  {!h.prospectoId && !h.descartadoEn && h.dup && <Boton size="sm" variant="ghost" onClick={() => incorporar(h, h.dup.prospecto.id)}>Vincular</Boton>}
                  {!h.prospectoId && !h.descartadoEn && <Boton size="sm" variant={h.dup ? "quiet" : "ghost"} onClick={() => incorporar(h)}>{h.dup ? "Es otro: crear" : "Al CRM"}</Boton>}
                  {!h.prospectoId && !h.descartadoEn && <button onClick={() => descartar(h)} aria-label="Descartar" title="Descartar" className="p-1.5 text-texto-tenue hover:text-texto"><X size={14} /></button>}
                  {h.descartadoEn && <Boton size="sm" variant="quiet" onClick={async () => { try { await recuperarHallazgo(h.id); leer(); } catch (e) { toast(e.message, "mal"); } }}>Recuperar</Boton>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {viendo && <Vista h={viendo} nombre={nombre} onCerrar={() => setViendo(null)} />}
    </div>
  );
}

/* La vista previa: todo lo que trajo el proveedor, con su origen. */
function Vista({ h, nombre, onCerrar }) {
  const filas = [["Rubro", h.rubro ? nombre("rubro", h.rubro) : null], ["Tipo en OpenStreetMap", h.subrubro], ["Dirección", h.direccion], ["Localidad", h.localidad],
    ["Teléfono", h.telefono], ["WhatsApp", h.whatsapp], ["Email", h.email], ["Instagram", h.instagram], ["Horario", h.horario]].filter(([, v]) => v);
  return (
    <Modal open onClose={onCerrar} ancho="max-w-lg">
      <div className="p-5 space-y-3">
        <div>
          <h3 className="f-d text-xl">{h.nombre}</h3>
          <p className="text-[11px] text-texto-tenue">De OpenStreetMap · traído {fechaHora(h.obtenidoEn)} · visto por última vez {relativo(h.vistoEn)} · <span className="text-ojo">sin verificar</span></p>
        </div>
        <dl className="text-sm space-y-1">
          {filas.map(([k, v]) => <div key={k} className="flex justify-between gap-3 border-b border-borde pb-1"><dt className="text-texto-suave">{k}</dt><dd className="text-right">{v}</dd></div>)}
        </dl>
        {filas.length < 4 && <p className="text-sm text-texto-tenue">OpenStreetMap tiene pocos datos de este comercio.</p>}
        <div className="flex flex-wrap gap-3 text-sm">
          {h.web && <a href={h.web} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-acento">Su web <ExternalLink size={12} /></a>}
          <a href={osmUrl(h.externoId)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-texto-suave hover:text-texto">Ver en OpenStreetMap <ExternalLink size={12} /></a>
        </div>
        <p className="text-[11px] text-texto-tenue">{ATRIBUCION}</p>
        <div className="flex justify-end"><Boton variant="ghost" onClick={onCerrar}>Cerrar</Boton></div>
      </div>
    </Modal>
  );
}

/* El mapa: Leaflet con los mosaicos de OpenStreetMap (uso liviano, con
   atribución, como pide su política). Se carga solo al abrirlo. */
function MapaHallazgos({ filas, ver }) {
  const ref = useRef(null);
  const [error, setError] = useState("");
  const conUbicacion = filas.filter((h) => isFinite(h.lat) && isFinite(h.lng) && h.lat !== null);
  useEffect(() => {
    let mapa = null, vivo = true;
    Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")]).then(([L]) => {
      if (!vivo || !ref.current) return;
      const Lf = L.default || L;
      mapa = Lf.map(ref.current, { scrollWheelZoom: false });
      Lf.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; colaboradores de OpenStreetMap" }).addTo(mapa);
      /* Los colores del tema (index.css), no fijos: el mapa dibuja en SVG
         y no entiende clases, pero sí el valor de cada variable. */
      const tono = (v) => `rgb(${getComputedStyle(ref.current).getPropertyValue(v).trim().split(/s+/).join(",")})`;
      const colores = { crm: tono("--bien"), dup: tono("--ojo"), nuevo: tono("--acento") };
      const puntos = conUbicacion.map((h) => {
        const color = h.prospectoId ? colores.crm : h.dup ? colores.dup : colores.nuevo;
        const m = Lf.circleMarker([h.lat, h.lng], { radius: 7, color, weight: 2, fillOpacity: 0.7 }).addTo(mapa);
        m.bindTooltip(h.nombre);
        m.on("click", () => ver(h));
        return [h.lat, h.lng];
      });
      if (puntos.length) mapa.fitBounds(puntos, { padding: [30, 30], maxZoom: 16 });
      else mapa.setView([-34.59, -58.56], 13);
    }).catch(() => setError("No se pudo cargar el mapa."));
    return () => { vivo = false; if (mapa) mapa.remove(); };
  }, [conUbicacion.map((h) => h.id).join()]);
  if (error) return <Card><ErrorEstado>{error}</ErrorEstado></Card>;
  return (
    <Card className="overflow-hidden">
      <div ref={ref} style={{ height: 460 }} className="w-full" />
      <p className="px-4 py-2 text-[11px] text-texto-tenue border-t border-borde">
        <span className="text-acento">●</span> para revisar · <span className="text-ojo">●</span> puede estar en el CRM · <span className="text-bien">●</span> en el CRM
        {conUbicacion.length < filas.length ? ` · ${filas.length - conUbicacion.length} sin ubicación` : ""}
      </p>
    </Card>
  );
}

/* ---------- Historial ---------- */
function Historial({ busquedas, nombre, ver }) {
  if (!busquedas.length) return <Card><Vacio>Todavía no hay búsquedas.</Vacio></Card>;
  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-borde">
        {busquedas.map((b) => {
          const p = b.parametros || {};
          return (
            <li key={b.id}>
              <button onClick={() => b.proveedor !== "planilla" && ver(b.id)} className="w-full text-left flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm hover:bg-superficie-2">
                <span className="f-m text-[11px] text-texto-tenue w-28">{fechaHora(b.creadoEn)}</span>
                <span className="flex-1 min-w-[12rem]">
                  {b.proveedor === "planilla" ? `Planilla${p.archivo ? `: ${p.archivo}` : ""}`
                    : [p.zona && nombre("zona", p.zona), (p.rubros || []).map((r) => (RUBROS_OSM[r] || { n: r }).n).join(", "), p.radio && `${(p.radio / 1000).toLocaleString("es-AR")} km`].filter(Boolean).join(" · ")}
                </span>
                {b.error ? <span className="text-[11px] text-mal">{b.error}</span>
                  : <span className="f-m text-[11px] text-texto-suave">{b.resultados ?? 0} encontrados · {b.nuevos ?? 0} nuevos</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ---------- Fuentes ---------- */
function Fuentes({ proveedores }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-texto-suave">Las reglas de cada fuente: qué se puede guardar, por cuánto tiempo y cómo se cita. Google Places no está: sus términos solo dejan guardar el identificador del lugar, no el nombre ni el teléfono.</p>
      {proveedores.map((p) => (
        <Card key={p.clave} className="p-4 space-y-1.5 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-medium">{p.nombre}</h3>
            <span className={`text-[11px] ${p.activo ? "text-bien" : "text-texto-tenue"}`}>{p.activo ? "Activa" : "Desactivada"}</span>
          </div>
          {[["Licencia", p.licencia], ["Cómo se cita", p.atribucion], ["Se guarda", (p.camposPermitidos || []).join(", ")], ["Por cuánto tiempo", p.retencionDias ? `${p.retencionDias} días` : "Sin límite del proveedor"],
            ["Costo", p.costo], ["Límites", p.limites], ["Ojo", p.notas]].filter(([, v]) => v).map(([k, v]) => (
            <p key={k}><span className="text-texto-suave">{k}: </span>{v}</p>
          ))}
          {p.terminosUrl && <a href={p.terminosUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] text-acento">Términos <ExternalLink size={11} /></a>}
        </Card>
      ))}
    </div>
  );
}
