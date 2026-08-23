/* ============================================================
   22. COMUNICACIONES · lo que hay que avisar hoy
   ============================================================

   La tarea de todas las tardes: mandar los recordatorios de mañana. Es
   lo que evita la mitad de las ausencias y hoy se hace de memoria,
   mirando la agenda y abriendo WhatsApp a mano uno por uno.

   ES UNA COLA, NO UNA TABLA
   -------------------------
   La lista está ordenada por hora y cada mensaje que se manda desaparece
   de ella. Se trabaja de arriba para abajo hasta que queda vacía, que es
   como se hace de verdad. Una grilla con casillas para tildar obliga a
   llevar la cuenta en la cabeza.

   Se avisa por turno y no por persona: alguien con dos turnos esta
   semana recibe los dos recordatorios, y el que ya recibió el del martes
   sigue apareciendo para el del jueves.

   EL TEXTO SE VE RESUELTO, NO CON LOS HUECOS
   ------------------------------------------
   En la lista se lee el mensaje tal como le va a llegar a la persona, con
   el nombre y la hora puestos. Una plantilla con `{nombre}` a la vista no
   deja ver el error más común, que es que quede mal redactada una vez
   completada.

   UN HUECO QUE NO EXISTE SE DEJA ESCRITO
   --------------------------------------
   Si alguien escribe `{profe}` en vez de `{profesional}`, en la vista
   previa aparece `{profe}` y se corrige solo. Borrarlo en silencio deja
   un mensaje mocho y ninguna pista de por qué.
   ============================================================ */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { MessageCircle, Check, RotateCcw, Clock } from "lucide-react";
import {
  cargarPendientes, cargarPlantillas, guardarPlantilla, restaurarPlantilla,
  anotarAviso, resolver, plantillaPorK, HUECOS,
} from "../datos/comunicaciones.js";
import { cargarContactos, segmentoPorK } from "../datos/crm.js";
import { linkWhatsapp, nf } from "../utils/helpers.js";
import {
  Card, Boton, Tabs, Kpi, Vacio, Cargando, ErrorEstado, Sello, TablaSimple,
} from "../ui/Base.jsx";
import { inputCls } from "../ui/Campos.jsx";

const ROTULO = "text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold";

const VENTANAS = [
  { k: 12, n: "12 horas" },
  { k: 24, n: "24 horas" },
  { k: 48, n: "2 días" },
];

const cuando = (d) =>
  d.toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "2-digit" }) +
  " · " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

