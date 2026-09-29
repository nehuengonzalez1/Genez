/* ============================================================
   Founder · importar prospectos de una planilla
   ============================================================

   Lo puro de la importación, sin pantalla: qué columna es cada campo,
   qué fila está mal, qué fila ya existe. Así se prueba en node
   (scripts/probar-importar-prospectos.mjs) sin montar nada.

   Un dato que no se entiende no se inventa: un rubro que no está en las
   listas queda vacío y se avisa, un teléfono con pocos dígitos se avisa
   pero no frena, y lo único que frena una fila es que no tenga nombre.
   Los duplicados se marcan y se dejan afuera por defecto: se pueden
   sumar igual, uno por uno, desde la vista previa.
   ============================================================ */

export const norm = (s) => String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
/* Igual que interno_norm_tel en la base (0114), que explica el porqué:
   "011 15-4444-5555" y "+54 9 11 4444-5555" terminan en 1144445555. */
export const normTel = (s) => {
  let d = String(s == null ? "" : s).replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("54")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("9")) d = d.slice(1);
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length === 12) {
    for (const i of [2, 3, 4]) if (d.slice(i, i + 2) === "15") { d = d.slice(0, i) + d.slice(i + 2); break; }
  }
  return d.length >= 8 ? d.slice(-10) : "";
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* Los campos que se pueden importar, con las palabras que suelen
   aparecer en el título de su columna. */
export const CAMPOS = [
  { k: "nombre", n: "Nombre del negocio", pistas: ["negocio", "comercio", "local", "razon", "nombre", "empresa"] },
  { k: "contactoNombre", n: "Con quién hablar", pistas: ["contacto", "dueno", "encargado", "persona", "responsable"] },
  { k: "rubro", n: "Rubro", pistas: ["rubro", "categoria", "tipo", "actividad"], lista: "rubro" },
  { k: "zona", n: "Zona", pistas: ["zona", "barrio", "partido"], lista: "zona" },
  { k: "localidad", n: "Localidad", pistas: ["localidad", "ciudad"] },
  { k: "direccion", n: "Dirección", pistas: ["direccion", "domicilio", "calle"] },
  { k: "telefono", n: "Teléfono", pistas: ["telefono", "tel", "celular", "movil"] },
  { k: "whatsapp", n: "WhatsApp", pistas: ["whatsapp", "wsp", "wa"] },
  { k: "email", n: "Email", pistas: ["email", "mail", "correo"] },
  { k: "instagram", n: "Instagram", pistas: ["instagram", "ig", "redes"] },
  { k: "fuente", n: "Cómo lo conociste", pistas: ["fuente", "origen", "como lo", "canal"], lista: "fuente" },
  { k: "interes", n: "Interés", pistas: ["interes", "temperatura"] },
  { k: "notas", n: "Notas", pistas: ["nota", "observ", "comentario"] },
];

/* La fila de títulos: la primera, de las veinte de arriba, con más celdas
   que parecen títulos de los campos. Las planillas suelen traer un
   encabezado con el nombre del archivo o la fecha antes. */
export function filaDeTitulos(filas) {
  let mejor = 0, puntaje = 0;
  filas.slice(0, 20).forEach((f, i) => {
    const p = (f || []).map(norm).filter((c) => c && CAMPOS.some((x) => x.pistas.some((w) => c.includes(w)))).length;
    if (p > puntaje) { puntaje = p; mejor = i; }
  });
  return mejor;
}

/* Qué columna es cada campo. Cada columna se usa una sola vez y gana la
   pista más específica: "WhatsApp" no se toma como teléfono si hay una
   columna que dice teléfono. -1 = ninguna. */
export function adivinarColumnas(titulos) {
  const t = (titulos || []).map(norm);
  const mapa = {}; const usadas = new Set();
  /* Primero los campos con pistas más raras, para que "nombre" (que
     aparece en "nombre del contacto") no se lleve la columna equivocada. */
  const orden = ["whatsapp", "email", "instagram", "contactoNombre", "localidad", "direccion", "telefono", "rubro", "zona", "fuente", "interes", "notas", "nombre"];
  for (const k of orden) {
    const campo = CAMPOS.find((c) => c.k === k);
    const i = t.findIndex((c, j) => !usadas.has(j) && c && campo.pistas.some((w) => (w.length <= 3 ? c.split(/[^a-z]+/).includes(w) : c.includes(w))));
    mapa[k] = i;
    if (i >= 0) usadas.add(i);
  }
  return mapa;
}

