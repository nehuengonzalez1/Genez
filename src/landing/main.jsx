import React from "react";
import ReactDOM from "react-dom/client";
/* La landing nueva de una sola pantalla (docs/landing-nueva.md). La
   anterior, con el alta en pasos, queda en Landing.jsx hasta publicar. */
import Landing from "./LandingNueva.jsx";
import Privacidad from "./Privacidad.jsx";
import Terminos from "./Terminos.jsx";
import Arrepentimiento from "./Arrepentimiento.jsx";
import { iniciarTema } from "./tema.js";
import "../index.css";
import "./landing.css";
import "./landing-nueva.css";

/* Misma escala que la app del cliente y por la misma razón: esto se lee
   en un teléfono, donde no hay un 125% de Windows que compense el rem
   de 13.5 que usa el sistema de gestión (ver src/cliente/main.jsx). */
document.documentElement.style.fontSize = "16px";

/* Claro u oscuro según el teléfono, con un botón para fijarlo (tema.js). */
iniciarTema();

/* /privacidad llega acá por el rewrite de vercel.json. En desarrollo Vite
   no aplica esos rewrites: ahí se abre con landing.html?privacidad. */
const enDesarrollo = (clave) => import.meta.env.DEV && new URLSearchParams(location.search).has(clave);
const esPrivacidad = location.pathname.startsWith("/privacidad") || enDesarrollo("privacidad");
if (esPrivacidad) document.title = "Política de privacidad · Genez";

/* /terminos y /arrepentimiento, igual (0130). */
const esTerminos = location.pathname.startsWith("/terminos") || enDesarrollo("terminos");
if (esTerminos) document.title = "Términos y condiciones · Genez";
const esArrepentimiento = location.pathname.startsWith("/arrepentimiento") || enDesarrollo("arrepentimiento");
if (esArrepentimiento) document.title = "Botón de arrepentimiento · Genez";

/* /empezar es el registro, en una página aparte (lo mismo: en desarrollo,
   landing.html?empezar). */
const esRegistro = !esPrivacidad && !esTerminos && !esArrepentimiento
  && (location.pathname.startsWith("/empezar") || enDesarrollo("empezar"));
if (esRegistro) document.title = "Probalo gratis · Genez";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <div className="min-h-screen bg-fondo text-texto">
      {esPrivacidad ? <Privacidad />
        : esTerminos ? <Terminos />
        : esArrepentimiento ? <Arrepentimiento />
        : <Landing pagina={esRegistro ? "registro" : "principal"} />}
    </div>
  </React.StrictMode>
);
