/* ============================================================
   21. CRM Y MARKETING · a quién escribirle esta semana
   ============================================================

   Una lista de trabajo, no un tablero de métricas. La pantalla existe
   para que alguien la abra un martes a la mañana, escriba ocho mensajes
   y la cierre vacía.

   POR ESO ES UNA LISTA QUE SE VACÍA
   ---------------------------------
   Cada persona a la que se le escribe desaparece del segmento por tres
   semanas. Sin eso, el lunes aparecen los mismos veinte nombres que el
   viernes, nadie se acuerda a cuáles ya les escribió, y la pantalla se
   deja de abrir. Es la diferencia entre una herramienta y un informe más.

   EL MENSAJE SE LEE ANTES DE MANDARSE
   -----------------------------------
   El texto viene escrito pero editable, y lo que se guarda es lo que se
   mandó. Nada sale solo: se abre WhatsApp con el mensaje cargado y la
   persona aprieta enviar. Un sistema que escribe en nombre de un negocio
   sin que nadie lo lea es una forma rápida de perder clientes.

   LO QUE PASÓ DESPUÉS
   -------------------
   "Volvió" se marca a mano y es la única columna que dice si esto sirve.
   Sin ella, el módulo informa cuántos mensajes se mandaron y nada sobre
   si valió la pena mandarlos.
   ============================================================ */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { MessageCircle, Phone, BellOff } from "lucide-react";
import {
  cargarSegmentos, cargarContactos, anotarContacto, marcarResultado,
  noContactar, mensajeDe, segmentoPorK, palabrasDe, RESULTADOS,
} from "../datos/crm.js";
import { linkWhatsapp, money, nf } from "../utils/helpers.js";
import {
  Card, Boton, Modal, Tabs, Kpi, Vacio, Cargando, ErrorEstado, Sello, TablaSimple,
} from "../ui/Base.jsx";
import { inputCls } from "../ui/Campos.jsx";

const ROTULO = "text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold";
const fecha = (d) => d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });

