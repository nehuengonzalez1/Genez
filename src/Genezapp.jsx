/* ============================================================
   15. RAÍZ · quién entró decide qué se ve
   ============================================================ */

import React, { useState, useEffect, useCallback } from "react";
import { Login, ClaveNueva, Sistema, PanelGenez } from "./genez/PanelGenez.jsx";
import { cargarSesion, cargarComercios, salir, alRecuperarClave } from "./datos/sesion.js";
import { cargarRubro } from "./datos/rubros.js";

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
  const [errorInicio, setErrorInicio] = useState("");
  const [recuperando, setRecuperando] = useState(false);

  /* El link del correo abre una sesión que solo sirve para cambiar la
     contraseña. Se escucha antes que nada: si se dejara seguir de largo,
     entraría al sistema como si nada y el usuario nunca vería la pantalla
     para elegir la clave nueva. */
  useEffect(() => alRecuperarClave(() => setRecuperando(true)), []);

  useEffect(() => {
    let vigente = true;
    cargarSesion()
      .then((s) => { if (vigente) setSesion(s); })
      .catch(async (e) => {
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
      tema={tema} setTema={setTema}
      sesion={sesionSistema}
      setComercios={setComercios}
      onSalir={sesion.viendo ? () => setSesion({ ...sesion, viendo: null }) : cerrarSesion}
    />
  );
}
