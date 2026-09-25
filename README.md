# Genez

Plataforma de gestión para comercios: cobro, caja, stock y compras para un
minimercado; salón, comandas, cocina y centro de pedidos para un bar;
agenda, clases, abonos, equipo y CRM para un negocio de turnos. Cada
comercio es un inquilino aislado por RLS en Supabase, y **qué módulos ve,
cómo se llaman y por dónde arranca lo decide su rubro, que es una fila de
la base y no código** (`rubros`).

Son dos aplicaciones en un mismo repositorio:

- **El sistema de gestión**, lo que usa el comercio. Entrada `index.html`.
- **La app del cliente**, lo que ve quien saca el turno. Entrada
  `cliente.html`, servida en el subdominio de cada comercio
  (`almha.genez.com.ar`). Cuál se sirve lo decide `middleware.js` por el
  host.

## Levantarlo

Necesitás Node 18 o superior y un proyecto de Supabase.

```bash
npm install
cp .env.example .env    # completá al menos VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev
```

- `http://localhost:5173/` — el sistema de gestión.
- `http://localhost:5173/cliente.html?c=<slug>` — la app del cliente de
  ese comercio (en desarrollo no hay subdominio, así que se fuerza con `?c=`).

Solo las variables `VITE_*` viajan al navegador. El resto —`service_role`,
la URL directa a la base, las claves de Anthropic y Mercado Pago— son de
servidor y de scripts; `.env.example` explica cada una. Las funciones de
`api/` corren en desarrollo por un middleware de `vite.config.js`, así que
lo que se prueba local es lo mismo que corre publicado en Vercel.

Para entrar hace falta un usuario real de Supabase Auth: ver "Comandos" en
`CLAUDE.md`.

```bash
npm run build && npm run preview   # la versión de producción
```

## La base

El esquema vive en `supabase/migrations/`, numerado, y se aplica en orden:

```bash
node scripts/aplicar-sql.mjs supabase/migrations/0001_core.sql
```

`supabase/seed/` tiene datos de demostración por rubro (un catálogo de
minimercado, un bar con su salón y sus pedidos, una estética con cuatro
meses de historia). Van marcados como demo y se borran de una.

## Las pruebas

Corren contra la base real leyendo `SUPABASE_DB_URL` del `.env`:

```bash
node scripts/probar-rls.mjs      # seguridad, con la identidad de un usuario real
node scripts/probar-venta.mjs    # y el resto de scripts/probar-*.mjs
node scripts/probar-dominio.mjs  # el único que no toca la red
```

`probar-rls.mjs` es el único que aplica las políticas; los demás corren
como administrador y sirven para la lógica, no para los permisos.

## Operar

- **Lector de códigos de barras.** Se comporta como un teclado: el sistema
  detecta la ráfaga a nivel de ventana y no hace falta hacer clic en ningún
  campo. Sin lector, escribir un código del catálogo y Enter hace lo mismo.
- **Teclado.** El cobro está pensado para hacerse sin mouse; F1 muestra los
  atajos dentro de la aplicación.
- **Impresión.** Ticket, pre cuenta y comanda se componen como texto de
  ancho fijo para impresora térmica (58 u 80 mm, se elige en Ajustes).
- **Asistente y lectura de remitos por foto.** Necesitan `ANTHROPIC_API_KEY`
  del lado del servidor. Sin clave, todo lo demás funciona igual: los
  diagnósticos se calculan localmente.
- **Cobros por Mercado Pago.** Cada comercio conecta su cuenta en Ajustes →
  Mercado Pago; la caja avisa cada cobro entrante (la plata entra con la venta).
  Sin cuenta, Ajustes tiene un botón para simular el aviso.

## Dónde está cada cosa

| Carpeta | Qué contiene |
|---|---|
| `src/datos/` | La capa de datos. Un archivo por dominio. Es el único lugar que habla con Supabase. |
| `src/modulos/` | Una pantalla del sistema de gestión por archivo. |
| `src/cliente/` | La app del cliente. |
| `src/genez/PanelGenez.jsx` | Login, panel de plataforma y `Sistema`, el contenedor de estado de un comercio. |
| `src/ui/` | Componentes compartidos. |
| `api/` | Lo que necesita una credencial de servidor: modelo, Mercado Pago, alta de accesos, manifest e ícono de la PWA. |
| `middleware.js` | Decide por el host cuál de las dos aplicaciones se sirve. |
| `supabase/` | Migraciones y semillas. |
| `scripts/` | Aplicar SQL, pruebas y utilidades. |

## Leer antes de tocar

- **`ARQUITECTURA.md`** — la pila, el modelo de datos, las funciones de
  Postgres, las reglas que no se pueden romper y una sección por módulo.
- **`CLAUDE.md`** — cómo se trabaja en este repositorio: comandos,
  convenciones, permisos, integraciones y lo que todavía vive en memoria.
- **`DISENO.md`** — cómo tiene que verse.
- **`docs/`** — los encargos de cada vertical, con lo que quedó abierto.