export function Crm({ empresaId, rubro, toast }) {
  const [pestana, setPestana] = useState("hacer");
  const [segmentos, setSegmentos] = useState([]);
  const [contactos, setContactos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState(null);   // { fila, segmento }
  const [texto, setTexto] = useState("");

  /* Cómo llama este rubro a un cliente: alumno, paciente, socio. Mismo
     mecanismo que VOZ_MESA en la comanda. */
  const palabras = useMemo(() => palabrasDe(rubro), [rubro]);

  const releer = useCallback(async () => {
    const [s, c] = await Promise.all([
      cargarSegmentos(empresaId),
      cargarContactos(empresaId, { dias: 90 }),
    ]);
    setSegmentos(s);
    setContactos(c);
  }, [empresaId]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError("");
    releer()
      .catch((e) => { if (vigente) setError(e.message || "No pudimos armar la lista."); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [releer]);

  const pendientes = useMemo(
    () => segmentos.reduce((s, x) => s + x.gente.length, 0), [segmentos]);
  const volvieron = useMemo(
    () => contactos.filter((c) => c.resultado === "volvio").length, [contactos]);
  const ultimos30 = useMemo(
    () => contactos.filter((c) => c.fecha > new Date(Date.now() - 30 * 86400000)).length, [contactos]);

  function abrir(fila, segmento) {
    setAbierto({ fila, segmento });
    setTexto(mensajeDe(segmento, fila, rubro));
  }

  /* Se anota primero y se abre después. Si se hiciera al revés y el
     navegador bloqueara la pestaña, quedaría un mensaje mandado que el
     sistema no registró, que es peor que uno registrado de más. */
  async function escribir(canal) {
    const { fila, segmento } = abierto;
    try {
      await anotarContacto({
        empresaId, clienteId: fila.clienteId, motivo: segmento, canal, texto,
      });
      if (canal === "whatsapp") {
        const url = linkWhatsapp(fila.tel, texto);
        if (url) window.open(url, "_blank", "noopener");
        else toast("Anotado, pero el teléfono no sirve para WhatsApp.");
      }
      setAbierto(null);
      await releer();
      if (canal !== "whatsapp") toast("Anotado.");
    } catch (e) {
      toast(e.message || "No se pudo anotar.");
    }
  }

  async function silenciar() {
    const { fila } = abierto;
    try {
      await noContactar(empresaId, fila.clienteId, true);
      setAbierto(null);
      await releer();
      toast(`${fila.cliente} no va a aparecer más en estas listas.`);
    } catch (e) {
      toast(e.message || "No se pudo guardar.");
    }
  }

  async function cambiarResultado(id, resultado) {
    try {
      await marcarResultado(id, resultado);
      await releer();
    } catch (e) {
      toast(e.message || "No se pudo guardar.");
    }
  }

  if (error) return <ErrorEstado onReintentar={releer}>{error}</ErrorEstado>;
  if (cargando && !segmentos.length) return <Cargando>Buscando a quién escribirle…</Cargando>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Kpi label="Para escribirles" valor={nf.format(pendientes)}
          icono={MessageCircle}
          sub={pendientes ? "en cinco motivos distintos" : "lista al día"} />
        <Kpi label="Mensajes en 30 días" valor={nf.format(ultimos30)} />
        <Kpi label="Volvieron" valor={nf.format(volvieron)} tono={volvieron ? "bien" : "neutro"}
          sub="marcado a mano, sobre 90 días" />
      </div>

      <Tabs value={pestana} onChange={setPestana} items={[
        { k: "hacer", n: "Para hacer", badge: pendientes },
        { k: "hecho", n: "Lo que se mandó", badge: contactos.length },
      ]} />

      {pestana === "hacer" && (
        pendientes === 0 ? (
          <Card className="p-6">
            <Vacio>
              No hay nadie a quien escribirle. O ya está todo hecho, o todavía
              no hay historia suficiente para que el sistema note un patrón.
            </Vacio>
          </Card>
        ) : (
          <div className="space-y-4">
            {segmentos.filter((s) => s.gente.length > 0).map((s) => (
              <Card key={s.k} className="overflow-hidden">
                <div className="px-5 py-4 border-b border-borde flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="f-d flex items-center gap-2">
                      {s.n}
                      <Sello tono={s.tono}>{nf.format(s.gente.length)}</Sello>
                    </h3>
                    <p className="text-xs text-texto-suave mt-1">{s.d}</p>
                  </div>
                </div>
                <ul className="divide-y divide-borde">
                  {s.gente.map((f) => (
                    <li key={f.clienteId} className="px-5 py-3 flex items-center gap-4 hover:bg-superficie-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{f.cliente}</div>
                        <div className="text-xs text-texto-suave truncate">{f.motivo}</div>
                      </div>
                      <div className="text-right shrink-0 hidden sm:block">
                        <div className={`${ROTULO} font-normal`}>Gastó</div>
                        <div className="f-m text-sm">{money(f.valor)}</div>
                      </div>
                      <Boton size="sm" variant="ghost" onClick={() => abrir(f, s.k)}>
                        <MessageCircle size={15} /> Escribir
                      </Boton>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )
      )}

      {pestana === "hecho" && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-borde">
            <h3 className="f-d">Lo que se mandó</h3>
            <p className="text-xs text-texto-suave mt-1">
              Marcar "Volvió" es lo único que dice si esto sirve. Nadie lo puede
              deducir por el sistema: lo sabe quien la vio entrar.
            </p>
          </div>
          <TablaSimple
            cols={["Cliente", "Motivo", "Cuándo", "Cómo", "Qué pasó"]}
            filas={contactos.map((c) => [
              <span key="a" className="font-medium">{c.cliente || "—"}</span>,
              <span className="text-texto-suave">{segmentoPorK(c.motivo).n}</span>,
              <span className="f-m text-texto-suave">{fecha(c.fecha)}</span>,
              <span className="text-texto-suave">{c.canal === "whatsapp" ? "WhatsApp" : c.canal}</span>,
              <select value={c.resultado} onChange={(e) => cambiarResultado(c.id, e.target.value)}
                className="bg-superficie border border-borde rounded-md px-2 py-1 text-xs outline-none focus:border-acento">
                {RESULTADOS.map((r) => <option key={r.k} value={r.k}>{r.n}</option>)}
              </select>,
            ])}
            vacio="Todavía no se le escribió a nadie desde acá."
          />
        </Card>
      )}

      <Modal open={!!abierto} onClose={() => setAbierto(null)}>
        {abierto && (
          <div className="p-6 space-y-4">
            <div>
              <div className={ROTULO}>{segmentoPorK(abierto.segmento).n}</div>
              <h3 className="f-d text-lg mt-1">{abierto.fila.cliente}</h3>
              <p className="text-sm text-texto-suave">{abierto.fila.motivo}</p>
              {abierto.fila.ultimoContacto && (
                <p className="text-xs text-texto-tenue mt-1">
                  Ya se le escribió por esto el {fecha(abierto.fila.ultimoContacto)}.
                </p>
              )}
            </div>

            <div>
              <label className={ROTULO}>El mensaje</label>
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={6}
                className={`${inputCls} resize-y leading-relaxed`} />
              <p className="text-xs text-texto-tenue mt-1.5">
                Se abre WhatsApp con esto cargado. Todavía lo podés cambiar ahí antes de enviar.
              </p>
            </div>

            {!abierto.fila.tel && (
              <p className="text-xs text-mal">
                Este {palabras.cliente} no tiene teléfono cargado. Se puede anotar el llamado igual.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Boton onClick={() => escribir("whatsapp")} disabled={!abierto.fila.tel}>
                <MessageCircle size={15} /> Abrir WhatsApp
              </Boton>
              <Boton variant="ghost" onClick={() => escribir("telefono")}>
                <Phone size={15} /> Lo llamé
              </Boton>
              <Boton variant="ghost" className="ml-auto text-texto-tenue" onClick={silenciar}
                title="No vuelve a aparecer en ninguna lista de seguimiento">
                <BellOff size={15} /> No contactar
              </Boton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
