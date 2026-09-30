/* ============================================================
   GENEZ FOUNDER · importar prospectos
   ============================================================

   Una planilla (CSV o Excel) en tres pasos: elegir el archivo, decir qué
   columna es cada cosa (se adivina por el título y se corrige), y
   revisar fila por fila antes de crear nada. Como todo lo que viene de
   afuera, no se aplica directo: se mira y se confirma.

   Lo que decide qué está mal y qué ya existe vive en
   utils/importarProspectos.js, que se prueba sin pantalla.
   ============================================================ */

import React, { useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { Modal, Boton } from "../ui/Base.jsx";
import { inputCls } from "../ui/Campos.jsx";
import { cargarPlanilla } from "../utils/planilla.js";
import { CAMPOS, filaDeTitulos, adivinarColumnas, armarFilas } from "../utils/importarProspectos.js";
import { cargarProspectos, importarProspectos } from "../datos/internoCrm.js";
import { registrarPlanilla } from "../datos/internoProspector.js";

async function leerFilas(archivo) {
  const XLSX = await cargarPlanilla();
  if (!XLSX) throw new Error("No se pudo cargar el lector de planillas. Revisá la conexión y probá de nuevo.");
  const libro = /\.csv$/i.test(archivo.name)
    ? XLSX.read(await archivo.text(), { type: "string" })
    : XLSX.read(await archivo.arrayBuffer(), { type: "array" });
  return XLSX.utils.sheet_to_json(libro.Sheets[libro.SheetNames[0]], { header: 1, defval: "" });
}

export function ImportarProspectos({ de, onCerrar, onListo, toast }) {
  const [paso, setPaso] = useState("archivo");
  const [archivo, setArchivo] = useState("");
  const [filas, setFilas] = useState(null);
  const [desde, setDesde] = useState(0);
  const [mapa, setMapa] = useState({});
  const [existentes, setExistentes] = useState([]);
  const [revisadas, setRevisadas] = useState(null);
  const [error, setError] = useState("");
  const [trabajando, setTrabajando] = useState("");

  const subir = async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = "";
    if (!f) return;
    setError(""); setTrabajando("Leyendo la planilla…");
    try {
      const [fs, activos, archivados] = await Promise.all([leerFilas(f), cargarProspectos(), cargarProspectos({ archivados: true })]);
      if (!fs.length) throw new Error("La planilla está vacía.");
      const d = filaDeTitulos(fs);
      setArchivo(f.name); setFilas(fs); setDesde(d); setMapa(adivinarColumnas(fs[d]));
      setExistentes([...activos, ...archivados]);
      setPaso("columnas");
    } catch (e) { setError(e.message || "No se pudo leer el archivo."); }
    setTrabajando("");
  };

  const titulos = filas ? (filas[desde] || []).map((t, i) => String(t || "").trim() || `Columna ${i + 1}`) : [];
  const listas = useMemo(() => ({ rubro: de("rubro"), zona: de("zona"), fuente: de("fuente") }), [de]);

  const revisar = () => {
    if (!(mapa.nombre >= 0)) return setError("Falta decir qué columna tiene el nombre del negocio.");
    setError("");
    setRevisadas(armarFilas(filas, desde, mapa, listas, existentes));
    setPaso("revisar");
  };

  const aCrear = (revisadas || []).filter((r) => r.incluir && !r.errores.length);
  const confirmar = async () => {
    setTrabajando(`Creando 0 de ${aCrear.length}…`);
    try {
      /* El origen queda en cada prospecto, y la planilla en el historial de
         búsquedas del prospector (0119). */
      const ahora = new Date();
      const n = await importarProspectos(aCrear.map((r) => ({ ...r.datos, fuente: r.datos.fuente || "planilla", origenProveedor: "planilla", origenObtenidoEn: ahora })),
        (k) => setTrabajando(`Creando ${k} de ${aCrear.length}…`));
      await registrarPlanilla(archivo, revisadas.length, n).catch(() => {});
      toast(`${n} ${n === 1 ? "prospecto importado" : "prospectos importados"}.`);
      onListo();
    } catch (e) {
      /* Si se cortó a mitad de camino, lo creado queda: se dice cuánto,
         para no volver a importar lo mismo. */
      setError(`${e.message}${e.creados ? ` Se llegaron a crear ${e.creados}: volvé a abrir la importación y van a aparecer como ya cargados.` : ""}`);
      setTrabajando("");
    }
  };

  const conteo = revisadas && {
    ok: revisadas.filter((r) => !r.errores.length && !r.duplicado).length,
    dup: revisadas.filter((r) => r.duplicado && !r.errores.length).length,
    mal: revisadas.filter((r) => r.errores.length).length,
    avisos: revisadas.filter((r) => r.avisos.length).length,
  };

  return (
    <Modal open onClose={trabajando ? () => {} : onCerrar} ancho="max-w-3xl">
      <div className="p-5 space-y-4">
        <div>
          <h3 className="f-d text-xl">Importar prospectos</h3>
          <p className="text-sm text-texto-suave mt-1">
            {paso === "archivo" && "Una planilla CSV o Excel con una fila por comercio. Alcanza con el nombre; lo demás, si está, se toma."}
            {paso === "columnas" && <>De <span className="font-medium text-texto">{archivo}</span>: decí qué columna es cada cosa. Lo que no esté, dejalo en "No está".</>}
            {paso === "revisar" && "Nada se creó todavía. Revisá y confirmá."}
          </p>
        </div>

        {paso === "archivo" && (
          <label className="flex flex-col items-center justify-center gap-2 border border-dashed border-borde-fuerte rounded-lg py-10 cursor-pointer hover:bg-superficie-2">
            <Upload size={20} className="text-texto-tenue" />
            <span className="text-sm">{trabajando || "Elegir la planilla"}</span>
            <span className="text-[11px] text-texto-tenue">.csv, .xlsx o .xls</span>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={subir} className="hidden" disabled={!!trabajando} />
          </label>
        )}

        {paso === "columnas" && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-texto-suave">Los títulos están en la fila</span>
              <select value={desde} onChange={(e) => { const d = Number(e.target.value); setDesde(d); setMapa(adivinarColumnas(filas[d])); }} className={`${inputCls} w-auto`}>
                {filas.slice(0, 20).map((_, i) => <option key={i} value={i}>{i + 1}</option>)}
              </select>
            </label>
            <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2">
              {CAMPOS.map((c) => (
                <label key={c.k} className="flex items-center gap-2 text-sm">
                  <span className={`w-36 shrink-0 ${c.k === "nombre" ? "font-medium" : "text-texto-suave"}`}>{c.n}{c.k === "nombre" ? " *" : ""}</span>
                  <select value={mapa[c.k] ?? -1} onChange={(e) => setMapa({ ...mapa, [c.k]: Number(e.target.value) })} className={`${inputCls} min-w-0`}>
                    <option value={-1}>No está</option>
                    {titulos.map((t, i) => <option key={i} value={i}>{t}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <p className="text-[11px] text-texto-tenue">{Math.max(0, filas.length - desde - 1)} filas debajo de los títulos.</p>
          </div>
        )}

        {paso === "revisar" && (
          <div className="space-y-3">
            <p className="text-sm">
              <span className="f-m">{conteo.ok}</span> {conteo.ok === 1 ? "nuevo" : "nuevos"}
              {conteo.dup > 0 && <> · <span className="f-m text-ojo">{conteo.dup}</span> ya estaban</>}
              {conteo.mal > 0 && <> · <span className="f-m text-mal">{conteo.mal}</span> con error, no se importan</>}
              {conteo.avisos > 0 && <> · <span className="f-m">{conteo.avisos}</span> con avisos</>}
            </p>
            <div className="max-h-[50vh] overflow-auto border border-borde rounded-lg">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-superficie text-[11px] uppercase tracking-wider text-texto-tenue">
                  <tr><th className="p-2 w-8"></th><th className="p-2 text-left w-12">Fila</th><th className="p-2 text-left">Negocio</th><th className="p-2 text-left">Qué pasa</th></tr>
                </thead>
                <tbody className="divide-y divide-borde">
                  {revisadas.map((r, i) => (
                    <tr key={r.n} className={r.errores.length ? "opacity-60" : ""}>
                      <td className="p-2 text-center">
                        <input type="checkbox" aria-label="Importar esta fila" className="accent-acento" disabled={!!r.errores.length} checked={r.incluir && !r.errores.length}
                          onChange={(e) => setRevisadas(revisadas.map((x, j) => (j === i ? { ...x, incluir: e.target.checked } : x)))} />
                      </td>
                      <td className="p-2 f-m text-texto-tenue">{r.n}</td>
                      <td className="p-2">
                        <div className="font-medium">{r.datos.nombre || "—"}</div>
                        <div className="text-[11px] text-texto-tenue">{[r.datos.localidad, r.datos.telefono || r.datos.whatsapp, r.datos.email].filter(Boolean).join(" · ")}</div>
                      </td>
                      <td className="p-2 text-[12px]">
                        {r.errores.map((x) => <div key={x} className="text-mal">{x}</div>)}
                        {r.duplicado && <div className="text-ojo">{r.duplicado}</div>}
                        {r.avisos.map((x) => <div key={x} className="text-texto-suave">{x}</div>)}
                        {!r.errores.length && !r.duplicado && !r.avisos.length && <span className="text-texto-tenue">Bien</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-mal" data-aviso="mal">{error}</p>}

        <div className="flex flex-wrap justify-end gap-2">
          {paso === "columnas" && <Boton variant="quiet" onClick={() => setPaso("archivo")}>Otro archivo</Boton>}
          {paso === "revisar" && !trabajando && <Boton variant="quiet" onClick={() => setPaso("columnas")}>Volver a las columnas</Boton>}
          <Boton variant="ghost" onClick={onCerrar} disabled={!!trabajando}>Cancelar</Boton>
          {paso === "columnas" && <Boton onClick={revisar}>Revisar</Boton>}
          {paso === "revisar" && (
            <Boton onClick={confirmar} disabled={!aCrear.length || !!trabajando}>
              {trabajando || `Importar ${aCrear.length}`}
            </Boton>
          )}
        </div>
      </div>
    </Modal>
  );
}
