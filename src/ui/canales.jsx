/* ============================================================
   UI · CANALES
   ============================================================

   Cómo se ve un canal. Los canales son filas de la base (ver la
   migración 0020), así que lo único que puede vivir en el código es la
   traducción: de un nombre de color a las clases de Tailwind, y de un
   nombre de ícono al dibujo.

   Las clases van escritas enteras y no armadas con plantillas porque
   Tailwind lee el código como texto: `bg-canal-${x}` no existe en la
   hoja de estilos y el color simplemente no aparece.

   Un canal que el comercio cree con un color que no está en esta lista
   se ve con el gris de "aplicación". Se lo puede agregar sin tocar
   código; darle un color de marca propio sí necesita pasar por acá y por
   src/index.css, que es donde viven los colores del sistema.
   ============================================================ */

import React from "react";
import {
  Store, ShoppingBag, Bike, Smartphone, UtensilsCrossed, Truck,
  Globe, MessageCircle, Phone, ShoppingCart, Bot, Package,
} from "lucide-react";

const ICONOS = {
  Store, ShoppingBag, Bike, Smartphone, UtensilsCrossed, Truck,
  Globe, MessageCircle, Phone, ShoppingCart, Bot, Package,
};

export const ICONOS_DISPONIBLES = Object.keys(ICONOS);

const TONOS = {
  mostrador: { txt: "text-canal-mostrador", suave: "bg-canal-mostrador-suave", borde: "border-canal-mostrador", punto: "bg-canal-mostrador" },
  retiro:    { txt: "text-canal-retiro",    suave: "bg-canal-retiro-suave",    borde: "border-canal-retiro",    punto: "bg-canal-retiro" },
  reparto:   { txt: "text-canal-reparto",   suave: "bg-canal-reparto-suave",   borde: "border-canal-reparto",   punto: "bg-canal-reparto" },
  pedidosya: { txt: "text-canal-pedidosya", suave: "bg-canal-pedidosya-suave", borde: "border-canal-pedidosya", punto: "bg-canal-pedidosya" },
  rappi:     { txt: "text-canal-rappi",     suave: "bg-canal-rappi-suave",     borde: "border-canal-rappi",     punto: "bg-canal-rappi" },
  ubereats:  { txt: "text-canal-ubereats",  suave: "bg-canal-ubereats-suave",  borde: "border-canal-ubereats",  punto: "bg-canal-ubereats" },
  app:       { txt: "text-canal-app",       suave: "bg-canal-app-suave",       borde: "border-canal-app",       punto: "bg-canal-app" },
  salon:     { txt: "text-texto-suave",     suave: "bg-superficie-2",          borde: "border-borde-fuerte",    punto: "bg-superficie-3" },
};

export const COLORES_DISPONIBLES = Object.keys(TONOS);

export const tonoCanal = (canal) =>
  TONOS[(canal && (canal.color || canal.familia)) || "app"] || TONOS.app;

export function IconoCanal({ canal, size = 15, className = "" }) {
  const I = ICONOS[(canal && canal.icono) || ""] || ShoppingBag;
  return <I size={size} className={className} />;
}

/* El cuadradito con el ícono adentro. Es lo que se reconoce de lejos en
   una columna de tarjetas: la marca antes que el texto. */
export function SelloCanal({ canal, size = 30 }) {
  const t = tonoCanal(canal);
  return (
    <span className={`shrink-0 grid place-items-center rounded-md ${t.suave} ${t.txt}`}
      style={{ width: size, height: size }}>
      <IconoCanal canal={canal} size={Math.round(size * 0.55)} />
    </span>
  );
}

/* Una fila de la barra lateral. */
export function FilaLateral({ icono: Icono, canal = null, tinte = "text-texto-tenue", nombre, cuantos = null, activo = false, onTocar, title }) {
  return (
    <button onClick={onTocar} title={title}
      /* En una notebook la barra mide 192 px y "Delivery propio" no entra
         con el espaciado de un monitor grande: quedaba "Delivery propi…",
         que es justo lo que hay que leer de un vistazo. */
      className={`w-full flex items-center gap-2 xl:gap-2.5 px-2 xl:px-2.5 py-2 rounded-md
        text-[13px] xl:text-sm font-medium transition-colors ${
        activo ? "bg-superficie-2 text-texto" : "text-texto-suave hover:bg-superficie-2 hover:text-texto"}`}>
      {canal
        ? <IconoCanal canal={canal} size={16} className={`shrink-0 ${tonoCanal(canal).txt}`} />
        : <Icono size={16} className={`shrink-0 ${activo ? "text-acento" : tinte}`} />}
      <span className="flex-1 min-w-0 truncate text-left">{nombre}</span>
      {cuantos != null && cuantos > 0 && (
        <span className={`f-m text-[11px] font-bold rounded px-1.5 py-0.5 shrink-0 ${
          activo ? "bg-acento text-sobre-acento" : "bg-superficie-2 text-texto-suave"}`}>
          {cuantos}
        </span>
      )}
    </button>
  );
}

/* El chip de arriba del tablero. Cuando está elegido toma el color del
   canal y no el naranja del sistema: es lo que hace que se entienda de
   un vistazo qué se está mirando. */
export function ChipCanal({ canal = null, nombre, cuantos, activo, onTocar }) {
  const t = canal ? tonoCanal(canal) : null;
  return (
    <button onClick={onTocar}
      className={`shrink-0 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
        activo
          ? (t ? `${t.borde} ${t.suave} ${t.txt}` : "border-acento bg-acento-suave text-texto")
          : "border-borde bg-superficie text-texto-suave hover:bg-superficie-2 hover:text-texto"}`}>
      {canal && <IconoCanal canal={canal} size={14} className={`shrink-0 ${activo ? "" : t.txt}`} />}
      {nombre}
      <span className={`f-m text-[11px] font-bold ${activo ? "" : "text-texto-tenue"}`}>{cuantos}</span>
    </button>
  );
}
