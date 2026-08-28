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
import { Clock, MapPin, ChevronRight, LogOut, User, Building2, Bell } from "lucide-react";
import {
  Pantalla, Tarjeta, Seccion, Boton, Vacio, Cargando, Estado, ROTULO,
  cuando, hora, diaCorto,
} from "./ui.jsx";

/* ------------------------------------------------------------
   Un turno, en sus dos formas

   La maqueta usa dos y no una: el próximo va grande, con su foto, y los
   que vienen después van en fila. Es la diferencia entre "esto es lo que
   te toca" y "esto es lo que hay". Con una sola forma para las dos cosas,
   el turno de mañana pesa lo mismo que el de dentro de tres semanas.

   LA FOTO ES UN LUGAR VACÍO
   Hoy no hay ninguna cargada. Cuando no hay, la tarjeta no deja un
   rectángulo gris: no dibuja la banda y el contenido sube. Es lo mismo
   que hace la portada en la bienvenida, y es lo que permite que el día
   que Almha suba sus fotos aparezcan solas.
   ------------------------------------------------------------ */

/* "Reformer 2 · Camila". Las dos pueden faltar —un servicio sin sala, una
   clase sin profesional asignado— así que el separador se pone solo
   cuando hay algo de los dos lados. */
function donde(t) {
  return [t.recurso, t.profesional].filter(Boolean).join(" · ");
}

