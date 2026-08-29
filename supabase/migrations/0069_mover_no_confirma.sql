/* ============================================================
   0069 · MOVER UN TURNO NO LO CONFIRMA
   ============================================================

   Tercer defecto de 0067, y el único que se ve sin mirar la base: en la
   pantalla, el turno de la clienta de prueba decía PENDIENTE antes de
   moverlo y CONFIRMADA después.

   El brazo de las clases no mueve una fila: cancela una inscripción y
   crea otra. Y al crearla le pasaba `'estado', 'confirmada'` escrito a
   mano, copiado de `reservar_como_cliente` —donde está bien, porque ahí
   la inscripción nace—. Acá no nace: se está moviendo una que ya existía
   y que ya tenía su estado.

   POR QUÉ IMPORTA AUNQUE UNA CLASE CASI SIEMPRE ESTÉ CONFIRMADA
   ------------------------------------------------------------
   Porque `pendiente` es del comercio, no de la app. Un local que trabaja
   con turnos a confirmar —los toma y después llama— usa ese estado para
   saber a quién le falta llamar. Con esto, la clienta se lo confirmaba
   sola moviendo el horario, y el turno desaparecía de la lista de los que
   había que revisar.

   Es la misma regla que sostiene todo 0067 y por eso el defecto duele:
   mover cambia la hora **y nada más**. El abono no se cambia por otro, la
   clase no se gasta dos veces, el asiento dice de dónde venía. El estado
   es una cosa más de esa lista y se me pasó.

   El brazo individual no lo tenía: `mover_turno` hace `update reservas set
   desde` y no toca `estado`. Otra vez los dos brazos diciendo cosas
   distintas, que es el patrón de 0068.
   ============================================================ */

