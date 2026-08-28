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
  cargarEsperas, salirDeEspera, cargarPagos, guardarMisDatos,
  cargarAvisos, marcarAvisosVistos,
  pedirClaveNueva, guardarClaveNueva, alRecuperarClave, vinoDeRecuperacion, registrarme,
  marcaGuardada,
  proximos, historial, cancelados,
} from "../datos/cliente.js";
import { ChevronLeft, Eye, EyeOff } from "lucide-react";
import {
  Navegacion, Cargando, Error as ErrorEstado, SinConexion, useHayConexion, Boton, ROTULO,
} from "./ui.jsx";
import { Inicio, Turnos, Plan, Sesiones, Pagos, Actividad, Avisos, Cuenta, MisDatos } from "./pantallas.jsx";
import { Reservar } from "./Reservar.jsx";
import { DetalleTurno } from "./DetalleTurno.jsx";
import { aplicarTema, alCambiarElTema } from "./tema.js";

/* ------------------------------------------------------------
   LA ENTRADA · pantallas 1, 2 y 3 de la maqueta

   La carga, la bienvenida y el login. Eran una sola: la bienvenida
   llevaba el formulario adentro, con el argumento de que una pantalla
   intermedia es un toque de más para llegar al mismo lado.

   Con la maqueta a la vista ese argumento se cae. La bienvenida no es un
   paso hacia el login: es la única pantalla donde el comercio se
   presenta —su foto, su lema, su nombre— y meterle dos campos y un
   teclado encima la convierte en un formulario con una foto arriba.

   El toque de más existe y es una sola vez: después de entrar, la sesión
   dura.
   ------------------------------------------------------------ */

/* El mismo campo en todas las pantallas del recorrido. Si cada una
   define lo suyo, se despeinan la primera vez que alguien toca una. */
const CAMPO =
  "w-full bg-superficie border border-borde rounded-lg px-3.5 py-3 text-base mt-1.5 outline-none text-texto placeholder:text-texto-tenue focus:border-acento transition-colors";

/* El nombre del comercio, con su logo si lo subió. Se repite en las tres
   pantallas de la entrada, así que vive en un solo lugar. */
function Marca({ marca, sobreTelon = false }) {
  return (
    <div>
      {marca.logo
        ? <img src={marca.logo} alt={marca.nombre} className="h-11 object-contain" />
        : <h1 className="f-d text-3xl text-acento">{marca.nombre}</h1>}
      <p className={`text-[11px] uppercase tracking-[0.18em] mt-2 ${
        sobreTelon ? "text-sobre-telon" : "text-texto-tenue"}`}>
        by GENEZ
      </p>
    </div>
  );
}

/* ------------------------------------------------------------
   1 · La carga

   Sobre el telón oscuro y no sobre el crema de la app: es el momento en
   que aparece la marca y todavía no hay aplicación.

   LLEVA EL NOMBRE PORQUE SE GUARDÓ LA VEZ ANTERIOR
   El nombre lo trae `marca_de`, que es una ida a la base: mientras carga,
   no hay nombre. Con `marcaGuardada` la segunda apertura y todas las que
   siguen —que son las que importan en una app instalada— ya arrancan
   diciendo Almha. La primera muestra solo el punto girando, que es lo
   honesto: todavía no sabemos de quién es.
   ------------------------------------------------------------ */

