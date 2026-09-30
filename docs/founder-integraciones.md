# GENEZ FOUNDER · integraciones futuras y crecimiento

Qué está preparado y qué no, para conectar servicios de afuera o sumar gente a
Founder. **Ninguna de estas integraciones está conectada**: no hay credenciales ni
endpoints de terceros en Founder, y ninguna pantalla dice lo contrario. Todo lo
que figura acá como "punto de entrada" es una tabla o una columna que ya existe y
se llena a mano.

Antes de conectar cualquiera: credenciales propias de Genez (no las de un
comercio), guardadas del lado del servidor como las de ARCA y Mercado Pago de los
comercios (cifradas, sin políticas para el navegador), y una función de Vercel.
**Vercel Hobby permite 12 funciones y hay 11 en uso**: la próxima integración
probablemente obligue a juntar funciones o a pasar de plan.

## Integraciones

| Integración | Dónde entra | Qué hace falta | Hoy |
|---|---|---|---|
| **WhatsApp Business** | `interno_actividades` (tipo `whatsapp`), `interno_ticket_mensajes` (tipo `del_cliente` / `al_cliente`) | Cuenta de WhatsApp Business API (Meta), número verificado, webhook para mensajes entrantes | Links `wa.me` desde la ficha; lo que se habla se registra a mano |
| **Email** | `interno_actividades` (tipo `email`), `interno_ticket_mensajes` | Un proveedor de envío (y de recepción, para tickets por mail) con dominio verificado | Link `mailto:`; se registra a mano |
| **Google Calendar** | `interno_eventos` (tiene `zona_horaria`, `inicio`, `fin`, `link`) | OAuth de Google por usuario, y decidir quién manda si el mismo evento cambia en los dos lados | Agenda propia |
| **Google Drive / almacenamiento** | `interno_adjuntos` (ruta, tipo, tamaño) | OAuth y decidir si Drive reemplaza al bucket o se suma | Bucket privado `interno` de Supabase, por área |
| **Facturación electrónica de Genez** | `interno_movimientos.facturado` y `comprobante`; `interno_ajustes.empresa` (razón social, CUIT, condición de IVA) | Certificado de ARCA a nombre de Genez y un punto de venta propio. El código de ARCA de los comercios (`api/arca`) se puede reutilizar, pero con otra identidad fiscal | Se marca "facturado" y se escribe el número a mano |
| **Pasarelas de pago** | `interno_movimientos.fecha_pago`, `medio_pago`, `referencia`; `interno_suscripciones` | Cuenta de Mercado Pago (u otra) de Genez; suscripciones con débito y un webhook para marcar cobrado | Se marca "cobrado" a mano; los cobros del mes se generan con un botón que no duplica |
| **Automatizaciones de seguimiento** | `interno_tareas` (con repetición), `interno_prospectos.proximo_contacto` | Un proceso programado del lado del servidor (Vercel Cron o una función de Postgres con `pg_cron`) | La base ya hace sola lo que no necesita reloj: próxima tarea de una serie, seguimiento después de un contacto, recordatorios al pasar a cliente |
| **Formularios de captura** | `solicitudes` (el formulario de la web, que ya existe) → `interno_prospectos` (`solicitud_id`, `fuente`) | Pasar cada solicitud a prospecto, a mano o con un disparador | Inicio muestra cuántos pedidos hay; se cargan a mano |
| **Redes sociales** | `interno_contenido_metricas` (7 y 30 días), `interno_contenidos.url` | APIs de cada red (Meta, TikTok, YouTube, LinkedIn), con OAuth y permisos de lectura de métricas | Métricas cargadas a mano; la pantalla lo dice |
| **Analítica** | `interno_prospectos.contenido_id`, `fuente`, `campania` | Etiquetas UTM en los links y una herramienta que las lea | Lo originado por cada contenido sale de los prospectos atados |

## Avisos

Hoy los avisos son **dentro de Founder**: Mi día (vencidos, agenda de hoy,
seguimientos atrasados), clientes que requieren atención, objetivos que vencen y
los tickets abiertos. No hay timers del navegador que hagan de recordatorio: si
Founder no está abierto, no avisa.

Un aviso por mail o al teléfono necesita dos cosas que no existen: un proceso
programado del lado del servidor (ver Automatizaciones) y un canal (mail, push o
WhatsApp). Los datos para decidir qué avisar ya están en la base.

## Sumar gente

Lo que ya funciona:

- **Áreas por persona** (`interno_miembros`, `es_interno(área)`): cada miembro ve
  solo sus áreas; nadie se cambia a sí mismo; solo el fundador o un administrador
  suman y editan (Configuración → Equipo).
- **Responsable, creado por y actualizado por** en todas las tablas `interno_*`,
  y el **historial** de cada cambio (`interno_historial`).
- Roles guardados: fundador, administrador, comercial, marketing, desarrollo,
  soporte, administración. Hoy el rol es informativo: lo que habilita son las
  áreas.

Lo que falta, y cuándo conviene hacerlo:

- **Crear la cuenta desde Founder.** Hoy la cuenta se crea en Supabase
  (Authentication) y después se suma por mail. Hacerlo desde la pantalla necesita
  una función de servidor con la `service_role`, como `api/usuarios.js` hace para
  los comercios.
- **Ver solo lo propio.** Las políticas dan el área entera: un comercial ve todos
  los prospectos, no solo los suyos. Para "cada vendedor su cartera" hay que sumar
  `responsable_id = auth.uid()` a las políticas de las tablas que correspondan.
- **Comisiones, objetivos por vendedor y pipeline por zona.** Los datos ya están
  (`responsable_id` en oportunidades y objetivos, `zona` en prospectos); faltan
  las pantallas y, para comisiones, una regla de cálculo acordada.
- **Aprobaciones.** Ninguna acción las necesita todavía. Si hacen falta (por
  ejemplo, un descuento sobre el precio de lista), van como un estado más en la
  tabla que corresponda, no como un sistema aparte.
