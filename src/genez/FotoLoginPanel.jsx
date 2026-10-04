/* ============================================================
   LA FOTO DEL LOGIN · subirla desde el panel de plataforma (0128)
   ============================================================

   Reemplaza a "Imagen del login", que guardaba la imagen en la memoria
   del navegador: se perdía al cerrar sesión y nunca le llegaba al login.
   Ahora va a Storage y la ve cualquiera que abra el login.

   La foto es solo el fondo: el panel oscuro con la flecha naranja, el
   texto y la tarjeta los dibuja el sistema encima (src/genez/Entrada.jsx).
   ============================================================ */

import React, { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Boton } from "../ui/Base.jsx";
import { urlFotoLogin, FOTO_DE_FABRICA, subirFotoLogin, sacarFotoLogin } from "../datos/imagenLogin.js";

const ROTULO = "text-[11px] uppercase tracking-widest text-texto-suave font-bold";
const PESO_MAXIMO = 8 * 1024 * 1024;

export function FotoLoginPanel() {
  const archivo = useRef(null);
  /* El número fuerza a releer la foto después de subirla: la URL es
     siempre la misma. */
  const [version, setVersion] = useState(Date.now());
  const [propia, setPropia] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState(null);

  const url = urlFotoLogin();
  const vista = propia && url ? `${url}?v=${version}` : FOTO_DE_FABRICA;

  const subir = async (f) => {
    if (!f) return;
    if (!/^image\/(webp|jpeg|png)$/.test(f.type)) return setAviso({ mal: true, texto: "Tiene que ser WebP, JPG o PNG." });
    if (f.size > PESO_MAXIMO) return setAviso({ mal: true, texto: "La foto supera los 8 MB. Exportala en WebP o JPG y probá de nuevo." });
    setOcupado(true); setAviso(null);
    try {
      await subirFotoLogin(f);
      setPropia(true); setVersion(Date.now());
      setAviso({ texto: "Listo. El login la muestra en unos minutos (se guarda en caché hasta 5)." });
    } catch (e) {
      setAviso({ mal: true, texto: e.message });
    } finally {
      setOcupado(false);
    }
  };

  const sacar = async () => {
    setOcupado(true); setAviso(null);
    try {
      await sacarFotoLogin();
      setPropia(false);
      setAviso({ texto: "Vuelve la foto de fábrica." });
    } catch (e) {
      setAviso({ mal: true, texto: e.message });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <section className="mt-8">
      <h2 className={`${ROTULO} mb-2`}>Foto del login</h2>
      <div className="bg-superficie-3 border border-borde-fuerte rounded-2xl p-4">
        <div className="flex flex-wrap items-start gap-4">
          <div className="w-56 aspect-video rounded-xl overflow-hidden border border-borde-fuerte shrink-0 bg-fondo">
            <img src={vista} alt="Foto del login" className="w-full h-full object-cover"
              onError={() => setPropia(false)} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-texto-tenue">
              El fondo del login. El sistema dibuja encima, a la izquierda, el panel oscuro con la flecha naranja y el
              texto, y a la derecha la tarjeta para entrar.
            </p>
            <ul className="text-[11px] text-texto-suave mt-2 space-y-0.5">
              <li><strong className="text-texto-tenue">Medida:</strong> 16:9, idealmente 2560 × 1440 o 3840 × 2160.</li>
              <li><strong className="text-texto-tenue">Qué mostrar:</strong> la escena sola, sin textos ni logos encima. El tercio izquierdo queda tapado por el panel.</li>
              <li><strong className="text-texto-tenue">Peso:</strong> hasta 8 MB, en WebP o JPG.</li>
              <li>En el celular no se muestra: ahí va el texto arriba y la tarjeta abajo.</li>
            </ul>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <input ref={archivo} type="file" accept="image/webp,image/jpeg,image/png" className="hidden"
                onChange={(e) => { const f = e.target.files[0]; e.target.value = ""; subir(f); }} />
              <Boton onClick={() => archivo.current && archivo.current.click()} disabled={ocupado || !url}>
                <Upload size={15} /> {ocupado ? "Subiendo…" : "Subir foto"}
              </Boton>
              {propia && url && (
                <Boton variant="quiet" onClick={sacar} disabled={ocupado}>Volver a la de fábrica</Boton>
              )}
            </div>
            {!url && <p className="text-xs text-texto-suave mt-2">En la pantalla de pruebas no se puede subir: no hay base.</p>}
            {aviso && <p className={`text-sm mt-2 ${aviso.mal ? "text-mal" : "text-bien"}`}>{aviso.texto}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
