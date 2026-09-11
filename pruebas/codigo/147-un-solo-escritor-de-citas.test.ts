// `negocio.citas` tiene UN escritor, y la tentación de un segundo acaba de crecer. Tipo: Código.
//
// ══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTO SE ESCRIBE AHORA Y NO ANTES
//
// La tabla siempre tuvo un solo escritor —`lib/negocio/citas.ts`, el barrido del calendario— y
// nadie lo había afirmado porque nadie había estado cerca de romperlo. `lib/negocio/avisoDelCrm.ts`
// sí lo argumenta, y su comentario es la mitad del motivo de este archivo:
//
//   «De las citas solo refresca las etiquetas, no la hora. […] Traer la cita desde el cuerpo del
//    webhook sería un segundo escritor de `negocio.citas` con su propio criterio de cancelación, y
//    ese criterio ya existe en un solo lugar.»
//
// La migración `042` le agregó a la tabla tres columnas —`reagendada_el`, `crm_asignado_a` y
// `inicio_anterior_el`— y con ellas el segundo escritor pasó de tentador a peligroso:
//
//   · `inicio_anterior_el` **sólo es correcta si la escribe el `do update`**, que lee la fila vieja
//     en la misma sentencia que la pisa. Un escritor que la ponga a mano tiene que hacer un `select`
//     antes, y entre el `select` y el `update` la fila puede haberse movido: guardaría una hora que
//     nunca fue la anterior;
//   · la guarda `is distinct from` vive en ese `do update`. Un segundo escritor sin ella marca como
//     movida una cita que no se movió, y «cuántas se reagendaron» empieza a contar el barrido en
//     vez del negocio;
//   · y la que viene después, cuando se mida: un escritor del webhook pondría como fecha de reserva
//     **la hora en que llegó el aviso**, que se parece tanto a la buena que nadie lo notaría.
//
// ── SE LEE SIN COMENTARIOS, Y ESO NO ES UN DETALLE ──────────────────────────
//
// `lib/negocio/avisoDelCrm.ts` habla del tema entero en un comentario, y varias pruebas nombran
// `barrerCitas` en prosa. Una prueba que leyera el texto crudo contaría explicaciones y se pondría
// roja por documentar bien. Van trece veces en este repositorio.
// ══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { archivosFuente } from '../apoyo/fuente.ts';

/** Dónde vive el único escritor legítimo. */
const EL_ESCRITOR = 'lib/negocio/citas.ts';

test('`negocio.citas` se escribe desde UN solo archivo', () => {
  /* Se cuentan las tres formas de escribir, no sólo el `insert`: un `update` suelto sobre `citas`
     es peor que un `insert` duplicado, porque pisa sin pasar por el `do update` donde viven las
     tres reglas. */
  const escriben: string[] = [];
  for (const a of archivosFuente(['lib', 'app'])) {
    if (/insertInto\('citas'\)|updateTable\('citas'\)|deleteFrom\('citas'\)/.test(a.limpio)) {
      escriben.push(a.ruta);
    }
  }

  assert.deepEqual(
    escriben,
    [EL_ESCRITOR],
    'apareció un segundo escritor de `negocio.citas`. Las tres columnas de la `042` sólo son ' +
      'correctas si las escribe el `do update` de `guardar()`, que lee la fila vieja en la misma ' +
      'sentencia que la pisa — ver el encabezado de este archivo',
  );
});

test('las tres reglas del `do update` siguen siendo tres reglas distintas', () => {
  /* No alcanza con que las columnas se escriban: cada una tiene una regla DISTINTA y la asimetría
     es el punto. Esta prueba existe porque «uniformar» las tres es el cambio que alguien haría por
     prolijidad, y cada uniformación rompe algo:

       · con `coalesce` en `crm_asignado_a`, desasignar una cita en el CRM deja de verse;
       · sin `coalesce` en `reagendada_el`, un barrido sin el campo borra la marca de todas;
       · sin el `case` en `inicio_anterior_el`, el barrido inventa reagendamientos.

     Las tres tienen su prueba de comportamiento en `pruebas/base/27-agenda.test.ts`, que es donde
     se miden. Ésta afirma la FORMA, que es lo que hace legible por qué son distintas. */
  const fuente = archivosFuente(['lib']).find((a) => a.ruta === EL_ESCRITOR);
  assert.ok(fuente, `no se encontró ${EL_ESCRITOR}`);

  assert.match(
    fuente.limpio,
    /reagendada_el:\s*sql`coalesce\(excluded\.reagendada_el, citas\.reagendada_el\)`/,
    'la marca de reagendamiento dejó de protegerse con `coalesce`: un barrido sin el campo borra ' +
      'la de todas las citas de la ventana, sin error',
  );
  assert.match(
    fuente.limpio,
    /crm_asignado_a:\s*valores\.crm_asignado_a/,
    'el usuario asignado dejó de pisarse derecho: con `coalesce`, desasignar en el CRM no se ve',
  );
  assert.match(
    fuente.limpio,
    /case when citas\.inicio_el is distinct from excluded\.inicio_el/,
    'se fue la guarda del `case`: el barrido corre cada hora, así que sin ella toda cita queda ' +
      'marcada como movida y «cuántas se reagendaron» diría el 100 %',
  );
});
