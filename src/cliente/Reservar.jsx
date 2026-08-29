/* ============================================================
   RESERVAR
   ============================================================

   DOS PASOS Y NO CUATRO
   ---------------------
   La maqueta muestra cuatro campos —servicio, profesional, fecha,
   horario— que es la forma de un formulario de escritorio. En un teléfono
   eso son cuatro pantallas para elegir una cosa.

   Acá son dos: qué querés, y cuándo. La fecha no se elige antes: se ven
   los horarios agrupados por día y se toca uno, que es una decisión en
   vez de tres. Y el profesional queda como filtro y no como paso, porque
   la mayoría no tiene preferencia y la que sí la tiene lo busca.

   Para una clase, además, el profesional y la fecha **no son elegibles**:
   los eligió el comercio al publicarla. Preguntarlos sería ofrecer una
   libertad que no existe.

   LO QUE SE PUEDE ELEGIR SALE DE LA BASE
   --------------------------------------
   Ni un horario se calcula acá. `horarios_libres` ya devuelve solo lo
   reservable: descuenta la anticipación mínima del comercio, las clases
   llenas y las que ya tiene tomadas. Si la pantalla filtrara además por
   su cuenta, la primera vez que cambie una regla habría dos verdades.

   Y ES LA MISMA PANTALLA PARA MOVER UN TURNO
   ------------------------------------------
   Con `moviendo` se entra desde el detalle de un turno en vez de desde
   cero. Cambia poco y a propósito: elegir horario es elegir horario, y
   quien acaba de reservar la semana pasada no tiene que aprender otra
   pantalla para correr el mismo turno dos días.

   Lo único que se saca es la elección de servicio, que deja de ser una
   pregunta: mover es el mismo turno en otra hora. Cambiar de servicio es
   cancelar y sacar otro, con otro precio, y la base lo rechaza igual
   (P00D4).
   ============================================================ */

import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, X, Check, AlertTriangle, Users } from "lucide-react";
import {
  cargarServicios, cargarHorarios, reservar, anotarmeEnEspera, moverTurno,
} from "../datos/cliente.js";
import {
  Pantalla, Tarjeta, Boton, Cargando, Vacio, Error as ErrorEstado, ROTULO, hora,
} from "./ui.jsx";

const money = (n) =>
  "$" + Math.round(n).toLocaleString("es-AR");

/* Los horarios vienen ordenados; agruparlos por día es lo que convierte
   una lista larga en algo que se puede recorrer con el pulgar. */
function porDia(horarios) {
  const grupos = [];
  for (const h of horarios) {
    const clave = h.desde.toDateString();
    let g = grupos.find((x) => x.clave === clave);
    if (!g) {
      g = { clave, fecha: h.desde, horarios: [] };
      grupos.push(g);
    }
    g.horarios.push(h);
  }
  return grupos;
}

function tituloDia(d) {
  const hoy = new Date();
  const manana = new Date(hoy);
  manana.setDate(hoy.getDate() + 1);
  const mismo = (a, b) => a.toDateString() === b.toDateString();

  if (mismo(d, hoy)) return "Hoy";
  if (mismo(d, manana)) return "Mañana";
  return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
}

/* ------------------------------------------------------------
   Paso 1 · Qué, con quién y cuándo · pantalla 7 de la maqueta

   La maqueta muestra una pantalla con filas —Servicio, Profesional,
   Fecha, Horario, Sala— y un botón "Ver disponibilidad". Lo construido
   era otra cosa: elegir servicio y saltar directo a la grilla de
   horarios, con el argumento de que en un teléfono cuatro campos son
   cuatro pantallas.

   Ese argumento era contra una maqueta que no había mirado: no son
   cuatro pantallas, es una con cuatro filas. Y la diferencia importa,
   porque quien va siempre con la misma profesional hoy tiene que
   buscarla entre 43 horarios en vez de decir su nombre una vez.

   SOLO EL SERVICIO ES OBLIGATORIO
   Lo demás son filtros que se pueden saltear. Quien no tiene preferencia
   toca Servicio y va derecho a los horarios, que es el camino que la
   versión anterior hacía bien y no había que perder.

   LAS OPCIONES SALEN DE LOS HUECOS, NO DE UNA LISTA DE PERSONAL
   No hay ninguna función nueva ni ninguna tabla más expuesta:
   `horarios_libres` ya devuelve el profesional y la sala de cada hueco,
   así que las opciones son exactamente los que tienen disponibilidad.

   Eso además arregla solo un problema que una lista de personal tendría:
   nunca se ofrece una profesional que no puede atender, y una que se fue
   de vacaciones desaparece del filtro sin que nadie la dé de baja.

   Un filtro que dejaría la lista vacía no se ofrece: si Camila no tiene
   nada el jueves, el jueves no aparece cuando Camila está elegida.
   ------------------------------------------------------------ */