function TurnoDestacado({ t, mostrarComercio, onAbrir }) {
  return (
    <Tarjeta className="mb-3" aire={false} onClick={onAbrir ? () => onAbrir(t) : undefined}>
      {t.imagen && (
        <div className="h-36 bg-superficie-2">
          <img src={t.imagen} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] uppercase tracking-[0.08em] font-bold">
              {t.servicio}
            </div>
            <div className="text-[15px] mt-1.5">{cuando(t.desde)}</div>
            {donde(t) && (
              <div className="text-sm text-texto-suave mt-0.5">{donde(t)}</div>
            )}
            {mostrarComercio && (
              <div className="text-[11px] text-texto-tenue mt-2 flex items-center gap-1">
                <MapPin size={11} /> {t.empresa}
              </div>
            )}
          </div>
          {onAbrir && <ChevronRight size={18} className="text-texto-tenue shrink-0 mt-0.5" />}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Estado estado={t.estado} />
          {t.esClase && (
            <span className="text-[10px] text-texto-tenue uppercase tracking-wider px-1.5 border border-transparent">
              Clase
            </span>
          )}
        </div>
      </div>
    </Tarjeta>
  );
}

function TurnoFila({ t, mostrarComercio, onAbrir }) {
  return (
    <Tarjeta className="mb-2.5" onClick={onAbrir ? () => onAbrir(t) : undefined}>
      <div className="flex items-center gap-3.5">
        {/* La miniatura solo si hay foto. Sin ella la fila arranca en el
            texto y no queda un cuadrado vacío ocupando el lugar. */}
        {t.imagen && (
          <div className="w-12 h-12 rounded-lg bg-superficie-2 shrink-0 overflow-hidden">
            <img src={t.imagen} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="text-[15px] truncate">{t.servicio}</div>
          <div className="text-sm text-texto-suave mt-0.5">{cuando(t.desde)}</div>
          {donde(t) && (
            <div className="text-[13px] text-texto-tenue mt-0.5 truncate">{donde(t)}</div>
          )}
          {mostrarComercio && (
            <div className="text-[11px] text-texto-tenue mt-1 flex items-center gap-1">
              <MapPin size={11} /> {t.empresa}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Estado estado={t.estado} />
          {onAbrir && <ChevronRight size={16} className="text-texto-tenue" />}
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

export function Inicio({
  marca, nombre, turnos, abonos, hayModulo, onIr, onReservar, onAbrirTurno,
  avisosNuevos = 0, onVerAvisos,
}) {
  const proximo = turnos[0] || null;
  const plan = abonos.find((a) => a.vigente) || null;

  return (
    <Pantalla>
      <header className="pt-7 pb-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="f-d text-2xl">
            Hola{nombre ? `, ${nombre.split(" ")[0]}` : ""} <span className="font-normal">👋</span>
          </h1>
          <p className="text-sm text-texto-suave mt-1">
            {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>

        {/* La campana solo si hay algo que mirar. Una campana que nunca
            tuvo nada adentro le enseña a la persona a no tocarla, y el día
            que tenga algo ya aprendió a ignorarla.

            El punto y no el número: cuántos avisos sin ver hay no cambia
            lo que va a hacer, que es entrar a leerlos. */}
        {onVerAvisos && (
          <button onClick={onVerAvisos} aria-label="Avisos"
            className="relative -mr-[11px] -mt-[6px] w-[44px] h-[44px] flex items-center justify-center text-texto-suave hover:text-texto transition-colors shrink-0">
            <Bell size={20} />
            {avisosNuevos > 0 && (
              <span className="absolute top-[9px] right-[10px] w-2 h-2 rounded-full bg-acento border-2 border-fondo" />
            )}
          </button>
        )}
      </header>

      {hayModulo("turnos") && (
        <Seccion titulo="Tu próximo turno"
          accion={turnos.length > 1 && (
            <button onClick={() => onIr("turnos")} className="text-[13px] text-acento font-semibold">
              Ver todos
            </button>
          )}>
          {proximo ? (
            <TurnoDestacado t={proximo} onAbrir={onAbrirTurno} />
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
                {/* Lo que le queda, según qué clase de plan sea. Un pack
                    cuenta sesiones y un plan cuenta por semana; el que no
                    tiene ninguno de los dos no muestra número, porque un
                    cero ahí diría que no le queda nada. */}
                {plan.clases != null ? (
                  <div className="text-right shrink-0">
                    <div className="f-m text-3xl leading-none">
                      {Math.max(0, plan.clases - plan.usadas)}
                    </div>
                    <div className="text-[11px] text-texto-tenue mt-1">
                      de {plan.clases} sin usar
                    </div>
                  </div>
                ) : plan.topeSemanal != null && (
                  <div className="text-right shrink-0">
                    <div className="f-m text-3xl leading-none">
                      {Math.max(0, plan.topeSemanal - (plan.usadasSemana || 0))}
                    </div>
                    <div className="text-[11px] text-texto-tenue mt-1">
                      de {plan.topeSemanal} esta semana
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

/* Estar en una lista no es tener un turno, así que va en su propia
   sección y no mezclado con los próximos. Si estuviera en la misma lista,
   alguien contaría como suya una clase que todavía no tiene. */
function Esperando({ esperas, onBajarse, bajando }) {
  if (!esperas.length) return null;

  return (
    <Seccion titulo="Estás esperando lugar">
      {esperas.map((e) => (
        <Tarjeta key={e.claseId} className="mb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[15px]">{e.servicio}</div>
              <div className="text-sm text-texto-suave mt-1 flex items-start gap-1.5">
                <Clock size={13} className="shrink-0 mt-[3px]" /> {cuando(e.desde)}
              </div>
              {e.profesional && (
                <div className="text-sm text-texto-suave mt-0.5">Con {e.profesional}</div>
              )}
              <div className="text-[11px] text-texto-tenue mt-2">
                {e.lugar === 1 ? "Sos la primera" : `Sos la número ${e.lugar}`}
                {e.esperando > 1 && ` de ${e.esperando}`}
              </div>
            </div>
          </div>
          <button onClick={() => onBajarse(e.claseId)} disabled={bajando === e.claseId}
            className="text-[13px] text-texto-tenue hover:text-mal mt-4 disabled:opacity-50">
            {bajando === e.claseId ? "Saliendo…" : "Salir de la lista"}
          </button>
        </Tarjeta>
      ))}
    </Seccion>
  );
}

export function Turnos({
  proximos, anteriores, cancelados, varios, puedeReservar, onReservar, onAbrirTurno,
  esperas = [], onBajarse, bajando,
}) {
  const [pestana, setPestana] = React.useState("proximos");

  /* Tres y no dos, como la maqueta. Un turno cancelado no es historial:
     el historial es a lo que fuiste, y mezclarlos hace que la lista de lo
     que hiciste incluya lo que no hiciste. Antes caían todos juntos en
     "Historial" porque `pasados` se llevaba lo vencido y lo cancelado. */
  const LISTAS = {
    proximos: proximos,
    historial: anteriores,
    cancelados: cancelados,
  };
  const lista = LISTAS[pestana] || [];

  const VACIOS = {
    proximos: ["No tenés turnos próximos", "Reservá tu próximo turno y seguí cuidándote."],
    historial: ["Todavía no hay historial", "Acá van a quedar los turnos a los que ya fuiste."],
    cancelados: ["No cancelaste ningún turno", "Si alguna vez cancelás uno, lo vas a ver acá."],
  };

  const [tituloVacio, textoVacio] = VACIOS[pestana];

  /* En próximos, el primero va grande y el resto en fila. En las otras dos
     no hay un "próximo": son listas de cosas que ya pasaron y ninguna
     manda sobre las demás. */
  const destacado = pestana === "proximos" ? lista[0] : null;
  const resto = pestana === "proximos" ? lista.slice(1) : lista;

  return (
    <Pantalla titulo="Mis turnos">
      <div className="flex gap-1 bg-superficie-2 rounded-lg p-1 mb-5">
        {[["proximos", "Próximos"], ["historial", "Historial"], ["cancelados", "Cancelados"]].map(([k, n]) => (
          <button key={k} onClick={() => setPestana(k)}
            className={`flex-1 rounded-md py-2 text-[13px] font-semibold border transition-colors ${
              pestana === k ? "bg-superficie border-borde text-texto" : "border-transparent text-texto-suave"
            }`}>
            {n}
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <Vacio icono="calendario" titulo={tituloVacio}
          accion={pestana === "proximos" && puedeReservar && (
            <Boton onClick={onReservar}>Reservar turno</Boton>
          )}>
          {textoVacio}
        </Vacio>
      ) : (
        <div className={pestana === "proximos" ? "" : "opacity-80"}>
          {destacado && (
            <Seccion titulo="Próximo turno">
              <TurnoDestacado t={destacado} mostrarComercio={varios} onAbrir={onAbrirTurno} />
            </Seccion>
          )}

          {resto.length > 0 && (
            <Seccion titulo={destacado ? "Otros próximos" : null}>
              {/* Solo los próximos se abren: en el historial no hay nada
                  que hacer con un turno, y un panel que solo informa
                  invita a tocarlo para nada. */}
              {resto.map((t) => (
                <TurnoFila key={t.id} t={t} mostrarComercio={varios}
                  onAbrir={pestana === "proximos" ? onAbrirTurno : undefined} />
              ))}
            </Seccion>
          )}
        </div>
      )}

      {pestana === "proximos" && (
        <Esperando esperas={esperas} onBajarse={onBajarse} bajando={bajando} />
      )}

      {/* Abajo y no arriba, como la maqueta, y ahí sí lleno.

          Arriba de la lista un bloque naranja se lee antes que los turnos,
          que son lo que la persona vino a ver; abajo no compite con nada y
          cae donde uno llega después de mirar lo que tiene. La maqueta ya
          tenía resuelto lo que en el repaso anterior había dejado como
          "cambiarlo cuando toques la pantalla". */}
      {puedeReservar && pestana === "proximos" && lista.length > 0 && (
        <div className="mt-7">
          <Boton onClick={onReservar}>Reservar turno</Boton>
        </div>
      )}
    </Pantalla>
  );
}

/* ------------------------------------------------------------
   MI PLAN
   ------------------------------------------------------------ */

export function Plan({ abonos, varios, onVer }) {
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
            (a.clases != null || a.topeSemanal != null) && a.vence ? "grid-cols-2" : "grid-cols-1"}`}>
            {a.clases != null ? (
              <div className="bg-superficie-2 rounded-lg p-4">
                <div className="f-m text-3xl leading-none">
                  {Math.max(0, a.clases - a.usadas)}
                </div>
                <div className="text-[11px] text-texto-tenue mt-1.5">
                  sesiones disponibles
                </div>
              </div>
            ) : a.topeSemanal != null && (
              /* Un plan con tope semanal no es libre, que es lo que esta
                 pantalla venía diciendo por omisión: no mostraba nada y
                 quedaba solo el vencimiento. */
              <div className="bg-superficie-2 rounded-lg p-4">
                <div className="f-m text-3xl leading-none">
                  {Math.max(0, a.topeSemanal - (a.usadasSemana || 0))}
                </div>
                <div className="text-[11px] text-texto-tenue mt-1.5">
                  de {a.topeSemanal} esta semana
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

      {/* Las dos pantallas de la maqueta que cuelgan del plan. Van como
          filas y no como botones: son lugares a los que se entra, no
          acciones que se ejecutan. */}
      <Seccion titulo="Ver también">
        {[
          ["sesiones", "Sesiones", "Cuántas trae tu plan y cuántas usaste"],
          ["pagos", "Pagos", "Lo que pagaste, cuándo y con qué"],
          ["actividad", "Actividad", "Tus turnos y tus pagos, en orden"],
        ].map(([k, n, sub]) => (
          <Tarjeta key={k} className="mb-2.5" onClick={() => onVer(k)}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[15px]">{n}</div>
                <div className="text-[13px] text-texto-tenue mt-0.5">{sub}</div>
              </div>
              <ChevronRight size={18} className="text-texto-tenue shrink-0" />
            </div>
          </Tarjeta>
        ))}
      </Seccion>
    </Pantalla>
  );
}
/* ------------------------------------------------------------
   SESIONES · pantalla 10 de la maqueta

   El desglose de lo que da el plan: cuántas trae, cuántas se usaron y
   cuántas quedan. Mi plan contesta "¿tengo?"; esto contesta "¿cuántas y
   en qué se fueron?", que es la pregunta de quien está decidiendo si
   reserva otra esta semana.

   NO DICE "EL MES"
   La maqueta lo titula "Resumen del mes", que es cierto para un plan
   mensual y falso para un pack de cuatro clases sin vencimiento. Acá el
   período es el del abono, que es lo que el dato realmente sabe, y se
   dice cuál es. Inventar un mes obligaría a repartir las clases de un
   pack entre meses que el comercio nunca definió.
   ------------------------------------------------------------ */

function Numero({ valor, rotulo }) {
  return (
    <div className="bg-superficie-2 rounded-lg p-4">
      <div className="f-m text-3xl leading-none">{valor}</div>
      <div className="text-[11px] text-texto-tenue mt-1.5">{rotulo}</div>
    </div>
  );
}

export function Sesiones({ abonos, turnos, onVolver, onVerTurnos }) {
  const plan = abonos.find((a) => a.vigente) || null;

  /* Un pack cuenta sesiones; un plan con tope cuenta por semana; el que
     no tiene ninguno de los dos es libre. Las dos primeras pueden ser
     ciertas a la vez —doce clases, máximo dos por semana— así que se
     preguntan por separado y no con un `else`. */
  const cuenta = plan && plan.clases != null;
  const porSemana = plan && plan.topeSemanal != null;

  return (
    <Pantalla titulo="Sesiones" onVolver={onVolver}>
      {!plan ? (
        <Vacio icono="credencial" titulo="No tenés un plan activo">
          Cuando contrates uno, acá vas a ver cuántas sesiones trae y
          cuántas te quedan.
        </Vacio>
      ) : (
        <>
          <Tarjeta>
            <div className={ROTULO}>Tu plan</div>
            <div className="text-lg mt-2">{plan.nombre}</div>
            {plan.vence && (
              <div className="text-sm text-texto-suave mt-0.5">
                Hasta el {plan.vence.toLocaleDateString("es-AR", { day: "numeric", month: "long" })}
              </div>
            )}

            {cuenta && (
              <div className="grid grid-cols-3 gap-2.5 mt-5">
                <Numero valor={plan.clases} rotulo="del plan" />
                <Numero valor={plan.usadas} rotulo="usadas" />
                <Numero valor={Math.max(0, plan.clases - plan.usadas)} rotulo="te quedan" />
              </div>
            )}

            {porSemana && (
              <div className="grid grid-cols-2 gap-2.5 mt-5">
                <Numero valor={plan.topeSemanal} rotulo="por semana" />
                <Numero valor={Math.max(0, plan.topeSemanal - (plan.usadasSemana || 0))}
                  rotulo="esta semana" />
              </div>
            )}

            {!cuenta && !porSemana && (
              <p className="text-sm text-texto-suave mt-4 leading-relaxed">
                Es un plan libre: no tiene un tope de sesiones.
              </p>
            )}
          </Tarjeta>

          <Seccion titulo="Próximas sesiones"
            accion={turnos.length > 0 && (
              <button onClick={onVerTurnos} className="text-[13px] text-acento font-semibold">
                Ver todas
              </button>
            )}>
            {turnos.length === 0 ? (
              <Tarjeta>
                <p className="text-sm text-texto-suave">No tenés sesiones agendadas.</p>
              </Tarjeta>
            ) : (
              turnos.slice(0, 5).map((t) => (
                <TurnoFila key={t.id} t={t} />
              ))
            )}
          </Seccion>
        </>
      )}
    </Pantalla>
  );
}

/* ------------------------------------------------------------
   PAGOS · pantalla 11 de la maqueta

   Lo que pagó, cuándo y con qué. Es de las pocas cosas que una persona
   busca sola, sin querer preguntarle a nadie.

   FALTA "PRÓXIMO PAGO", Y NO ES UN OLVIDO
   La maqueta abre con "Próximo pago · 15 Jun · $24.000 · Pagar ahora".
   Eso necesita que un abono se renueve solo y que haya un cobro
   recurrente, y hoy los abonos no tienen ni una cosa ni la otra: se
   venden de a uno, en el local. Dibujar una fecha de renovación que nadie
   calcula sería el primer número inventado de esta app.

   Cuando exista la renovación, esta pantalla ya tiene dónde ponerlo.
   ------------------------------------------------------------ */

/* Como lo dice la base y como lo diría una persona. Lo que no esté en la
   lista se muestra tal cual: es mejor que un pago diga "cheque" a que la
   pantalla se calle porque no lo tenía previsto. */
const MEDIOS = {
  efectivo: "Efectivo",
  debito: "Débito",
  credito: "Crédito",
  mp: "Mercado Pago",
  transferencia: "Transferencia",
  qr: "QR",
  cuenta: "Cuenta corriente",
};

export function Pagos({ pagos, cargando, varios, onVolver }) {
  const money = (n) => "$" + Math.round(n).toLocaleString("es-AR");

  return (
    <Pantalla titulo="Pagos" onVolver={onVolver}>
      {cargando ? (
        <Cargando>Buscando tus pagos…</Cargando>
      ) : pagos.length === 0 ? (
        <Vacio icono="billete" titulo="Todavía no hay pagos">
          Acá van a quedar los pagos que hagas, con la fecha y el medio.
        </Vacio>
      ) : (
        <Seccion titulo="Pagos realizados">
          {pagos.map((p) => (
            <Tarjeta key={p.id} className="mb-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[15px] truncate">{p.concepto}</div>
                  <div className="text-sm text-texto-suave mt-0.5">
                    {p.fecha.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
                  </div>
                  <div className="text-[13px] text-texto-tenue mt-0.5">
                    {MEDIOS[p.medio] || p.medio}
                    {varios && ` · ${p.empresa}`}
                  </div>
                </div>
                <div className="f-m text-[15px] shrink-0">{money(p.monto)}</div>
              </div>
            </Tarjeta>
          ))}
        </Seccion>
      )}
    </Pantalla>
  );
}
/* ------------------------------------------------------------
   ACTIVIDAD · pantalla 12 de la maqueta

   Todo lo que pasó, en una línea de tiempo. No agrega ningún dato: junta
   los turnos y los pagos, que ya estaban cada uno en su pantalla, y los
   ordena por fecha.

   Y ahí está lo que aporta. "¿Cuándo fue la última vez que vine?" y
   "¿esto ya lo pagué?" son preguntas que se contestan mirando dos listas
   y cruzándolas de memoria. Acá se leen de corrido.

   NO SE INVENTA UNA TABLA DE EVENTOS
   Se podría guardar cada cosa que pasa en una tabla de actividad. Sería
   un segundo registro de hechos que ya están escritos en `reservas` y en
   `pagos`, con el problema de siempre: el día que los dos no coincidan,
   hay que averiguar cuál tiene razón. Esto se arma al vuelo y no puede
   desincronizarse de nada.

   FALTAN LOS BENEFICIOS, Y ES LA MISMA RAZÓN DE SIEMPRE
   La maqueta tiene una cuarta ficha —"Sumaste 120 puntos", "Beneficio
   utilizado"— que necesita el módulo de puntos. Cuando exista, es un
   arreglo más en `TODO` y una ficha más arriba.
   ------------------------------------------------------------ */

/* Qué le pasó al turno, dicho para quien lo tuvo. La base habla de
   estados; una persona lee lo que hizo. */
const QUE_PASO = {
  pendiente: "Turno reservado",
  confirmada: "Turno confirmado",
  cumplida: "Turno cumplido",
  cancelada: "Turno cancelado",
  ausente: "Ausencia registrada",
};

export function Actividad({ turnos, pagos, cargando, onVolver }) {
  const [filtro, setFiltro] = React.useState("todo");
  const [cuantos, setCuantos] = React.useState(15);

  const money = (n) => "$" + Math.round(n).toLocaleString("es-AR");

  /* Lo que pasó, no lo que va a pasar.

     Con los turnos futuros adentro, la pantalla abría en septiembre
     —"Turno confirmado" cuatro veces— y la historia real quedaba abajo.
     Actividad contesta "¿cuándo vine la última vez?" y "¿esto ya lo
     pagué?"; lo que viene ya tiene su lugar en Turnos.

     La fecha de un turno es la del turno y no la de cuando se reservó,
     que es el único dato que hay. Por eso un turno futuro cancelado no
     aparece acá: aparece en la pestaña Cancelados. */
  const ahora = new Date();

  /* Un solo arreglo con las dos cosas adentro, cada una traducida a lo
     mismo: cuándo, qué pasó y sobre qué. Así ordenar es ordenar por una
     fecha y no cruzar dos listas. */
  const todo = [
    ...turnos.filter((t) => t.desde < ahora).map((t) => ({
      id: "t" + t.id,
      tipo: "turnos",
      fecha: t.desde,
      titulo: QUE_PASO[t.estado] || "Turno",
      detalle: [t.servicio, t.profesional].filter(Boolean).join(" · "),
      monto: null,
    })),
    ...pagos.map((p) => ({
      id: "p" + p.id,
      tipo: "pagos",
      fecha: p.fecha,
      titulo: "Pago realizado",
      detalle: p.concepto,
      monto: p.monto,
    })),
  ].sort((a, b) => b.fecha - a.fecha);

  const lista = filtro === "todo" ? todo : todo.filter((x) => x.tipo === filtro);
  const visibles = lista.slice(0, cuantos);

  return (
    <Pantalla titulo="Actividad" onVolver={onVolver}>
      <div className="flex gap-2 mb-6">
        {[["todo", "Todo"], ["turnos", "Turnos"], ["pagos", "Pagos"]].map(([k, n]) => (
          <button key={k} onClick={() => { setFiltro(k); setCuantos(15); }}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
              filtro === k
                ? "bg-superficie border-borde-fuerte text-texto"
                : "border-borde text-texto-suave hover:text-texto"
            }`}>
            {n}
          </button>
        ))}
      </div>

      {cargando ? (
        <Cargando>Armando tu historia…</Cargando>
      ) : visibles.length === 0 ? (
        <Vacio icono="calendario" titulo="Todavía no hay nada">
          Acá van a quedar tus turnos y tus pagos, en orden.
        </Vacio>
      ) : (
        <>
          <ol>
            {visibles.map((x, i) => (
              <li key={x.id} className="flex gap-3.5">
                {/* El punto y la línea. La línea no se dibuja en el
                    último, si no queda colgando de la nada. */}
                <div className="flex flex-col items-center shrink-0 pt-1.5">
                  <span className={`w-2 h-2 rounded-full ${
                    x.tipo === "pagos" ? "bg-texto-tenue" : "bg-acento"}`} />
                  {i < visibles.length - 1 && (
                    <span className="w-px flex-1 bg-borde mt-1" />
                  )}
                </div>

                <div className="min-w-0 pb-6 flex-1">
                  <div className="text-[11px] uppercase tracking-[0.08em] text-texto-tenue">
                    {x.fecha.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
                  </div>
                  <div className="flex items-start justify-between gap-3 mt-1">
                    <div className="min-w-0">
                      <div className="text-[15px]">{x.titulo}</div>
                      {x.detalle && (
                        <div className="text-sm text-texto-suave mt-0.5">{x.detalle}</div>
                      )}
                    </div>
                    {x.monto != null && (
                      <div className="f-m text-[15px] shrink-0">{money(x.monto)}</div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>

          {lista.length > visibles.length && (
            <button onClick={() => setCuantos((n) => n + 20)}
              className="w-full text-center text-[13px] text-acento font-semibold py-2">
              Ver más
            </button>
          )}
        </>
      )}
    </Pantalla>
  );
}



/* ------------------------------------------------------------
   CUENTA
   ------------------------------------------------------------ */

/* El aviso de instalar aparece solo si el navegador dice que se puede.

   No se le pide permiso a nadie: se escucha el evento que el navegador
   dispara cuando la app cumple los requisitos, y recién ahí se ofrece.
   Un botón "Instalar" que en la mitad de los teléfonos no hace nada es
   peor que no tenerlo.

   iOS no dispara ese evento: ahí se instala desde Compartir → Agregar a
   inicio, y no hay forma de ofrecerlo desde la página. Por eso el texto
   dice cómo, en vez de prometer un botón que Safari no va a mostrar. */
function Instalar({ marca }) {
  const [prompt, setPrompt] = React.useState(null);
  const [listo, setListo] = React.useState(false);

  React.useEffect(() => {
    const alPoder = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener("beforeinstallprompt", alPoder);
    return () => window.removeEventListener("beforeinstallprompt", alPoder);
  }, []);

  /* Ya instalada: no se ofrece instalar de nuevo. */
  const yaEsApp = typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone);

  const esIOS = typeof navigator !== "undefined" &&
    /iphone|ipad|ipod/i.test(navigator.userAgent);

  if (yaEsApp || listo) return null;
  if (!prompt && !esIOS) return null;

  return (
    <Seccion titulo={`Tener ${marca.nombre} a mano`}>
      <Tarjeta>
        {prompt ? (
          <>
            <p className="text-sm text-texto-suave leading-relaxed">
              Instalala y te queda en la pantalla de inicio, como cualquier
              aplicación.
            </p>
            <div className="mt-4">
              <Boton onClick={async () => {
                prompt.prompt();
                await prompt.userChoice;
                setPrompt(null); setListo(true);
              }}>
                Instalar
              </Boton>
            </div>
          </>
        ) : (
          <p className="text-sm text-texto-suave leading-relaxed">
            Para tenerla en la pantalla de inicio: tocá Compartir y después
            "Agregar a inicio".
          </p>
        )}
      </Tarjeta>
    </Seccion>
  );
}
/* ------------------------------------------------------------
   AVISOS · pantalla 15 de la maqueta

   Lo que el comercio le mandó, en un solo lugar. No es un canal nuevo:
   son los mismos mensajes que salieron por WhatsApp desde Comunicaciones
   y desde CRM. Quien abre la app ve lo mismo que le llegó al teléfono.

   NO HAY PANTALLA DE DETALLE
   La maqueta tiene una (la 16): un mensaje abierto, con su imagen y un
   botón "Ir a la tienda". Eso es una promoción, y las promociones son del
   módulo de beneficios, que no existe.

   Lo que sí existe son estos: dos renglones de texto que el comercio
   escribió a mano. Abrir una pantalla para mostrar dos renglones que ya
   se leen enteros en la lista es un toque de más que no muestra nada
   nuevo. Cuando haya promociones con imagen, la pantalla 16 se justifica
   sola.

   Y NO HAY "MARCAR TODAS COMO LEÍDAS"
   Se marcan solas al entrar, que es cuando efectivamente las vio. Un
   botón para declarar que leyó lo que tiene delante es trabajo que la
   pantalla puede hacer sin preguntar.
   ------------------------------------------------------------ */

const FICHAS = [
  ["todas", "Todas"],
  ["turnos", "Turnos"],
  ["novedades", "Novedades"],
];

export function Avisos({ avisos, varios, onVolver }) {
  const [ficha, setFicha] = React.useState("todas");

  const lista = avisos.filter((a) =>
    ficha === "todas" ? true : ficha === "turnos" ? a.deTurno : !a.deTurno);

  return (
    <Pantalla titulo="Avisos" onVolver={onVolver}>
      <div className="flex gap-2 mb-6">
        {FICHAS.map(([k, n]) => (
          <button key={k} onClick={() => setFicha(k)}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
              ficha === k
                ? "bg-superficie border-borde-fuerte text-texto"
                : "border-borde text-texto-suave hover:text-texto"
            }`}>
            {n}
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <Vacio icono="casa" titulo="No hay avisos">
          Acá van a aparecer los mensajes que te mande {varios ? "cada comercio" : "el comercio"}:
          los recordatorios de tus turnos y lo que te quieran contar.
        </Vacio>
      ) : (
        lista.map((a) => (
          <Tarjeta key={a.id} className="mb-2.5">
            <div className="flex items-start gap-3">
              {/* El punto de lo no visto. Se apaga solo al entrar, así que
                  a la segunda vuelta no está: es una marca de "esto es de
                  ahora" y no un estado que haya que administrar. */}
              <span className={`w-2 h-2 rounded-full shrink-0 mt-2 ${
                a.nuevo ? "bg-acento" : "bg-transparent"}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[11px] uppercase tracking-[0.08em] text-texto-tenue">
                    {a.deTurno ? "Tu turno" : "Del comercio"}
                    {varios && ` · ${a.empresa}`}
                  </span>
                  <span className="text-[11px] text-texto-tenue shrink-0">
                    {a.fecha.toLocaleDateString("es-AR", { day: "numeric", month: "short" })
                      .replace(".", "")}
                  </span>
                </div>
                <p className="text-sm mt-1.5 leading-relaxed">{a.texto}</p>
              </div>
            </div>
          </Tarjeta>
        ))
      )}
    </Pantalla>
  );
}

/* ------------------------------------------------------------
   MI CUENTA · pantalla 17 de la maqueta

   Era una tarjeta con el correo adentro y dos tercios de pantalla en
   blanco. La maqueta la resuelve como lo que es: una portada con quien
   sos y una lista de lugares a los que se entra.

   LAS FILAS QUE NO EXISTEN NO SE DIBUJAN
   La maqueta lista seis: Mis datos, Métodos de pago, Notificaciones,
   Seguridad, Ayuda y Cerrar sesión. Están las que llevan a algo. Una fila
   que no hace nada no es "casi lista": es una promesa incumplida en la
   pantalla donde alguien va a buscar ayuda.

   Se agregan solas cuando exista cada cosa.
   ------------------------------------------------------------ */

function FilaCuenta({ icono: Ico, nombre, sub, onTocar, tono = "" }) {
  return (
    <button onClick={onTocar}
      className="w-full flex items-center gap-3.5 px-4 py-3.5 min-h-[44px] text-left border-b border-borde last:border-b-0 hover:bg-superficie-2 transition-colors">
      <Ico size={17} className={`shrink-0 ${tono || "text-texto-tenue"}`} />
      <span className="min-w-0 flex-1">
        <span className={`block text-[15px] ${tono}`}>{nombre}</span>
        {sub && <span className="block text-[13px] text-texto-tenue mt-0.5 truncate">{sub}</span>}
      </span>
      <ChevronRight size={16} className="text-texto-tenue shrink-0" />
    </button>
  );
}

export function Cuenta({ marca, comercio, email, comercios, onSalir, onVerPerfil }) {
  return (
    <Pantalla titulo="Mi cuenta">
      {/* La portada: quién sos, no cómo te logueás. La inicial en vez de
          una foto porque no hay ninguna cargada y un círculo gris vacío
          dice menos que una letra. */}
      <div className="flex items-center gap-4 mb-6">
        <span className="w-14 h-14 shrink-0 rounded-full bg-superficie-2 flex items-center justify-center text-lg font-bold text-texto-suave">
          {(comercio && comercio.miNombre ? comercio.miNombre : "?")
            .trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="f-d text-xl truncate">
            {comercio && comercio.miNombre ? comercio.miNombre : "Tu cuenta"}
          </div>
          <div className="text-sm text-texto-suave truncate">{email}</div>
        </div>
      </div>

      <div className="bg-superficie border border-borde rounded-xl overflow-hidden">
        <FilaCuenta icono={User} nombre="Mis datos"
          sub="Tu correo, tu teléfono y tu domicilio" onTocar={onVerPerfil} />
      </div>

      {/* Solo si hay más de uno. Con un comercio, decir "dónde sos
          cliente" es contarle a alguien algo que ya sabe. */}
      {comercios.length > 1 && (
        <Seccion titulo="Dónde sos cliente">
          {comercios.map((c) => (
            <Tarjeta key={c.empresaId} className="mb-2.5">
              <div className="flex items-center gap-2.5">
                <Building2 size={15} className="text-texto-tenue shrink-0" />
                <span className="text-[15px]">{c.nombre}</span>
                {c.desde && (
                  <span className="text-[13px] text-texto-tenue ml-auto shrink-0">
                    desde {c.desde.getFullYear()}
                  </span>
                )}
              </div>
            </Tarjeta>
          ))}
        </Seccion>
      )}

      <Instalar marca={marca} />

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

/* ------------------------------------------------------------
   MIS DATOS · pantalla 18 de la maqueta

   Lo que puede corregir y lo que no, con la razón a la vista en vez de un
   campo apagado sin explicación.

   El nombre y el correo con el que entra se muestran igual, en gris.
   Esconderlos sería fingir que no existen, y quien viene a cambiar el
   nombre tiene que enterarse acá de a quién pedírselo, no descubrir que
   no está.

   Ver 0063 para por qué cada uno cae de un lado o del otro.
   ------------------------------------------------------------ */

export function MisDatos({ marca, comercio, email, onVolver, onGuardar }) {
  const [d, setD] = React.useState({
    email: (comercio && comercio.miEmail) || "",
    tel: (comercio && comercio.miTel) || "",
    domicilio: (comercio && comercio.miDomicilio) || "",
    nacimiento: (comercio && comercio.miNacimiento) || "",
  });
  const [yendo, setYendo] = React.useState(false);
  const [error, setError] = React.useState("");
  const [listo, setListo] = React.useState(false);

  const campo = "w-full bg-superficie border border-borde rounded-lg px-3.5 py-3 text-base mt-1.5 outline-none text-texto placeholder:text-texto-tenue focus:border-acento transition-colors";
  const cambiar = (k) => (e) => { setD({ ...d, [k]: e.target.value }); setListo(false); setError(""); };

  async function guardar(e) {
    e.preventDefault();
    if (yendo) return;
    setYendo(true); setError("");
    try {
      await onGuardar(d);
      setListo(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setYendo(false);
    }
  }

  return (
    <Pantalla titulo="Mis datos" onVolver={onVolver}>
      {/* Lo que el comercio maneja. En gris y con el porqué al lado. */}
      <Tarjeta className="mb-6">
        <div className={ROTULO}>Los maneja {marca.nombre}</div>
        <div className="text-[15px] mt-3">{(comercio && comercio.miNombre) || "—"}</div>
        <div className="text-sm text-texto-suave mt-1 break-all">{email}</div>
        <p className="text-[13px] text-texto-tenue mt-3 leading-relaxed">
          Tu nombre es con el que {marca.nombre} te factura, y ese correo es
          con el que entrás. Si alguno está mal, pediles que lo cambien.
        </p>
      </Tarjeta>

      <form onSubmit={guardar} className="space-y-4">
        <label className="block">
          <span className={ROTULO}>A dónde te escribimos</span>
          <input type="email" value={d.email} onChange={cambiar("email")}
            className={campo} placeholder="ejemplo@correo.com" inputMode="email" />
        </label>

        <label className="block">
          <span className={ROTULO}>Teléfono</span>
          <input type="tel" value={d.tel} onChange={cambiar("tel")}
            className={campo} placeholder="11 5555 5555" inputMode="tel" />
        </label>

        <label className="block">
          <span className={ROTULO}>Domicilio</span>
          <input type="text" value={d.domicilio} onChange={cambiar("domicilio")}
            className={campo} placeholder="Calle y número" />
        </label>

        <label className="block">
          <span className={ROTULO}>Fecha de nacimiento</span>
          <input type="date" value={d.nacimiento} onChange={cambiar("nacimiento")}
            className={campo} />
        </label>

        {error && (
          <div className="text-sm text-mal border border-mal bg-mal-suave rounded-lg px-3.5 py-3">
            {error}
          </div>
        )}

        {/* Se avisa que quedó guardado y no se sale de la pantalla: quien
            corrigió el teléfono suele querer corregir también la dirección,
            y devolverlo a la lista lo obliga a entrar de nuevo. */}
        {listo && !error && (
          <div className="text-sm text-bien border border-bien bg-bien-suave rounded-lg px-3.5 py-3">
            Listo, lo guardamos.
          </div>
        )}

        <button type="submit" disabled={yendo}
          className="w-full bg-acento hover:bg-acento-vivo disabled:opacity-50 text-sobre-acento font-bold rounded-lg px-4 py-3 text-[15px] transition-colors">
          {yendo ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>
    </Pantalla>
  );
}