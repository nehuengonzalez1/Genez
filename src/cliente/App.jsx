/* ============================================================
   EL MOTOR DE LA APP DEL CLIENTE
   ============================================================

   Un solo motor que se comporta como la app de cualquier comercio. No hay
   una versión de Almha: hay una configuración de Almha.

   Lo que recibe y de dónde:

     el comercio    del dominio          almha.genez.com.ar
     la marca       marca_de(slug)       pública, sin sesión
     quién entró    mis_comercios()      la sesión de Supabase
     qué muestra    modulos_del_cliente  contrato + decisión del comercio
     los datos      mis_turnos, mis_abonos

   Ninguna de esas cinco está escrita acá. Este archivo las junta y
   dibuja; si mañana Almha apaga "Mi plan" o contrata otro módulo, la app
   cambia sin que nadie toque este código.

   POR QUÉ EL COMERCIO SALE DEL DOMINIO Y NO DE LA SESIÓN
   -----------------------------------------------------
   Para que la bienvenida muestre la marca antes de que la persona entre.
   Si saliera del login, hasta ese momento la app no sería de nadie, y la
   primera pantalla —la que decide si esto se siente de Almha— sería
   genérica.

   NO HAY RUTAS
   ------------
   La navegación es un estado, no una URL. Una app instalada no se navega
   con la barra de direcciones, y agregar un enrutador para cuatro
   pantallas es traer una dependencia para resolver algo que no pasa. El
   día que haga falta compartir un link a un turno, se agrega.
   ============================================================ */

import React, { useState, useEffect, useCallback } from "react";
import {
  slugDelDominio, cargarMarca, cargarModulos,
  entrarComoCliente, salir, cargarClienta, cargarTurnos, cargarAbonos,
  proximos, pasados,
} from "../datos/cliente.js";
import { Navegacion, Cargando, Error as ErrorEstado, Boton, ROTULO } from "./ui.jsx";
import { Inicio, Turnos, Plan, Cuenta } from "./pantallas.jsx";
import { Reservar } from "./Reservar.jsx";

/* ------------------------------------------------------------
   Bienvenida y login

   Una sola pantalla y no dos. La maqueta las separa, y con razón cuando
   hay que elegir entre entrar y registrarse; mientras el alta la haga el
   comercio, "Crear cuenta" no existe y una pantalla intermedia es un
   toque de más para llegar al mismo lado.
   ------------------------------------------------------------ */

