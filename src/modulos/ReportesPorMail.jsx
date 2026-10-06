/* ============================================================
   INFORMES · POR MAIL (0136)
   ============================================================

   Programar el resumen que llega solo: cada mañana lo de ayer, los lunes
   la semana, el 1 el mes. Con ventas, ganancia y tickets contra el
   período anterior, lo más vendido, lo que está sin stock, y si se
   quiere un reporte guardado de "Mi reporte".

   Lo manda el cron diario del servidor a eso de las 9 (api/_reportes.js).
   No hay hora para elegir: el plan de Vercel corre el cron una vez por
   día. "Mandarme uno ahora" llega solo a tu mail, para ver cómo queda.
   ============================================================ */

import React, { useEffect, useState, useCallback } from "react";
import { Mail, Plus } from "lucide-react";
import { Card, Boton, Vacio, Cargando, Sello } from "../ui/Base.jsx";
import { FRECUENCIAS, nombreFrecuencia, leerDirecciones, cargarProgramados, crearProgramado, cambiarProgramado, borrarProgramado, mandarmeUno, miMail } from "../datos/reportesPorMail.js";
import { cargarGuardados } from "../datos/reportesAMedida.js";

const campoCls = "w-full border border-borde rounded-md px-3 py-2 text-sm bg-superficie outline-none focus:border-acento";
const cuando = (d) => d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

