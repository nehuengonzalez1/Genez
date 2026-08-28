/* ============================================================
   LA APP DEL CLIENTE
   ============================================================

   Entrada aparte del sistema de gestión, y no una ruta más adentro, por
   dos razones concretas:

   El peso. El bundle de gestión son 1,5 MB —punto de venta, salón,
   reportes, gráficos, lector de códigos de barras— y nada de eso tiene
   por qué viajar al teléfono de alguien que quiere saber a qué hora tiene
   turno.

   Y el alcance. Una PWA necesita su propio manifest, su ícono y su propio
   service worker. Metida adentro de la aplicación de gestión, "instalar"
   no significa nada claro.

   Mismo repositorio para que los colores, el cliente de Supabase y la
   sesión sean los mismos y no se desincronicen.

   LA FORMA LA VA A DAR EL RUBRO
   -----------------------------
   Hoy esto muestra turnos y abonos, que es lo de una estética. `rubros`
   ya es dato en la base y ya decide el menú del comercio; cuando esta
   pantalla crezca, lo que se ve va a salir de ahí y no de un `if`. Se
   deja anotado antes de que aparezca el primer `if`.
   ============================================================ */

import React, { useState, useEffect, useCallback } from "react";
import { CalendarDays, LogOut, Clock, MapPin, Ticket } from "lucide-react";
import {
  entrarComoCliente, salir, cargarClienta, cargarTurnos, cargarAbonos,
  proximos, pasados,
} from "../datos/cliente.js";

const ROTULO = "text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold";

const dia = (d) =>
  d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
const hora = (d) =>
  d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

/* Un turno de hoy o de mañana se dice con palabras: es lo que la persona
   está buscando cuando abre esto, y "mañana 9:00" se lee más rápido que
   "jueves 28 de agosto". */
function cuando(d) {
  const hoy = new Date();
  const manana = new Date(hoy); manana.setDate(hoy.getDate() + 1);
  const mismoDia = (a, b) => a.toDateString() === b.toDateString();

  if (mismoDia(d, hoy)) return `Hoy ${hora(d)}`;
  if (mismoDia(d, manana)) return `Mañana ${hora(d)}`;
  return `${dia(d)}, ${hora(d)}`;
}

const TONO_ESTADO = {
  pendiente: "text-texto-suave border-borde bg-superficie-2",
  confirmada: "text-bien border-bien bg-bien-suave",
  cancelada: "text-mal border-mal bg-mal-suave",
  ausente: "text-ojo border-ojo bg-ojo-suave",
};

