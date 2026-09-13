import React from "react";
import ReactDOM from "react-dom/client";
import Landing from "./Landing.jsx";
import { aplicarTema, alCambiarElTema } from "../cliente/tema.js";
import "../index.css";

/* Misma escala que la app del cliente y por la misma razón: esto se lee
   en un teléfono, donde no hay un 125% de Windows que compense el rem
   de 13.5 que usa el sistema de gestión (ver src/cliente/main.jsx). */
document.documentElement.style.fontSize = "16px";

/* El tema lo decide el teléfono. La landing no es de ningún comercio,
   así que no hay marca que lo fije: `auto` es la respuesta correcta. */
const SIN_MARCA = { tema: "auto" };
aplicarTema(SIN_MARCA);
alCambiarElTema(SIN_MARCA, () => aplicarTema(SIN_MARCA));

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <div className="min-h-screen bg-fondo text-texto">
      <Landing />
    </div>
  </React.StrictMode>
);
