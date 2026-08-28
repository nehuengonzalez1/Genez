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

export function Inicio({ marca, nombre, turnos, abonos, hayModulo, onIr, onReservar, onAbrirTurno }) {
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

/* El mes y el año, sin el día: "desde el 14 de abril de 2026" es una
   precisión que no le sirve a nadie y se lee peor. */
const mesYAno = (d) =>
  d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });

export function Cuenta({ marca, comercio, email, comercios, onSalir }) {
  return (
    <Pantalla titulo="Mi cuenta">
      {/* Acá había un correo y nada más: una tarjeta con rótulo para un
          solo dato, y dos tercios de pantalla en blanco abajo.

          El nombre y desde cuándo ya venían en `mis_comercios` y no los
          mostraba nadie. No es llenar la pantalla: es que "Mi cuenta"
          diga quién sos y no cómo te logueás.

          El nombre sale de la ficha del comercio y no de la cuenta,
          porque es el que el comercio usa: la misma persona puede estar
          anotada distinto en dos lados. */}
      <Tarjeta className="mb-6">
        <div className={ROTULO}>Tus datos</div>

        {comercio && comercio.miNombre && (
          <div className="text-lg mt-3">{comercio.miNombre}</div>
        )}

        {/* Se parte y no se corta. Con `truncate` el correo entraba justo
            —253px en 253— así que en un teléfono un poco más angosto le
            faltaba el final, y es el único lugar de la app donde se
            muestra. Un dato cortado es peor que un renglón de más. */}
        <div className="mt-2 flex items-start gap-2.5 text-[15px]">
          <Mail size={15} className="text-texto-tenue shrink-0 mt-1" />
          <span className="break-all">{email}</span>
        </div>

        {comercio && comercio.desde && (
          <div className="text-sm text-texto-suave mt-3">
            Con {marca.nombre} desde {mesYAno(comercio.desde)}
          </div>
        )}
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
