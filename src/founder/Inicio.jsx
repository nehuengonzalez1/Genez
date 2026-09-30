/* ============================================================
   GENEZ FOUNDER · Inicio
   ============================================================

   En menos de un minuto: qué hay que hacer hoy y qué está trabando.
   Mi día (la agenda de hoy, las tareas de hoy y las vencidas, los
   seguimientos que se vencieron, las oportunidades sin próximo paso),
   el resumen comercial, lo último que pasó, y los indicadores del
   período. Todo sale de los registros: nada se estima ni se completa
   para que se vea lleno. Cada número abre lo que lo forma.

   Arriba de todo, los objetivos en curso contra lo real (0117): el
   avance lo calcula la base, y los que vencen pronto se marcan.
   ============================================================ */

import React, { useEffect, useState } from "react";
import { UserPlus, ListPlus, CalendarPlus } from "lucide-react";
import { Card, Cargando, ErrorEstado, Boton, Tabs } from "../ui/Base.jsx";
import { money } from "../utils/helpers.js";
import { cargarProspectos, cargarOportunidadesAbiertas, cargarTareas, cargarEventos, actividadReciente, actividadesDesde, guardarTarea } from "../datos/internoCrm.js";
import { contarSolicitudes } from "../datos/interno.js";
import { cargarClientes, cargarTickets, abierto, ESTADO_TICKET } from "../datos/internoClientes.js";
import { motivosDeAtencion } from "./Clientes.jsx";
import { cargarObjetivos, METRICA } from "../datos/internoMarketing.js";
import { situacion } from "./Objetivos.jsx";
import { useConfig, diaLargo, hora, relativo, fechaHora, diaAR, hoyAR, vencido } from "./util.js";

const CONTACTO = new Set(["llamada", "whatsapp", "email", "visita", "reunion", "demo", "propuesta"]);

function desdeDe(periodo) {
  const d = new Date(`${hoyAR()}T00:00:00-03:00`);
  if (periodo === "semana") { const dow = (new Date(`${hoyAR()}T12:00:00-03:00`).getUTCDay() + 6) % 7; return new Date(d.getTime() - dow * 86400000); }
  if (periodo === "mes") return new Date(`${hoyAR().slice(0, 8)}01T00:00:00-03:00`);
  return new Date(d.getTime() - 29 * 86400000);
}