function Bienvenida({ marca, onEntro }) {
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

  const campo = "w-full bg-superficie border border-borde rounded-lg px-3.5 py-3 text-base mt-1.5 outline-none text-texto placeholder:text-texto-tenue focus:border-acento transition-colors";

  return (
    <div className="min-h-screen flex flex-col">
      {/* La portada es del comercio. Sin una cargada no se deja un hueco
          gris: se sube el contenido y la pantalla sigue estando bien. */}
      {marca.portada && (
        <div className="h-52 bg-superficie-2 overflow-hidden shrink-0">
          <img src={marca.portada} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="flex-1 flex flex-col justify-center max-w-lg w-full mx-auto px-6 py-10">
        <div>
          {marca.logo
            ? <img src={marca.logo} alt={marca.nombre} className="h-11 object-contain" />
            : <h1 className="f-d text-3xl text-acento">{marca.nombre}</h1>}
          <p className="text-[11px] uppercase tracking-[0.18em] text-texto-tenue mt-2">
            by GENEZ
          </p>
        </div>

        {marca.lema && (
          <p className="f-d text-2xl mt-8 leading-snug">{marca.lema}</p>
        )}
        {marca.bajada && (
          <p className="text-sm text-texto-suave mt-3 leading-relaxed">{marca.bajada}</p>
        )}

        <form onSubmit={entrar} className="mt-9 space-y-4">
          <label className="block">
            <span className={ROTULO}>Correo</span>
            <input type="email" value={email} autoComplete="email" inputMode="email"
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              className={campo} placeholder="el que le diste al comercio" />
          </label>
          <label className="block">
            <span className={ROTULO}>Contraseña</span>
            <input type="password" value={clave} autoComplete="current-password"
              onChange={(e) => { setClave(e.target.value); setError(""); }}
              className={campo} />
          </label>

          {error && (
            <div className="text-sm text-mal border border-mal bg-mal-suave rounded-lg px-3.5 py-3">
              {error}
            </div>
          )}

          <button type="submit" disabled={yendo || !email || !clave}
            className="w-full bg-acento hover:bg-acento-vivo disabled:opacity-50 text-sobre-acento font-bold rounded-lg px-4 py-3.5 text-[15px] transition-colors">
            {yendo ? "Entrando…" : "Ingresar"}
          </button>
        </form>

        <p className="text-[13px] text-texto-suave mt-7 leading-relaxed">
          ¿Todavía no tenés cuenta? Pedísela a {marca.nombre} y te la damos de alta.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   Cuando algo falta

   Dos casos que no son errores y se tratan distinto. El primero es de
   configuración —alguien abrió una dirección que no es de ningún
   comercio— y el segundo es una persona real esperando que la enlacen.
   ------------------------------------------------------------ */

function SinComercio({ slug }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 text-center">
      <div className="max-w-xs">
        <h1 className="f-d text-xl">Esta dirección no es de ningún comercio</h1>
        <p className="text-sm text-texto-suave mt-2 leading-relaxed">
          {slug
            ? <>No encontramos un comercio en <span className="f-m">{slug}</span>.</>
            : "Entrá desde la dirección que te pasó el comercio."}
        </p>
      </div>
    </div>
  );
}

function SinFicha({ marca, email, onSalir }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 text-center">
      <div className="max-w-xs">
        <h1 className="f-d text-xl">Todavía no hay nada para mostrarte</h1>
        <p className="text-sm text-texto-suave mt-3 leading-relaxed">
          Tu cuenta funciona, pero {marca.nombre} no te tiene asociada a esta
          dirección. Pediles que te enlacen con <span className="f-m">{email}</span>.
        </p>
        <button onClick={onSalir} className="text-sm text-texto-tenue hover:text-acento mt-8">
          Salir
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   El motor
   ------------------------------------------------------------ */

export default function App() {
  const [slug] = useState(slugDelDominio);
  const [marca, setMarca] = useState(undefined);   // undefined = todavía no se sabe
  const [clienta, setClienta] = useState(null);
  const [modulos, setModulos] = useState([]);
  const [donde, setDonde] = useState("inicio");
  /* Reservar no es un modulo de la barra: es algo que se hace desde
     Turnos o desde Inicio y despues se vuelve. Por eso es un estado
     aparte y no un  mas. */
  const [reservando, setReservando] = useState(false);
  const [turnos, setTurnos] = useState([]);
  const [abonos, setAbonos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  /* La marca primero y sin sesión: es lo que hace que la bienvenida sea
     de Almha y no de nadie. */
  useEffect(() => {
    let vigente = true;
    cargarMarca(slug)
      .then((m) => { if (vigente) setMarca(m); })
      .catch(() => { if (vigente) setMarca(null); });
    return () => { vigente = false; };
  }, [slug]);

  useEffect(() => {
    let vigente = true;
    cargarClienta()
      .then((c) => { if (vigente) setClienta(c); })
      .catch((e) => { if (vigente) setError(e.message); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, []);

  /* El comercio de ESTA app entre los de la persona. Con el dominio
     resuelto, entrar a `almha.genez.com.ar` con una cuenta que además es
     clienta de otro lado muestra Almha y nada más: la app es de un
     comercio, aunque la cuenta sea de varios. */
  const comercio = clienta && marca
    ? clienta.comercios.find((c) => c.slug === marca.slug) || null
    : null;

  const releer = useCallback(async () => {
    if (!comercio) return;
    const [ms, t, a] = await Promise.all([
      cargarModulos(comercio.empresaId),
      cargarTurnos(),
      cargarAbonos(),
    ]);
    setModulos(ms);
    setTurnos(t);
    setAbonos(a);
    /* Si la pantalla en la que está dejó de existir —el comercio apagó el
       módulo mientras la tenía abierta— se vuelve al inicio en vez de
       quedar en una pantalla que ya no está en la barra. */
    if (!ms.some((m) => m.k === donde)) setDonde("inicio");
  }, [comercio, donde]);

  useEffect(() => {
    if (!comercio) return;
    let vigente = true;
    releer().catch((e) => { if (vigente) setError(e.message); });
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comercio && comercio.empresaId]);

  async function cerrar() {
    await salir();
    setClienta(null); setTurnos([]); setAbonos([]); setModulos([]); setDonde("inicio");
  }

  /* Mientras no se sepa de qué comercio es, no se dibuja nada: cualquier
     cosa que se muestre antes sería genérica, que es lo único que esta
     app no puede ser. */
  if (marca === undefined || cargando) return <Cargando />;
  if (marca === null) return <SinComercio slug={slug} />;
  if (!clienta) return <Bienvenida marca={marca} onEntro={setClienta} />;
  if (!comercio) return <SinFicha marca={marca} email={clienta.email} onSalir={cerrar} />;

  const hayModulo = (k) => modulos.some((m) => m.k === k);
  const varios = clienta.comercios.length > 1;

  const pantallas = {
    inicio: () => (
      <Inicio marca={marca} nombre={comercio.miNombre} hayModulo={hayModulo}
        turnos={proximos(turnos)} abonos={abonos} onIr={setDonde}
        onReservar={() => setReservando(true)} />
    ),
    turnos: () => (
      <Turnos proximos={proximos(turnos)} anteriores={pasados(turnos).slice(0, 20)}
        varios={varios} puedeReservar={hayModulo("turnos")}
        onReservar={() => setReservando(true)} />
    ),
    plan: () => <Plan abonos={abonos} varios={varios} />,
    cuenta: () => (
      <Cuenta marca={marca} email={clienta.email} comercios={clienta.comercios} onSalir={cerrar} />
    ),
  };

  const dibujar = pantallas[donde] || pantallas.inicio;

  /* Reservar se lleva la pantalla entera, incluida la barra: es una tarea
     con principio y fin, y dejar la navegacion abajo invita a irse a la
     mitad. */
  if (reservando) {
    return (
      <Reservar empresaId={comercio.empresaId}
        onCerrar={() => { setReservando(false); setDonde("turnos"); }}
        onReservado={releer} />
    );
  }

  return (
    <div className="min-h-screen">
      {error
        ? <ErrorEstado onReintentar={() => { setError(""); releer(); }}>{error}</ErrorEstado>
        : dibujar()}
      <Navegacion modulos={modulos} actual={donde} onIr={setDonde} />
    </div>
  );
}