export function Comunicaciones({ empresaId, rubro, ajustes, setAjustes, toast }) {
  const [pestana, setPestana] = useState("avisar");
  const [horas, setHoras] = useState(() => Number(ajustes.recordatorioHoras) || 24);
  const [cual, setCual] = useState("recordatorio");

  const [pendientes, setPendientes] = useState([]);
  const [plantillas, setPlantillas] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [editando, setEditando] = useState(null);   // { k, texto }

  const releer = useCallback(async () => {
    const [p, t, h] = await Promise.all([
      cargarPendientes(empresaId, horas),
      cargarPlantillas(empresaId),
      cargarContactos(empresaId, { dias: 60 }),
    ]);
    setPendientes(p);
    setPlantillas(t);
    setHistorial(h);
  }, [empresaId, horas]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError("");
    releer()
      .catch((e) => { if (vigente) setError(e.message || "No pudimos armar la lista."); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [releer]);

  const plantilla = useMemo(
    () => plantillas.find((p) => p.k === cual) || { k: cual, texto: plantillaPorK(cual).texto },
    [plantillas, cual]);

  const sinConfirmar = useMemo(
    () => pendientes.filter((t) => t.estado === "pendiente").length, [pendientes]);
  const avisadosHoy = useMemo(() => {
    const desde = new Date(); desde.setHours(0, 0, 0, 0);
    return historial.filter((h) => h.motivo === "recordatorio" && h.fecha >= desde).length;
  }, [historial]);

  /* La ventana es del comercio y no de la pantalla: quien la cambia lo
     hace una vez y espera encontrarla igual mañana. */
  function cambiarVentana(h) {
    setHoras(h);
    setAjustes({ ...ajustes, recordatorioHoras: h });
  }

  async function avisar(t) {
    const texto = resolver(plantilla.texto, t, ajustes, rubro);
    try {
      await anotarAviso({
        empresaId, clienteId: t.clienteId, reservaId: t.reservaId,
        motivo: "recordatorio", canal: "whatsapp", texto,
      });
      const url = linkWhatsapp(t.tel, texto);
      if (url) window.open(url, "_blank", "noopener");
      else toast("Anotado, pero el teléfono no sirve para WhatsApp.");
      await releer();
    } catch (e) {
      toast(e.message || "No se pudo anotar.");
    }
  }

  async function guardar() {
    try {
      await guardarPlantilla(empresaId, editando.k, editando.texto);
      setEditando(null);
      await releer();
      toast("Plantilla guardada.");
    } catch (e) {
      toast(e.message || "No se pudo guardar.");
    }
  }

  async function restaurar(k) {
    try {
      await restaurarPlantilla(empresaId, k);
      setEditando(null);
      await releer();
      toast("Volvió al texto original.");
    } catch (e) {
      toast(e.message || "No se pudo restaurar.");
    }
  }

  if (error) return <ErrorEstado onReintentar={releer}>{error}</ErrorEstado>;
  if (cargando && !plantillas.length) return <Cargando>Buscando los turnos que vienen…</Cargando>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Kpi label="Turnos por avisar" valor={nf.format(pendientes.length)}
          icono={MessageCircle}
          sub={pendientes.length ? `en las próximas ${horas} horas` : "no queda nadie"} />
        <Kpi label="Sin confirmar" valor={nf.format(sinConfirmar)}
          tono={sinConfirmar ? "ojo" : "neutro"}
          sub="todavía no dijeron que vienen" />
        <Kpi label="Avisados hoy" valor={nf.format(avisadosHoy)} icono={Check} />
      </div>

      <Tabs value={pestana} onChange={setPestana} items={[
        { k: "avisar", n: "Por avisar", badge: pendientes.length },
        { k: "plantillas", n: "Plantillas" },
        { k: "historial", n: "Lo que se mandó", badge: historial.length },
      ]} />

      {pestana === "avisar" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className={ROTULO}><Clock size={12} className="inline mb-0.5 mr-1" />Avisar con</span>
            {VENTANAS.map((v) => (
              <button key={v.k} onClick={() => cambiarVentana(v.k)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  horas === v.k
                    ? "bg-superficie-3 text-texto border-superficie-3"
                    : "bg-superficie border-borde text-texto-suave hover:bg-superficie-2"}`}>
                {v.n}
              </button>
            ))}
            <span className="text-xs text-texto-tenue">de anticipación</span>
          </div>

          {!pendientes.length ? (
            <Card className="p-6">
              <Vacio>
                No queda nadie a quien avisarle en las próximas {horas} horas.
                O ya está todo mandado, o no hay turnos.
              </Vacio>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="px-5 py-4 border-b border-borde flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="f-d">Los turnos que vienen</h3>
                  <p className="text-xs text-texto-suave mt-1">
                    Cada uno se va de la lista cuando se manda. Se avisa por turno:
                    quien tiene dos esta semana recibe los dos.
                  </p>
                </div>
                <select value={cual} onChange={(e) => setCual(e.target.value)}
                  className="bg-superficie border border-borde rounded-md px-2.5 py-1.5 text-xs outline-none focus:border-acento">
                  {plantillas.map((p) => <option key={p.k} value={p.k}>{p.n}</option>)}
                </select>
              </div>

              <ul className="divide-y divide-borde">
                {pendientes.map((t) => (
                  <li key={t.reservaId} className="px-5 py-3.5 flex items-start gap-4 hover:bg-superficie-2">
                    <div className="w-28 shrink-0">
                      <div className="f-m text-sm">{cuando(t.desde)}</div>
                      {t.estado === "pendiente" && <Sello tono="ojo" className="mt-1">Sin confirmar</Sello>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">
                        {t.cliente}
                        {t.esClase && <span className="text-xs text-texto-tenue font-normal ml-2">en clase</span>}
                      </div>
                      <div className="text-xs text-texto-suave truncate">
                        {[t.servicio, t.profesional, t.sala].filter(Boolean).join(" · ")}
                      </div>
                      {/* El mensaje tal como le va a llegar, no la plantilla. */}
                      <p className="text-xs text-texto-tenue mt-1.5 leading-relaxed">
                        {resolver(plantilla.texto, t, ajustes, rubro)}
                      </p>
                    </div>
                    <Boton size="sm" variant="ghost" className="shrink-0"
                      onClick={() => avisar(t)} disabled={!t.tel}
                      title={t.tel ? "" : "No tiene teléfono cargado"}>
                      <MessageCircle size={15} /> Avisar
                    </Boton>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      {pestana === "plantillas" && (
        <div className="space-y-4">
          <Card className="p-5">
            <div className={ROTULO}>Los huecos que se pueden usar</div>
            <div className="flex flex-wrap gap-2 mt-3">
              {HUECOS.map((h) => (
                <span key={h.k} className="text-xs border border-borde rounded-md px-2 py-1 text-texto-suave">
                  <span className="f-m text-acento">{"{" + h.k + "}"}</span>
                  <span className="text-texto-tenue ml-1.5">{h.d}</span>
                </span>
              ))}
            </div>
            <p className="text-xs text-texto-suave mt-3">
              Lo que no sea uno de estos queda escrito tal cual en el mensaje. Es a
              propósito: así un error de tipeo se ve en la vista previa en vez de
              desaparecer.
            </p>
          </Card>

          {plantillas.map((p) => (
            <Card key={p.k} className="p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <h3 className="f-d flex items-center gap-2">
                    {p.n}
                    {p.propia && <Sello tono="acento">Cambiada</Sello>}
                  </h3>
                  <p className="text-xs text-texto-suave mt-1">{p.d}</p>
                </div>
                {editando && editando.k === p.k ? (
                  <div className="flex items-center gap-2">
                    <Boton size="sm" onClick={guardar}>Guardar</Boton>
                    <Boton size="sm" variant="ghost" onClick={() => setEditando(null)}>Cancelar</Boton>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {p.propia && (
                      <Boton size="sm" variant="ghost" onClick={() => restaurar(p.k)}
                        title="Vuelve al texto de fábrica">
                        <RotateCcw size={14} /> Volver al original
                      </Boton>
                    )}
                    <Boton size="sm" variant="ghost" onClick={() => setEditando({ k: p.k, texto: p.texto })}>
                      Editar
                    </Boton>
                  </div>
                )}
              </div>

              {editando && editando.k === p.k ? (
                <textarea value={editando.texto} rows={4}
                  onChange={(e) => setEditando({ ...editando, texto: e.target.value })}
                  className={`${inputCls} resize-y leading-relaxed mt-3`} />
              ) : (
                <p className="text-sm text-texto-suave mt-3 leading-relaxed border border-borde rounded-lg p-3 bg-superficie-2">
                  {p.texto}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      {pestana === "historial" && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-borde">
            <h3 className="f-d">Todo lo que se mandó</h3>
            <p className="text-xs text-texto-suave mt-1">
              Los recordatorios de acá y los mensajes de seguimiento, juntos.
              Son el mismo registro: dos listas de mensajes enviados es la forma
              más rápida de no saber nunca si a alguien ya se le escribió.
            </p>
          </div>
          <TablaSimple
            cols={["Cliente", "Por qué", "Cuándo", "Qué se le dijo"]}
            filas={historial.map((h) => [
              <span key="a" className="font-medium">{h.cliente || "—"}</span>,
              <span className="text-texto-suave">
                {h.motivo === "recordatorio" ? "Recordatorio de turno" : segmentoPorK(h.motivo).n}
              </span>,
              <span className="f-m text-texto-suave">
                {h.fecha.toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
              </span>,
              <span className="text-xs text-texto-tenue block max-w-md truncate" title={h.texto}>
                {h.texto || "—"}
              </span>,
            ])}
            vacio="Todavía no se mandó ningún mensaje."
          />
        </Card>
      )}
    </div>
  );
}