/* Los cuatro puntos de la maqueta. No son pasos obligatorios —tres de las
   cuatro filas se pueden saltear— sino lo que ya eligió: prender uno
   cuenta algo, y numerarlos en una pantalla donde el orden no manda
   contaría algo falso. */
function Puntos({ hechos }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className={`h-1.5 rounded-full transition-all ${
          i < hechos ? "w-6 bg-acento" : "w-1.5 bg-borde"}`} />
      ))}
    </div>
  );
}

function Fila({ rotulo, valor, vacio, onTocar, apagada, fijo }) {
  const contenido = (
    <>
      <span className="text-sm text-texto-suave shrink-0">{rotulo}</span>
      <span className="flex items-center gap-2 min-w-0">
        <span className={`text-[15px] truncate ${valor ? "" : "text-texto-tenue"}`}>
          {valor || vacio}
        </span>
        {!fijo && <ChevronRight size={16} className="text-texto-tenue shrink-0" />}
      </span>
    </>
  );

  /* Fijo no es lo mismo que apagado. `apagada` baja al 40%, que está bien
     para un filtro que todavía no se puede tocar y está mal acá: moviendo
     un turno, el servicio es el dato que dice qué se está moviendo y
     tiene que leerse. Lo que se saca es el chevron, que es lo que promete
     que algo se abre. */
  const caja = "w-full flex items-center justify-between gap-3 px-4 py-3.5 min-h-[44px] text-left border-b border-borde last:border-b-0";

  if (fijo) return <div className={caja}>{contenido}</div>;

  return (
    <button onClick={onTocar} disabled={apagada}
      className={`${caja} transition-colors ${apagada ? "opacity-40" : "hover:bg-superficie-2"}`}>
      {contenido}
    </button>
  );
}

/* La lista que se abre al tocar una fila. Va como hoja de abajo por lo
   mismo que el detalle del turno: elegir entre seis cosas no merece
   perder de vista la pantalla desde donde se eligió. */
