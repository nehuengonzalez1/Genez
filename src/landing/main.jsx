import React from "react";
import ReactDOM from "react-dom/client";
import Landing from "./Landing.jsx";
import { iniciarTema } from "./tema.js";
import "../index.css";
import "./landing.css";

/* Misma escala que la app del cliente y por la misma razón: esto se lee
   en un teléfono, donde no hay un 125% de Windows que compense el rem
   de 13.5 que usa el sistema de gestión (ver src/cliente/main.jsx). */
document.documentElement.style.fontSize = "16px";

/* Claro u oscuro según el teléfono, con un botón para fijarlo (tema.js). */
iniciarTema();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <div className="min-h-screen bg-fondo text-texto">
      <Landing />
    </div>
  </React.StrictMode>
);
