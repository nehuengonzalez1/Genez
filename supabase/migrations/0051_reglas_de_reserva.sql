/* ============================================================
   0051 · LAS REGLAS DE RESERVA
   ============================================================

   Con cuánta anticipación se puede sacar un turno, hasta cuándo se puede
   cancelar sin costo, y si alguien que nunca vino puede reservar. Son las
   reglas que va a aplicar la app del cliente cuando reserve.

   Acá no reserva nadie todavía: esto es dónde viven los números y quién
   los puede cambiar.

   FÁBRICA EN EL RUBRO, CAMBIOS EN EL COMERCIO
   -------------------------------------------
   Es el mismo criterio de `roles_base` → `roles` y de las plantillas de
   Comunicaciones, y por las mismas dos razones: un comercio nuevo
   funciona sin que nadie le siembre nada, y el día que se corrija un
   valor de fábrica, el que nunca lo tocó se lleva la corrección.

   Los valores de fábrica del rubro `servicios` salieron de cómo trabaja
   una estética con pilates, que es el primer caso. **Son del rubro, no de
   Almha.** Si Almha mañana quiere cancelación hasta 6 horas antes, eso va
   en su `config` y no acá; y si resulta que 3 horas era una mala idea
   para todo el rubro, se corrige acá y le llega a todos los que no lo
   tocaron.

   No hay una tabla nueva. `empresas.config` ya es donde vive lo que cada
   comercio configura —`cobertura`, `recordatorioHoras`, los medios de
   pago— y estas reglas son eso mismo.

   SE GUARDA LA DIFERENCIA, NO LA FOTO
   -----------------------------------
   `config -> 'reserva'` tiene solo las claves que el comercio cambió. Con
   la foto entera, el día que se corrija un valor de fábrica el comercio
   que nunca lo tocó se quedaría con el viejo para siempre y sin que nadie
   lo note. Es la decisión de 0045 una vez más.

   POR QUÉ LA CAPACIDAD NO ESTÁ ACÁ
   --------------------------------
   Porque ya está resuelta y no es una regla: es un dato de cada horario.
   Una clase tiene `cupo` desde 0034 e `inscribir()` la bloquea, cuenta y
   rechaza cuando está completa. Un comercio con siete camas publica sus
   clases con `cupo = 7`; otro con veinte bicicletas publica veinte. No
   hay número que configurar.
   ============================================================ */


/* ------------------------------------------------------------
   1 · Los valores de fábrica, por rubro
   ------------------------------------------------------------ */

alter table rubros
  add column if not exists reglas jsonb not null default '{}'::jsonb;

comment on column rubros.reglas is
  'Reglas de reserva de fábrica del rubro. Cada comercio pisa lo que quiera en empresas.config->reserva.';


/* Solo el rubro de servicios por ahora: es el único donde el cliente
   reserva. Gastronomía va a necesitar las suyas el día que se reserve
   una mesa desde la app, y minimercado probablemente nunca. Un rubro sin
   reglas devuelve las de abajo, que son las más conservadoras. */
update rubros
   set reglas = jsonb_build_object(
     /* Hasta cuántos minutos antes del turno se puede reservar. Más
        bajo, más cómodo para quien busca lugar a último momento; más
        alto, más previsible para quien atiende. */
     'anticipacionMin',    60,

     /* Con cuánta anticipación se puede reservar como máximo, en días.
        Null es sin límite. Un gimnasio que abre la agenda semana a
        semana pone 7; una estética que toma turnos con meses lo deja
        en null. */
     'anticipacionMaxDias', null,

     /* Horas antes del turno hasta las que se puede cancelar sin costo. */
     'cancelacionHoras',   3,

     /* Qué pasa si cancela después de esa hora. Con `true`, la clase se
        descuenta igual del abono: el lugar se reservó y no se pudo dar
        a nadie más. */
     'tardeConsume',       true,

     /* Si la persona puede cancelar sola desde la app. Con `false`, el
        turno se cancela solo desde el mostrador. */
     'permiteCancelar',    true,

     /* Si hace falta haber pasado antes por el local para reservar sin
        abono. Con `true`, alguien que nunca vino no puede tomar un lugar
        sin pagar: es la regla contra el turno fantasma. */
     'requiereHistorial',  true,

     /* Si se avisa cuando ya tiene otro turno el mismo día. No lo
        impide: lo dice. Dos turnos en un día es raro y a veces es un
        error de dedo, pero también es alguien que quiere doble clase. */
     'avisarMismoDia',     true
   )
 where clave = 'servicios'
   and not (reglas ? 'anticipacionMin');


/* ------------------------------------------------------------
   2 · Las reglas que le tocan a un comercio

   Fábrica del rubro, con lo que el comercio haya cambiado encima, y un
   piso conservador debajo de todo por si el rubro no dijo nada.

   El piso importa: esta función la va a llamar la que reserva, y una
   regla que vuelve null se lee como "sin restricción", que es lo peor
   que puede pasar cuando lo que falta es el límite.
   ------------------------------------------------------------ */

create or replace function public.reglas_de(p_empresa uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select
      jsonb_build_object(
        'anticipacionMin',     60,
        'anticipacionMaxDias', null,
        'cancelacionHoras',    24,
        'tardeConsume',        true,
        'permiteCancelar',     false,
        'requiereHistorial',   true,
        'avisarMismoDia',      true
      )
   || coalesce(r.reglas, '{}'::jsonb)
   || coalesce(e.config -> 'reserva', '{}'::jsonb)
  from empresas e
  left join rubros r on r.clave = e.rubro
 where e.id = p_empresa
$$;

comment on function public.reglas_de is
  'Las reglas de reserva de un comercio: el piso, lo de fábrica de su rubro, y lo que el comercio cambió.';

grant execute on function public.reglas_de(uuid) to authenticated;


/* ------------------------------------------------------------
   3 · Quién las puede cambiar

   Nadie nuevo: `config` vive en `empresas`, y esa fila ya la protege
   `empresas_configurar`, que desde 0045 pide `permiso('configurar')`.
   Se deja dicho para que nadie busque una política que no existe.

   La pantalla para editarlas va en Ajustes, con el resto de la
   configuración del comercio.
   ------------------------------------------------------------ */
