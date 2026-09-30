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

## Dos aplicaciones, un repositorio

El sistema de gestión —lo que usa el comercio— y la **app del cliente**, que es
lo que ve quien saca el turno. Dos entradas (`index.html` y `cliente.html`), dos
bundles, la misma base y los mismos colores.

Cuál se sirve lo decide el **host**, en `middleware.js`, que es lo único que corre
antes del sistema de archivos: `genez.com.ar` es la gestión y cualquier subdominio
que no esté reservado es la app de ese comercio. Un rewrite de `vercel.json` no
puede hacerlo —se evalúan después de los archivos y `/` ya encontró `index.html`—
y eso ya costó un rato: está explicado en `middleware.js` y en `ARQUITECTURA.md`.

```
http://localhost:5173/            el sistema de gestión
http://localhost:5173/cliente.html?c=almha   la app del cliente
https://almha.genez.com.ar/       la misma, en producción
```

En desarrollo no hay subdominio, así que el comercio se fuerza con `?c=`. La app
del cliente tiene su propia guía de diseño en `docs/modelo-identidad-del-cliente.md`
y su sección en `ARQUITECTURA.md`.

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

### La pantalla de pruebas

```bash
node node_modules/vite/bin/vite.js --mode pruebas --port 5191   # o "genez-pruebas" en .claude/launch.json
```

El sistema entero con una conexión a Supabase **de mentira** (`src/pruebas/`): entra
solo, con un comercio inventado, y nada de lo que se haga llega a la base ni a
`api/`. `?rubro=minimercado`, `gastronomia` o `servicios` elige el comercio. Los
menús y roles son los de producción (`src/pruebas/plataforma.json`, que regenera
`node scripts/armar-datos-de-prueba.mjs`); lo demás es inventado.

**Antes de publicar un cambio de pantalla**, abrirla y correr en la consola
`await window.__genezRecorrer()`: entra a cada sección del menú y devuelve los
errores y los avisos rojos de cada una. Así se habría visto la pantalla en negro del
29/09 (un `const` usado antes de declararse en `Sistema`), que se publicó porque nadie
pudo ver la pantalla montada. El build de producción no incluye nada de esto.

Para probar a mano contra la base hay que loguearse con un usuario real de Supabase Auth. Los
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

## Lo que queda del prototipo

Conviene saberlo antes de leer un módulo y sacar conclusiones, y **verificarlo en el
código antes de afirmarlo**: esta sección estuvo meses diciendo que los indicadores
salían de datos simulados cuando ya salían de la base.

Sale de la base todo lo que importa: catálogo, ventas, comandas, salón y reservas,
pedidos y canales, caja, clientes, proveedores, ajustes, la sesión, la serie diaria de
ventas (`ventas_diarias`, 0071) y lo que alimenta los indicadores (`items_vista`: stock,
velocidad, última venta, vencimiento; ver 0110). Todo pasa por `src/datos/`, que es el
único lugar que habla con Supabase. `diasHasta`/`diasDesde` ya cuentan contra la fecha
real.

Lo único que sigue en memoria y se pierde al refrescar son **los pedidos de picking**
(`pedidosCli`): un espacio de trabajo; la venta de cada uno se cobra y se guarda como
cualquier otra. Las órdenes de compra se guardan desde 0111.

**`HOY`** (`new Date(2026, 7, 9)`) ya no lo usa nadie fuera de `src/datos/generador.js`:
toda fecha nueva va con la real. El generador sigue dando `uid`, `fdate`/`fdatel` y el
PRNG del modo demo.

Stock: el conteo, "No reponer" y "Poner 30% menos" se guardan desde 0109; el stock que
nunca se cargó (`stock_cargado`, 0110) no entra en "Para reponer" ni en el valor del
inventario.

## GENEZ FOUNDER

El sistema interno de la empresa Genez (`src/founder/`, tablas `interno_*`, 0113 en
adelante), no un módulo de los comercios. **Su llave es `es_interno(área)`, nunca
`es_plataforma` ni `puede_ver`**: la plataforma ve todos los comercios, y un futuro
miembro del equipo no tiene que verlos. Toda tabla nueva de Founder: RLS por área, nada
para anon, revocar lo que Supabase da solo, y `probar-founder-seguridad.mjs` tiene que
pasar. Ver la sección en `ARQUITECTURA.md`.

