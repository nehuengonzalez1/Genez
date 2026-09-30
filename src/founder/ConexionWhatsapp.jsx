/* ============================================================
   GENEZ FOUNDER · Configuración → WhatsApp
   ============================================================

   El estado de la conexión con Meta, paso por paso, preguntado en vivo
   a api/founder.js: qué variables están cargadas en Vercel (si están,
   nunca cuánto valen), cómo ve Meta el número, si la app está suscripta
   a la cuenta y qué fue lo último que llegó al webhook.

   Los secretos no se cargan desde acá a propósito: pasarían por el
   navegador y por la base. Van en las variables de Vercel.
   ============================================================ */

import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw, Copy } from "lucide-react";
import { Card, Boton, Cargando, ErrorEstado, Sello } from "../ui/Base.jsx";
import { estadoWhatsapp, registrarNumero, suscribirApp } from "../datos/internoWhatsapp.js";
import { fechaHora } from "./util.js";

const VARIABLES = [
  ["WHATSAPP_TOKEN", "El token permanente del usuario del sistema de Meta. Sin él no se manda nada ni se puede preguntar por el número."],
  ["WHATSAPP_APP_SECRET", "La clave secreta de la app (Meta → Configuración de la app → Básica). Con ella se comprueba que cada webhook sea de Meta."],
  ["WHATSAPP_VERIFY_TOKEN", "Una palabra que inventás vos y pegás igual en Vercel y en Meta → WhatsApp → Configuración → Webhook."],
  ["WHATSAPP_PIN", "El PIN de 6 dígitos de la verificación en dos pasos del número. Solo hace falta para registrarlo."],
];

/* Cómo dice Meta cada cosa, en castellano. */
const ESTADO_NUMERO = { CONNECTED: ["bien", "Conectado"], PENDING: ["ojo", "Pendiente"], DISCONNECTED: ["mal", "Desconectado"],
  FLAGGED: ["mal", "Marcado"], RESTRICTED: ["mal", "Restringido"], BANNED: ["mal", "Bloqueado"], UNKNOWN: ["tenue", "Desconocido"] };
const CALIDAD = { GREEN: ["bien", "Alta"], YELLOW: ["ojo", "Media"], RED: ["mal", "Baja"], UNKNOWN: ["tenue", "Sin datos"] };

function Paso({ ok, titulo, children }) {
  return (
    <li className="flex gap-3 py-3">
      <span className={`mt-0.5 w-5 h-5 shrink-0 rounded-full border text-[11px] flex items-center justify-center f-m ${ok ? "border-bien text-bien bg-bien-suave" : "border-borde text-texto-tenue"}`}>
        {ok ? "✓" : ""}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{titulo}</div>
        <div className="text-xs text-texto-suave mt-0.5 space-y-1">{children}</div>
      </div>
    </li>
  );
}

