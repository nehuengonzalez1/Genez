/* ============================================================
   EL LOGO DEL COMERCIO, PARA FONDO OSCURO Y PARA FONDO CLARO
   ============================================================

   El logo va sobre fondos distintos: la barra de arriba en el tema
   oscuro, la misma en el claro, la franja negra de las etiquetas de
   góndola. Un solo logo no sirve para todos: el de Super 25 tiene las
   letras blancas, y sobre un recuadro blanco no se veía nada (26/09).

   Por eso hay dos, en la marca del comercio:
     - `logoParaOscuro`: el que se ve sobre fondo oscuro (letras claras);
     - `logoParaClaro`:  el que se ve sobre fondo claro (letras oscuras).
   El comercio puede subir los dos. Si sube uno solo —o si solo está el
   `logo` de antes—, el otro se arma acá: se mira si el logo es claro u
   oscuro y se hace una versión toda blanca o toda negra, con la misma
   forma. Así nadie tiene que tener dos archivos para que ande.

   Eso vale para un logo sin fondo (PNG transparente). Una foto con fondo
   ya trae su contraste: se usa la misma en los dos lados, tal cual.

   Nunca se le pone recuadro ni contorno: un logo sin fondo se muestra
   solo, y una foto, con su fondo.
   ============================================================ */

import { useEffect, useState } from "react";

function cargar(src) {
  return new Promise((resolver, fallar) => {
    const img = new Image();
    img.onload = () => resolver(img);
    img.onerror = () => fallar(new Error("No se pudo leer el logo."));
    img.src = src;
  });
}

function lienzoDe(img) {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  c.getContext("2d").drawImage(img, 0, 0);
  return c;
}

/* { transparente, claro }: si tiene zonas sin fondo, y si lo que se ve
   del logo es más bien claro (pensado para fondo oscuro) o no. La
   luminosidad se promedia pesada por la opacidad: el borde suavizado de
   una letra cuenta menos que la letra. */
export async function analizarLogo(src) {
  const c = lienzoDe(await cargar(src));
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let transparente = false, suma = 0, peso = 0;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3] / 255;
    if (a < 0.98) transparente = true;
    if (a < 0.1) continue;
    suma += a * (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
    peso += a;
  }
  return { transparente, claro: peso > 0 && suma / peso > 0.6 };
}

/* La misma forma, toda de un color, respetando la transparencia. */
export async function monocromo(src, blanco) {
  const c = lienzoDe(await cargar(src));
  const ctx = c.getContext("2d");
  const datos = ctx.getImageData(0, 0, c.width, c.height);
  const d = datos.data;
  const v = blanco ? 255 : 0;
  for (let i = 0; i < d.length; i += 4) { d[i] = v; d[i + 1] = v; d[i + 2] = v; }
  ctx.putImageData(datos, 0, 0);
  return c.toDataURL("image/png");
}

const resueltos = new Map();

/* { paraOscuro, paraClaro, automatico: "oscuro"|"claro"|null } a partir
   de la marca del comercio. `automatico` dice cuál se armó acá. */
export async function resolverLogos(marca) {
  const m = marca || {};
  const oscuro = m.logoParaOscuro || null;
  const claro = m.logoParaClaro || null;
  if (oscuro && claro) return { paraOscuro: oscuro, paraClaro: claro, automatico: null };
  const base = oscuro || claro || m.logo || null;
  if (!base) return { paraOscuro: null, paraClaro: null, automatico: null };

  const clave = `${oscuro ? "o" : claro ? "c" : "l"}:${base.length}:${base.slice(-64)}`;
  if (resueltos.has(clave)) return resueltos.get(clave);

  const { transparente, claro: esClaro } = await analizarLogo(base);
  /* Para qué fondo es el que hay: lo dice el lugar donde se subió, o,
     para el `logo` de antes, su luminosidad. */
  const esParaOscuro = oscuro ? true : claro ? false : esClaro;
  let r;
  if (!transparente) {
    r = { paraOscuro: base, paraClaro: base, automatico: null };
  } else if (esParaOscuro) {
    r = { paraOscuro: base, paraClaro: await monocromo(base, false), automatico: "claro" };
  } else {
    r = { paraOscuro: await monocromo(base, true), paraClaro: base, automatico: "oscuro" };
  }
  resueltos.set(clave, r);
  return r;
}

/* Lo mismo como hook. Mientras se resuelve, el que haya para los dos
   lados: mejor un logo que un hueco que parpadea. */
export function useLogos(marca) {
  const m = marca || {};
  const inicial = m.logoParaOscuro || m.logoParaClaro || m.logo || null;
  const [logos, setLogos] = useState({ paraOscuro: inicial, paraClaro: inicial, automatico: null });
  useEffect(() => {
    let vivo = true;
    resolverLogos(m).then((r) => { if (vivo) setLogos(r); }).catch(() => {});
    return () => { vivo = false; };
  }, [m.logoParaOscuro, m.logoParaClaro, m.logo]);
  return logos;
}