function Estado({ estado }) {
  return (
    <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${
      TONO_ESTADO[estado] || TONO_ESTADO.pendiente}`}>
      {estado}
    </span>
  );
}

/* ------------------------------------------------------------
   Entrar
   ------------------------------------------------------------ */

function Entrar({ onEntro }) {
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [yendo, setYendo] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    if (yendo) return;
    setYendo(true); setError("");
    try {
      onEntro(await entrarComoCliente(email, clave));
    } catch (err) {
      setError(err.message);
      setYendo(false);
    }
  }

  const campo = "w-full bg-superficie-2 border border-borde rounded-md px-3 py-3 text-base mt-1.5 outline-none text-texto focus:border-acento transition-colors";

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={entrar} className="w-full max-w-sm">
        <div className="w-11 h-11 rounded-lg bg-acento flex items-center justify-center">
          <CalendarDays size={20} className="text-texto" />
        </div>
        <h1 className="f-d text-2xl mt-5">Tus turnos</h1>
        <p className="text-sm text-texto-suave mt-1.5">
          Entrá con el correo que le diste al comercio.
        </p>

        <div className="mt-7 space-y-4">
          <label className="block">
            <span className={ROTULO}>Correo</span>
            <input type="email" value={email} autoFocus autoComplete="email"
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              className={campo} />
          </label>
          <label className="block">
            <span className={ROTULO}>Contraseña</span>
            <input type="password" value={clave} autoComplete="current-password"
              onChange={(e) => { setClave(e.target.value); setError(""); }}
              className={campo} />
          </label>

          {error && (
            <div className="text-sm text-mal border border-mal bg-mal-suave rounded-md px-3 py-2.5">
              {error}
            </div>
          )}

          <button type="submit" disabled={yendo || !email || !clave}
            className="w-full bg-acento hover:bg-acento-vivo disabled:opacity-50 text-texto font-bold rounded-md px-4 py-3 transition-colors">
            {yendo ? "Entrando…" : "Entrar"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------
   Un turno
   ------------------------------------------------------------ */

function Turno({ t, mostrarComercio }) {
  return (
    <li className="border border-borde rounded-lg p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-base">{t.servicio}</div>
          <div className="text-sm text-texto-suave mt-0.5 flex items-center gap-1.5 flex-wrap">
            <Clock size={13} /> {cuando(t.desde)} · {t.duracionMin} min
          </div>
          {t.profesional && (
            <div className="text-sm text-texto-suave mt-0.5">Con {t.profesional}</div>
          )}
          {mostrarComercio && (
            <div className="text-[11px] text-texto-tenue mt-1.5 flex items-center gap-1">
              <MapPin size={11} /> {t.empresa}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {t.esClase && <span className={ROTULO}>Clase</span>}
          <Estado estado={t.estado} />
        </div>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------
   La pantalla
   ------------------------------------------------------------ */

export default function App() {
  const [clienta, setClienta] = useState(null);
  const [turnos, setTurnos] = useState([]);
  const [abonos, setAbonos] = useState([]);
  const [iniciando, setIniciando] = useState(true);
  const [error, setError] = useState("");

  const releer = useCallback(async () => {
    const [t, a] = await Promise.all([cargarTurnos(), cargarAbonos()]);
    setTurnos(t);
    setAbonos(a);
  }, []);

  useEffect(() => {
    let vigente = true;
    cargarClienta()
      .then((c) => { if (vigente) setClienta(c); })
      .catch((e) => { if (vigente) setError(e.message); })
      .finally(() => { if (vigente) setIniciando(false); });
    return () => { vigente = false; };
  }, []);

  useEffect(() => {
    if (!clienta || clienta.sinFichas) return;
    let vigente = true;
    releer().catch((e) => { if (vigente) setError(e.message); });
    return () => { vigente = false; };
  }, [clienta, releer]);

  async function cerrar() {
    await salir();
    setClienta(null); setTurnos([]); setAbonos([]);
  }

  if (iniciando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-7 h-7 rounded-full border-2 border-borde-fuerte border-t-acento animate-spin" />
      </div>
    );
  }

  if (!clienta) return <Entrar onEntro={setClienta} />;

  /* Se registró y ningún comercio la reconoce todavía. No es un error: es
     el estado normal de alguien que llegó antes de que la invitaran. */
  if (clienta.sinFichas) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="f-d text-xl">Todavía no hay nada para mostrarte</h1>
          <p className="text-sm text-texto-suave mt-2 leading-relaxed">
            Tu cuenta anda, pero ningún comercio te tiene asociada a esta dirección.
            Avisale a donde te atendés y pediles que te enlacen con {clienta.email}.
          </p>
          <button onClick={cerrar} className="text-sm text-texto-tenue hover:text-acento-vivo mt-6">
            Salir
          </button>
        </div>
      </div>
    );
  }

  const proximosTurnos = proximos(turnos);
  const anteriores = pasados(turnos).slice(0, 10);
  /* Con un solo comercio, decir de cuál es cada turno es ruido. */
  const varios = clienta.comercios.length > 1;

  return (
    <div className="min-h-screen">
      <header className="border-b border-borde">
        <div className="max-w-2xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="f-d text-lg">Tus turnos</h1>
            <p className="text-[11px] text-texto-tenue truncate">{clienta.email}</p>
          </div>
          <button onClick={cerrar} title="Salir"
            className="text-texto-tenue hover:text-texto transition-colors">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-6 space-y-8">
        {error && (
          <div className="text-sm text-mal border border-mal bg-mal-suave rounded-md px-3 py-2.5">
            {error}
          </div>
        )}

        <section>
          <div className={ROTULO}>Lo que viene</div>
          {proximosTurnos.length === 0 ? (
            <p className="text-sm text-texto-suave mt-3">
              No tenés turnos agendados.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {proximosTurnos.map((t) => (
                <Turno key={t.id} t={t} mostrarComercio={varios} />
              ))}
            </ul>
          )}
        </section>

        {abonos.length > 0 && (
          <section>
            <div className={ROTULO}>Tus abonos</div>
            <ul className="mt-3 space-y-3">
              {abonos.map((a) => (
                <li key={a.id} className="border border-borde rounded-lg p-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-base flex items-center gap-2">
                        <Ticket size={14} className="text-texto-tenue" /> {a.nombre}
                      </div>
                      {varios && (
                        <div className="text-[11px] text-texto-tenue mt-1">{a.empresa}</div>
                      )}
                      {a.vence && (
                        <div className="text-sm text-texto-suave mt-0.5">
                          {a.vigente ? "Vence" : "Venció"} el{" "}
                          {a.vence.toLocaleDateString("es-AR", { day: "numeric", month: "long" })}
                        </div>
                      )}
                    </div>
                    {a.clases != null && (
                      <div className="text-right">
                        <div className="f-m text-2xl">{Math.max(0, a.clases - a.usadas)}</div>
                        <div className="text-[11px] text-texto-tenue">de {a.clases} sin usar</div>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {anteriores.length > 0 && (
          <section>
            <div className={ROTULO}>Antes</div>
            <ul className="mt-3 space-y-3 opacity-60">
              {anteriores.map((t) => (
                <Turno key={t.id} t={t} mostrarComercio={varios} />
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
