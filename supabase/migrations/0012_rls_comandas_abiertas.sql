/* ============================================================
   0012 · LAS COMANDAS ABIERTAS TAMBIÉN SE EDITAN
   ============================================================

   Las políticas de la migración 0002 listaban los estados que admiten
   cambios: borrador, pendiente y preparando. Después, en la 0009, las
   comandas trajeron un estado nuevo —'abierta'— y nadie volvió a mirar
   estas políticas.

   El resultado no fue un error sino algo peor: Postgres no rechaza un
   UPDATE que la política excluye, simplemente no encuentra filas y
   devuelve éxito habiendo hecho nada. La pantalla anulaba una línea y
   volvía igual; la cocina cambiaba un estado y rebotaba. Todo "sin
   errores".

   Que esto llegara hasta acá es culpa del método de prueba: las pruebas
   corren con el usuario administrador de Postgres, que saltea RLS por
   completo. Probaban la lógica y no las reglas.
   ============================================================ */

drop policy operaciones_editar_abiertas on operaciones;

/* Solo lo que todavía no se cerró admite cambios: un presupuesto se
   edita, una mesa suma consumos, una venta confirmada no. */
create policy operaciones_editar_abiertas on operaciones
  for update
  using (public.puede_ver(empresa_id) and estado in ('borrador', 'pendiente', 'preparando', 'abierta'))
  with check (public.puede_ver(empresa_id));

drop policy operacion_lineas_editar_abiertas on operacion_lineas;

create policy operacion_lineas_editar_abiertas on operacion_lineas
  for update using (
    public.puede_ver(empresa_id)
    and exists (
      select 1 from operaciones o
      where o.id = operacion_id and o.estado in ('borrador', 'pendiente', 'preparando', 'abierta')
    )
  ) with check (public.puede_ver(empresa_id));

drop policy operacion_lineas_borrar_abiertas on operacion_lineas;

create policy operacion_lineas_borrar_abiertas on operacion_lineas
  for delete using (
    public.puede_ver(empresa_id)
    and exists (
      select 1 from operaciones o
      where o.id = operacion_id and o.estado in ('borrador', 'pendiente', 'preparando', 'abierta')
    )
  );

/* Cerrar la mesa cambia el estado de 'abierta' a 'confirmada'. Con la
   política vieja ese UPDATE tampoco encontraba filas, y cerrar_comanda
   terminaba avisando "esa comanda no está abierta" sobre una mesa que sí
   lo estaba. */
