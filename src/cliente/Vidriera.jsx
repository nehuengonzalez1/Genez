/* ============================================================
   LA VIDRIERA DEL COMERCIO (0140)
   ============================================================

   Lo que muestra la página pública de un comercio a quien no tiene
   cuenta: si está abierto, cómo escribirle, cómo llegar, los horarios,
   cómo se paga y si hace envíos. Es lo que se pregunta antes de ir.

   El orden es el de esa pregunta: primero si está abierto y los botones
   para escribir o ir (lo que se toca), después el detalle (lo que se
   lee). Un aviso del comercio ("Cerramos por vacaciones") va arriba de
   todo, porque cambia todo lo demás.

   Lo dibujan dos aplicaciones: la página del comercio y la vista previa
   de Presencia online en la gestión. Por eso no importa nada de ninguna
   de las dos: solo los colores, que son los mismos.
   ============================================================ */

import React from "react";
import { MessageCircle, Phone, MapPin, Instagram, Facebook, Music2, Mail, Globe, Clock, CreditCard, Truck, Store, Megaphone } from "lucide-react";
import { DIAS, estadoAhora, horarioDelDia, diaDeHoy, linksDeContacto, hayHorarios } from "./vidriera.js";

const ICONO = { whatsapp: MessageCircle, telefono: Phone, mapa: MapPin, instagram: Instagram, facebook: Facebook, tiktok: Music2, email: Mail, web: Globe };
const ROTULO = "text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold";

function Bloque({ titulo, icono: Ico, children }) {
  return (
    <section className="border-t border-borde pt-5 mt-5">
      <h2 className={`${ROTULO} flex items-center gap-1.5`}><Ico size={13} /> {titulo}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Vidriera({ nombre, presencia, ahora = new Date(), enlaces = true }) {
  if (!presencia) return null;
  const estado = estadoAhora(presencia.horarios, ahora);
  const links = linksDeContacto(presencia.contacto || {}, nombre);
  /* Los tres primeros van como botones grandes; el resto, en lista. */
  const principales = links.filter((l) => ["whatsapp", "telefono", "mapa"].includes(l.k));
  const otros = links.filter((l) => !principales.includes(l));
  const hoy = diaDeHoy(ahora);
  const e = presencia.entrega;
  const A = enlaces ? "a" : "span";
  const ir = (href) => (enlaces ? { href, target: href.startsWith("http") ? "_blank" : undefined, rel: "noopener noreferrer" } : {});

  return (
    <div>
      {presencia.aviso && (
        <div className="flex items-start gap-2.5 rounded-xl border border-acento bg-acento-suave px-4 py-3 text-sm mb-5">
          <Megaphone size={16} className="text-acento shrink-0 mt-0.5" />
          <span className="leading-relaxed">{presencia.aviso}</span>
        </div>
      )}

      {estado && (
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className={`w-2 h-2 rounded-full ${estado.abierto ? "bg-bien" : "bg-texto-tenue"}`} />
          <span className={estado.abierto ? "text-bien" : "text-texto-suave"}>{estado.texto}</span>
        </div>
      )}

      {principales.length > 0 && (
        <div className={`grid gap-2 mt-4 ${principales.length === 1 ? "grid-cols-1" : principales.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {principales.map((l) => {
            const Ico = ICONO[l.k];
            return (
              <A key={l.k} {...ir(l.href)} data-contacto={l.k}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-borde bg-superficie px-2 py-3 text-xs font-semibold hover:bg-superficie-2">
                <Ico size={18} className="text-acento" /> {l.n}
              </A>
            );
          })}
        </div>
      )}

      {hayHorarios(presencia.horarios) && (
        <Bloque titulo="Horarios" icono={Clock}>
          <ul className="space-y-1.5 text-sm">
            {DIAS.map((d) => (
              <li key={d.k} className={`flex justify-between gap-4 ${d.k === hoy ? "font-semibold text-texto" : "text-texto-suave"}`}>
                <span>{d.n}{d.k === hoy ? " · hoy" : ""}</span>
                <span className="text-right">{horarioDelDia(presencia.horarios, d.k)}</span>
              </li>
            ))}
          </ul>
        </Bloque>
      )}

      {presencia.contacto && presencia.contacto.direccion && (
        <Bloque titulo="Dónde estamos" icono={MapPin}>
          <p className="text-sm">{presencia.contacto.direccion}</p>
        </Bloque>
      )}

      {((presencia.pagos && presencia.pagos.length > 0) || (e && (e.retiro || e.envio))) && (
        <Bloque titulo="Cómo comprar" icono={CreditCard}>
          {e && (e.retiro || e.envio) && (
            <div className="flex flex-wrap gap-2 mb-3">
              {e.retiro && <span className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-md border border-borde px-2.5 py-1"><Store size={13} /> Retiro en el local</span>}
              {e.envio && <span className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-md border border-borde px-2.5 py-1"><Truck size={13} /> Envíos{e.zona ? ` · ${e.zona}` : ""}</span>}
            </div>
          )}
          {presencia.pagos && presencia.pagos.length > 0 && (
            <p className="text-sm text-texto-suave">Aceptamos {presencia.pagos.join(", ").replace(/, ([^,]*)$/, " y $1")}.</p>
          )}
        </Bloque>
      )}

      {otros.length > 0 && (
        <Bloque titulo="Seguinos y escribinos" icono={Globe}>
          <ul className="space-y-1">
            {otros.map((l) => {
              const Ico = ICONO[l.k];
              return (
                <li key={l.k}>
                  <A {...ir(l.href)} data-contacto={l.k} className="flex items-center gap-3 rounded-lg px-2 py-2 -mx-2 text-sm hover:bg-superficie-2">
                    <Ico size={16} className="text-texto-tenue" />
                    <span className="text-texto-tenue w-20 shrink-0">{l.n}</span>
                    <span className="truncate">{l.v}</span>
                  </A>
                </li>
              );
            })}
          </ul>
        </Bloque>
      )}
    </div>
  );
}