Lo que ya costó y no se ve en el código:

- `interno_anotar` identifica la fila por `id`, `perfil_id` o `clave`: una tabla nueva
  sin ninguno de los tres rompe el historial.
- Una columna con un guion bajo seguido de un dígito (`vis_7d`) no pasa a camelCase en
  `src/datos/`: el campo no llega. Nombrarla sin dígito.
- Las fechas sin hora (`alta`, `limite`, `periodo`, `fin` de un plan) quedan como texto
  `AAAA-MM-DD`: como `Date` caen al día anterior en Buenos Aires.
- Lo que se escribe desde `src/datos/interno*` pasa por una lista de columnas por tabla
  (`conColumnas`): las vistas traen campos que en otras tablas son columnas de verdad.
- `Boton` no tiene `type`: adentro de un `<form>`, "Cancelar" también lo manda.
- Las pruebas `probar-founder-*` ponen `idle_in_transaction_session_timeout`: una prueba
  cortada dejó una sesión abierta en producción, con bloqueos. Correrlas de a una.

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
`cambiarPrecios`, `ajustes`, `verBitacora`, `configurar`, `darAccesos`) viajan
como `permisos` hasta los componentes.

Dos reglas de la base que no se pueden romper al tocar permisos: **nadie se
cambia sus propios permisos** y **nadie otorga una bandera que no tiene**. La
segunda es de 0049 y es la que hace que apagarle algo a un rol signifique
algo: sin ella, cualquiera con `configurar` se lo volvía a prender editando su
propio rol.

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
`comandaCocina` / `comandaPicking` arman las líneas con `armarLineas`, e
`imprimirComandera` las imprime.

De fábrica las imprime como página: un documento aparte en un iframe con `@page`
medido, que le dice a Chrome el tamaño exacto del papel. Los comentarios de
`imprimirComandera` cuentan todo lo que costó que saliera bien; no simplificarla sin
leerlos. Chrome le agrega la fecha, el título y la dirección, y eso solo se saca en
cada computadora (`docs/impresion/`).

Hay una segunda forma, **como PDF** (`src/ui/ticketPdf.js`, armado a mano con
Courier), que se prende en Ajustes: a un PDF Chrome no le agrega nada. Está apagada
de fábrica porque con un PDF Chrome no toma el papel de la página sino el del driver,
y centra el ticket ahí: en Super 25 el papel del driver era más ancho que el rollo y
el ticket salió corrido a la derecha, con un dígito de cada importe.

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
base64 y espera JSON estricto. Un tercero no pasa por el proxy: el asistente de WhatsApp de
Founder (`api/_bot.js`, 0121) llama desde el servidor con el SDK oficial y deja
borradores; ver su sección en `ARQUITECTURA.md`. Todo lo demás —incluidos los diagnósticos de "Lo que
tenés que saber"— se calcula en `src/utils/` (`calcular()` + `insights()`) y funciona
sin conexión.

Cualquier función nueva tiene que degradar así: sin API key, el camino a mano sigue
vivo.

### Mercado Pago

**Cada comercio conecta su propia cuenta** (0091): pega su Access Token en
Ajustes → Mercado Pago, `api/mp/conexion.js` le pregunta a MP de quién es y lo
guarda cifrado en `mp_credenciales` (la misma llave que ARCA; la tabla no tiene
políticas para el navegador). `api/mp/pagos.js` consulta `/v1/payments/search` con
el token **del comercio de quien llama**. Ya no hay un `MP_ACCESS_TOKEN` global: con
uno solo, cualquier usuario de cualquier comercio veía los cobros de esa cuenta.

No hay webhooks a propósito: el navegador sondea cada 6 s desde `Sistema` pidiendo
una **ventana fija de los últimos 5 minutos** (solapada, no incremental, porque MP
indexa con demora) y deduplica con el ref `vistos`. La primera vuelta se marca como
vista sin avisar. Un cobro entrante suena y se lee en voz alta, y **no carga plata
en la caja**: la plata entra con la venta cobrada con "Mercado Pago". Antes el aviso
también la cargaba y cada venta por QR entraba dos veces. Sin cuenta conectada,
Ajustes tiene un botón para simular el aviso.

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