export function InicioFounder({ sesion, ir, abrir, abrirCliente, toast, nuevo }) {
  const { cfg, nombre } = useConfig();
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [periodo, setPeriodo] = useState("semana");

  const leer = () => {
    const hoy0 = new Date(`${hoyAR()}T00:00:00-03:00`);
    return Promise.all([
      /* Cada área puede faltarle a un miembro: sin acceso, esa parte
         viene vacía y el resto del inicio se ve igual. */
      cargarProspectos().catch(() => []), cargarOportunidadesAbiertas().catch(() => []), cargarTareas().catch(() => []),
      cargarEventos(hoy0, new Date(hoy0.getTime() + 8 * 86400000)).catch(() => []),
      actividadReciente(8).catch(() => []), actividadesDesde(new Date(hoy0.getTime() - 40 * 86400000)).catch(() => []), contarSolicitudes(),
      cargarClientes().catch(() => null), cargarTickets().catch(() => null), cargarObjetivos().catch(() => null),
    ]).then(([prospectos, ops, tareas, eventos, recientes, actividades, solicitudes, clientes, tickets, objetivos]) =>
      setD({ prospectos, ops, tareas, eventos, recientes, actividades, solicitudes, clientes, tickets, objetivos }))
      .catch((e) => setError(e.message || "No se pudo leer Founder."));
  };
  useEffect(() => { leer(); }, []);

  const nombreCorto = String(sesion.nombre || "").split(" ")[0];
  if (error) return <Card><ErrorEstado onReintentar={() => { setError(""); leer(); }}>{error}</ErrorEstado></Card>;
  if (!d || !cfg) return <Card><Cargando /></Card>;

  const hoy = hoyAR();
  const eventosHoy = d.eventos.filter((e) => diaAR(e.inicio) === hoy && e.estado !== "cancelado");
  const proximos = d.eventos.filter((e) => diaAR(e.inicio) > hoy && e.estado === "programado").slice(0, 5);
  const tareasHoy = d.tareas.filter((t) => t.vence && diaAR(t.vence) === hoy);
  const tareasVencidas = d.tareas.filter((t) => t.vence && vencido(t.vence));
  const segVencidos = d.prospectos.filter((p) => p.proximoContacto && vencido(p.proximoContacto) && (!p.oportunidadEstado || p.oportunidadEstado === "abierta"));
  const abiertas = d.ops.filter((o) => o.estado === "abierta");
  const sinPaso = abiertas.filter((o) => !o.fechaSeguimiento && !(o.prospecto && o.prospecto.proximoContacto));

  const desde = desdeDe(periodo);
  const enPeriodo = (f) => f && f >= desde;
  const acts = d.actividades.filter((a) => enPeriodo(a.fecha));
  const etapaNombre = (id) => (cfg.etapas.find((e) => e.id === id) || {}).nombre;
  const indicadores = [
    { n: "Prospectos nuevos", v: d.prospectos.filter((p) => enPeriodo(p.creadoEn)).length, ir: "prospectos" },
    { n: "Contactos hechos", v: acts.filter((a) => CONTACTO.has(a.tipo)).length, ir: "prospectos" },
    { n: "Demos hechas", v: acts.filter((a) => a.tipo === "demo").length, ir: "agenda" },
    { n: "Propuestas enviadas", v: acts.filter((a) => a.tipo === "propuesta" || (a.tipo === "cambio_etapa" && /propuesta/i.test((a.datos && a.datos.a_nombre) || ""))).length, ir: "pipeline" },
    { n: "Ventas cerradas", v: d.ops.filter((o) => o.estado === "ganada" && enPeriodo(o.ganadaEn)).length, ir: "pipeline" },
    { n: "Recurrente contratado", v: money(Math.round(d.ops.filter((o) => o.estado === "ganada" && enPeriodo(o.ganadaEn)).reduce((s, o) => s + Number(o.valor || 0), 0))), sub: "por mes, de lo ganado", ir: "pipeline" },
  ];
  /* El embudo: cuántas oportunidades abiertas o ganadas están en cada
     etapa o más adelante. Es la foto de hoy, no la historia del período. */
  const orden = (o) => (cfg.etapas.find((e) => e.id === o.etapaId) || {}).orden || 0;
  const vivas = d.ops.filter((o) => o.estado === "abierta" || o.estado === "ganada");
  const embudo = cfg.etapas.filter((e) => e.tipo === "abierta" || e.tipo === "ganada").map((e) => ({ ...e, n: vivas.filter((o) => orden(o) >= e.orden).length }));
  const tope = Math.max(1, ...embudo.map((e) => e.n));

  const Lista = ({ titulo, items, vacio, tono = "", render }) => (
    <div>
      <h3 className={`text-[11px] uppercase tracking-widest font-bold mb-1.5 ${tono || "text-texto-tenue"}`}>{titulo} <span className="f-m">{items.length || ""}</span></h3>
      {items.length === 0 ? <p className="text-sm text-texto-tenue">{vacio}</p> : <ul className="space-y-1">{items.slice(0, 6).map(render)}</ul>}
    </div>
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-texto-tenue first-letter:uppercase">{diaLargo(new Date())}</p>
          <h1 className="f-d text-3xl mt-1">Hola, {nombreCorto}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Boton onClick={() => nuevo("prospecto")}><UserPlus size={14} /> Prospecto</Boton>
          <Boton variant="ghost" onClick={() => nuevo("tarea")}><ListPlus size={14} /> Tarea</Boton>
          <Boton variant="ghost" onClick={() => nuevo("evento")}><CalendarPlus size={14} /> Reunión</Boton>
        </div>
      </header>

      {d.objetivos && (() => {
        /* Los que están en curso hoy; los semanales de un plan, solo el de esta semana. */
        const vivos = d.objetivos.filter((o) => o.estado === "activo" && o.inicio <= hoy && o.limite >= hoy);
        if (!vivos.length) return null;
        return (
          <Card className="p-5">
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <h2 className="f-d text-lg"><button onClick={() => ir("objetivos")} className="hover:text-acento">Objetivos</button></h2>
              <span className="text-[11px] text-texto-tenue">lo real contra la meta</span>
            </div>
            <ul className="grid md:grid-cols-2 gap-x-6 gap-y-2">
              {vivos.slice(0, 8).map((o) => {
                const s = situacion(o, hoy);
                const p = o.valorActual == null ? 0 : Math.min(100, (o.valorActual / o.valorObjetivo) * 100);
                const cifra = (v) => (v == null ? "—" : METRICA[o.metrica].plata ? money(Math.round(v)) : Number(v).toLocaleString("es-AR"));
                return (
                  <li key={o.id} className="text-sm">
                    <div className="flex justify-between gap-2"><span className="truncate">{o.nombre}</span><span className={`text-[11px] shrink-0 ${s.tono}`}>{s.t}</span></div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="flex-1 h-1.5 rounded bg-superficie-2 overflow-hidden"><span className={`block h-full ${p >= 100 ? "bg-bien" : "bg-acento"}`} style={{ width: `${p}%` }} /></span>
                      <span className="f-m text-[11px]">{cifra(o.valorActual)} / {cifra(o.valorObjetivo)}{o.metrica === "manual" ? " (manual)" : ""}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })()}

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2 space-y-5">
          <h2 className="f-d text-lg">Mi día</h2>
          <div className="grid sm:grid-cols-2 gap-5">
            <Lista titulo="Agenda de hoy" items={eventosHoy} vacio="Nada agendado hoy." render={(e) => (
              <li key={e.id} className="text-sm flex gap-2">
                <span className="f-m text-texto-tenue w-11 shrink-0">{hora(e.inicio)}</span>
                <button onClick={() => ir("agenda")} className={`text-left truncate ${e.estado === "programado" && e.fin < new Date() ? "text-ojo" : ""}`}>{e.titulo}</button>
              </li>
            )} />
            <Lista titulo="Tareas de hoy" items={tareasHoy} vacio="Ninguna para hoy." render={(t) => (
              <li key={t.id} className="text-sm flex items-center gap-2">
                <input type="checkbox" aria-label="Completar" className="accent-acento" onChange={async () => {
                  try { await guardarTarea({ id: t.id, estado: "completada" }); toast("Completada."); leer(); } catch (e) { toast(e.message, "mal"); }
                }} />
                <button onClick={() => ir("tareas")} className="text-left truncate">{t.titulo}</button>
              </li>
            )} />
            <Lista titulo="Tareas vencidas" tono="text-mal" items={tareasVencidas} vacio="Nada vencido." render={(t) => (
              <li key={t.id} className="text-sm flex justify-between gap-2"><button onClick={() => ir("tareas")} className="text-left truncate">{t.titulo}</button><span className="text-[11px] text-mal shrink-0">{relativo(t.vence)}</span></li>
            )} />
            <Lista titulo="Seguimientos vencidos" tono="text-mal" items={segVencidos} vacio="Todos al día." render={(p) => (
              <li key={p.id} className="text-sm flex justify-between gap-2"><button onClick={() => abrir(p.id)} className="text-left truncate">{p.nombre}</button><span className="text-[11px] text-mal shrink-0">{relativo(p.proximoContacto)}</span></li>
            )} />
          </div>
          {sinPaso.length > 0 && (
            <div className="border-t border-borde pt-4">
              <Lista titulo="Oportunidades sin próximo paso" tono="text-ojo" items={sinPaso} vacio="" render={(o) => (
                <li key={o.id} className="text-sm flex justify-between gap-2">
                  <button onClick={() => abrir(o.prospectoId)} className="text-left truncate">{o.prospecto ? o.prospecto.nombre : o.nombre}</button>
                  <span className="text-[11px] text-texto-tenue shrink-0">{etapaNombre(o.etapaId)}</span>
                </li>
              )} />
            </div>
          )}
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="f-d text-lg">Lo comercial</h2>
          <dl className="space-y-2 text-sm">
            {[["Prospectos en seguimiento", d.prospectos.filter((p) => !p.oportunidadEstado || p.oportunidadEstado === "abierta").length, "prospectos"], ["Oportunidades abiertas", abiertas.length, "pipeline"],
              ["Demos agendadas", abiertas.filter((o) => /demo agendada/i.test(etapaNombre(o.etapaId) || "")).length, "pipeline"],
              ["Propuestas pendientes", abiertas.filter((o) => /propuesta/i.test(etapaNombre(o.etapaId) || "")).length, "pipeline"],
              ["Clientes ganados", d.ops.filter((o) => o.estado === "ganada").length, "pipeline"],
              ["Pedidos desde la web", d.solicitudes == null ? "—" : d.solicitudes, null]].map(([n, v, a]) => (
              <div key={n} className="flex items-baseline justify-between gap-3 border-b border-borde pb-1.5">
                <dt className="text-texto-suave">{a ? <button onClick={() => ir(a)} className="hover:text-texto">{n}</button> : n}</dt><dd className="f-m">{v}</dd>
              </div>
            ))}
          </dl>
          <div>
            <h3 className="text-[11px] uppercase tracking-widest font-bold text-texto-tenue mb-1.5">Próximos días</h3>
            {proximos.length === 0 ? <p className="text-sm text-texto-tenue">Nada agendado.</p> : (
              <ul className="space-y-1">{proximos.map((e) => <li key={e.id} className="text-sm flex gap-2"><span className="f-m text-texto-tenue text-xs w-24 shrink-0">{fechaHora(e.inicio)}</span><span className="truncate">{e.titulo}</span></li>)}</ul>
            )}
          </div>
        </Card>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="f-d text-lg">Indicadores</h2>
          <Tabs value={periodo} onChange={setPeriodo} items={[{ k: "semana", n: "Esta semana" }, { k: "mes", n: "Este mes" }, { k: "30", n: "30 días" }]} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {indicadores.map((i) => (
            <button key={i.n} onClick={() => ir(i.ir)} className="text-left rounded-lg border border-borde p-3 hover:bg-superficie-2">
              <div className="text-[11px] text-texto-tenue">{i.n}</div>
              <div className="f-d f-m text-2xl mt-1">{i.v}</div>
              {i.sub && <div className="text-[10px] text-texto-tenue">{i.sub}</div>}
            </button>
          ))}
        </div>
        <div>
          <h3 className="text-[11px] uppercase tracking-widest font-bold text-texto-tenue mb-2">El embudo hoy <span className="normal-case tracking-normal font-normal">· oportunidades que llegaron al menos hasta cada etapa</span></h3>
          <ul className="space-y-1">
            {embudo.map((e, i) => (
              <li key={e.id} className="flex items-center gap-3 text-xs">
                <span className="w-36 shrink-0 text-texto-suave truncate">{e.nombre}</span>
                <span className="flex-1 h-2 rounded bg-superficie-2 overflow-hidden"><span className="block h-full bg-acento" style={{ width: `${(e.n / tope) * 100}%` }} /></span>
                <span className="f-m w-8 text-right">{e.n}</span>
                <span className="f-m w-12 text-right text-texto-tenue">{i > 0 && embudo[i - 1].n ? `${Math.round((e.n / embudo[i - 1].n) * 100)}%` : ""}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      {(d.clientes || d.tickets) && (() => {
        /* null = sin acceso a esa área: la parte no se muestra, en vez de un cero que miente. */
        const atencion = (d.clientes || []).map((c) => ({ ...c, motivos: motivosDeAtencion(c) })).filter((c) => c.motivos.length);
        const vigentes = (d.clientes || []).filter((c) => ["implementacion", "activo", "en_riesgo"].includes(c.estado));
        const abiertos = (d.tickets || []).filter(abierto);
        return (
          <Card className="p-5 grid md:grid-cols-3 gap-5">
            {d.clientes && (
              <div className="md:col-span-2">
                <div className="flex items-baseline justify-between gap-3 mb-2">
                  <h2 className="f-d text-lg"><button onClick={() => ir("clientes")} className="hover:text-acento">Clientes</button></h2>
                  <span className="text-sm text-texto-suave"><span className="f-m">{vigentes.length}</span> {vigentes.length === 1 ? "vigente" : "vigentes"} · <span className="f-m">{money(Math.round(vigentes.reduce((x, c) => x + Number(c.importeMensual || 0), 0)))}</span>/mes acordado</span>
                </div>
                {atencion.length === 0 ? <p className="text-sm text-texto-tenue">{d.clientes.length ? "Ninguno requiere atención." : "Todavía no hay clientes."}</p> : (
                  <ul className="space-y-1">
                    {atencion.slice(0, 5).map((c) => (
                      <li key={c.id} className="text-sm flex flex-wrap gap-x-2">
                        <button onClick={() => abrirCliente(c.id)} className="font-medium hover:text-acento">{c.nombre}</button>
                        <span className="text-mal text-[12px]">{c.motivos.join(" · ")}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {d.tickets && (
              <div>
                <h2 className="f-d text-lg mb-2"><button onClick={() => ir("soporte")} className="hover:text-acento">Soporte</button> <span className="f-m text-sm text-texto-suave">{abiertos.length} {abiertos.length === 1 ? "abierto" : "abiertos"}</span></h2>
                {abiertos.length === 0 ? <p className="text-sm text-texto-tenue">Nada abierto.</p> : (
                  <ul className="space-y-1">
                    {abiertos.slice(0, 4).map((t) => (
                      <li key={t.id} className="text-sm flex gap-2"><span className="f-m text-xs text-texto-tenue">#{t.numero}</span><span className="truncate flex-1">{t.titulo}</span><span className="text-[11px] text-texto-tenue shrink-0">{ESTADO_TICKET[t.estado]}</span></li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Card>
        );
      })()}

      <Card className="p-5">
        <h2 className="f-d text-lg mb-3">Lo último</h2>
        {d.recientes.length === 0 ? <p className="text-sm text-texto-tenue">Todavía no hay actividad registrada.</p> : (
          <ul className="divide-y divide-borde">
            {d.recientes.map((a) => (
              <li key={a.id} className="flex items-baseline gap-3 py-2 text-sm">
                <span className="f-m text-[11px] text-texto-tenue w-24 shrink-0">{fechaHora(a.fecha)}</span>
                <button onClick={() => abrir(a.prospectoId)} className="font-medium shrink-0">{a.prospectoNombre}</button>
                <span className="text-texto-suave truncate">{a.tipo === "cambio_etapa" ? a.resultado : `${nombre("tipo_actividad", a.tipo)}${a.resultado ? ` · ${a.resultado}` : ""}`}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
