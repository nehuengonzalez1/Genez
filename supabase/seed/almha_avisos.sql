/* ============================================================
   SEMILLA · unos avisos ya mandados, para ver la campana
   ============================================================

   `contactos` tiene una sola fila en toda la base: Comunicaciones y CRM
   existen desde 0043 y 0044 y casi no se usaron. Con eso, la pantalla de
   avisos de la app queda vacía y no se puede mirar si está bien hecha.

   Esto no inventa un canal ni una tabla: escribe en `contactos` lo mismo
   que escribiría el comercio al mandar esos mensajes desde Comunicaciones
   y desde CRM, con los textos de fábrica de esos módulos.

   ATADOS A TURNOS DE VERDAD
   -------------------------
   El recordatorio apunta con `reserva_id` a un turno real de Victoria y
   dice el servicio y la hora que ese turno tiene. Un texto inventado que
   no coincida con la agenda es peor que ninguno: al mirarlo parece un
   error del sistema.

   Se niega a correr si Almha no está marcada como demo, que es la misma
   regla que `almha_historia.sql`.

   Se puede correr más de una vez: borra los suyos antes de escribir.

     node scripts/aplicar-sql.mjs supabase/seed/almha_avisos.sql
   ============================================================ */

do $$
declare
  v_empresa uuid;
  v_cliente uuid;
  v_quien   uuid;
  v_turno   record;
begin
  select id into v_empresa
    from empresas
   where nombre = 'Almha'
     and (config -> 'demo')::boolean is true;

  if v_empresa is null then
    raise exception 'Almha no está marcada como demo. Esto solo se siembra en datos de prueba.';
  end if;

  select id into v_cliente
    from clientes
   where empresa_id = v_empresa and razon_social = 'Victoria Peralta';

  if v_cliente is null then
    raise exception 'No está Victoria Peralta cargada.';
  end if;

  /* Quien los mandó: alguien del comercio. `contactos.usuario_id` apunta
     a `perfiles`, así que no sirve cualquiera. */
  select id into v_quien from perfiles where empresa_id = v_empresa limit 1;

  delete from contactos
   where cliente_id = v_cliente
     and texto like '%[demo]%';

  /* 1 · El recordatorio del próximo turno, con los datos de ese turno. */
  select r.id, r.desde, coalesce(i.nombre, ic.nombre) as servicio
    into v_turno
    from reservas r
    left join items i on i.id = r.item_id
    left join reservas cl on cl.id = r.clase_id
    left join items ic on ic.id = cl.item_id
   where r.cliente_id = v_cliente
     and r.desde > now()
     and r.estado <> 'cancelada'
   order by r.desde
   limit 1;

  if v_turno.id is not null then
    insert into contactos (empresa_id, cliente_id, motivo, canal, texto, resultado, usuario_id, fecha, reserva_id)
    values (
      v_empresa, v_cliente, 'recordatorio', 'whatsapp',
      /* La hora en la zona del comercio y no en UTC. Sin el `at time
         zone`, `to_char` rinde en la del servidor y el recordatorio decia
         18:00 de un turno de las 15:00: tres horas de diferencia, que es
         exactamente el error contra el que este archivo advierte cuatro
         parrafos mas arriba. Lo escribi y lo cometi en la misma sesion. */
      'Hola Victoria! Te recuerdo tu turno de ' || v_turno.servicio || ' el ' ||
        to_char(v_turno.desde at time zone 'America/Argentina/Buenos_Aires', 'DD/MM') ||
        ' a las ' ||
        to_char(v_turno.desde at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI') ||
        '. Si no vas a poder venir avisame así libero el lugar. ¡Nos vemos! [demo]',
      'enviado', v_quien, now() - interval '20 hours', v_turno.id
    );
  end if;

  /* 2 · Uno del CRM: el abono que se termina. Sin `reserva_id`, porque no
     es de un turno: es del vínculo. */
  insert into contactos (empresa_id, cliente_id, motivo, canal, texto, resultado, usuario_id, fecha)
  values (
    v_empresa, v_cliente, 'se_queda_sin', 'whatsapp',
    'Hola Victoria! Te queda poco del plan y no quiero que te quedes sin lugar. ' ||
      '¿Querés que te renueve para el mes que viene? [demo]',
    'enviado', v_quien, now() - interval '6 days'
  );

  /* 3 · Uno más viejo, para que la lista tenga profundidad y se note la
     diferencia entre lo nuevo y lo que ya vio. */
  insert into contactos (empresa_id, cliente_id, motivo, canal, texto, resultado, usuario_id, fecha)
  values (
    v_empresa, v_cliente, 'aviso', 'whatsapp',
    'Hola Victoria! Te cuento que a partir de septiembre sumamos un turno ' ||
      'de reformer los sábados a las 10. Si te sirve, avisame y te lo guardo. [demo]',
    'enviado', v_quien, now() - interval '18 days'
  );
end $$;

select k.fecha::date, k.motivo, k.reserva_id is not null as de_un_turno, left(k.texto, 50) as texto
  from contactos k
  join clientes c on c.id = k.cliente_id
 where c.razon_social = 'Victoria Peralta'
 order by k.fecha desc;
