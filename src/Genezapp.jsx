/* ============================================================
   15. RAÍZ · quién entró decide qué se ve
   ============================================================ */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Login, ClaveNueva, Sistema, PanelGenez } from "./genez/PanelGenez.jsx";
import { cargarSesion, cargarComercios, salir, alRecuperarClave, vinoDeRecuperacion } from "./datos/sesion.js";
import { cargarRubro } from "./datos/rubros.js";
import { cargarRoles } from "./datos/permisos.js";

/* La sesión sobrevive al refresco: Supabase la guarda en el navegador.
   Mientras se resuelve no se puede mostrar ni el login ni el sistema,
   porque cualquiera de los dos parpadearía en la cara del usuario. */
function Cargando() {
  return (
    <div className="min-h-screen bg-fondo flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-borde-fuerte border-t-acento animate-spin" />
    </div>
  );
}

export default function App() {
  const [sesion, setSesion] = useState(null);
  const [comercios, setComercios] = useState([]);
  /* Oscuro de fábrica porque es donde el sistema vive: una cocina, un
     salón de noche, una caja con la persiana baja. El claro queda para
     quien lo prefiera o trabaje contra una ventana. */
  const [tema, setTema] = useState("oscuro");
  const [imagenFondo, setImagenFondo] = useState(null);   // fondo propio del login
  const [iniciando, setIniciando] = useState(true);
  /* undefined = todavía no se sabe. Distinto de null, que es "no tiene". */
  const [rubro, setRubro] = useState(undefined);
  const [roles, setRoles] = useState(null);
  const [errorInicio, setErrorInicio] = useState("");
  const [recuperando, setRecuperando] = useState(vinoDeRecuperacion);

  /* Lo mismo que `recuperando`, para poder leerlo desde adentro de una
     promesa. El estado que ve un `catch` es el del momento en que se armó
     la cadena, y acá lo que importa es lo que pasó mientras corría. */
  const recuperandoRef = useRef(vinoDeRecuperacion);

  /* El link del correo abre una sesión que solo sirve para cambiar la
     contraseña. Se escucha antes que nada: si se dejara seguir de largo,
     entraría al sistema como si nada y el usuario nunca vería la pantalla
     para elegir la clave nueva. */
  useEffect(() => alRecuperarClave(() => {
    recuperandoRef.current = true;
    setRecuperando(true);
  }), []);

  useEffect(() => {
    let vigente = true;
    cargarSesion()
      .then((s) => { if (vigente) setSesion(s); })
      .catch(async (e) => {
        /* Si vino del link de recuperación no se cierra nada. Esa sesión
           es lo único que permite cambiar la clave, y cerrarla deja la
           pantalla de contraseña nueva sin poder guardar: Supabase
           contesta "falta la sesión de autenticación" y no hay forma de
           salir de ahí más que pedir otro link, que va a hacer lo mismo.

           Pasa siempre con una clienta del comercio —no tiene perfil, así
           que `cargarSesion` lanza— y era invisible porque las dos partes
           por separado están bien: cerrar una sesión a medias es correcto,
           y mostrar la pantalla de clave nueva también. */
        if (recuperandoRef.current) return;

        /* Hay sesión en Auth pero algo falta del lado de Genez (típico:
           el usuario existe y no tiene perfil). Se cierra para no dejarlo
           en un limbo donde el login no reacciona. */
        await salir();
        if (vigente) setErrorInicio(e.message || "No pudimos abrir tu sesión.");
      })
      .finally(() => { if (vigente) setIniciando(false); });
    return () => { vigente = false; };
  }, []);

  /* El panel de plataforma necesita la lista de comercios. Qué comercios
     devuelve la consulta lo decide RLS según quién esté autenticado. */
  useEffect(() => {
    if (!sesion) return setComercios([]);
    let vigente = true;
    cargarComercios()
      .then((cs) => { if (vigente) setComercios(cs); })
      .catch((e) => console.error("No se pudieron cargar los comercios:", e));
    return () => { vigente = false; };
  }, [sesion && sesion.tipo, sesion && sesion.nombre]);

  /* El comercio que se está mirando: el propio, o el que abrió la
     plataforma. En el panel de plataforma no hay ninguno. */
  const comercio = sesion ? sesion.viendo || sesion.comercio : null;

  /* El rubro decide la forma del sistema: el menú, por dónde entra y qué
     tablero muestra el inicio. Se resuelve acá, antes de montar Sistema, y
     no adentro: si llegara tarde, una estética abriría un instante en la
     pantalla de cobro y recién después se corregiría sola, que es peor que
     esperar. */
  useEffect(() => {
    if (!comercio) { setRubro(null); return; }
    let vigente = true;
    setRubro(undefined);
    cargarRubro(comercio.rubro)
      .then((r) => { if (vigente) setRubro(r); })
      .catch((e) => {
        /* Sin rubro el sistema igual se usa: Sistema tiene su menú de
           respaldo. No vale la pena frenar a nadie por esto. */
        console.error("No se pudo cargar el rubro:", e);
        if (vigente) setRubro(null);
      });
    return () => { vigente = false; };
  }, [comercio && comercio.id]);

  /* Los roles del comercio, por lo mismo que el rubro: deciden qué menú
     ve la persona. La diferencia es que acá sí se puede seguir sin ellos
     —`permisosDe` cae en los roles de fábrica, que son los mismos— así
     que no se frena el arranque esperándolos. Un parpadeo de menú es
     peor remedio que enfermedad. */
  useEffect(() => {
    if (!comercio) { setRoles(null); return; }
    let vigente = true;
    cargarRoles(comercio.id)
      .then((rs) => { if (vigente) setRoles(rs); })
      .catch((e) => {
        console.error("No se pudieron cargar los roles:", e);
        if (vigente) setRoles(null);
      });
    return () => { vigente = false; };
  }, [comercio && comercio.id]);

  const cerrarSesion = useCallback(async () => {
    await salir();
    setSesion(null);
    setErrorInicio("");
  }, []);

  /* La clase no dice "poné el tema oscuro" sino "cambiá al claro": el
     oscuro son los valores de fábrica y no necesita que nadie lo active. */
  const envolver = (hijo) => (
    <div className={`${tema === "claro" ? "tema-claro" : ""} min-h-screen bg-fondo text-texto`}>{hijo}</div>
  );

  if (iniciando) return envolver(<Cargando />);

  if (recuperando) {
    return envolver(
      <ClaveNueva
        imagenFondo={imagenFondo}
        onListo={async () => {
          /* Se cierra la sesión temporal del link a propósito: que entre
             de nuevo con la contraseña nueva confirma que quedó bien y no
             se la va a olvidar en dos minutos. */
          await cerrarSesion();
          setRecuperando(false);
        }}
        onCancelar={async () => { await cerrarSesion(); setRecuperando(false); }}
      />
    );
  }

  if (!sesion) {
    return envolver(
      <Login
        onEntrar={setSesion}
        imagenFondo={imagenFondo}
        errorInicial={errorInicio}
      />
    );
  }

  /* Entró con la clave provisional que le dictó el dueño, así que esa
     clave la sabe otra persona. No se le muestra nada del sistema hasta
     que ponga una suya. Va después del login y antes de todo lo demás:
     cualquier pantalla que se dibuje acá es una pantalla que vio alguien
     con una credencial compartida. */
  if (sesion.debeCambiarClave) {
    return envolver(
      <ClaveNueva
        forzado
        invitado={sesion.invitado}
        imagenFondo={imagenFondo}
        onListo={async () => {
          /* Se relee la sesión en vez de apagar la bandera a mano: la
             marca la apaga la base, y leerla de nuevo es lo que confirma
             que quedó apagada de verdad. */
          setIniciando(true);
          try {
            setSesion(await cargarSesion());
          } catch (e) {
            await cerrarSesion();
            setErrorInicio(e.message || "No pudimos abrir tu sesión.");
          } finally {
            setIniciando(false);
          }
        }}
        onCancelar={cerrarSesion}
      />
    );
  }

  if (sesion.tipo === "plataforma" && !sesion.viendo) {
    return envolver(
      <PanelGenez
        tema={tema} setTema={setTema}
        imagenFondo={imagenFondo} setImagenFondo={setImagenFondo}
        sesion={sesion}
        comercios={comercios}
        setComercios={setComercios}
        onSalir={cerrarSesion}
        onEntrarComo={(c) => setSesion({ ...sesion, viendo: c })}
      />
    );
  }

  // Sin saber el rubro no se puede dibujar: se decidiría dos veces.
  if (rubro === undefined) return envolver(<Cargando />);

  const sesionSistema = sesion.viendo
    ? { tipo: "comercio", comercio, rol: "dueno", nombre: sesion.nombre, usuario: sesion.usuario, comoAdmin: true }
    : sesion;

  return envolver(
    <Sistema
      key={comercio.id}
      rubro={rubro}
      roles={roles}
      tema={tema} setTema={setTema}
      sesion={sesionSistema}
      setComercios={setComercios}
      onSalir={sesion.viendo ? () => setSesion({ ...sesion, viendo: null }) : cerrarSesion}
    />
  );
}
