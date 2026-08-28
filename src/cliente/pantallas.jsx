/* ============================================================
   LAS PANTALLAS DEL CLIENTE
   ============================================================

   Cuatro: Inicio, Turnos, Mi plan y Cuenta. Cuáles se muestran no lo
   decide este archivo —lo decide `modulos_del_cliente` en la base— así
   que agregar una es escribirla acá y prender una fila.

   TODO SALE DE DATOS REALES
   -------------------------
   No hay un solo número escrito a mano. Si un comercio no tiene abonos
   cargados, "Mi plan" está vacío y lo dice; no muestra un plan de ejemplo
   para que la pantalla se vea llena. Una pantalla que miente es peor que
   una vacía: la vacía se entiende sola.
   ============================================================ */

import React from "react";
import { Clock, MapPin, ChevronRight, LogOut, Mail, Building2 } from "lucide-react";
import {
  Pantalla, Tarjeta, Seccion, Boton, Vacio, Estado, ROTULO,
  cuando, hora, diaCorto,
} from "./ui.jsx";

/* ------------------------------------------------------------
   Un turno, en tarjeta
   ------------------------------------------------------------ */

function Turno({ t, mostrarComercio }) {
  return (
    <Tarjeta className="mb-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px]">{t.servicio}</div>
          <div className="text-sm text-texto-suave mt-1 flex items-center gap-1.5">
            <Clock size={13} className="shrink-0" /> {cuando(t.desde)}
          </div>
          {t.profesional && (
            <div className="text-sm text-texto-suave mt-0.5">Con {t.profesional}</div>
          )}
          {mostrarComercio && (
            <div className="text-[11px] text-texto-tenue mt-2 flex items-center gap-1">
              <MapPin size={11} /> {t.empresa}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Estado estado={t.estado} />
          {t.esClase && <span className="text-[10px] text-texto-tenue uppercase tracking-wider">Clase</span>}
        </div>
      </div>
    </Tarjeta>
  );
}

/* ------------------------------------------------------------
   INICIO

   La pantalla más importante y la que más disciplina pide: es la que
   contesta "¿qué tengo que saber ahora?". Un turno que ya pasó y un plan
   vencido no contestan eso, así que no están.
   ------------------------------------------------------------ */

export function Inicio({ marca, nombre, turnos, abonos, hayModulo, onIr, onReservar }) {
  const proximo = turnos[0] || null;
  const plan = abonos.find((a) => a.vigente) || null;

  return (
    <Pantalla>
      <header className="pt-7 pb-1">
        <h1 className="f-d text-2xl">
          Hola{nombre ? `, ${nombre.split(" ")[0]}` : ""} <span className="font-normal">👋</span>
        </h1>
        <p className="text-sm text-texto-suave mt-1">
          {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </header>

      {hayModulo("turnos") && (
        <Seccion titulo="Tu próximo turno"
          accion={turnos.length > 1 && (
            <button onClick={() => onIr("turnos")} className="text-[13px] text-acento font-semibold">
              Ver todos
            </button>
          )}>
          {proximo ? (
            <Turno t={proximo} />
          ) : (
            <Tarjeta>
              <p className="text-sm text-texto-suave">No tenés turnos agendados.</p>
              <div className="mt-4">
                <Boton onClick={onReservar}>Reservar un turno</Boton>
              </div>
            </Tarjeta>
          )}
        </Seccion>
      )}

      {hayModulo("plan") && (
        <Seccion titulo="Mi plan"
          accion={plan && (
            <button onClick={() => onIr("plan")} className="text-[13px] text-acento font-semibold">
              Ver detalle
            </button>
          )}>
          {plan ? (
            <Tarjeta onClick={() => onIr("plan")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[15px]">{plan.nombre}</div>
                  {plan.vence && (
                    <div className="text-sm text-texto-suave mt-1">
                      Vence el {plan.vence.toLocaleDateString("es-AR", { day: "numeric", month: "long" })}
                    </div>
                  )}
                </div>
                {/* Solo si el plan tiene un tope. Un plan libre no tiene
                    sesiones que contar, y mostrar un cero sería mentir. */}
                {plan.clases != null && (
                  <div className="text-right shrink-0">
                    <div className="f-m text-3xl leading-none">
                      {Math.max(0, plan.clases - plan.usadas)}
                    </div>
                    <div className="text-[11px] text-texto-tenue mt-1">
                      de {plan.clases} sin usar
                    </div>
                  </div>
                )}
              </div>
            </Tarjeta>
          ) : (
            <Tarjeta>
              <p className="text-sm text-texto-suave">
                No tenés un plan activo.
              </p>
            </Tarjeta>
          )}
        </Seccion>
      )}
    </Pantalla>
  );
}

/* ------------------------------------------------------------
   TURNOS
   ------------------------------------------------------------ */

export function Turnos({ proximos, anteriores, varios, puedeReservar, onReservar }) {
  const [pestana, setPestana] = React.useState("proximos");
  const lista = pestana === "proximos" ? proximos : anteriores;

  return (
    <Pantalla titulo="Tus turnos">
      <div className="flex gap-1 bg-superficie-2 rounded-lg p-1 mb-5">
        {[["proximos", "Próximos"], ["historial", "Historial"]].map(([k, n]) => (
          <button key={k} onClick={() => setPestana(k)}
            className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${
              pestana === k ? "bg-superficie text-texto shadow-sm" : "text-texto-suave"
            }`}>
            {n}
          </button>
        ))}
      </div>

      {puedeReservar && pestana === "proximos" && lista.length > 0 && (
        <div className="mb-5">
          <Boton onClick={onReservar}>Reservar otro turno</Boton>
        </div>
      )}

      {lista.length === 0 ? (
        <Vacio icono="calendario"
          titulo={pestana === "proximos" ? "No tenés turnos próximos" : "Todavía no hay historial"}
          accion={pestana === "proximos" && puedeReservar && (
            <Boton onClick={onReservar}>Reservar turno</Boton>
          )}>
          {pestana === "proximos"
            ? "Cuando saques un turno, lo vas a ver acá."
            : "Acá van a quedar los turnos a los que ya fuiste."}
        </Vacio>
      ) : (
        <div className={pestana === "historial" ? "opacity-70" : ""}>
          {lista.map((t) => <Turno key={t.id} t={t} mostrarComercio={varios} />)}
        </div>
      )}
    </Pantalla>
  );
}

/* ------------------------------------------------------------
   MI PLAN
   ------------------------------------------------------------ */

export function Plan({ abonos, varios }) {
  const vigentes = abonos.filter((a) => a.vigente);
  const vencidos = abonos.filter((a) => !a.vigente);

  if (!abonos.length) {
    return (
      <Pantalla titulo="Mi plan">
        <Vacio icono="credencial" titulo="No tenés un plan">
          Cuando contrates uno, vas a poder ver acá las sesiones que te quedan
          y cuándo vence.
        </Vacio>
      </Pantalla>
    );
  }

  return (
    <Pantalla titulo="Mi plan">
      {vigentes.map((a) => (
        <Tarjeta key={a.id} className="mb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-lg">{a.nombre}</div>
              {varios && <div className="text-[11px] text-texto-tenue mt-1">{a.empresa}</div>}
              <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-bien border border-bien bg-bien-suave rounded px-1.5 py-0.5">
                Activo
              </div>
            </div>
          </div>

          {/* Una columna o dos según cuántas cajas haya de verdad. Un plan
              libre no tiene sesiones que contar, y con dos columnas fijas
              queda media grilla vacía al lado del vencimiento. */}
          <div className={`grid gap-3 mt-5 ${
            a.clases != null && a.vence ? "grid-cols-2" : "grid-cols-1"}`}>
            {a.clases != null && (
              <div className="bg-superficie-2 rounded-lg p-4">
                <div className="f-m text-3xl leading-none">
                  {Math.max(0, a.clases - a.usadas)}
                </div>
                <div className="text-[11px] text-texto-tenue mt-1.5">
                  sesiones disponibles
                </div>
              </div>
            )}
            {a.vence && (
              <div className="bg-superficie-2 rounded-lg p-4">
                <div className="f-m text-3xl leading-none">
                  {a.vence.toLocaleDateString("es-AR", { day: "numeric", month: "short" })
                    .replace(".", "").toUpperCase()}
                </div>
                <div className="text-[11px] text-texto-tenue mt-1.5">vence</div>
              </div>
            )}
          </div>

          {a.clases != null && (
            <p className="text-sm text-texto-suave mt-4">
              Usaste {a.usadas} de {a.clases}.
            </p>
          )}
        </Tarjeta>
      ))}

      {vencidos.length > 0 && (
        <Seccion titulo="Planes anteriores">
          {vencidos.map((a) => (
            <Tarjeta key={a.id} className="mb-3 opacity-60">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[15px]">{a.nombre}</div>
                  {a.vence && (
                    <div className="text-sm text-texto-suave mt-0.5">
                      Venció el {a.vence.toLocaleDateString("es-AR", { day: "numeric", month: "long" })}
                    </div>
                  )}
                </div>
                {a.clases != null && (
                  <div className="text-sm text-texto-tenue shrink-0">
                    {a.usadas}/{a.clases}
                  </div>
                )}
              </div>
            </Tarjeta>
          ))}
        </Seccion>
      )}
    </Pantalla>
  );
}

/* ------------------------------------------------------------
   CUENTA
   ------------------------------------------------------------ */

export function Cuenta({ marca, email, comercios, onSalir }) {
  return (
    <Pantalla titulo="Mi cuenta">
      <Tarjeta className="mb-6">
        <div className={ROTULO}>Tus datos</div>
        <div className="mt-3 flex items-center gap-2.5 text-[15px]">
          <Mail size={15} className="text-texto-tenue shrink-0" />
          <span className="truncate">{email}</span>
        </div>
      </Tarjeta>

      {/* Solo si hay más de uno. Con un comercio, decir "dónde sos
          cliente" es contarle a alguien algo que ya sabe. */}
      {comercios.length > 1 && (
        <Seccion titulo="Dónde sos cliente">
          {comercios.map((c) => (
            <Tarjeta key={c.empresaId} className="mb-3">
              <div className="flex items-center gap-2.5">
                <Building2 size={15} className="text-texto-tenue shrink-0" />
                <span className="text-[15px]">{c.nombre}</span>
              </div>
            </Tarjeta>
          ))}
        </Seccion>
      )}

      <div className="mt-8">
        <Boton variante="linea" onClick={onSalir}>
          <span className="inline-flex items-center gap-2">
            <LogOut size={16} /> Cerrar sesión
          </span>
        </Boton>
      </div>

      {/* La firma de Genez va acá y en la bienvenida, y en ningún otro
          lado: la app es del comercio, Genez es la tecnología. */}
      <p className="text-center text-[11px] text-texto-tenue mt-10">
        {marca.nombre} · powered by GENEZ
      </p>
    </Pantalla>
  );
}
