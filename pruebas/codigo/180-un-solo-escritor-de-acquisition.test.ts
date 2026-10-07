// UN SOLO escritor de las tablas de Acquisition (`065`, `066` y `076`). Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTO ES DE CÓDIGO Y NO DE COMPORTAMIENTO
//
// `pruebas/base/99-anuncios.test.ts` prueba lo que el colector escribe en `negocio.campanas`, y
// `pruebas/base/180-el-funnel-de-la-campana.test.ts` lo que la ruta escribe en
// `negocio.funnels_de_campana`. Ninguna de las dos puede ver a un SEGUNDO escritor: si mañana otro
// archivo inserta campañas o asigna funnels por su cuenta, las dos siguen en verde.
//
// Y cada tabla tiene una regla que un segundo escritor se saltearía:
//
//   · en `campanas`, el nombre se conserva con `coalesce` y el estado se reescribe plano (`065`), y
//     eso lo hace su escritor, `guardarCampanas`. Uno nuevo que no lo supiera borraría nombres, o
//     dejaría estados viejos con sello nuevo;
//   · en `funnels_de_campana`, cada asignación y cada quita dejan su fila de auditoría en la misma
//     transacción. **Eso NO lo hace el escritor**: lo hace quien lo llama —la ruta
//     `app/api/acquisition/funnel`—, igual que en el link manual de Creative. Por eso la tercera
//     prueba de abajo exige que todo el que llame a `asignarFunnel` o `quitarFunnel` audite con la
//     acción que corresponde: un script o una ruta nueva que los llamara sin auditar movería campañas
//     de funnel sin rastro, y ninguna prueba de comportamiento lo vería.
//
// Se busca la FORMA de la escritura —Kysely o SQL crudo, con el esquema o sin él— y no una
// convención de nombres. Sin el esquema también, porque el rol de la aplicación tiene `negocio` en
// su ruta de búsqueda y el código escribe sin calificar.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { archivosFuente } from '../apoyo/fuente.ts';

/** Una escritura sobre la tabla, por Kysely o en SQL crudo, con o sin `negocio.` adelante. */
function escribe(tabla: string, fuente: string): boolean {
  const kysely = new RegExp(`(insertInto|updateTable|deleteFrom|mergeInto)\\(\\s*['"\`]${tabla}['"\`]\\s*\\)`);
  const crudo = new RegExp(`(insert\\s+into|update|delete\\s+from|merge\\s+into)\\s+(?:negocio\\.)?${tabla}\\b`, 'i');
  return kysely.test(fuente) || crudo.test(fuente);
}

const ESCRITORES = [
  { tabla: 'campanas', escritor: 'lib/negocio/recolectarAnuncios.ts' },
  /* Las dos de la `076`. El relleno (`rellenarAnuncios.ts`) escribe a través de los escritores exportados de
     `recolectarAnuncios.ts`: el rango que no pisa una lectura del día y el cambio que reinicia el residuo son
     reglas de su escritor, y un segundo escritor se las saltearía. */
  { tabla: 'gasto_de_la_cuenta', escritor: 'lib/negocio/recolectarAnuncios.ts' },
  { tabla: 'lecturas_de_gasto', escritor: 'lib/negocio/recolectarAnuncios.ts' },
  { tabla: 'funnels_de_campana', escritor: 'lib/negocio/funnelDeLaCampana.ts' },
];

for (const { tabla, escritor } of ESCRITORES) {
  test(`\`negocio.${tabla}\` tiene UN solo escritor, y es \`${escritor}\``, () => {
    const culpables = archivosFuente(['app', 'lib', 'scripts'])
      .filter((a) => a.ruta !== escritor)
      .filter((a) => escribe(tabla, a.limpio))
      .map((a) => a.ruta);

    assert.deepEqual(
      culpables,
      [],
      `apareció un segundo escritor de \`negocio.${tabla}\`: la regla que aplica su escritor —o quien ` +
        'lo llama— no lo alcanza',
    );

    /* Y el que sí escribe, INSERTA: si el `insert` se fuera de ahí, la aserción de arriba pasaría en
       vacío con cero escritores. Se pide el `insertInto` y no cualquier escritura porque el escritor de
       funnels también BORRA (`quitarFunnel`), y con eso solo parecería escritor sin guardar nada —
       medido por mutación: renombrar la tabla del `insert` dejaba esta prueba en verde. */
    const propio = archivosFuente(['lib']).find((a) => a.ruta === escritor);
    assert.ok(propio, `no se encontró ${escritor}`);
    assert.match(
      propio.limpio,
      new RegExp(`insertInto\\(\\s*['"\`]${tabla}['"\`]\\s*\\)`),
      `el escritor único dejó de insertar en \`negocio.${tabla}\`: la aserción de arriba estaría pasando en vacío`,
    );
  });
}

test('todo el que asigna o quita un funnel, lo audita con su acción', () => {
  const PARES = [
    { funcion: 'asignarFunnel', accion: 'funnel_de_campana_asignado' },
    { funcion: 'quitarFunnel', accion: 'funnel_de_campana_quitado' },
  ];
  const llamadores = archivosFuente(['app', 'lib', 'scripts']).filter(
    (a) => a.ruta !== 'lib/negocio/funnelDeLaCampana.ts' && PARES.some((p) => new RegExp(`\\b${p.funcion}\\(`).test(a.limpio)),
  );
  // Sin llamadores, el bucle de abajo pasaría en vacío. Hoy es la ruta.
  assert.ok(
    llamadores.some((a) => a.ruta === 'app/api/acquisition/funnel/route.ts'),
    'la ruta dejó de llamar al escritor de funnels: esta prueba estaría pasando en vacío',
  );

  const sinAuditar: string[] = [];
  for (const a of llamadores) {
    for (const { funcion, accion } of PARES) {
      if (!new RegExp(`\\b${funcion}\\(`).test(a.limpio)) continue;
      if (!/auditarAdministracion\(/.test(a.limpio) || !a.limpio.includes(`'${accion}'`)) {
        sinAuditar.push(`${a.ruta} llama a ${funcion} sin auditar '${accion}'`);
      }
    }
  }
  assert.deepEqual(
    sinAuditar,
    [],
    'alguien mueve campañas de funnel sin dejar rastro: la auditoría la hace quien llama, no el escritor',
  );
});
