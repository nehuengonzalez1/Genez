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
   ============================================================ */

import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, Check, AlertTriangle, Users } from "lucide-react";
import { cargarServicios, cargarHorarios, reservar, anotarmeEnEspera } from "../datos/cliente.js";
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
   Paso 1 · Qué
   ------------------------------------------------------------ */

function ElegirServicio({ servicios, onElegir }) {
  if (!servicios.length) {
    return (
      <Vacio icono="calendario" titulo="No hay servicios para reservar">
        Todavía no hay nada publicado para tomar turno.
      </Vacio>
    );
  }

  return (
    <div className="space-y-3">
      {servicios.map((s) => (
        <Tarjeta key={s.id} onClick={() => onElegir(s)}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[15px]">{s.nombre}</div>
              <div className="text-sm text-texto-suave mt-1">
                {s.duracionMin} min
                {s.enClase && " · en clase"}
              </div>
            </div>
            <div className="text-sm text-texto-suave shrink-0">{money(s.precio)}</div>
          </div>
        </Tarjeta>
      ))}
    </div>
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

  return (
    <div className="space-y-6">
      {porDia(horarios).map((g) => (
        <section key={g.clave}>
          <div className={`${ROTULO} mb-2.5`}>{tituloDia(g.fecha)}</div>
          <div className="space-y-2.5">
            {g.horarios.map((h, i) => (
              <button key={h.claseId || `${h.desde.toISOString()}-${i}`}
                onClick={() => onElegir(h)}
                className={`w-full text-left bg-superficie border rounded-xl px-4 py-3.5 transition-colors ${
                  h.lugares === 0 ? "border-borde opacity-70 hover:opacity-100" : "border-borde hover:border-acento"}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="f-m text-[17px]">{hora(h.desde)}</div>
                    <div className="text-sm text-texto-suave mt-0.5 truncate">
                      {h.profesional}
                      {h.recurso && ` · ${h.recurso}`}
                    </div>
                  </div>
                  {/* Los lugares solo cuando son varios: en un turno
                      individual "1 lugar" no le dice nada a nadie. */}
                  {h.claseId && h.lugares > 0 && (
                    <div className="flex items-center gap-1 text-[11px] text-texto-tenue shrink-0">
                      <Users size={12} />
                      {h.lugares}
                    </div>
                  )}
                  {/* Una clase llena no se esconde: es otra cosa que se
                      puede hacer, no un horario que no sirve. */}
                  {h.claseId && h.lugares === 0 && (
                    <div className="text-[10px] uppercase tracking-wider font-bold text-ojo border border-ojo bg-ojo-suave rounded px-1.5 py-0.5 shrink-0 whitespace-nowrap">
                      {h.enEspera ? "En la lista" : "Completa"}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------
   Paso 3 · Confirmar

   Una pantalla propia y no un `confirm()`: es el único momento donde se
   ve junto todo lo que se está por reservar, y es más barato corregir un
   error acá que cancelar un turno después.
   ------------------------------------------------------------ */

function Confirmar({ servicio, horario, yendo, error, onConfirmar, onVolver }) {
  /* Una clase llena no se reserva: se pide lugar. Es la misma pantalla
     porque lo que se está por hacer se lee igual —qué, cuándo, con
     quién— y lo único que cambia es qué significa el botón. */
  const esEspera = horario.lugares === 0;

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
        <div className={ROTULO}>{esEspera ? "Vas a pedir lugar" : "Vas a reservar"}</div>
        <div className="mt-3 space-y-2.5">
          <div className="text-lg">{servicio.nombre}</div>
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
            ? (esEspera ? "Anotándote…" : "Reservando…")
            : (esEspera ? "Anotarme en la lista" : "Confirmar turno")}
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

function Listo({ servicio, horario, aviso, espera, onVer, onOtro }) {
  return (
    <div className="text-center py-10">
      <div className="w-14 h-14 rounded-full bg-bien-suave border border-bien flex items-center justify-center mx-auto">
        <Check size={26} className="text-bien" />
      </div>
      <h2 className="f-d text-xl mt-5">
        {espera ? "Estás en la lista" : "Turno reservado"}
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
        <Boton variante="suave" onClick={onOtro}>Reservar otro</Boton>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   El flujo
   ------------------------------------------------------------ */

export function Reservar({ empresaId, onCerrar, onReservado }) {
  const [servicios, setServicios] = useState([]);
  const [servicio, setServicio] = useState(null);
  const [horarios, setHorarios] = useState([]);
  const [horario, setHorario] = useState(null);
  const [hecho, setHecho] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [yendo, setYendo] = useState(false);
  const [error, setError] = useState("");
  const [errorCarga, setErrorCarga] = useState("");

  const traerServicios = useCallback(() => {
    setCargando(true); setErrorCarga("");
    return cargarServicios(empresaId)
      .then(setServicios)
      .catch((e) => setErrorCarga(e.message))
      .finally(() => setCargando(false));
  }, [empresaId]);

  useEffect(() => { traerServicios(); }, [traerServicios]);

  async function elegirServicio(s) {
    setServicio(s); setBuscando(true); setError("");
    try {
      setHorarios(await cargarHorarios({ empresaId, itemId: s.id }));
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
      const r = horario.lugares === 0
        ? { espera: await anotarmeEnEspera(horario.claseId) }
        : await reservar({ empresaId, horario, itemId: servicio.id });
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
        setHorarios(await cargarHorarios({ empresaId, itemId: servicio.id }));
      } catch { /* si tampoco se pueden releer, el error de arriba alcanza */ }
    } finally {
      setYendo(false);
    }
  }

  function atras() {
    if (hecho) { setHecho(null); setServicio(null); setHorario(null); return; }
    if (horario) return setHorario(null);
    if (servicio) return setServicio(null);
    onCerrar();
  }

  const titulo = hecho ? "" : !servicio ? "¿Qué querés reservar?"
    : !horario ? servicio.nombre : "Confirmar";

  return (
    <div className="max-w-lg mx-auto px-5 pb-28">
      <header className="pt-6 pb-4 flex items-center gap-2">
        <button onClick={atras} className="-ml-2 p-2 text-texto-suave hover:text-texto">
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
          espera={hecho.espera}
          onVer={onCerrar}
          onOtro={() => { setHecho(null); setServicio(null); setHorario(null); }} />
      ) : !servicio ? (
        <ElegirServicio servicios={servicios} onElegir={elegirServicio} />
      ) : !horario ? (
        <>
          {error && (
            <div className="mb-4 text-sm text-mal border border-mal bg-mal-suave rounded-lg px-4 py-3 leading-relaxed">
              {error}
            </div>
          )}
          <ElegirHorario servicio={servicio} horarios={horarios}
            cargando={buscando} onElegir={setHorario} />
        </>
      ) : (
        <Confirmar servicio={servicio} horario={horario} yendo={yendo} error={error}
          onConfirmar={confirmar} onVolver={() => setHorario(null)} />
      )}
    </div>
  );
}
