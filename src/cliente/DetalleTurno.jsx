/* ============================================================
   EL DETALLE DE UN TURNO
   ============================================================

   Se abre tocando un turno. Es donde vive cancelar, y por eso no es un
   `confirm()` del navegador: cancelar puede costar una clase, y eso hay
   que poder leerlo antes de decidir.

   SE AVISA ANTES Y SE INFORMA DESPUÉS
   -----------------------------------
   Son dos momentos distintos y dicen cosas distintas.

   Antes, la pantalla sabe hasta qué hora salía gratis —lo devuelve
   `mis_turnos`— así que puede decir "cancelar sin costo era hasta las
   15:00". Lo que no sabe es cuánto va a costar exactamente: depende de si
   tiene abono y de la regla del comercio.

   Después, `cancelar_como_cliente` devuelve qué pasó de verdad —si fue
   tarde, si gastó la clase, cuánto quedó debiendo— y eso se muestra tal
   cual. Adivinarlo antes sería arriesgarse a decir un número equivocado
   justo en la pantalla donde más molesta.
   ============================================================ */

import React, { useState } from "react";
import { X, Clock, User, MapPin, Backpack, AlertTriangle, Check } from "lucide-react";
import { cancelarTurno } from "../datos/cliente.js";
import { Boton, Estado, ROTULO, cuando, hora } from "./ui.jsx";

const money = (n) => "$" + Math.round(n).toLocaleString("es-AR");