function Splash({ marca }) {
  return (
    <div className="min-h-screen bg-telon flex flex-col items-center justify-center gap-10 px-8">
      <div className="text-center">
        {marca && <Marca marca={marca} sobreTelon />}
      </div>
      <div className="flex flex-col items-center gap-4">
        <div className="w-6 h-6 rounded-full border-2 border-sobre-telon/30 border-t-acento animate-spin" />
        <p className="text-[13px] text-sobre-telon">Cargando tu experiencia…</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   2 · La bienvenida

   La foto del local arriba y el lema abajo. Es la pantalla que decide si
   esto se siente de Almha o de un proveedor de software.
   ------------------------------------------------------------ */

/* El lema, una frase por renglón y la segunda en el color del acento.

   Sale de partirlo por el punto y no de tres columnas en la base: el
   comercio escribe "Tu espacio. Tu bienestar. Tu tiempo." y la pantalla
   lo acomoda. Con dos frases la resaltada es la última, con una no hay
   ninguna y queda un lema común, que también está bien. */
function Lema({ texto }) {
  const frases = texto.split(".").map((f) => f.trim()).filter(Boolean);
  if (!frases.length) return null;

  return (
    <p className="f-d text-[26px] leading-[1.25]">
      {frases.map((f, i) => (
        <span key={i} className={`block ${
          frases.length > 1 && i === 1 ? "text-acento" : ""}`}>
          {f}.
        </span>
      ))}
    </p>
  );
}

function Bienvenida({ marca, onIngresar, onCrear }) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* La portada es del comercio. Sin una cargada no se deja un hueco
          gris: se sube el contenido y la pantalla sigue estando bien. El
          lugar está hecho y la foto la carga Almha. */}
      {marca.portada && (
        <div className="h-64 bg-superficie-2 overflow-hidden shrink-0">
          <img src={marca.portada} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="flex-1 flex flex-col justify-center max-w-lg w-full mx-auto px-6 py-10">
        <Marca marca={marca} />

        {marca.lema && <div className="mt-8"><Lema texto={marca.lema} /></div>}
        {marca.bajada && (
          <p className="text-sm text-texto-suave mt-4 leading-relaxed">{marca.bajada}</p>
        )}

        <div className="mt-9 space-y-3">
          <Boton onClick={onIngresar}>Ingresar</Boton>

          {/* "Crear cuenta" solo donde el comercio abrió el registro. De
              fábrica está cerrado, así que para la mayoría este botón no
              existe y abajo queda la frase de siempre: la cuenta se pide
              en el local. Ver 0065. */}
          {marca.autoregistro && (
            <Boton variante="linea" onClick={onCrear}>Crear cuenta</Boton>
          )}
        </div>

        {!marca.autoregistro && (
          <p className="text-[13px] text-texto-suave mt-6 text-center leading-relaxed">
            ¿Todavía no tenés cuenta? Pedísela a {marca.nombre} y te la damos de alta.
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   3 · Iniciar sesión
   ------------------------------------------------------------ */

function Ingresar({ marca, onEntro, onVolver }) {
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [ver, setVer] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [yendo, setYendo] = useState(false);
  const [pidiendo, setPidiendo] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    if (yendo) return;
    setYendo(true); setError(""); setAviso("");
    try {
      onEntro(await entrarComoCliente(email, clave));
    } catch (err) {
      setError(err.message);
      setYendo(false);
    }
  }

  /* El mismo mensaje salga o no salga: si dijera "ese correo no existe",
     esta pantalla se convierte en una forma de averiguar quién es cliente
     del comercio. Por eso ni siquiera se mira si falló. */
  async function recuperar() {
    if (pidiendo) return;
    if (!email.trim()) return setError("Escribí tu correo y volvé a tocar acá.");

    setPidiendo(true); setError("");
    try { await pedirClaveNueva(email); } catch { /* el mismo aviso igual */ }
    setPidiendo(false);
    setAviso(`Si ${email.trim()} tiene cuenta, te va a llegar un correo con el link para cambiarla. Fijate también en el correo no deseado.`);
  }

  return (
    <div className="min-h-screen flex flex-col max-w-lg w-full mx-auto px-6">
      <header className="pt-6 pb-2">
        <button type="button" onClick={onVolver} aria-label="Volver"
          className="-ml-[11px] w-[44px] h-[44px] flex items-center justify-center text-texto-suave hover:text-texto transition-colors">
          <ChevronLeft size={22} />
        </button>
      </header>

      <div className="flex-1 flex flex-col justify-center pb-16">
        {/* Neutro y no "bienvenida", que es lo que dice la maqueta.

            Almha atiende mujeres y ahí suena bien; el motor es el mismo
            para el bar y para el minimercado, y esta es la pantalla que
            más gente ve de toda la app. Es una palabra: si preferís la de
            la maqueta, se cambia acá y en ningún otro lado. */}
        <h1 className="f-d text-[26px]">¡Hola de nuevo!</h1>
        <p className="text-sm text-texto-suave mt-1.5">Ingresá para continuar</p>

        <form onSubmit={entrar} className="mt-8 space-y-4">
          <label className="block">
            {/* La maqueta dice "Email o teléfono". Entrar con el teléfono
                pide otra forma de autenticación en Supabase —y que el
                comercio tenga el número verificado— así que por ahora es
                el correo y se dice el correo. Prometer las dos y aceptar
                una sola es peor que ofrecer una. */}
            <span className={ROTULO}>Correo</span>
            <input type="email" value={email} autoComplete="email" inputMode="email"
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              className={CAMPO} placeholder="ejemplo@correo.com" />
          </label>

          <label className="block">
            <span className={ROTULO}>Contraseña</span>
            <div className="relative">
              <input type={ver ? "text" : "password"} value={clave} autoComplete="current-password"
                onChange={(e) => { setClave(e.target.value); setError(""); }}
                className={`${CAMPO} pr-12`} />
              <button type="button" onClick={() => setVer((v) => !v)} tabIndex={-1}
                aria-label={ver ? "Ocultar la contraseña" : "Mostrar la contraseña"}
                className="absolute right-1 top-1/2 -translate-y-1/2 mt-[3px] w-[44px] h-[44px] flex items-center justify-center text-texto-tenue hover:text-texto-suave transition-colors">
                {ver ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <div className="flex justify-end">
            <button type="button" onClick={recuperar} disabled={pidiendo}
              className="text-[13px] text-acento hover:text-acento-vivo transition-colors disabled:opacity-50">
              {pidiendo ? "Enviando…" : "¿Olvidaste tu contraseña?"}
            </button>
          </div>

          {error && (
            <div className="text-sm text-mal border border-mal bg-mal-suave rounded-lg px-3.5 py-3">
              {error}
            </div>
          )}

          {aviso && (
            <div className="text-sm text-texto-suave border border-borde bg-superficie-2 rounded-lg px-3.5 py-3 leading-relaxed">
              {aviso}
            </div>
          )}

          <button type="submit" disabled={yendo || !email || !clave}
            className="w-full bg-acento hover:bg-acento-vivo disabled:opacity-50 text-sobre-acento font-bold rounded-lg px-4 py-3 text-[15px] transition-colors">
            {yendo ? "Entrando…" : "Ingresar"}
          </button>
        </form>

        {/* Acá va el "o continuá con" de Google, Apple y Facebook. Son
            proveedores que hay que habilitar en Supabase y que cambian el
            alta —alguien entra con Google sin que el comercio lo haya
            dado de alta— así que van con el resto de esa tanda. */}

        <p className="text-[13px] text-texto-suave mt-8 text-center leading-relaxed">
          ¿Todavía no tenés cuenta? Pedísela a {marca.nombre} y te la damos de alta.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   4 · Crear cuenta

   Solo aparece si el comercio lo abrió. De fábrica está cerrado, así que
   para la mayoría esta pantalla no existe y la bienvenida sigue diciendo
   que la cuenta se pide en el local. Ver 0065.

   NO SE RECLAMA NINGUNA FICHA
   ---------------------------
   La maqueta titula "Creá tu cuenta / y vinculate con Almha", y esa
   segunda línea es justo lo que no se hace. Reclamar la ficha propia por
   teléfono es el camino que §4 del modelo de identidad marca como
   peligroso: cualquiera pone el teléfono de otra y se lleva su historial.

   Así que la cuenta empieza vacía, y la pantalla lo dice antes de que
   alguien la cree. Descubrirlo después —entrar y no encontrar sus veinte
   turnos— sería peor que decirlo ahora.

   EL TELÉFONO ES OPCIONAL Y NO BUSCA NADA
   ---------------------------------------
   Se pide porque el comercio lo necesita para avisarle algo, no para
   encontrarla. Que sirva para encontrarse a sí misma es exactamente lo
   que no se construyó.

   LO QUE ACEPTA, ACEPTA ALGO QUE EXISTE
   -------------------------------------
   La maqueta tiene un tilde de términos y condiciones con dos links. Esos
   documentos no existen, y un link a la nada es peor que no tenerlo:
   parece que hay algo escrito y no lo hay.

   Queda el tilde, con el texto que sí es cierto y verificable: qué va a
   ver el comercio. El día que haya términos, se agrega el link.
   ------------------------------------------------------------ */

function Registro({ marca, onCreada, onVolver }) {
  const [d, setD] = React.useState({ nombre: "", email: "", tel: "", clave: "" });
  const [acepta, setAcepta] = React.useState(false);
  const [yendo, setYendo] = React.useState(false);
  const [error, setError] = React.useState("");
  const [confirmar, setConfirmar] = React.useState("");

  const cambiar = (k) => (e) => { setD({ ...d, [k]: e.target.value }); setError(""); };
  const listo = d.nombre.trim() && d.email.includes("@") && d.clave.length >= 6 && acepta;

  async function crear(e) {
    e.preventDefault();
    if (yendo || !listo) return;
    setYendo(true); setError("");
    try {
      const r = await registrarme({
        slug: marca.slug,
        nombre: d.nombre,
        email: d.email,
        clave: d.clave,
        tel: d.tel,
      });
      if (r.confirmar) setConfirmar(r.email);
      else onCreada(r.clienta);
    } catch (err) {
      setError(err.message);
      setYendo(false);
    }
  }

  /* La cuenta quedó creada y falta que confirme el correo. No es un error
     ni un éxito a medias: es un paso más, y el que sigue no está en esta
     pantalla sino en su casilla. */
  if (confirmar) {
    return (
      <div className="min-h-screen flex flex-col max-w-lg w-full mx-auto px-6">
        <div className="flex-1 flex flex-col justify-center pb-16">
          <h1 className="f-d text-[26px]">Revisá tu correo</h1>
          <p className="text-sm text-texto-suave mt-3 leading-relaxed">
            Le mandamos un link a <span className="f-m">{confirmar}</span> para
            confirmar que es tuyo. Cuando lo toques, entrás.
          </p>
          <div className="mt-8">
            <Boton variante="linea" onClick={onVolver}>Volver</Boton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col max-w-lg w-full mx-auto px-6">
      <header className="pt-6 pb-2">
        <button type="button" onClick={onVolver} aria-label="Volver"
          className="-ml-[11px] w-[44px] h-[44px] flex items-center justify-center text-texto-suave hover:text-texto transition-colors">
          <ChevronLeft size={22} />
        </button>
      </header>

      <div className="flex-1 flex flex-col justify-center pb-16">
        <h1 className="f-d text-[26px]">Creá tu cuenta</h1>
        <p className="text-sm text-texto-suave mt-1.5 leading-relaxed">
          Es una cuenta nueva y arranca vacía. Si ya venís a {marca.nombre},
          pediles que te la enlacen con tu ficha así ves tu historial.
        </p>

        <form onSubmit={crear} className="mt-8 space-y-4">
          <label className="block">
            <span className={ROTULO}>Nombre y apellido</span>
            <input type="text" value={d.nombre} autoFocus autoComplete="name"
              onChange={cambiar("nombre")} className={CAMPO} placeholder="Sofía Martínez" />
          </label>

          <label className="block">
            <span className={ROTULO}>Correo</span>
            <input type="email" value={d.email} autoComplete="email" inputMode="email"
              onChange={cambiar("email")} className={CAMPO} placeholder="ejemplo@correo.com" />
          </label>

          <label className="block">
            <span className={ROTULO}>Teléfono</span>
            <input type="tel" value={d.tel} autoComplete="tel" inputMode="tel"
              onChange={cambiar("tel")} className={CAMPO} placeholder="11 5555 5555" />
            <span className="block text-[11px] text-texto-tenue mt-1.5">
              Para que {marca.nombre} pueda avisarte algo. Podés dejarlo vacío.
            </span>
          </label>

          <label className="block">
            <span className={ROTULO}>Contraseña</span>
            <input type="password" value={d.clave} autoComplete="new-password"
              onChange={cambiar("clave")} className={CAMPO} placeholder="Mínimo 6 caracteres" />
          </label>

          <label className="flex items-start gap-3 pt-1 cursor-pointer">
            <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)}
              className="mt-1 w-4 h-4 accent-[rgb(var(--acento))] shrink-0" />
            <span className="text-[13px] text-texto-suave leading-relaxed">
              Entiendo que {marca.nombre} va a ver mis turnos y mis datos de contacto.
            </span>
          </label>

          {error && (
            <div className="text-sm text-mal border border-mal bg-mal-suave rounded-lg px-3.5 py-3 leading-relaxed">
              {error}
            </div>
          )}

          <button type="submit" disabled={yendo || !listo}
            className="w-full bg-acento hover:bg-acento-vivo disabled:opacity-50 text-sobre-acento font-bold rounded-lg px-4 py-3 text-[15px] transition-colors">
            {yendo ? "Creando…" : "Crear cuenta"}
          </button>
        </form>

        <button type="button" onClick={onVolver}
          className="w-full text-center text-[13px] text-texto-suave mt-7">
          ¿Ya tenés cuenta? <span className="text-acento font-semibold">Ingresá</span>
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   La contraseña nueva

   La misma pantalla que tiene el sistema de gestión, en el envase de esta
   app. No se reusa aquella: es oscura y dice Genez, y quien llega acá es
   una clienta de Almha que tocó "olvidé mi contraseña" en la app de
   Almha. Cambiar de marca en el medio de recuperar una cuenta es
   exactamente donde no hay que hacerlo.

   ACÁ NO SE CIERRA LA SESIÓN AL TERMINAR
   --------------------------------------
   La gestión sí lo hace, y tiene su razón escrita: entrar de nuevo con la
   contraseña nueva confirma que quedó bien. En un teclado cuesta poco.

   En un teléfono es volver a tipear, con el pulgar, algo que se acaba de
   elegir hace cuatro segundos. Y no protege nada: quien llegó hasta acá
   ya demostró que entra al correo, y si la olvida otra vez el camino de
   vuelta ahora está a un toque de la bienvenida, que antes es lo que no
   existía.
   ------------------------------------------------------------ */

function ClaveNueva({ marca, onListo, onCancelar }) {
  const [clave, setClave] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    if (guardando) return;
    if (clave !== repetir) return setError("Las dos contraseñas no coinciden.");

    setGuardando(true); setError("");
    try {
      await guardarClaveNueva(clave);
      await onListo();
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col justify-center max-w-lg w-full mx-auto px-6 py-10">
        <div>
          {marca.logo
            ? <img src={marca.logo} alt={marca.nombre} className="h-11 object-contain" />
            : <h1 className="f-d text-3xl text-acento">{marca.nombre}</h1>}
          <p className="text-[11px] uppercase tracking-[0.18em] text-texto-tenue mt-2">
            by GENEZ
          </p>
        </div>

        <p className="f-d text-2xl mt-8 leading-snug">Elegí una contraseña nueva</p>
        <p className="text-sm text-texto-suave mt-3 leading-relaxed">
          Con esta vas a entrar de ahora en más. Mínimo 8 caracteres.
        </p>

        <form onSubmit={guardar} className="mt-9 space-y-4">
          <label className="block">
            <span className={ROTULO}>Contraseña nueva</span>
            <input type="password" value={clave} autoFocus autoComplete="new-password"
              onChange={(e) => { setClave(e.target.value); setError(""); }}
              disabled={guardando} className={CAMPO} />
          </label>
          <label className="block">
            <span className={ROTULO}>Repetila</span>
            <input type="password" value={repetir} autoComplete="new-password"
              onChange={(e) => { setRepetir(e.target.value); setError(""); }}
              disabled={guardando} className={CAMPO} />
          </label>

          {error && (
            <div className="text-sm text-mal border border-mal bg-mal-suave rounded-lg px-3.5 py-3 leading-relaxed">
              {error}
            </div>
          )}

          <button type="submit" disabled={guardando || !clave || !repetir}
            className="w-full bg-acento hover:bg-acento-vivo disabled:opacity-50 text-sobre-acento font-bold rounded-lg px-4 py-3 text-[15px] transition-colors">
            {guardando ? "Guardando…" : "Guardar y entrar"}
          </button>
        </form>

        <button type="button" onClick={onCancelar} disabled={guardando}
          className="w-full text-center text-[13px] text-texto-tenue hover:text-acento mt-5 transition-colors disabled:opacity-50">
          Volver
        </button>
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
  /* Arranca con la que quedó guardada del último uso, si la hay: así la
     pantalla de carga ya dice Almha. `cargarMarca` la refresca abajo.

     `undefined` sigue queriendo decir "todavía no se sabe", que es lo
     único que distingue "cargando" de "esta dirección no es de nadie". */
  const [marca, setMarca] = useState(() => marcaGuardada(slugDelDominio()) || undefined);

  /* Cuál de las dos pantallas de entrada se ve. La bienvenida presenta
     al comercio y el login pide los datos: son dos cosas distintas y la
     maqueta las separa. Ver el bloque de arriba. */
  const [entrando, setEntrando] = useState(false);
  const [clienta, setClienta] = useState(null);
  const [modulos, setModulos] = useState([]);
  const [donde, setDonde] = useState("inicio");
  /* Reservar no es un modulo de la barra: es algo que se hace desde
     Turnos o desde Inicio y despues se vuelve. Por eso es un estado
     aparte y no un  mas. */
  const [reservando, setReservando] = useState(false);
  const [turnoAbierto, setTurnoAbierto] = useState(null);
  const [turnos, setTurnos] = useState([]);
  const [abonos, setAbonos] = useState([]);
  const [esperas, setEsperas] = useState([]);

  /* Los pagos se piden cuando alguien entra a verlos y no al arrancar: es
     la única lista de la app que no aparece en ninguna pantalla de la
     barra. Cargarla siempre sería una consulta más en cada apertura para
     algo que casi nadie abre.

     `null` quiere decir "todavía no se pidieron", que es distinto de "no
     tiene ninguno" y la pantalla dibuja como cargando.

     Y cuál de las dos subpantallas del plan se está viendo. */
  const [pagos, setPagos] = useState(null);
  const [enPlan, setEnPlan] = useState(null);

  /* Lo mismo para la cuenta: "Mis datos" es un lugar al que se entra
     desde ahi y del que se vuelve, no una pestaña de la barra. */
  const [enCuenta, setEnCuenta] = useState(null);

  /* Los avisos se cargan con el resto: la campana de Inicio tiene que
     saber si hay algo sin ver antes de que nadie la toque. */
  const [avisos, setAvisos] = useState([]);
  const [verAvisos, setVerAvisos] = useState(false);
  const [bajando, setBajando] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  /* Llegó por el link del correo. Se mira la URL al importar el módulo y
     además se escucha el evento, porque supabase-js borra el hash apenas
     lo lee y si eso pasa antes de que React monte, el evento no lo
     escucha nadie. Ver `vinoDeRecuperacion` en `datos/sesion.js`. */
  const [recuperando, setRecuperando] = useState(vinoDeRecuperacion);
  useEffect(() => alRecuperarClave(() => setRecuperando(true)), []);

  /* Lo sabe el navegador y se actualiza solo. Sirve para decir "sin
     conexión" en vez de "no pudimos cargar esto", que son dos problemas
     distintos y solo uno lo puede resolver quien está mirando. */
  const hayConexion = useHayConexion();

  /* El tema, cuando ya se sabe de quién es la app.

     `main.jsx` lo aplicó con la marca guardada; acá se vuelve a aplicar
     con la que llegó, que es la que manda si el comercio cambió su
     elección. Y se escucha el cambio del sistema para el caso de siempre:
     el teléfono que pasa a oscuro al atardecer con la app abierta. */
  useEffect(() => {
    if (marca === undefined) return;
    aplicarTema(marca);
    return alCambiarElTema(marca, () => aplicarTema(marca));
  }, [marca && marca.tema, marca && marca.slug]);

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
    const [ms, t, a, es, av] = await Promise.all([
      cargarModulos(comercio.empresaId),
      cargarTurnos(),
      cargarAbonos(),
      cargarEsperas(),
      cargarAvisos(),
    ]);
    setModulos(ms);
    setTurnos(t);
    setAbonos(a);
    setEsperas(es);
    setAvisos(av);
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

  async function bajarse(claseId) {
    setBajando(claseId);
    try {
      await salirDeEspera(claseId);
      await releer();
    } catch (e) {
      setError(e.message);
    } finally {
      setBajando(null);
    }
  }

  /* Se piden una sola vez, la primera que alguien entra a la pantalla. Si
     falla queda en `null` y se vuelve a intentar al entrar de nuevo, que
     para una lista que no cambia sola es reintento suficiente. */
  useEffect(() => {
    if ((enPlan !== "pagos" && enPlan !== "actividad") || pagos !== null) return;
    let vigente = true;
    cargarPagos()
      .then((ps) => { if (vigente) setPagos(ps); })
      .catch((e) => { if (vigente) setError(e.message); });
    return () => { vigente = false; };
  }, [enPlan, pagos]);

  /* Al cambiar de pestaña se sale de la subpantalla: volver a "Mi plan"
     desde la barra tiene que mostrar el plan y no la última cosa que se
     miró adentro hace media hora. */
  useEffect(() => { setEnPlan(null); setEnCuenta(null); setVerAvisos(false); }, [donde]);

  /* Vuelve a preguntar quién entró. Es lo que reintenta la pantalla sin
     conexión: el problema de ahí es que `cargarClienta` no llegó, así que
     reintentar es llamarla de nuevo y no recargar la página. */
  const reintentarSesion = useCallback(async () => {
    setError(""); setCargando(true);
    try {
      setClienta(await cargarClienta());
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  /* Entrar a los avisos es haberlos visto. Se marca acá y no con un botón
     de "marcar como leídos": declarar que leyó lo que tiene delante es
     trabajo que la pantalla puede hacer sin preguntar.

     El punto naranja de cada uno se apaga en la próxima lectura y no
     mientras los está mirando: si desaparecieran bajo el dedo, no habría
     forma de ver cuáles eran los nuevos. */
  const verLosAvisos = useCallback(async () => {
    setVerAvisos(true);
    if (!comercio || !avisos.some((a) => a.nuevo)) return;
    try {
      await marcarAvisosVistos(comercio.empresaId);
    } catch {
      /* Que no se haya podido marcar no le arruina la lectura a nadie: lo
         único que pasa es que el punto sigue ahí la próxima vez. */
    }
  }, [comercio, avisos]);

  async function cerrar() {
    await salir();
    setClienta(null); setTurnos([]); setAbonos([]); setEsperas([]); setModulos([]); setDonde("inicio");
  }

  /* Mientras no se sepa de qué comercio es, no se dibuja nada: cualquier
     cosa que se muestre antes sería genérica, que es lo único que esta
     app no puede ser. */
  if (marca === undefined) return <Splash marca={null} />;
  if (marca === null) return <SinComercio slug={slug} />;

  /* Antes que la sesión y antes que la carga, no después.

     El link abre una sesión de verdad: `cargarClienta` la encuentra, trae
     las fichas y la app se dibujaría entera, con lo cual la persona
     entraría sin haber cambiado nada y la pantalla que vino a ver no
     aparecería nunca. La marca es lo único que se resuelve antes, porque
     esta pantalla también tiene que ser de Almha. */
  if (recuperando) {
    return (
      <ClaveNueva marca={marca}
        onListo={async () => {
          /* Se relee en vez de dar por hecho que ya estaba: si la carga
             de recién falló o todavía no terminó, esto la deja lista. */
          setClienta(await cargarClienta());
          setRecuperando(false);
        }}
        onCancelar={async () => { await cerrar(); setRecuperando(false); }} />
    );
  }

  if (cargando) return <Splash marca={marca} />;

  if (!clienta) {
    /* Sin sesión hay dos motivos y no uno, y hasta acá se trataban igual.

       Si la sesión no está porque nadie entró, va la bienvenida. Pero si
       no está porque la consulta falló —y sin señal falla siempre— lo que
       se mostraba era el login: alguien que abre la app en el subte, ya
       logueado, veía que le pedían la contraseña de nuevo. Es el peor
       momento para dar a entender que la sesión se perdió.

       Apareció probando la pantalla sin conexión, que es justo para esto. */
    if (error) {
      return !hayConexion
        ? <SinConexion onReintentar={reintentarSesion} />
        : <ErrorEstado onReintentar={reintentarSesion}>{error}</ErrorEstado>;
    }

    if (entrando === "registro") {
      return <Registro marca={marca} onCreada={setClienta} onVolver={() => setEntrando(false)} />;
    }
    return entrando
      ? <Ingresar marca={marca} onEntro={setClienta} onVolver={() => setEntrando(false)} />
      : <Bienvenida marca={marca}
          onIngresar={() => setEntrando(true)}
          onCrear={() => setEntrando("registro")} />;
  }
  if (!comercio) return <SinFicha marca={marca} email={clienta.email} onSalir={cerrar} />;

  const hayModulo = (k) => modulos.some((m) => m.k === k);
  const varios = clienta.comercios.length > 1;

  const pantallas = {
    inicio: () => {
      if (verAvisos) {
        return <Avisos avisos={avisos} varios={varios} onVolver={() => setVerAvisos(false)} />;
      }
      return (
        <Inicio marca={marca} nombre={comercio.miNombre} hayModulo={hayModulo}
          turnos={proximos(turnos)} abonos={abonos} onIr={setDonde}
          onReservar={() => setReservando(true)} onAbrirTurno={setTurnoAbierto}
          avisosNuevos={avisos.filter((a) => a.nuevo).length}
          /* La campana solo existe si hay algo que mirar. Sin avisos no se
             dibuja: una campana que nunca tuvo nada adentro enseña a no
             tocarla, y el día que tenga algo ya la aprendió a ignorar. */
          onVerAvisos={avisos.length ? verLosAvisos : null} />
      );
    },
    turnos: () => (
      <Turnos proximos={proximos(turnos)} anteriores={historial(turnos).slice(0, 20)}
        cancelados={cancelados(turnos).slice(0, 20)}
        varios={varios} puedeReservar={hayModulo("turnos")}
        onReservar={() => setReservando(true)} onAbrirTurno={setTurnoAbierto}
        esperas={esperas} onBajarse={bajarse} bajando={bajando} />
    ),
    /* Sesiones y Pagos cuelgan del plan, como en la maqueta: no son
       pestañas de la barra sino lugares a los que se entra desde acá y se
       vuelve. Por eso son un estado de esta pantalla y no un `donde`
       nuevo —si fueran pestañas, la barra tendría seis— y por eso al
       cambiar de pestaña se olvidan. */
    plan: () => {
      if (enPlan === "sesiones") {
        return (
          <Sesiones abonos={abonos} turnos={proximos(turnos)}
            onVolver={() => setEnPlan(null)} onVerTurnos={() => { setEnPlan(null); setDonde("turnos"); }} />
        );
      }
      if (enPlan === "pagos") {
        return (
          <Pagos pagos={pagos} cargando={pagos === null} varios={varios}
            onVolver={() => setEnPlan(null)} />
        );
      }
      if (enPlan === "actividad") {
        return (
          <Actividad turnos={turnos} pagos={pagos || []} cargando={pagos === null}
            onVolver={() => setEnPlan(null)} />
        );
      }
      return <Plan abonos={abonos} varios={varios} onVer={setEnPlan} />;
    },
    cuenta: () => {
      if (enCuenta === "datos") {
        return (
          <MisDatos marca={marca} comercio={comercio} email={clienta.email}
            onVolver={() => setEnCuenta(null)}
            onGuardar={async (d) => {
              await guardarMisDatos(comercio.empresaId, d);
              /* Se relee la ficha: lo que la pantalla tiene que mostrar
                 después de guardar es lo que quedó escrito y no lo que se
                 tipeó. Si la base recortó o ignoró algo, se ve. */
              setClienta(await cargarClienta());
            }} />
        );
      }
      return (
        <Cuenta marca={marca} comercio={comercio} email={clienta.email}
          comercios={clienta.comercios} onSalir={cerrar}
          onVerPerfil={() => setEnCuenta("datos")} />
      );
    },
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
      {/* Sin señal gana sobre el error: si el wifi se cortó, "no pudimos
          cargar esto" manda a sospechar de la app por algo que la app no
          hizo. Solo se muestra si además algo falló —estar sin conexión
          con todo ya cargado en pantalla no es un problema todavía—. */}
      {error && !hayConexion
        ? <SinConexion onReintentar={() => { setError(""); releer(); }}
            onInicio={() => { setError(""); setDonde("inicio"); releer(); }} />
        : error
          ? <ErrorEstado onReintentar={() => { setError(""); releer(); }}>{error}</ErrorEstado>
          : dibujar()}
      <Navegacion modulos={modulos} actual={donde} onIr={setDonde} />

      <DetalleTurno turno={turnoAbierto}
        onCerrar={() => setTurnoAbierto(null)}
        onCancelado={releer} />
    </div>
  );
}