export function ReportesPorMail({ empresaId, puedeConfigurar }) {
  const [lista, setLista] = useState(null);
  const [guardados, setGuardados] = useState([]);
  const [editando, setEditando] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [error, setError] = useState(null);
  const [probando, setProbando] = useState(false);

  const leer = useCallback(() => {
    cargarProgramados(empresaId).then(setLista).catch((e) => setError(e.message || "No se pudieron leer."));
    cargarGuardados(empresaId).then(setGuardados).catch(() => setGuardados([]));
  }, [empresaId]);
  useEffect(() => { leer(); }, [leer]);

  const decir = (texto, tono = "bien") => { setAviso({ texto, tono }); setTimeout(() => setAviso(null), 5000); };

  const nuevo = async () => setEditando({ frecuencia: "semanal", para: await miMail(), reporteId: "" });
  const alternar = async (p) => {
    try { await cambiarProgramado(p.id, { activo: !p.activo }); leer(); }
    catch (e) { decir(e.message, "mal"); }
  };
  const borrar = async (p) => {
    if (!window.confirm(`¿Dejar de mandar el reporte ${nombreFrecuencia(p.frecuencia).toLowerCase()} a ${p.para.join(", ")}?`)) return;
    try { await borrarProgramado(p.id); decir("Listo, no se manda más."); leer(); }
    catch (e) { decir(e.message, "mal"); }
  };
  const probar = async (frecuencia, reporteId) => {
    setProbando(true);
    try { const r = await mandarmeUno({ frecuencia, reporteId }); decir(`Te lo mandamos a ${r.para}. Puede tardar un minuto; mirá también en spam.`); }
    catch (e) { decir(e.message, "mal"); }
    finally { setProbando(false); }
  };

  if (error) return <Card className="p-5"><p className="text-sm text-mal">{error}</p></Card>;
  if (!lista) return <Cargando />;

  const nombreReporte = (id) => (guardados.find((g) => g.id === id) || {}).nombre;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-borde flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="f-d">Reportes por mail</h3>
            <p className="text-xs text-texto-suave">Te llega solo, a eso de las 9: ventas, ganancia y tickets contra el período anterior, lo más vendido y lo que está sin stock.</p>
          </div>
          <div className="flex gap-2">
            <Boton size="sm" variant="ghost" onClick={() => probar("semanal", "")} disabled={probando}><Mail size={14} /> {probando ? "Mandando…" : "Mandarme uno ahora"}</Boton>
            {puedeConfigurar && <Boton size="sm" onClick={nuevo}><Plus size={14} /> Programar</Boton>}
          </div>
        </div>
        {aviso && <p className={`px-4 py-2 text-xs border-b border-borde ${aviso.tono === "mal" ? "text-mal" : "text-bien"}`}>{aviso.texto}</p>}
        {lista.length === 0 ? (
          <Vacio>{puedeConfigurar ? "Todavía no programaste ninguno." : "No hay reportes programados. Los programa quien configura el comercio."}</Vacio>
        ) : (
          <ul className="divide-y divide-borde">
            {lista.map((p) => (
              <li key={p.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium flex items-center gap-2">
                    {nombreFrecuencia(p.frecuencia)}
                    {!p.activo && <Sello>pausado</Sello>}
                    {p.ultimoError && <Sello tono="mal">no salió</Sello>}
                  </div>
                  <div className="text-xs text-texto-suave truncate">
                    A {p.para.join(", ")}{p.reporteId && nombreReporte(p.reporteId) ? ` · con "${nombreReporte(p.reporteId)}"` : ""}
                  </div>
                  <div className="text-[11px] text-texto-tenue">
                    {p.ultimoError ? `El último intento falló: ${p.ultimoError}. Se vuelve a probar mañana.`
                      : p.ultimoEnvio ? `Último envío: ${cuando(p.ultimoEnvio)}` : "Todavía no se mandó: sale en el próximo envío de la mañana."}
                  </div>
                </div>
                <Boton size="sm" variant="quiet" onClick={() => probar(p.frecuencia, p.reporteId)} disabled={probando}>Probar</Boton>
                {puedeConfigurar && (
                  <>
                    <Boton size="sm" variant="quiet" onClick={() => setEditando({ ...p, para: p.para.join(", ") })}>Cambiar</Boton>
                    <Boton size="sm" variant="quiet" onClick={() => alternar(p)}>{p.activo ? "Pausar" : "Reanudar"}</Boton>
                    <Boton size="sm" variant="quiet" onClick={() => borrar(p)}>Borrar</Boton>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="text-[11px] text-texto-tenue">
        Un día sin ventas no manda un mail en cero. "Probar" y "Mandarme uno ahora" te llegan solo a vos, con el último período cerrado.
      </p>

      {editando && (
        <Programacion empresaId={empresaId} inicial={editando} guardados={guardados}
          onCerrar={() => setEditando(null)} onHecho={(t) => { setEditando(null); decir(t); leer(); }} />
      )}
    </div>
  );
}

function Programacion({ empresaId, inicial, guardados, onCerrar, onHecho }) {
  const [d, setD] = useState(inicial);
  const [falla, setFalla] = useState(null);
  const [guardando, setGuardando] = useState(false);
  /* Sin <form>: Boton no tiene type, y adentro de uno "Cancelar" también
     lo mandaba. */
  const guardar = async () => {
    const dir = leerDirecciones(d.para);
    if (dir.error) { setFalla(dir.error); return; }
    setGuardando(true); setFalla(null);
    try {
      if (d.id) await cambiarProgramado(d.id, { frecuencia: d.frecuencia, para: dir.lista, reporteId: d.reporteId });
      else await crearProgramado(empresaId, { frecuencia: d.frecuencia, para: dir.lista, reporteId: d.reporteId });
      onHecho(d.id ? "Guardado." : "Programado. El primero sale en el próximo envío de la mañana.");
    } catch (err) { setFalla(err.message); setGuardando(false); }
  };
  return (
    <Card className="p-4">
      <div className="space-y-3">
        <h3 className="f-d">{d.id ? "Cambiar el reporte" : "Programar un reporte"}</h3>
        <div className="grid sm:grid-cols-3 gap-2">
          {FRECUENCIAS.map((f) => (
            <label key={f.k} className={`border rounded-lg px-3 py-2 cursor-pointer ${d.frecuencia === f.k ? "border-acento bg-superficie-2" : "border-borde"}`}>
              <input type="radio" name="frecuencia" value={f.k} checked={d.frecuencia === f.k} onChange={() => setD({ ...d, frecuencia: f.k })} className="sr-only" />
              <span className="block text-sm font-medium">{f.n}</span>
              <span className="block text-xs text-texto-suave">{f.d}</span>
            </label>
          ))}
        </div>
        <label className="block text-sm">
          <span className="block text-xs text-texto-suave mb-1">A quién (hasta cinco, separados por coma)</span>
          <input value={d.para} onChange={(e) => setD({ ...d, para: e.target.value })} placeholder="vos@tucomercio.com, contador@estudio.com" className={campoCls} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs text-texto-suave mb-1">Sumar un reporte guardado (opcional)</span>
          <select value={d.reporteId} onChange={(e) => setD({ ...d, reporteId: e.target.value })} className={campoCls}>
            <option value="">No, solo el resumen</option>
            {guardados.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
          {!guardados.length && <span className="block text-[11px] text-texto-tenue mt-1">Se guardan desde "Mi reporte".</span>}
        </label>
        {falla && <p className="text-xs text-mal">{falla}</p>}
        <div className="flex justify-end gap-2">
          <Boton variant="quiet" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : d.id ? "Guardar" : "Programar"}</Boton>
        </div>
      </div>
    </Card>
  );
}