export function DetalleTurno({ turno, onCerrar, onCancelado }) {
  const [confirmando, setConfirmando] = useState(false);
  const [yendo, setYendo] = useState(false);
  const [error, setError] = useState("");
  const [hecho, setHecho] = useState(null);

  if (!turno) return null;

  /* Comparar con la hora es leer un reloj, no aplicar una regla: la regla
     —cuántas horas antes— ya la resolvió la base y vino en `cancelarHasta`. */
  const yaEsTarde = turno.cancelarHasta && new Date() > turno.cancelarHasta;

  async function cancelar() {
    setYendo(true); setError("");
    try {
      setHecho(await cancelarTurno(turno.id));
      await onCancelado();
    } catch (e) {
      setError(e.message);
    } finally {
      setYendo(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-fondo/60 backdrop-blur-[2px]" onClick={onCerrar} />

      <div className="relative w-full max-w-lg bg-superficie rounded-t-2xl border-t border-x border-borde max-h-[88vh] overflow-auto seguro-abajo">
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className={ROTULO}>Tu turno</div>
          <button onClick={onCerrar} className="-mt-1 -mr-1 p-1 text-texto-tenue hover:text-texto">
            <X size={20} />
          </button>
        </div>

        {hecho ? (
          /* Lo que efectivamente pasó, dicho por la base. */
          <div className="px-5 py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-superficie-2 border border-borde flex items-center justify-center mx-auto">
              <Check size={22} className="text-texto-suave" />
            </div>
            <h3 className="f-d text-lg mt-4">Turno cancelado</h3>

            {!hecho.tarde && (
              <p className="text-sm text-texto-suave mt-2 leading-relaxed">
                Cancelaste a tiempo, así que no te costó nada.
              </p>
            )}
            {hecho.consumio && (
              <p className="text-sm text-texto-suave mt-2 leading-relaxed">
                Como cancelaste sobre la hora, la sesión se descontó de tu plan.
              </p>
            )}
            {hecho.adeuda > 0 && (
              <p className="text-sm text-texto-suave mt-2 leading-relaxed">
                Como cancelaste sobre la hora, queda un cargo de {money(hecho.adeuda)}.
                Lo vas a poder abonar en el local.
              </p>
            )}

            <div className="mt-7">
              <Boton onClick={onCerrar}>Listo</Boton>
            </div>
          </div>
        ) : (
          <div className="px-5 pb-6 pt-3">
            <h3 className="f-d text-xl">{turno.servicio}</h3>

            <div className="mt-4 space-y-2.5">
              <div className="flex items-center gap-2.5 text-[15px] text-texto-suave">
                <Clock size={15} className="shrink-0" /> {cuando(turno.desde)}
                <span className="text-texto-tenue">· {turno.duracionMin} min</span>
              </div>
              {turno.profesional && (
                <div className="flex items-center gap-2.5 text-[15px] text-texto-suave">
                  <User size={15} className="shrink-0" /> {turno.profesional}
                </div>
              )}
              {turno.recurso && (
                <div className="flex items-center gap-2.5 text-[15px] text-texto-suave">
                  <MapPin size={15} className="shrink-0" /> {turno.recurso}
                </div>
              )}
              <div className="pt-1">
                <Estado estado={turno.estado} />
              </div>
            </div>

            {/* Lo que hay que saber antes de ir.

                Solo para los turnos que todavía no pasaron: a quien mira
                un turno de la semana pasada decirle que llegue diez
                minutos antes no le sirve de nada.

                Cada bloque aparece solo si el comercio lo cargó. Sin nada
                cargado no queda un hueco ni un texto de fábrica: queda el
                detalle como estaba. */}
            {turno.desde > new Date() && (turno.llegarMin || turno.llevar) && (
              <div className="mt-6 border-t border-borde pt-5 space-y-4">
                {turno.llegarMin > 0 && (
                  <div className="flex gap-3">
                    <Clock size={16} className="shrink-0 mt-0.5 text-texto-tenue" />
                    <div className="min-w-0">
                      <div className="text-[15px]">Llegar {turno.llegarMin} min antes</div>
                      {turno.llegarNota && (
                        <div className="text-sm text-texto-suave mt-0.5 leading-relaxed">
                          {turno.llegarNota}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {turno.llevar && (
                  <div className="flex gap-3">
                    <Backpack size={16} className="shrink-0 mt-0.5 text-texto-tenue" />
                    <div className="min-w-0">
                      <div className="text-[15px]">Qué llevar</div>
                      <div className="text-sm text-texto-suave mt-0.5 leading-relaxed">
                        {turno.llevar}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="mt-5 text-sm text-mal border border-mal bg-mal-suave rounded-lg px-4 py-3 leading-relaxed">
                {error}
              </div>
            )}

            {turno.puedeCancelar && (
              <div className="mt-7">
                {!confirmando ? (
                  <>
                    {/* El aviso antes de tocar nada, no después. */}
                    {yaEsTarde && (
                      <div className="mb-3 text-sm text-ojo border border-ojo bg-ojo-suave rounded-lg px-4 py-3 flex gap-2.5">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                        <span className="leading-relaxed">
                          Cancelar sin costo era hasta las {hora(turno.cancelarHasta)}.
                          Si cancelás ahora, puede tener costo.
                        </span>
                      </div>
                    )}
                    <Boton variante="linea" onClick={() => setConfirmando(true)}>
                      Cancelar turno
                    </Boton>
                  </>
                ) : (
                  <div className="space-y-2.5">
                    <p className="text-sm text-texto-suave leading-relaxed">
                      {yaEsTarde
                        ? "Estás cancelando sobre la hora. ¿Seguro?"
                        : "¿Seguro que querés cancelar este turno?"}
                    </p>
                    <Boton onClick={cancelar} disabled={yendo}>
                      {yendo ? "Cancelando…" : "Sí, cancelar"}
                    </Boton>
                    <Boton variante="suave" onClick={() => setConfirmando(false)} disabled={yendo}>
                      No, dejarlo
                    </Boton>
                  </div>
                )}
              </div>
            )}

            {/* Que no se pueda cancelar no es lo mismo que que no exista el
                botón: si el comercio no lo permite, conviene decirlo. */}
            {!turno.puedeCancelar && turno.desde > new Date()
              && turno.estado !== "cancelada" && (
              <p className="mt-7 text-sm text-texto-suave leading-relaxed">
                Para cambiar o cancelar este turno, hablá con el local.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
