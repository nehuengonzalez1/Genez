# CLAUDE.md

Guía para Claude Code (claude.ai/code) al trabajar en este repositorio.

## Antes de tocar nada

Este archivo cubre lo que no está escrito en otro lado. Lo demás vive en dos
documentos que se mantienen al día y **hay que leer primero**:

- **`ARQUITECTURA.md`** — la pila, dónde vive cada cosa, el modelo de datos, las
  funciones de Postgres, las cinco reglas que no se pueden romper, y una sección
  por módulo (el salón, la comanda, el centro de pedidos) con las decisiones que
  conviene no deshacer.
- **`DISENO.md`** — cómo tiene que verse: bordes de 1px, esquinas discretas, aire,
  sombras casi inexistentes, jerarquía de texto y poco color, con la traducción a
  clases de Tailwind.

Si algo de acá contradice a esos dos, mandan ellos. `README.md` tiene el recorrido
funcional.

## Qué es

Genez es una plataforma de gestión multi-comercio (cobro, comandas, salón, pedidos,
stock, compras, caja, informes) con **backend real**: Supabase (Postgres + Auth +
RLS) sobre Vercel. Cada comercio es un inquilino; el aislamiento lo garantiza RLS,
no la aplicación.

El primer cliente es un minimercado (Super 25) y el segundo un bar (Bar Rivadavia),
pero la arquitectura tiene que servir para cualquier rubro: no hardcodear supuestos
de góndola, código de barras o stock físico en el núcleo.

## Comandos

```bash
npm install
npm run dev       # Vite en http://localhost:5173, abre el navegador solo
npm run build
npm run preview
```

```bash
node scripts/aplicar-sql.mjs supabase/migrations/0024_reservas.sql   # aplicar SQL
node scripts/probar-rls.mjs                                          # ver ARQUITECTURA.md
```

No hay linter ni typechecker. Las pruebas son los `scripts/probar-*.mjs`, que corren
**contra la base real** leyendo `SUPABASE_DB_URL` del `.env`. `probar-rls.mjs` es el
único que aplica las políticas; los demás corren como administrador y saltean RLS.
La lista completa está en `ARQUITECTURA.md`, con la advertencia de por qué esa
diferencia importa.

Para probar a mano hay que loguearse con un usuario real de Supabase Auth. Los
perfiles los crean `supabase/migrations/0003_semilla.sql` y
`supabase/seed/gastronomia_usuario.sql`, pero esos usuarios **de arranque** se
crean a mano en Authentication → Users (con "Auto Confirm User"):
`nehuengonzalez1@gmail.com` es el dueño de plataforma, `axel@super25.com` el de
Super 25, `mozo@rivadavia.com` el del bar. Las contraseñas no están en el
repositorio.

Los de después ya no: desde la migración 0048, cada comercio da de alta a su
gente desde Permisos → Personas. Eso necesita `SUPABASE_SERVICE_ROLE_KEY` en el
entorno del servidor —nunca en el navegador— y sin ella el sistema funciona
igual: lo único que no anda es crear accesos.

Las variables de entorno están explicadas en `.env.example`. Solo las dos `VITE_*`
viajan al navegador; el resto es de servidor y de scripts.

## Idioma

Todo el código está en español rioplatense: nombres de variables, funciones,
componentes, comentarios y textos de UI (`cobrar`, `productos`, `ajustes`, `movCaja`,
`permisosDe`). Mantener esa convención en cualquier código nuevo; mezclar inglés
rompe la lectura.

Los comentarios explican **por qué** está hecho así —qué se rompía antes, qué se
descartó— no qué hace la línea de abajo. Es el estilo de todo el repositorio.

## La migración está a mitad de camino

Conviene saberlo antes de leer un módulo y sacar conclusiones.

Ya salen de la base: catálogo, ventas, comandas, salón y reservas, pedidos y canales,
caja, ajustes y la sesión. Todo eso pasa por `src/datos/`, que es el único lugar que
habla con Supabase.

Todavía viven en memoria, heredados del prototipo: la serie de 90 días de ventas que
alimenta los KPIs (`DATA.diario`, que consume `calcular()`), los pedidos de picking
(`PEDIDOS_INICIALES`), los clientes (`CLIENTES_INICIALES`) y los proveedores
(`PROV_INFO`). Los arma `src/datos/generador.js` con un PRNG determinista
(`mulberry32(20260809)`), así que son idénticos en cada carga y se pierden al
refrescar.