function Elegir({ titulo, opciones, valor, onElegir, onCerrar }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-fondo/60 backdrop-blur-[2px]" onClick={onCerrar} />
      <div className="relative w-full max-w-lg bg-superficie rounded-t-2xl border-t border-x border-borde max-h-[75vh] overflow-auto seguro-abajo">
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
          <div className={ROTULO}>{titulo}</div>
          <button onClick={onCerrar} aria-label="Cerrar"
            className="-mr-2 w-[44px] h-[44px] flex items-center justify-center text-texto-tenue hover:text-texto">
            <X size={20} />
          </button>
        </div>
        <div className="px-5 pb-5">
          {opciones.map((o) => (
            <button key={o.k} onClick={() => { onElegir(o.k); onCerrar(); }}
              className={`w-full text-left px-4 py-3 min-h-[44px] rounded-lg border mb-2 transition-colors ${
                o.k === valor
                  ? "border-acento bg-acento-suave/40"
                  : "border-borde hover:border-borde-fuerte"}`}>
              <div className="text-[15px]">{o.n}</div>
              {o.sub && <div className="text-[13px] text-texto-tenue mt-0.5">{o.sub}</div>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Filtros({
  servicios, servicio, horarios, buscando, moviendo,
  personal, dia, recurso, onCambiar, onElegirServicio, onVer,
}) {
  const [abierta, setAbierta] = useState(null);

  /* Lo que se puede elegir sale de los huecos que hay, y cada filtro se
     calcula sobre lo que dejan pasar los otros dos. Así no se ofrece una
     combinación que no existe: elegir a Camila y después un día en el que
     Camila no trabaja daría una lista vacía y la culpa parecería del
     sistema. */
  const pasa = (h, salvo) =>
    (salvo === "personal" || !personal || h.personalId === personal) &&
    (salvo === "dia" || !dia || h.desde.toDateString() === dia) &&
    (salvo === "recurso" || !recurso || h.recursoId === recurso);

  const unicos = (campo, nombre, salvo) => {
    const vistos = new Map();
    for (const h of horarios) {
      if (!h[campo] || !pasa(h, salvo)) continue;
      if (!vistos.has(h[campo])) vistos.set(h[campo], h[nombre]);
    }
    return [...vistos].map(([k, n]) => ({ k, n }));
  };

  const profesionales = unicos("personalId", "profesional", "personal");
  const salas = unicos("recursoId", "recurso", "recurso");

  const dias = [];
  const diasVistos = new Set();
  for (const h of horarios) {
    const k = h.desde.toDateString();
    if (diasVistos.has(k) || !pasa(h, "dia")) continue;
    diasVistos.add(k);
    dias.push({ k, n: tituloDia(h.desde) });
  }

  const nombreDe = (lista, k) => (lista.find((o) => o.k === k) || {}).n || "";
  const cuantos = horarios.filter((h) => pasa(h)).length;

  /* Cuántas de las cuatro ya están decididas. El horario se elige en la
     pantalla siguiente, así que acá el cuarto punto nunca se prende: es
     lo que falta hacer y por eso el botón dice "ver disponibilidad". */
  const hechos = [servicio, personal, dia].filter(Boolean).length;

  return (
    <>
      <Puntos hechos={hechos} />

      {moviendo && (
        <p className="text-[15px] text-texto-suave -mt-2 mb-5 leading-relaxed">
          Ahora lo tenés {tituloDia(moviendo.desde).toLowerCase()} a
          las {hora(moviendo.desde)}. Elegí cuándo te queda mejor.
        </p>
      )}

      <div className="bg-superficie border border-borde rounded-xl overflow-hidden">
        <Fila rotulo="Servicio" valor={servicio && servicio.nombre}
          vacio="Elegir" fijo={!!moviendo} onTocar={() => setAbierta("servicio")} />

        {/* Los filtros se apagan hasta que haya servicio: no hay de qué
            listar profesionales todavía. */}
        <Fila rotulo="Profesional" valor={nombreDe(profesionales, personal)}
          vacio="Cualquiera" apagada={!servicio || profesionales.length < 2}
          onTocar={() => setAbierta("personal")} />

        <Fila rotulo="Fecha" valor={nombreDe(dias, dia)}
          vacio="Cualquiera" apagada={!servicio || !dias.length}
          onTocar={() => setAbierta("dia")} />

        {salas.length > 1 && (
          <Fila rotulo="Sala o equipo" valor={nombreDe(salas, recurso)}
            vacio="Cualquiera" apagada={!servicio}
            onTocar={() => setAbierta("recurso")} />
        )}
      </div>

      {servicio && !buscando && (
        <p className="text-[13px] text-texto-tenue mt-3">
          {cuantos === 0
            ? "Con esos filtros no queda ningún horario."
            : cuantos === 1 ? "Queda 1 horario." : `Quedan ${cuantos} horarios.`}
        </p>
      )}

      <div className="mt-7">
        <Boton onClick={onVer} disabled={!servicio || buscando || cuantos === 0}>
          {buscando ? "Buscando…" : "Ver disponibilidad"}
        </Boton>
      </div>

      {abierta === "servicio" && (
        <Elegir titulo="Qué querés reservar" valor={servicio && servicio.id}
          opciones={servicios.map((s) => ({
            k: s.id, n: s.nombre,
            sub: `${s.duracionMin} min${s.enClase ? " · en clase" : ""} · ${money(s.precio)}`,
          }))}
          onElegir={(id) => onElegirServicio(servicios.find((s) => s.id === id))}
          onCerrar={() => setAbierta(null)} />
      )}

      {abierta === "personal" && (
        <Elegir titulo="Con quién" valor={personal}
          opciones={[{ k: null, n: "Cualquiera" }, ...profesionales]}
          onElegir={(k) => onCambiar("personal", k)} onCerrar={() => setAbierta(null)} />
      )}

      {abierta === "dia" && (
        <Elegir titulo="Qué día" valor={dia}
          opciones={[{ k: null, n: "Cualquiera" }, ...dias]}
          onElegir={(k) => onCambiar("dia", k)} onCerrar={() => setAbierta(null)} />
      )}

      {abierta === "recurso" && (
        <Elegir titulo="En qué sala" valor={recurso}
          opciones={[{ k: null, n: "Cualquiera" }, ...salas]}
          onElegir={(k) => onCambiar("recurso", k)} onCerrar={() => setAbierta(null)} />
      )}
    </>
  );
}

/* ------------------------------------------------------------
   Paso 2 · Cuándo
   ------------------------------------------------------------ */

function ElegirHorario({ servicio, horarios, cargando, onElegir }) {
  if (cargando) return <Cargando>Buscando horarios…</Cargando>;

  if (!horarios.length) {
    return (
      <Vacio icono="calendario" titulo="No hay horarios disponibles">
        {servicio.enClase
          ? "No quedan clases con lugar en los próximos días. Probá más adelante."
          : "No hay huecos libres en los próximos días."}
      </Vacio>
    );
  }

  /* El nombre se dice una sola vez, lo más arriba que se pueda.

     Medido antes de tocar esto: 43 huecos en 8 días, y una sola
     profesional. En una lista de tarjetas eso era "Carla Gómez" escrito
     43 veces, con el peso tipográfico de un dato que hay que leer.

     Tres niveles, del más general al más puntual, porque un comercio
     puede tener una sola profesional, una por día, o varias el mismo
     día. Solo el último caso lo escribe en cada hueco, que es cuando de
     verdad distingue uno de otro. */
  const quien = (h) => h.profesional || "";
  const unicos = (hs) => [...new Set(hs.map(quien).filter(Boolean))];
  const deTodos = unicos(horarios);
  const comunTodos = deTodos.length === 1 ? deTodos[0] : null;

  return (
    <div className="space-y-6">
      {comunTodos && (
        <p className="text-sm text-texto-suave -mt-2">Con {comunTodos}</p>
      )}

      {porDia(horarios).map((g) => {
        const delDia = unicos(g.horarios);
        const comunDia = !comunTodos && delDia.length === 1 ? delDia[0] : null;
        const enCadaHueco = !comunTodos && !comunDia;

        return (
          <section key={g.clave}>
            <div className="mb-2.5">
              <div className={ROTULO}>{tituloDia(g.fecha)}</div>
              {comunDia && (
                <div className="text-sm text-texto-suave mt-1">Con {comunDia}</div>
              )}
            </div>

            {/* Tres columnas y no una pila.

                Elegir turno es comparar horas, y en vertical, con una
                tarjeta de 77px entre número y número, las horas del
                mismo día no se ven juntas: eran 5,8 pantallas de scroll
                para 43 huecos. Así cada día entra en dos filas.

                Tres entra hasta en un teléfono de 320px, que es donde se
                mide esto: la celda queda en 87px con 61 de espacio
                adentro, y lo más ancho que lleva —COMPLETA— mide 56. */}
            <div className="grid grid-cols-3 gap-2.5">
              {g.horarios.map((h, i) => (
                <button key={h.claseId || `${h.desde.toISOString()}-${i}`}
                  onClick={() => onElegir(h)}
                  /* El `min-h` no es decoración: con `py-3` y la hora en
                     `leading-none` la celda medía 43px, uno menos que el
                     mínimo que `ui.jsx` se fija para lo que se toca con
                     el pulgar. Y acá hay 43 de estos, uno al lado del
                     otro. */
                  className={`bg-superficie border rounded-lg px-3 py-3 min-h-[44px] text-left transition-colors ${
                    h.lugares === 0 ? "border-borde opacity-70 hover:opacity-100" : "border-borde hover:border-acento"}`}>
                  <div className="f-m text-[17px] leading-none">{hora(h.desde)}</div>

                  {enCadaHueco && h.profesional && (
                    <div className="text-[11px] text-texto-suave mt-1.5 truncate">
                      {h.profesional}
                    </div>
                  )}

                  {/* Los lugares solo cuando son varios: en un turno
                      individual "1 lugar" no le dice nada a nadie. */}
                  {h.claseId && h.lugares > 0 && (
                    <div className="flex items-center gap-1 text-[11px] text-texto-tenue mt-1.5">
                      <Users size={12} />
                      {h.lugares}
                    </div>
                  )}

                  {/* Una clase llena no se esconde: es otra cosa que se
                      puede hacer, no un horario que no sirve.

                      Sin el recuadro que tenía en la lista: en una celda
                      de 87px el borde y el fondo se comen el ancho, y el
                      color solo ya dice lo mismo.

                      Y dice "En lista" y no "En la lista", que medido
                      daba 63px contra los 61 de espacio que hay a 320px:
                      se desbordaba por dos. Corto y sin género, que es lo
                      que corresponde en un motor que mañana atiende a
                      cualquiera. */}
                  {h.claseId && h.lugares === 0 && (
                    <div className="text-[10px] uppercase tracking-wider font-bold text-ojo mt-1.5 whitespace-nowrap">
                      {h.enEspera ? "En lista" : "Completa"}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------
   Paso 3 · Confirmar

   Una pantalla propia y no un `confirm()`: es el único momento donde se
   ve junto todo lo que se está por reservar, y es más barato corregir un
   error acá que cancelar un turno después.
   ------------------------------------------------------------ */

function Confirmar({ servicio, horario, moviendo, yendo, error, onConfirmar, onVolver }) {
  /* Una clase llena no se reserva: se pide lugar. Es la misma pantalla
     porque lo que se está por hacer se lee igual —qué, cuándo, con
     quién— y lo único que cambia es qué significa el botón.

     Moviendo no aplica: dejar un turno confirmado para entrar en una
     lista de espera es cambiar algo seguro por algo que quizás, y no hay
     forma de que eso sea lo que alguien quiso. Los horarios completos ni
     se ofrecen. */
  const esEspera = !moviendo && horario.lugares === 0;

  if (horario.enEspera) {
    return (
      <div className="space-y-5">
        <Tarjeta>
          <div className={ROTULO}>Ya estás en la lista</div>
          <div className="mt-3 space-y-2.5">
            <div className="text-lg">{servicio.nombre}</div>
            <div className="text-[15px] text-texto-suave">
              {tituloDia(horario.desde)}, {hora(horario.desde)}
            </div>
          </div>
        </Tarjeta>
        <p className="text-sm text-texto-suave leading-relaxed">
          Si se libera un lugar, el local te avisa. Podés bajarte de la lista
          desde tus turnos.
        </p>
        <Boton variante="suave" onClick={onVolver}>Elegir otro horario</Boton>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Tarjeta>
        <div className={ROTULO}>
          {moviendo ? "Vas a cambiar el horario" : esEspera ? "Vas a pedir lugar" : "Vas a reservar"}
        </div>
        <div className="mt-3 space-y-2.5">
          <div className="text-lg">{servicio.nombre}</div>

          {/* Las dos horas juntas, y la vieja tachada. Es el único momento
              donde se ven de qué a qué, y es más barato darse cuenta acá
              de que era el otro jueves que cancelar un turno después. */}
          {moviendo && (
            <div className="text-[15px] text-texto-tenue line-through">
              {tituloDia(moviendo.desde)}, {hora(moviendo.desde)}
            </div>
          )}
          <div className="text-[15px] text-texto-suave">
            {tituloDia(horario.desde)}, {hora(horario.desde)}
          </div>
          {horario.profesional && (
            <div className="text-[15px] text-texto-suave">Con {horario.profesional}</div>
          )}
          {horario.recurso && (
            <div className="text-sm text-texto-tenue">{horario.recurso}</div>
          )}
        </div>
      </Tarjeta>

      {error && (
        <div className="text-sm text-mal border border-mal bg-mal-suave rounded-lg px-4 py-3 leading-relaxed">
          {error}
        </div>
      )}

      {esEspera && (
        <p className="text-sm text-texto-suave leading-relaxed">
          Esta clase está completa
          {horario.esperando > 0 && ` y hay ${horario.esperando} esperando`}.
          Si se libera un lugar, el local te avisa: no entrás sola.
        </p>
      )}

      <div className="space-y-2.5">
        <Boton onClick={onConfirmar} disabled={yendo}>
          {yendo
            ? (moviendo ? "Cambiando…" : esEspera ? "Anotándote…" : "Reservando…")
            : (moviendo ? "Confirmar el cambio"
              : esEspera ? "Anotarme en la lista" : "Confirmar turno")}
        </Boton>
        <Boton variante="suave" onClick={onVolver} disabled={yendo}>
          Elegir otro horario
        </Boton>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   Listo
   ------------------------------------------------------------ */

function Listo({ servicio, horario, aviso, espera, moviendo, onVer, onOtro }) {
  return (
    <div className="text-center py-10">
      <div className="w-14 h-14 rounded-full bg-bien-suave border border-bien flex items-center justify-center mx-auto">
        <Check size={26} className="text-bien" />
      </div>
      <h2 className="f-d text-xl mt-5">
        {moviendo ? "Horario cambiado" : espera ? "Estás en la lista" : "Turno reservado"}
      </h2>
      <p className="text-[15px] text-texto-suave mt-2">
        {servicio.nombre}, {tituloDia(horario.desde).toLowerCase()} a las {hora(horario.desde)}.
      </p>

      {/* En qué lugar de la fila quedó lo cuenta la base, no la pantalla:
          si tres de los de adelante se dieron de baja, decir "sos la
          cuarta" sería mentir. */}
      {espera && (
        <p className="text-[15px] text-texto-suave mt-3 leading-relaxed">
          {espera.lugar === 1
            ? "Sos la primera de la lista."
            : "Sos la número " + espera.lugar + " de la lista."}
          {" "}Si se libera un lugar, el local te avisa.
        </p>
      )}

      {/* El aviso viene de la base. No es un error y no impide nada: es
          algo que conviene que sepa. */}
      {aviso && (
        <div className="mt-6 text-sm text-ojo border border-ojo bg-ojo-suave rounded-lg px-4 py-3 text-left flex gap-2.5">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span className="leading-relaxed">{aviso}</span>
        </div>
      )}

      <div className="mt-8 space-y-2.5">
        <Boton onClick={onVer}>Ver mis turnos</Boton>
        {/* Moviendo no va: "reservar otro" después de cambiar un horario
            ofrece sacar un segundo turno a quien vino a correr el que
            tenía, que es lo contrario de lo que pidió. */}
        {!moviendo && <Boton variante="suave" onClick={onOtro}>Reservar otro</Boton>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   El flujo
   ------------------------------------------------------------ */

export function Reservar({ empresaId, moviendo = null, onCerrar, onReservado }) {
  /* El comercio del turno y no el de la app. Son el mismo casi siempre
     —la app es de un comercio— pero `mis_turnos` devuelve los de todos
     juntos, así que quien es clienta de la estética y del gimnasio puede
     estar mirando un turno del otro. */
  const emp = (moviendo && moviendo.empresaId) || empresaId;

  const [servicios, setServicios] = useState([]);
  /* Moviendo, el servicio ya está decidido: es el del turno. No sale de
     `cargarServicios` porque no hace falta el catálogo entero para saber
     lo que ya sabemos, y porque un servicio que el comercio dio de baja
     después de que ella reservara no estaría en esa lista y dejaría el
     turno sin poder moverse. */
  const [servicio, setServicio] = useState(() => moviendo && {
    id: moviendo.itemId,
    nombre: moviendo.servicio,
    enClase: moviendo.esClase,
    duracionMin: moviendo.duracionMin,
  });
  const [horarios, setHorarios] = useState([]);
  const [horario, setHorario] = useState(null);

  /* Los filtros de la pantalla 7. Van acá y no adentro de `Filtros`
     porque sobreviven a ir a los horarios y volver: quien eligió a
     Camila y se arrepintió del horario no tiene que volver a elegirla. */
  const [personal, setPersonal] = useState(null);
  const [dia, setDia] = useState(null);
  const [recurso, setRecurso] = useState(null);

  /* Se mira la disponibilidad o se están eligiendo los filtros. No es
     un paso más: es la misma pantalla 7 abierta o cerrada. */
  const [viendo, setViendo] = useState(false);
  const [hecho, setHecho] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [yendo, setYendo] = useState(false);
  const [error, setError] = useState("");
  const [errorCarga, setErrorCarga] = useState("");

  /* Los horarios se piden en tres momentos —al abrir, al elegir servicio y
     al releer después de un rechazo— y qué se ofrece tiene que ser lo
     mismo en los tres.

     Moviendo se sacan los completos: una clase llena es una opción cuando
     no tenés nada, pero cuando ya tenés el turno, cambiarlo por un lugar
     en una lista de espera es soltar lo seguro por lo que quizás.

     Estaba escrito en la carga de arriba y no en las otras dos, así que
     un rechazo de la base —"ese abono vence el 31/08"— releía la lista
     sin filtro y volvían a aparecer las clases completas. Lo encontró la
     captura, que es exactamente para lo que DISENO.md la pide. */
  const traerHorarios = useCallback(async (itemId) => {
    const hs = await cargarHorarios({ empresaId: emp, itemId });
    return moviendo ? hs.filter((h) => h.lugares > 0) : hs;
  }, [emp, moviendo]);

  const traerServicios = useCallback(() => {
    setCargando(true); setErrorCarga("");
    /* Moviendo se saltea el catálogo y se piden los horarios de una: la
       única pregunta que queda es cuándo. */
    if (moviendo) {
      return traerHorarios(moviendo.itemId)
        .then(setHorarios)
        .catch((e) => setErrorCarga(e.message))
        .finally(() => setCargando(false));
    }
    return cargarServicios(emp)
      .then(setServicios)
      .catch((e) => setErrorCarga(e.message))
      .finally(() => setCargando(false));
  }, [emp, moviendo, traerHorarios]);

  useEffect(() => { traerServicios(); }, [traerServicios]);

  async function elegirServicio(s) {
    /* Cambiar de servicio invalida los filtros: la profesional que daba
       reformer puede no dar faciales. */
    setServicio(s); setPersonal(null); setDia(null); setRecurso(null);
    setBuscando(true); setError("");
    try {
      setHorarios(await traerHorarios(s.id));
    } catch (e) {
      setErrorCarga(e.message);
    } finally {
      setBuscando(false);
    }
  }

  async function confirmar() {
    setYendo(true); setError("");
    try {
      /* Una clase llena no se reserva: se pide lugar. Son dos funciones
         distintas en la base, con reglas distintas. */
      const r = moviendo
        ? await moverTurno({ reservaId: moviendo.id, horario })
        : horario.lugares === 0
        ? { espera: await anotarmeEnEspera(horario.claseId) }
        : await reservar({ empresaId: emp, horario, itemId: servicio.id });
      /* Se guarda el horario junto con el resultado: despues de reservar
         ya no esta en la lista de disponibles —se lo acaba de tomar ella—
         asi que buscarlo de nuevo no lo encuentra. */
      setHecho({ ...r, horario });
      onReservado();
    } catch (e) {
      /* Se vuelve a la lista de horarios: si el error fue "esa clase se
         llenó recién", quedarse en la confirmación es ofrecerle apretar
         el mismo botón otra vez. */
      setError(e.message);
      setHorario(null);
      try {
        setHorarios(await traerHorarios(servicio.id));
      } catch { /* si tampoco se pueden releer, el error de arriba alcanza */ }
    } finally {
      setYendo(false);
    }
  }

  function atras() {
    /* Moviendo, terminar es volver: no hay a dónde empezar de nuevo si el
       servicio nunca se eligió. */
    if (hecho) {
      if (moviendo) return onCerrar();
      setHecho(null); setServicio(null); setHorario(null); setViendo(false); return;
    }
    if (horario) return setHorario(null);
    if (viendo) return setViendo(false);
    onCerrar();
  }

  const titulo = hecho ? ""
    : !viendo ? (moviendo ? "Cambiar el horario" : "Reservar turno")
    : !horario ? servicio.nombre
    : "Confirmar";

  return (
    <div className="max-w-lg mx-auto px-5 pb-28">
      <header className="pt-6 pb-4 flex items-center gap-2">
        {/* 44px, que es el mínimo que `ui.jsx` se fija a sí mismo para lo
            que se toca con el pulgar. Eran 38 —un ícono de 22 con 8 de
            padding— y es el único botón para volver de un recorrido de
            tres pasos: errarle es empezar de nuevo.

            En píxeles y no `w-11`, que es lo que uno escribiría. `w-11`
            son 2.75rem y acá el rem no vale 16: `index.css` lo baja a
            13.5 para achicar el sistema de gestión de una sola vez.
            Escrito así daba 37px, o sea que "arreglarlo" lo dejaba
            practicamente igual. Un mínimo para un dedo es una medida
            física y no puede depender de la escala del sistema.

            El -ml-[11px] es la mitad de lo que el área agrega alrededor
            del ícono: así el chevron sigue alineado con el borde del
            contenido y no se nota que el botón creció. */}
        <button onClick={atras} aria-label="Volver"
          className="-ml-[11px] w-[44px] h-[44px] flex items-center justify-center text-texto-suave hover:text-texto">
          <ChevronLeft size={22} />
        </button>
        <h1 className="f-d text-xl">{titulo || "Listo"}</h1>
      </header>

      {errorCarga ? (
        <ErrorEstado onReintentar={traerServicios}>{errorCarga}</ErrorEstado>
      ) : cargando ? (
        <Cargando />
      ) : hecho ? (
        <Listo servicio={servicio} horario={hecho.horario} aviso={hecho.aviso}
          espera={hecho.espera} moviendo={moviendo}
          onVer={onCerrar}
          onOtro={() => { setHecho(null); setServicio(null); setHorario(null); }} />
      ) : !viendo ? (
        <>
          {error && (
            <div className="mb-4 text-sm text-mal border border-mal bg-mal-suave rounded-lg px-4 py-3 leading-relaxed">
              {error}
            </div>
          )}
          <Filtros servicios={servicios} servicio={servicio} horarios={horarios}
            buscando={buscando} moviendo={moviendo}
            personal={personal} dia={dia} recurso={recurso}
            onElegirServicio={elegirServicio}
            onCambiar={(k, v) => ({ personal: setPersonal, dia: setDia, recurso: setRecurso }[k])(v)}
            onVer={() => setViendo(true)} />
        </>
      ) : !horario ? (
        <>
          {error && (
            <div className="mb-4 text-sm text-mal border border-mal bg-mal-suave rounded-lg px-4 py-3 leading-relaxed">
              {error}
            </div>
          )}
          {/* Elegir otro horario borra el error del anterior. Sin esto, un
              rechazo —"ese abono vence el 31/08"— seguía escrito en la
              confirmación del horario siguiente, diciéndole que no se
              puede algo que todavía nadie intentó. */}
          <ElegirHorario servicio={servicio} cargando={buscando}
            onElegir={(h) => { setError(""); setHorario(h); }}
            horarios={horarios.filter((h) =>
              (!personal || h.personalId === personal) &&
              (!dia || h.desde.toDateString() === dia) &&
              (!recurso || h.recursoId === recurso))} />
        </>
      ) : (
        <Confirmar servicio={servicio} horario={horario} moviendo={moviendo}
          yendo={yendo} error={error}
          onConfirmar={confirmar} onVolver={() => setHorario(null)} />
      )}
    </div>
  );
}
