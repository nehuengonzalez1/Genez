/**
 * El certificado de un comercio para hablar con ARCA.
 *
 * CÓMO ES EL CIRCUITO
 * -------------------
 *   1. Genez genera la clave privada y el pedido de certificado (CSR). La
 *      clave no sale nunca del servidor: se guarda cifrada (ver
 *      `_cifrado.js`) y el comercio solo se lleva el CSR.
 *   2. El dueño entra a ARCA con su Clave Fiscal, en "Administración de
 *      Certificados Digitales" sube el CSR y descarga el certificado.
 *   3. Lo sube a Genez. Acá se controla que sea la pareja de la clave que
 *      generamos, y de ahí —del certificado firmado por ARCA, no de lo que
 *      escriba nadie— sale el CUIT con el que se va a facturar.
 *
 * Así nadie tiene que mandarnos una clave privada, y el CUIT no se puede
 * inventar: solo ARCA emite un certificado para un CUIT, y solo a quien
 * tiene la Clave Fiscal de ese CUIT.
 */

import { generateKeyPairSync } from "node:crypto";
import forge from "node-forge";

/* Dígito verificador del CUIT. Un CUIT mal tipeado en el pedido termina
   en un certificado que ARCA no emite, y el dueño se entera en la página
   de ARCA sin saber por qué. Mejor frenarlo acá. */
export function cuitValido(cuit) {
  const d = String(cuit || "").replace(/\D/g, "");
  if (d.length !== 11) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((s, p, i) => s + p * Number(d[i]), 0);
  let v = 11 - (suma % 11);
  if (v === 11) v = 0;
  if (v === 10) v = 9;
  return v === Number(d[10]);
}

/* El alias es el nombre del "computador fiscal" en ARCA: lo ve el dueño
   en la lista de certificados y lo elige al autorizar el servicio. Tiene
   que decir que es de Genez para que dentro de un año se sepa qué es. */
export function aliasDe(nombre) {
  const base = String(nombre || "comercio")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    .slice(0, 24);
  return `genez-${base || "comercio"}`;
}

/**
 * Una clave nueva y su pedido de certificado.
 * La clave la genera Node y no forge: RSA de 2048 en JavaScript puro
 * tarda segundos, y en una función de Vercel eso es plata y timeouts.
 */
export function generarPedido({ cuit, razonSocial, alias }) {
  const numero = String(cuit).replace(/\D/g, "");
  if (!cuitValido(numero)) throw Object.assign(new Error("El CUIT no es válido: revisá los 11 números."), { estado: 400 });

  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });

  const clave = forge.pki.privateKeyFromPem(privateKey);
  const csr = forge.pki.createCertificationRequest();
  csr.publicKey = forge.pki.setRsaPublicKey(clave.n, clave.e);
  /* Los cuatro campos que pide ARCA. `serialNumber` lleva "CUIT " delante:
     es la forma en que ARCA sabe a quién es el certificado. */
  csr.setSubject([
    { shortName: "C", value: "AR" },
    { shortName: "O", value: String(razonSocial || alias).slice(0, 60) },
    { shortName: "CN", value: alias },
    { name: "serialNumber", value: `CUIT ${numero}` },
  ]);
  csr.sign(clave, forge.md.sha256.create());

  return { clavePem: privateKey, csrPem: forge.pki.certificationRequestToPem(csr), cuit: numero };
}

/**
 * Lee el certificado que devolvió ARCA y controla que sirva con esta
 * clave. Devuelve lo que hace falta mostrar y guardar.
 */
export function leerCertificado(pem, clavePem) {
  let cert;
  try {
    cert = forge.pki.certificateFromPem(String(pem || "").trim());
  } catch {
    throw Object.assign(new Error("Eso no es un certificado. Subí el archivo .crt que descargaste de ARCA."), { estado: 400 });
  }

  /* La pareja se reconoce por el módulo de la clave pública: es el mismo
     número en la clave y en el certificado, o no son pareja. Pasa si se
     sube el certificado de otro pedido, o uno viejo después de generar un
     pedido nuevo. */
  const clave = forge.pki.privateKeyFromPem(clavePem);
  if (cert.publicKey.n.compareTo(clave.n) !== 0) {
    throw Object.assign(new Error("Este certificado no es el del último pedido que generaste en Genez. Subí el que ARCA emitió para ese pedido."), { estado: 400 });
  }

  const serial = cert.subject.getField({ name: "serialNumber" });
  const cuit = serial ? String(serial.value).replace(/\D/g, "") : "";
  if (!cuitValido(cuit)) throw Object.assign(new Error("El certificado no trae un CUIT válido."), { estado: 400 });

  const vence = cert.validity.notAfter;
  if (vence.getTime() < Date.now()) throw Object.assign(new Error("Ese certificado ya venció. Pedí uno nuevo en ARCA."), { estado: 400 });

  const cn = (campo) => { const f = campo.getField("CN"); return f ? String(f.value) : null; };
  return {
    pem: forge.pki.certificateToPem(cert),
    cuit,
    alias: cn(cert.subject),
    emisor: cn(cert.issuer),
    desde: cert.validity.notBefore,
    vence,
  };
}