De ahí sale **`HOY`**, una fecha fija (`new Date(2026, 7, 9)`): es el "hoy" de los
cálculos que todavía dependen de los datos simulados —vencimientos, cobertura, series
diarias—. `Date.now()` real se usa para cosas del navegador (hora de tickets, sondeo
de Mercado Pago, ráfagas del lector). No mezclar los dos: mientras un cálculo tome
datos del generador, tiene que usar `HOY`/`addDays`/`diasHasta`.

Al migrar algo a la base, la fecha congelada sale con ello.

## Estado

`Genezapp.jsx` es la raíz y decide qué se ve según quién entró: sin sesión → `Login`
(o `ClaveNueva`, si viene del link de recuperación); sesión de plataforma →
`PanelGenez`; sesión de comercio, o plataforma "entrando como" → `Sistema`.

`Sistema` (en `src/genez/PanelGenez.jsx`) es el contenedor de estado de un comercio:
productos, tickets, caja, pedidos, clientes, proveedores, ajustes, toasts. Todo baja
por props; no hay store ni React Query. Se monta con `key={comercio.id}` para que
cambiar de comercio resetee el estado.

La sesión sí sobrevive al refresco —la guarda Supabase— y las ventas pendientes
también: `src/datos/cola.js` las escribe en `localStorage` antes de intentar
mandarlas, porque el caso que importa no es que falle la request sino que se corte la
luz. Fuera de eso, refrescar pierde lo que esté en memoria.

## Permisos

`permisosDe(sesion, roles)` cruza dos cosas: los módulos que el **comercio
contrató** (`comercio.modulos`) y los que el **rol** habilita. Un módulo no
contratado no lo ve ni el dueño. `MODULOS_BASE` (cobro, caja, ajustes) no se puede
desactivar. Las banderas finas (`verCostos`, `descuentos`, `anular`, `cerrarCaja`,
`cambiarPrecios`, `ajustes`, `verBitacora`, `configurar`) viajan como `permisos`
hasta los componentes.

**Los roles ya no están en el código.** Salen de `roles_base` (los cuatro de
fábrica, dato de plataforma) más `roles` (lo que cada comercio cambió). La
constante `ROLES` de `PanelGenez.jsx` sigue existiendo pero solo como respaldo,
por si la consulta no llegó. Se editan desde el módulo Permisos.

**Y hay una tercera capa: `perfiles.permisos`**, la excepción de una persona
sobre su rol. Las tres se fusionan en `permisos_de()`, de lo general a lo
puntual, y las tres guardan la diferencia y no la foto. El comercio da de
alta a su gente desde Permisos → Personas; crear el usuario en Auth es lo
único que pasa por el servidor (`api/usuarios.js`, necesita la
`service_role`). Ver la sección "Los accesos" de `ARQUITECTURA.md`.

Al agregar un módulo nuevo hay que tocar `MODULOS`, el `menu` del rubro en la
base, el arreglo `modulos` del rol en `roles_base` si corresponde, y el switch de
`tab` en `Sistema`. `NAV` y `TITULOS` ya no existen: el menú es dato.

Esto es la pantalla, no la seguridad: **lo que protege los datos es RLS**. Un permiso
de UI que no tenga su política atrás no protege nada. De las ocho banderas, dos
—`verBitacora` y `configurar`— las verifica la base con `permiso()`; las otras seis
apagan botones. Ver `ARQUITECTURA.md`.

## Lector de códigos de barras

Es un mecanismo global, no un input. `useScanner` (en `src/ui/Base.jsx`) escucha
`keydown` en `window` (fase de captura), ignora eventos con foco en
INPUT/TEXTAREA/SELECT, acumula teclas que llegan a menos de 90 ms de distancia y
dispara con Enter si el buffer tiene 6+ dígitos.

Las pantallas que saben qué hacer con un código se registran con `useScanHandler`,
que apila su callback en `ScanCtx`; **gana el último montado** (un modal le gana a la
pantalla que lo abrió). Si nadie está registrado, el escaneo cae en la ficha rápida
global (`FichaRapida`), y si el código no existe abre el alta de producto.

## Los colores y el tema