export function ConexionWhatsapp({ interno, toast }) {
  const [e, setE] = useState(null);
  const [error, setError] = useState("");
  const [haciendo, setHaciendo] = useState("");
  const admin = interno && ["fundador", "administrador"].includes(interno.rol);
  const leer = useCallback(() => { setError(""); return estadoWhatsapp().then(setE).catch((x) => setError(x.message)); }, []);
  useEffect(() => { leer(); }, [leer]);

  const hacer = async (que, fn, ok) => {
    setHaciendo(que);
    try { await fn(); toast(ok); await leer(); }
    catch (x) { toast((x.respuesta && x.respuesta.error && x.respuesta.error.message) || x.message, "mal"); }
    finally { setHaciendo(""); }
  };
  const copiar = (t) => navigator.clipboard.writeText(t).then(() => toast("Copiado."), () => toast("No se pudo copiar.", "mal"));

  if (error) return <Card><ErrorEstado onReintentar={leer}>{error}</ErrorEstado></Card>;
  if (!e) return <Card><Cargando>Preguntándole a Meta…</Cargando></Card>;

  const v = e.variables || {};
  const n = e.numero && !e.numero.error ? e.numero : null;
  const [tonoN, textoN] = n ? ESTADO_NUMERO[n.status] || ["tenue", n.status || "?"] : [];
  const [tonoC, textoC] = n && n.quality_rating ? CALIDAD[n.quality_rating] || ["tenue", n.quality_rating] : [];
  const apps = e.suscripcion && !e.suscripcion.error ? e.suscripcion.data || [] : null;
  const ultimo = (e.eventos || [])[0];

  return (
    <div className="space-y-4">
      <Card className="px-5 py-2">
        <div className="flex items-center justify-between pt-2">
          <h2 className="f-d text-lg">La conexión con Meta</h2>
          <Boton size="sm" variant="ghost" onClick={leer}><RefreshCw size={13} /> Volver a revisar</Boton>
        </div>
        <ol className="divide-y divide-borde">
          <Paso ok={VARIABLES.slice(0, 3).every(([k]) => v[k])} titulo="1. Las variables en Vercel">
            <p>Se cargan en Vercel → el proyecto → Settings → Environment Variables, y hace falta volver a publicar para que las tome. Acá solo se ve si están.</p>
            <ul className="space-y-1 mt-1">
              {VARIABLES.map(([k, d]) => (
                <li key={k} className="flex gap-2">
                  <Sello tono={v[k] ? "bien" : "tenue"}>{v[k] ? "cargada" : "falta"}</Sello>
                  <span><span className="f-m text-texto">{k}</span> — {d}</span>
                </li>
              ))}
            </ul>
          </Paso>

          <Paso ok={!!(n && n.status === "CONNECTED")} titulo="2. El número">
            <p className="f-m">{(e.ajustes && e.ajustes.numero) || ""} · phone number id {(e.ajustes && e.ajustes.phone_number_id) || "—"} · cuenta {(e.ajustes && e.ajustes.waba_id) || "—"}</p>
            {!v.WHATSAPP_TOKEN && <p>Con el token cargado, acá aparece cómo lo ve Meta.</p>}
            {e.numero && e.numero.error && <p className="text-mal">Meta: {e.numero.error.message}</p>}
            {n && (
              <p className="flex flex-wrap items-center gap-1.5">
                <Sello tono={tonoN}>{textoN}</Sello>
                {n.verified_name && <span>Nombre: <b className="text-texto">{n.verified_name}</b>{n.name_status ? ` (${n.name_status.toLowerCase()})` : ""}</span>}
                {tonoC && <span>· Calidad <Sello tono={tonoC}>{textoC}</Sello></span>}
                {n.messaging_limit_tier && <span>· Límite {n.messaging_limit_tier}</span>}
              </p>
            )}
            {n && n.status !== "CONNECTED" && (
              <p>Para pasar de Pendiente a Conectado, Meta pide registrarlo en la API con el PIN de dos pasos. Primero activá la verificación en dos pasos en el Administrador de WhatsApp y cargá el mismo PIN como WHATSAPP_PIN.</p>
            )}
            {admin && v.WHATSAPP_TOKEN && n && n.status !== "CONNECTED" && (
              <Boton size="sm" onClick={() => hacer("registrar", registrarNumero, "Número registrado.")} disabled={!!haciendo || !v.WHATSAPP_PIN}>
                {haciendo === "registrar" ? "Registrando…" : "Registrar el número"}
              </Boton>
            )}
          </Paso>

          <Paso ok={!!(apps && apps.length)} titulo="3. La app suscripta a la cuenta">
            <p>Sin esto Meta no manda ningún webhook, aunque el paso 4 esté bien.</p>
            {e.suscripcion && e.suscripcion.error && <p className="text-mal">Meta: {e.suscripcion.error.message}</p>}
            {apps && <p>{apps.length ? `Suscriptas: ${apps.map((a) => (a.whatsapp_business_api_data && a.whatsapp_business_api_data.name) || "una app").join(", ")}.` : "Ninguna app suscripta."}</p>}
            {admin && v.WHATSAPP_TOKEN && apps && !apps.length && (
              <Boton size="sm" onClick={() => hacer("suscribir", suscribirApp, "App suscripta.")} disabled={!!haciendo}>
                {haciendo === "suscribir" ? "Suscribiendo…" : "Suscribir la app"}
              </Boton>
            )}
          </Paso>

          <Paso ok={!!ultimo} titulo="4. El webhook">
            <p>En Meta → la app → WhatsApp → Configuración → Webhook: esta URL como "URL de devolución de llamada", el mismo WHATSAPP_VERIFY_TOKEN, y suscribir el campo <b className="text-texto">messages</b>.</p>
            <p className="flex items-center gap-2">
              <span className="f-m text-texto break-all">{e.webhook}</span>
              <button onClick={() => copiar(e.webhook)} className="text-texto-suave hover:text-texto" aria-label="Copiar"><Copy size={13} /></button>
            </p>
            <p>{ultimo ? `Lo último que llegó: ${fechaHora(new Date(ultimo.recibido_en))}.` : "Todavía no llegó nada. Mandale un mensaje al número desde otro teléfono para probar."}</p>
          </Paso>
        </ol>
      </Card>

      {(e.eventos || []).length > 0 && (
        <Card className="overflow-hidden">
          <h2 className="px-5 py-3 font-semibold border-b border-borde">Lo último que llegó al webhook</h2>
          <ul className="divide-y divide-borde">
            {e.eventos.map((x) => (
              <li key={x.id} className="px-5 py-2 text-xs flex flex-wrap gap-x-3">
                <span className="f-m text-texto-suave">{fechaHora(new Date(x.recibido_en))}</span>
                {x.error ? <span className="text-mal">{x.error}</span> : <span>{x.mensajes} mensaje{x.mensajes === 1 ? "" : "s"}, {x.estados} estado{x.estados === 1 ? "" : "s"} de entrega</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
