/**
 * Cifrar lo que no puede quedar legible en la base: la clave privada de
 * cada comercio y el token que devuelve ARCA.
 *
 * POR QUÉ ACÁ Y NO EN LA BASE
 * ---------------------------
 * La clave privada es la firma fiscal del comercio: con ella y su
 * certificado se factura a su nombre. Guardada tal cual, la tendría
 * cualquiera que lea la base —un backup, un script con la service_role,
 * una vista previa de Vercel mal configurada— y RLS no ayuda contra
 * nada de eso. Cifrada con una llave que vive solo en el entorno del
 * servidor, la base sola no alcanza.
 *
 * AES-256-GCM porque además de cifrar detecta si alguien tocó el dato:
 * un texto cifrado alterado no se descifra a otra cosa, falla.
 *
 * LA LLAVE
 * --------
 * `ARCA_CLAVE_MAESTRA`: 32 bytes en base64. Tiene que ser **la misma** en
 * el .env local y en Vercel, o lo cifrado en un lado no se abre en el
 * otro. Perderla es perder todas las claves privadas: cada comercio
 * tendría que pedir un certificado nuevo. Rotarla es descifrar con la
 * vieja y cifrar con la nueva, fila por fila; por eso el prefijo `v1:`.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function llave() {
  const b64 = process.env.ARCA_CLAVE_MAESTRA;
  if (!b64) throw Object.assign(new Error("Falta ARCA_CLAVE_MAESTRA en el servidor."), { estado: 501 });
  const k = Buffer.from(b64, "base64");
  if (k.length !== 32) throw Object.assign(new Error("ARCA_CLAVE_MAESTRA tiene que ser de 32 bytes en base64."), { estado: 501 });
  return k;
}

export function cifrar(texto) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", llave(), iv);
  const datos = Buffer.concat([c.update(String(texto), "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), datos.toString("base64")].join(":");
}

export function descifrar(guardado) {
  const [version, iv, tag, datos] = String(guardado || "").split(":");
  if (version !== "v1" || !iv || !tag || !datos) throw new Error("El dato cifrado no tiene el formato esperado.");
  const d = createDecipheriv("aes-256-gcm", llave(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(datos, "base64")), d.final()]).toString("utf8");
}