Los colores son variables CSS en `src/index.css`, nombradas por lo que son
(`--superficie`, `--texto-suave`, `--borde`, `--acento`) y no por lo que valen. Las
pantallas piden `bg-superficie`, `text-texto-tenue`, `border-borde`: ninguna sabe de
qué color es nada.

**El oscuro es el de fábrica** —es donde el sistema vive: una cocina, un salón de
noche, una caja con la persiana baja— y el claro se activa con la clase `.tema-claro`
en el wrapper de `Genezapp`. Por eso la clase dice "pasá al claro" y no "poné el
oscuro".

Nada de `bg-slate-*`, `bg-white`, `text-gray-*` ni variantes `dark:`. Un color de
Tailwind crudo queda fijo en los dos temas: si hace falta uno nuevo, se agrega como
variable en `index.css` y en `tailwind.config.js`. Así estaba antes —el claro escrito
en cada componente y el oscuro pisándolo con `!important`— y cada color nuevo quedaba
ilegible hasta que alguien se acordaba de remaparlo.

## Impresión

Ticket, pre cuenta y comanda se componen como texto de ancho fijo: **32 caracteres a
58 mm, 48 a 80 mm** (`ancho` en `ajustes`). `ticketVenta` / `preCuenta` /
`comandaCocina` / `comandaPicking` arman las líneas con `armarLineas`, y
`imprimirComandera` las imprime en un documento aparte dentro de un iframe invisible
con `@page { size: Nmm auto }`.

No imprimir la página con CSS: eso ya falló antes, salían dos hojas en A4.

## Integraciones

### Anthropic

El front nunca tiene la API key. Llama a `${API_BASE}/v1/messages`, donde `API_BASE`
sale de `window.__API_BASE__` (definido en `index.html`, valor `/api/anthropic`) y el
modelo de `window.__API_MODELO__`. Dos entornos, mismo path:

- dev: el proxy de `vite.config.js` reescribe a `api.anthropic.com` y agrega
  `x-api-key` desde `ANTHROPIC_API_KEY` del `.env` local.
- prod: el rewrite de `vercel.json` lleva a `api/anthropic.js`, que valida el origen,
  limita `max_tokens` a 2000 y siempre habla con `/v1/messages` (no reenvía la ruta
  pedida, a propósito).

Dos lugares consumen el modelo: el chat de `Asistente` (le pasa un `snapshot` JSON de
los KPIs) y `CargarCompra`, en `Compras.jsx`, que manda la foto de un remito en
base64 y espera JSON estricto. Todo lo demás —incluidos los diagnósticos de "Lo que
tenés que saber"— se calcula en `src/utils/` (`calcular()` + `insights()`) y funciona
sin conexión.

Cualquier función nueva tiene que degradar así: sin API key, el camino a mano sigue
vivo.

### Mercado Pago

`api/mp/pagos.js` consulta `/v1/payments/search` con `MP_ACCESS_TOKEN`. No hay
webhooks ni tabla propia a propósito: el navegador sondea cada 6 s desde `Sistema`
pidiendo una **ventana fija de los últimos 5 minutos** (solapada, no incremental,
porque MP indexa con demora) y deduplica con el ref `vistos`. La primera vuelta se
marca como vista sin avisar. Un cobro entrante suena, se lee en voz alta y genera un
movimiento de caja. Sin token, Ajustes tiene un botón para simular un cobro.

## Convenciones

- Plata: enteros en pesos, formateada con `money()` / `nf` / `pct`. Los números en
  pantalla llevan la clase `f-m` (mono tabular); los títulos, `f-d`.
- La traducción entre los nombres de la base (`stock_min`, `costo_prev`, `activa`) y
  los de la aplicación (`stockMin`, `costoPrev`, `activo`) vive **solo** en
  `src/datos/`. Ningún módulo tiene que enterarse de cómo se llaman las columnas.
- El costo y el precio anterior (`costoPrev` / `precioPrev`) los mantiene un
  disparador de la base; el motor de diagnóstico compara contra eso para detectar
  subas y caída de margen.
- Los cambios sobre datos leídos con el modelo (foto de remito, planilla importada)
  nunca se aplican directo: van a una tabla de revisión y se confirman a mano.
- Antes de dar una pantalla por terminada, sacar una captura y compararla contra la
  maqueta. Está en `DISENO.md` y es lo que más se nota cuando se saltea.
