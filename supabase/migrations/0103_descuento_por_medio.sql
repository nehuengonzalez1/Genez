/* ============================================================
   0103 · DESCUENTO POR MEDIO DE PAGO
   ============================================================

   "10% pagando con débito los miércoles", "5% en efectivo". Es una clase
   más de promoción (0102): `tipo = 'medio'`, con el medio y el
   porcentaje en `parametros` ({ "medio": "debito", "pct": 10 }), y los
   mismos días y fechas que las demás. No abarca productos: va sobre el
   total de la venta.

   La cuenta la hace el mostrador (descuentoPorMedio, en
   src/utils/promociones.js): se descuenta del total al cobrar con ese
   medio, y el recargo del medio, si tiene, se calcula después. Queda en
   el descuento de la venta (operaciones.descuento), que ya lee el IVA de
   la factura repartido entre alícuotas, y con el tope de 0088.
   ============================================================ */

alter table promociones drop constraint promociones_tipo_check;
alter table promociones add constraint promociones_tipo_check
  check (tipo in ('nxm', 'segunda', 'porcentaje', 'pack', 'medio'));

alter table promociones drop constraint promociones_parametros;
alter table promociones add constraint promociones_parametros check (
  case tipo
    when 'nxm' then (parametros->>'lleva')::int >= 2 and (parametros->>'paga')::int >= 1
                    and (parametros->>'paga')::int < (parametros->>'lleva')::int
    when 'segunda' then (parametros->>'pct')::numeric > 0 and (parametros->>'pct')::numeric <= 100
    when 'porcentaje' then (parametros->>'pct')::numeric > 0 and (parametros->>'pct')::numeric < 100
    when 'pack' then (parametros->>'cantidad')::int >= 2 and (parametros->>'precio')::numeric > 0
    when 'medio' then coalesce(btrim(parametros->>'medio'), '') <> ''
                      and (parametros->>'pct')::numeric > 0 and (parametros->>'pct')::numeric < 100
  end
);
