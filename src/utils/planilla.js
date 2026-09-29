/* ============================================================
   PLANILLAS · bajar un Excel
   ============================================================

   Antes vivía adentro de Vender.jsx, para el catálogo. Ahora también la
   usan las planillas para el contador (ParaElContador.jsx), y copiarla
   habría dejado dos lugares donde cambiar la versión de la librería.

   La librería (SheetJS) se descarga solo cuando se usa, así no engorda la
   aplicación para quien nunca la abre. Si no se puede descargar, se cae a
   CSV, que Excel abre igual.
   ============================================================ */

export async function cargarPlanilla() {
  try {
    return await import(/* @vite-ignore */ "https://esm.sh/xlsx@0.18.5");
  } catch (e) {
    return null;
  }
}

export function descargar(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* Un Excel con varias hojas, cada una como filas de celdas (la primera,
   los títulos). Los números van como números, para que el contador pueda
   sumar sin convertir. `anchos`, en caracteres, por columna.

   Sin la librería, baja un CSV por hoja: con punto y coma y la marca de
   UTF-8, que es lo que Excel en español espera. */
export async function bajarExcel(nombre, hojas) {
  const XLSX = await cargarPlanilla();
  if (XLSX) {
    const libro = XLSX.utils.book_new();
    for (const h of hojas) {
      const hoja = XLSX.utils.aoa_to_sheet(h.filas);
      if (h.anchos) hoja["!cols"] = h.anchos.map((wch) => ({ wch }));
      XLSX.utils.book_append_sheet(libro, hoja, h.nombre.slice(0, 31));
    }
    const buf = XLSX.write(libro, { bookType: "xlsx", type: "array" });
    descargar(`${nombre}.xlsx`, buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return "xlsx";
  }
  const esc = (v) => (typeof v === "number" ? String(v).replace(".", ",") : `"${String(v ?? "").replace(/"/g, '""')}"`);
  for (const h of hojas) {
    const csv = "﻿" + h.filas.map((f) => f.map(esc).join(";")).join("\n");
    descargar(`${nombre}${hojas.length > 1 ? ` - ${h.nombre}` : ""}.csv`, csv, "text/csv;charset=utf-8");
  }
  return "csv";
}
