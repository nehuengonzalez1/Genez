// Diagnóstico temporal: confirma si Vercel está publicando la carpeta api/
export default function handler(req, res) {
  res.status(200).json({ ok: true, ruta: "api/ping", metodo: req.method });
}