create or replace function public.reprogramar_como_cliente(p_reserva uuid, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_r      reservas%rowtype;
  v_reglas jsonb;
  v_clase  uuid := nullif(p ->> 'clase_id', '')::uuid;
  v_desde  timestamptz := nullif(p ->> 'desde', '')::timestamptz;
  v_dur    integer;
  v_antes  timestamptz;
  v_aviso  text;
  v_nueva  uuid;
begin
  select * into v_r from reservas where id = p_reserva for update;

  /* El `is null` de `cliente_id` no sobra: sin él, un turno que el
     mostrador tomó sin cargar la ficha se podía mover desde cualquier
     cuenta. `NULL not in (...)` no da falso, da NULL, y un `if NULL` no
     entra. Es el mismo agujero que encontró la prueba de 0055, escrito
     acá antes de que lo encuentre de nuevo. */
  if v_r.id is null
     or v_r.cliente_id is null
     or v_r.cliente_id not in (select public.mis_fichas()) then
    raise exception 'Ese turno no es tuyo.' using errcode = 'P0095';
  end if;

  v_reglas := public.reglas_de(v_r.empresa_id);

  if not (v_reglas ->> 'permiteReprogramar')::boolean then
    raise exception 'Este comercio pide que los cambios de horario se arreglen por el local.'
      using errcode = 'P00D0';
  end if;

  if v_r.estado in ('cancelada', 'ausente') then
    raise exception 'Ese turno está cancelado.' using errcode = 'P00D1';
  end if;

  /* La misma ventana que para cancelar sin costo, y con eso queda dicho
     que el turno pasó a ser del comercio. Cubre también el turno que ya
     pasó: con `cancelacionHoras` en cero, `desde <= now()`. */
  if v_r.desde <= now() + ((v_reglas ->> 'cancelacionHoras')::integer || ' hours')::interval then
    raise exception 'Ya es tarde para cambiar este turno de horario.'
      using errcode = 'P00D2';
  end if;

  /* ---- A dónde va ---- */

  if v_clase is not null then
    /* La hora sale de la clase, igual que al reservar: mandarla por
       parámetro deja entrar a una clase "a otra hora". */
    select r.desde, r.duracion_min into v_desde, v_dur
      from reservas r
     where r.id = v_clase and r.empresa_id = v_r.empresa_id and r.cupo is not null;
    if v_desde is null then
      raise exception 'No existe esa clase.' using errcode = 'P0042';
    end if;
  else
    if v_desde is null then
      raise exception 'Falta el horario nuevo.' using errcode = 'P00D3';
    end if;
    /* La duración es la del turno: mover no es cambiar de servicio. */
    v_dur := v_r.duracion_min;
  end if;

  /* Las cuatro combinaciones son en realidad dos. Cruzarlas —salir de una
     clase hacia un hueco individual, o al revés— no es mover un turno:
     es cancelar uno y sacar otro, con otro precio y otra disponibilidad.
     No puede llegar desde la app, porque `horarios_libres` ofrece clases
     o huecos según el servicio y nunca los dos, así que acá se rechaza y
     no se resuelve. */
  if (v_r.clase_id is not null) <> (v_clase is not null) then
    raise exception 'Ese cambio no es mover el turno: cancelalo y sacá el nuevo.'
      using errcode = 'P00D4';
  end if;

  /* Mover al mismo lugar no es mover. Se corta acá y no más adelante
     porque en el brazo de las clases sí tendría efecto: cancelaría la
     inscripción y crearía otra idéntica, dejando en el historial del
     comercio un cambio que nadie hizo. */
  if coalesce(v_clase = v_r.clase_id, v_desde = v_r.desde) then
    raise exception 'Ese es el horario que ya tenías.' using errcode = 'P00D5';
  end if;

  /* ---- Las reglas del horario nuevo ---- */

  v_aviso := public.revisar_reglas_del_cliente(
    v_r.empresa_id, v_r.cliente_id, v_desde, v_dur, v_r.id);

  /* El plan tiene que seguir cubriendo el turno en su fecha nueva:
     vigencia, saldo y tope semanal. Los tres los mira `revisar_abono`, y
     con `p_id` se ignora a sí misma —que es lo que 0067 vino a arreglar,
     ver el encabezado—.

     No se busca otro plan si este ya no sirve. Cambiar de pack en
     silencio es mover plata de un lado al otro: quien compró dos eligió
     con cuál venía. Lo que corresponde es el mensaje que `revisar_abono`
     ya escribe —"Ese abono vence el 12/09"— y que decida ella. */
  if v_r.abono_id is not null then
    perform public.revisar_abono(v_r.abono_id, v_r.cliente_id, v_desde, v_r.id);
  end if;

  v_antes := v_r.desde;

  /* ---- Y se mueve ---- */

  if v_clase is null then
    /* `mover_turno` ya valida lo del comercio —choque de sala, de
       persona, horario de trabajo, bloqueos y feriados— e ignora al
       propio turno. Es la misma que usa el mostrador. */
    perform public.mover_turno(p_reserva, v_desde, v_dur);

    update reservas
       set campos_extra = campos_extra || jsonb_build_object(
             'movidaPor', 'cliente',
             'movidaEn',  now(),
             'movidaDe',  v_antes)
     where id = p_reserva;

    v_nueva := p_reserva;
  else
    /* Se sale de una clase y se entra en la otra, en la misma
       transacción. El orden importa: cancelando primero, el lugar y la
       clase del abono quedan libres antes de que `inscribir` los pida, y
       si la clase nueva se llenó recién, `inscribir` levanta y se
       deshace todo —la vieja no se pierde—.

       Sin `cancelacionTarde`, que es lo que hace que `clases_usadas` no
       la cuente: mover dentro de la ventana no gasta nada. */
    update reservas
       set estado = 'cancelada',
           campos_extra = campos_extra || jsonb_build_object(
             'canceladaPor', 'cliente',
             'canceladaEn',  now(),
             'reprogramada', true)
     where id = p_reserva;

    v_nueva := public.inscribir(jsonb_build_object(
      'clase_id',   v_clase,
      'cliente_id', v_r.cliente_id,
      'nombre',     v_r.nombre,
      'telefono',   v_r.telefono,
      'abono_id',   v_r.abono_id,
      /* El que tenía, y no 'confirmada'. Estaba escrito a mano, copiado
         de `reservar_como_cliente`, donde está bien porque ahí la
         inscripción nace. Acá ya existía: mover un turno pendiente lo
         confirmaba solo, y en un local que llama para confirmar eso lo
         sacaba de la lista de los que faltaba llamar. Ver 0069. */
      'estado',     v_r.estado
    ));

    /* Las dos puntas del cambio quedan escritas, para que el mostrador
       pueda leer la historia sin adivinarla por las horas. */
    update reservas
       set campos_extra = campos_extra || jsonb_build_object(
             'movidaPor', 'cliente',
             'movidaEn',  now(),
             'movidaDe',  v_antes,
             'vieneDe',   p_reserva)
     where id = v_nueva;

    update reservas
       set campos_extra = campos_extra || jsonb_build_object('reprogramadaA', v_nueva)
     where id = p_reserva;
  end if;

  return jsonb_build_object('id', v_nueva, 'antes', v_antes, 'aviso', v_aviso);
end;
$$;

comment on function public.reprogramar_como_cliente is
  'Mueve un turno propio a otro horario aplicando las reglas del comercio. Un turno individual cambia de hora; una inscripción se cambia por otra clase, conservando su estado.';