/* Un valor de la planilla contra una lista de Configuración: por clave
   o por nombre, sin tildes ni mayúsculas. */
function enLista(valor, items) {
  const v = norm(valor);
  if (!v) return { clave: null };
  const it = (items || []).find((x) => norm(x.clave) === v || norm(x.nombre) === v);
  return it ? { clave: it.clave } : { clave: null, desconocido: String(valor).trim() };
}

const INTERES = { frio: "frio", tibio: "tibio", caliente: "caliente", bajo: "frio", medio: "tibio", alto: "caliente" };

/* Las filas listas para revisar.
   filas: la planilla como arreglo de arreglos; desde: la fila de títulos;
   mapa: { campo: índice }; listas: { rubro: [...], zona: [...], fuente: [...] };
   existentes: los prospectos que ya están (activos y archivados).
   Devuelve [{ n, datos, errores, avisos, duplicado, incluir }]. */
export function armarFilas(filas, desde, mapa, listas, existentes = []) {
  const porTel = new Map(), porEmail = new Map(), porNombre = new Map();
  const anotar = (p, quien) => {
    const t = normTel(p.telefono) || normTel(p.whatsapp);
    if (t && !porTel.has(t)) porTel.set(t, quien);
    const e = norm(p.email);
    if (e && !porEmail.has(e)) porEmail.set(e, quien);
    const nl = `${norm(p.nombre)}|${norm(p.localidad || p.zona)}`;
    if (norm(p.nombre) && !porNombre.has(nl)) porNombre.set(nl, quien);
  };
  existentes.forEach((p) => anotar(p, { ya: p.nombre + (p.archivadoEn ? " (archivado)" : "") }));

  const celda = (f, k) => (mapa[k] >= 0 ? String(f[mapa[k]] == null ? "" : f[mapa[k]]).trim() : "");
  const out = [];
  filas.slice(desde + 1).forEach((f, i) => {
    if (!f || !f.some((c) => String(c == null ? "" : c).trim())) return;   // fila vacía
    const n = desde + i + 2;   // el número de fila como lo ve la planilla
    const datos = {}; const errores = []; const avisos = [];
    for (const c of CAMPOS) {
      const v = celda(f, c.k);
      if (!v) continue;
      if (c.lista) {
        const r = enLista(v, listas[c.lista]);
        if (r.clave) datos[c.k] = r.clave;
        else avisos.push(`${c.n} "${r.desconocido}" no está en tus listas: queda vacío`);
      } else if (c.k === "interes") {
        const r = INTERES[norm(v)];
        if (r) datos.interes = r; else avisos.push(`Interés "${v}" no se entiende: queda vacío`);
      } else datos[c.k] = v.slice(0, c.k === "notas" ? 4000 : 200);
    }
    if (!datos.nombre) errores.push("Sin nombre del negocio");
    else if (datos.nombre.length > 120) datos.nombre = datos.nombre.slice(0, 120);
    if (datos.email && !EMAIL.test(datos.email)) { avisos.push(`El email "${datos.email}" no parece válido: queda vacío`); delete datos.email; }
    for (const k of ["telefono", "whatsapp"]) {
      if (datos[k] && !normTel(datos[k])) avisos.push(`${k === "telefono" ? "Teléfono" : "WhatsApp"} con pocos dígitos`);
    }

    let duplicado = null;
    if (datos.nombre) {
      const t = normTel(datos.telefono) || normTel(datos.whatsapp);
      const quien = (t && porTel.get(t)) || (datos.email && porEmail.get(norm(datos.email))) || porNombre.get(`${norm(datos.nombre)}|${norm(datos.localidad || datos.zona)}`);
      if (quien) duplicado = quien.ya ? `Ya está cargado: ${quien.ya}` : `Repetido en la planilla (fila ${quien.fila})`;
      anotar(datos, { fila: n });
    }
    out.push({ n, datos, errores, avisos, duplicado, incluir: !errores.length && !duplicado });
  });
  return out;
}
