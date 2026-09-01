// De quién son los leads de cada closer. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE ARCHIVO CUIDA, Y POR QUÉ NO LO PUEDE CUIDAR NADA MÁS
//
// Hasta la migración 034 todos los que abrían la pestaña Closer veían **los mismos contactos**: los
// del territorio entero. `lib/negocio/fila.ts` tenía escrita la decisión y su motivo:
//
//   *«La respuesta que se eligió: por territorio. NO por responsable asignado, porque GHL no da
//   asignación — da zona.»*
//
// Esa premisa resultó falsa, medida el 2026-09-01 con la MISMA llamada que la aplicación ya hacía:
// `assignedTo` viene poblado en 135 de los 152 contactos de `zona_closer`. Así que ahora un closer
// vinculado ve solo lo suyo.
//
// ── LOS DOS LADOS POR LOS QUE ESTO SE ROMPE, Y NINGUNO FALLA ────────────────
//
//   · **De más** — el filtro no se aplica en una de las tres pantallas del Closer. Mi Día y el
//     Pipeline muestran lo suyo, Contactos muestra todo, y las tres listas son «correctas»: una es
//     más larga. Nadie ve un error; alguien llama a un lead ajeno.
//   · **De menos** — el filtro se aplica a quien no debía. Un administrador ve una cartera vacía y
//     concluye que la empresa no tiene trabajo, o un closer sin vincular ve cero y se va a su casa.
//
// El segundo es peor porque es invisible: una lista vacía no dice por qué está vacía.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { montar, unContacto, type Escenario } from '../apoyo/closer.ts';
import {
  alcanceDe,
  alcancePedido,
  closersDeLaEmpresa,
  verComoDeLaUrl,
  type CloserConfigurado,
} from '../../lib/negocio/alcanceDelCloser.ts';
import { asignarCloser, quitarCloser, TOPE_DE_CLOSERS } from '../../lib/negocio/closer.ts';
import { cockpitDelMes } from '../../lib/negocio/inicio.ts';
import { filasDeTerritorio } from '../../lib/negocio/fila.ts';
import { pipelineDe } from '../../lib/negocio/pipeline.ts';

let esc: Escenario;

/** Los dos usuarios del CRM con los que se vinculan los closers de estas pruebas. */
const CRM_UNO = 'crmUsuarioUno';
const CRM_DOS = 'crmUsuarioDos';

before(async () => {
  esc = await montar('Alcance');
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

async function limpiar(): Promise<void> {
  const marca = `${esc.marca.toLowerCase()}-%`;
  await esc.admin.query('delete from negocio.contactos where ghl_contact_id like $1', [marca]);
  await esc.admin.query('delete from negocio.closer_asignado where org_id = $1', [esc.org]);
  /* Las personas se borran DESPUÉS de las designaciones: la clave foránea las sostiene, y el
     borrado al revés fallaría con un error que no menciona ni los closers. */
  await esc.admin.query("delete from identidad.usuarios where email like '%@alcance.ejemplo'");
}

/**
 * Una persona REAL de la organización.
 *
 * No sirve inventar un uuid: `closer_asignado` tiene una clave foránea COMPUESTA contra
 * `(org_id, id)` de `usuarios`, que es lo que impide designar closer a alguien de otra empresa.
 * Lo encontró esta prueba al intentarlo — que es la clave foránea haciendo su trabajo.
 */
async function unaPersona(nombre: string): Promise<string> {
  const { rows } = await esc.admin.query<{ id: string }>(
    `insert into identidad.usuarios (org_id, nombre, email, password_hash, creado_por)
     values ($1, $2, $3, 'scrypt$16384$8$1$c2FsCg==$aGFzaAo=', null) returning id`,
    [esc.org, `${esc.marca} ${nombre}`, `${nombre.toLowerCase()}@alcance.ejemplo`],
  );
  return rows[0]!.id;
}

/** Los tres contactos del escenario: uno de cada closer, y uno sin asignar. */
async function tresContactos(): Promise<void> {
  await unContacto(esc, { nombre: 'Alcance de uno', crmAsignadoA: CRM_UNO });
  await unContacto(esc, { nombre: 'Alcance de dos', crmAsignadoA: CRM_DOS });
  await unContacto(esc, { nombre: 'Alcance sin asignar', crmAsignadoA: null });
}

/** Los nombres de los contactos que ve alguien, ordenados. Es lo que se compara. */
async function loQueVe(usuarioId: string): Promise<string[]> {
  return conOrganizacion(esc.org, async () => {
    const closers = await closersDeLaEmpresa();
    const { filas } = await filasDeTerritorio('closer', {
      todas: true,
      alcance: alcanceDe(usuarioId, closers),
    });
    return filas.map((f) => f.nombre).sort();
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · EL REPARTO
// ═══════════════════════════════════════════════════════════════════════════════

test('un closer VINCULADO ve solo los contactos que el CRM le asignó', async () => {
  await limpiar();
  await tresContactos();
  await conOrganizacion(esc.org, () => asignarCloser(esc.quien, CRM_UNO, esc.quien));

  assert.deepEqual(
    await loQueVe(esc.quien),
    ['Alcance de uno'],
    'el closer ve contactos que el CRM no le asignó: los de otro closer, o los que nadie tiene',
  );
});

test('los SIN ASIGNAR no son de ningún closer, y por eso no se reparten', async () => {
  /* Fue la decisión de producto —*«solo quien no es closer»*— y el motivo es que un contacto sin
     asignar en el CRM no es de nadie: dárselo a los tres closers haría que los tres lo llamaran.
     Se cuida acá con el caso concreto porque un `or … is null` en la consulta lo rompería y NO
     fallaría nada: las tres listas seguirían devolviendo filas, una de más cada una. */
  await limpiar();
  await tresContactos();
  await conOrganizacion(esc.org, () => asignarCloser(esc.quien, CRM_UNO, esc.quien));

  const suyos = await loQueVe(esc.quien);
  assert.equal(
    suyos.includes('Alcance sin asignar'),
    false,
    'un contacto que el CRM no asignó le apareció a un closer como propio',
  );
});

test('un closer SIN VINCULAR ve TODO, y eso es a propósito', async () => {
  /* ══════════════════════════════════════════════════════════════════════════
     LA SALIDA OBVIA ES LA CONTRARIA, Y ES LA PEOR

     Un closer designado y sin vincular no tiene ningún lead que reclamar, así que «mostrarle lo
     suyo» sería mostrarle CERO. Y una pantalla vacía no dice «te falta vincularte»: dice «no hay
     trabajo». Esa persona se va a su casa y nadie se entera.

     Fallar del lado de mostrar de más es visible y reparable —alguien pregunta por qué ve contactos
     de otro— y fallar del lado de mostrar de menos esconde el trabajo. Por eso el caso sin vínculo
     cae en `todo`, junto con el de quien no es closer.
     ══════════════════════════════════════════════════════════════════════════ */
  await limpiar();
  await tresContactos();
  await conOrganizacion(esc.org, () => asignarCloser(esc.quien, null, esc.quien));

  assert.deepEqual(
    (await loQueVe(esc.quien)).length,
    3,
    'un closer sin vincular ve una lista recortada: la pantalla le va a decir que no tiene trabajo',
  );
});

test('quien NO es closer ve todo, incluidos los que nadie tiene asignados', async () => {
  await limpiar();
  await tresContactos();
  /* Se designa a OTRA persona, no a quien mira. Sin closers configurados esta prueba pasaría por el
     motivo equivocado —no hay a quién acotar— y no diría nada sobre el caso real, que es un
     administrador mirando una empresa que sí tiene closers. */
  await conOrganizacion(esc.org, () => asignarCloser(esc.quien, CRM_UNO, esc.quien));

  const deOtro = await loQueVe('00000000-0000-4000-8000-000000000000');
  assert.equal(deOtro.length, 3, 'quien no es closer dejó de ver la cartera completa');
  assert.ok(deOtro.includes('Alcance sin asignar'), 'los sin asignar no los ve nadie');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · LAS TRES PANTALLAS, CON EL MISMO ALCANCE
// ═══════════════════════════════════════════════════════════════════════════════

test('el Pipeline acota IGUAL que Mi Día: tres pantallas, una sola respuesta', async () => {
  /* ── EL DEFECTO QUE ESTO IMPIDE, Y ES EL MÁS FÁCIL DE COMETER ──────────────
   *
   * Son tres pantallas del Closer que consultan contactos —Mi Día, Pipeline y Contactos— y cada una
   * llama por su lado. Olvidarse del alcance en UNA no rompe nada: esa lista sale más larga que las
   * otras dos, y las tres se ven correctas. El closer entra a Pipeline y ve los leads que Mi Día le
   * esconde.
   *
   * Se compara el Pipeline contra el mismo alcance en vez de contra un número escrito acá: así, si
   * cambia lo que un closer ve, las dos afirmaciones se mueven juntas o esto se pone rojo. */
  await limpiar();
  await tresContactos();
  await conOrganizacion(esc.org, () => asignarCloser(esc.quien, CRM_UNO, esc.quien));

  const { deMiDia, delPipeline } = await conOrganizacion(esc.org, async () => {
    const closers = await closersDeLaEmpresa();
    const alcance = alcanceDe(esc.quien, closers);
    const { filas } = await filasDeTerritorio('closer', { todas: true, alcance });
    const p = await pipelineDe('closer', { conCongelados: true, alcance });
    return {
      deMiDia: filas.map((f) => f.nombre).sort(),
      delPipeline: p.columnas.flatMap((c) => c.filas.map((f) => f.nombre)).sort(),
    };
  });

  assert.deepEqual(deMiDia, ['Alcance de uno']);
  assert.deepEqual(delPipeline, deMiDia, 'el Pipeline no acota igual que Mi Día');
});

test('los CONTADORES del cockpit son de la misma persona que el número grande', async () => {
  /* ══════════════════════════════════════════════════════════════════════════
     DOS BASES DISTINTAS EN LA MISMA TARJETA, QUE ES LO QUE LA 020 VINO A CERRAR

     El cockpit tiene el número grande —lo cobrado, que sale de `resultados`— y dos contadores por
     etiqueta: con cita agendada y no-shows, que salen de `contactos`. Son DOS consultas, y acotar
     una sola es exactamente el defecto que la migración 020 describe: *«antes el número grande era
     de TODA la empresa y el anillo de al lado de quien miraba»*.

     Con varios closers vuelve por la puerta de al lado: un closer vería sus tres ventas arriba y
     los contactos de los tres abajo. Nada falla — los dos números son correctos, de gente
     distinta.

     Lo encontró una mutación: apagar el `$if` del cockpit dejaba las trece pruebas de este archivo
     en verde.
     ══════════════════════════════════════════════════════════════════════════ */
  await limpiar();
  await unContacto(esc, {
    nombre: 'Alcance con cita de uno',
    crmAsignadoA: CRM_UNO,
    etiquetas: ['cita_agendada'],
  });
  await unContacto(esc, {
    nombre: 'Alcance con cita de dos',
    crmAsignadoA: CRM_DOS,
    etiquetas: ['cita_agendada'],
  });
  await unContacto(esc, {
    nombre: 'Alcance con cita sin dueño',
    crmAsignadoA: null,
    etiquetas: ['cita_agendada'],
  });

  const { deUno, deLaEmpresa } = await conOrganizacion(esc.org, async () => ({
    deUno: await cockpitDelMes('UTC', 0, {
      tipo: 'persona',
      usuarioId: esc.quien,
      crmUsuarioId: CRM_UNO,
    }),
    deLaEmpresa: await cockpitDelMes('UTC', 0, { tipo: 'empresa', usuarioIds: [esc.quien] }),
  }));

  assert.equal(
    deUno.conCitaAgendada.valor,
    1,
    'el contador de citas de un closer cuenta las de los otros y las que nadie tiene',
  );
  /* Y quien mira toda la empresa las ve las TRES, incluida la que nadie tiene asignada. Sin esta
     mitad, acotar SIEMPRE pasaría la afirmación de arriba y dejaría a quien administra con un
     tablero recortado sin que nada lo diga. */
  assert.equal(deLaEmpresa.conCitaAgendada.valor, 3, 'quien administra ve un tablero recortado');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · EL SELECTOR «VER COMO»
// ═══════════════════════════════════════════════════════════════════════════════

test('«ver como» solo lo atiende quien ve TODO, y un closer no puede usarlo', async () => {
  /* ══════════════════════════════════════════════════════════════════════════
     DEJA QUE UNA PETICIÓN ELIJA DE QUIÉN VER LOS LEADS, QUE ES LA FORMA DE UNA ESCALADA

     Lo que lo cierra son dos cosas y hacen falta las dos: solo se atiende cuando el alcance propio
     es `todo`, y el identificador pedido tiene que estar en la lista de SU empresa.

     La primera es la que se mide acá: un closer vinculado que mande `verComo` a mano recibe su
     propio alcance igual. Se IGNORA en vez de rechazarse, y eso también es deliberado — un 403 le
     confirmaría a quien prueba que ese identificador existe y es closer.
     ══════════════════════════════════════════════════════════════════════════ */
  await limpiar();
  await conOrganizacion(esc.org, async () => {
    await asignarCloser(esc.quien, CRM_UNO, esc.quien);
  });

  const closers: CloserConfigurado[] = await conOrganizacion(esc.org, () => closersDeLaEmpresa());
  const otro: CloserConfigurado = {
    usuarioId: '00000000-0000-4000-8000-000000000001',
    nombre: 'Otro',
    crmUsuarioId: CRM_DOS,
    actualizadoEl: new Date(),
  };
  const lista = [...closers, otro];

  // Quien ve todo SÍ puede mirar los números de un closer.
  assert.deepEqual(
    alcancePedido({ tipo: 'todo' }, otro.usuarioId, lista),
    { tipo: 'mio', crmUsuarioId: CRM_DOS },
    'quien administra no puede elegir de quién ver los números',
  );

  // Y un closer NO, ni mandando el identificador del otro a mano.
  const propio = alcanceDe(esc.quien, lista);
  assert.deepEqual(
    alcancePedido(propio, otro.usuarioId, lista),
    { tipo: 'mio', crmUsuarioId: CRM_UNO },
    'un closer pudo ver los leads de otro mandando `verComo` a mano',
  );
});

test('un `verComo` que no es de la empresa cae en «toda la empresa», no en un error', async () => {
  /* La lista sale de `closer_asignado` leída por la conexión del inquilino, así que ya viene acotada
     por la política de fila: un identificador de otra organización no está en ella. Lo que se afirma
     es qué pasa entonces — se ignora, y quien pide sigue viendo todo. */
  const lista: CloserConfigurado[] = [
    { usuarioId: 'a', nombre: 'A', crmUsuarioId: CRM_UNO, actualizadoEl: new Date() },
  ];
  assert.deepEqual(alcancePedido({ tipo: 'todo' }, 'de-otra-empresa', lista), { tipo: 'todo' });

  /* Y un closer SIN VINCULAR tampoco se puede elegir: no tiene leads propios, así que su opción
     daría lo mismo que «toda la empresa» — y con `crmUsuarioId` nulo la consulta compararía contra
     nulo, que no es igual a nada y devolvería CERO filas. Un tablero vacío que parece un dato. */
  const sinVinculo: CloserConfigurado[] = [
    { usuarioId: 'b', nombre: 'B', crmUsuarioId: null, actualizadoEl: new Date() },
  ];
  assert.deepEqual(alcancePedido({ tipo: 'todo' }, 'b', sinVinculo), { tipo: 'todo' });
});

test('el `verComo` de la URL se valida como forma antes de viajar', async () => {
  const url = (v: string | null) =>
    new Request(`https://ejemplo.test/api/closer/mi-dia${v === null ? '' : `?verComo=${v}`}`);

  assert.equal(verComoDeLaUrl(url(null)), null);
  assert.equal(verComoDeLaUrl(url('no-es-un-uuid')), null);
  const uuid = '00000000-0000-4000-8000-000000000001';
  assert.equal(verComoDeLaUrl(url(uuid)), uuid);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · EL TOPE Y EL VÍNCULO ÚNICO
// ═══════════════════════════════════════════════════════════════════════════════

test('quitar a UN closer no se lleva a los otros', async () => {
  /* `quitarCloser()` sin identificador borraría los tres, y la política de aislamiento no lo
     impediría: acota por organización, que es justo lo que ese borrado ya hace. Con un solo closer
     el parámetro no existía. */
  await limpiar();
  const segundo = await unaPersona('Segundo');
  await conOrganizacion(esc.org, async () => {
    await asignarCloser(esc.quien, CRM_UNO, esc.quien);
    await asignarCloser(segundo, CRM_DOS, esc.quien);
  });

  const antes = await conOrganizacion(esc.org, () => closersDeLaEmpresa());
  assert.equal(antes.length, 2, 'el escenario no quedó con dos closers');

  await conOrganizacion(esc.org, () => quitarCloser(esc.quien));
  const despues = await conOrganizacion(esc.org, () => closersDeLaEmpresa());
  assert.equal(despues.length, 1, 'quitar a uno se llevó a los demás');
});

test('el tope de closers es un número con nombre, no una constante escondida', async () => {
  /* Se pidió *«por ahora pongamos hasta un máximo de 3»*, y «por ahora» es lo que decide dónde vive:
     subirlo tiene que ser una línea. Se afirma el valor para que cambiarlo sea deliberado. */
  assert.equal(TOPE_DE_CLOSERS, 3);
});

test('dos closers NO se pueden vincular al mismo usuario del CRM', async () => {
  /* Lo hace cumplir la BASE, con el índice único parcial de la migración 034. Es la única de estas
     reglas que no depende de que el código se acuerde: dos personas vinculadas al mismo usuario de
     GoHighLevel reclamarían los mismos leads, y las dos consultas devolverían filas. */
  await limpiar();
  const otro = await unaPersona('Tercero');
  const porque = await conOrganizacion(esc.org, async () => {
    await asignarCloser(esc.quien, CRM_UNO, esc.quien);
    return asignarCloser(otro, CRM_UNO, esc.quien);
  });
  assert.equal(porque, 'crm_ya_vinculado');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5 · LA COLUMNA, Y QUÉ PISA LA SINCRONIZACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

test('`crm_asignado_a` se PISA al sincronizar, y `responsable_id` NO', async () => {
  /* ══════════════════════════════════════════════════════════════════════════
     LAS DOS MITADES DE LA MISMA REGLA, Y SE ROMPEN PARA LADOS OPUESTOS

     `lib/negocio/sincronizar.ts` protege del `do update` cinco columnas que son NUESTRAS —el sello
     del setter, la etapa, el score, el responsable— porque pisarlas borraría trabajo hecho acá.

     `crm_asignado_a` es lo contrario: es un hecho de GoHighLevel. Si quedara fuera del `set`, el
     primer valor sería el definitivo — el lead se quedaría para siempre con el closer que lo tuvo el
     día que se sincronizó por primera vez, y ninguna reasignación en el CRM tendría efecto. **Nada
     fallaría.**

     Se mide sobre el SQL de la función en vez de correr una sincronización real, que necesitaría el
     CRM: lo que se comprueba es qué columnas están en el `do update`, que es exactamente donde vive
     la decisión.
     ══════════════════════════════════════════════════════════════════════════ */
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { RAIZ } = await import('../apoyo/fuente.ts');
  const fuente = readFileSync(join(RAIZ, 'lib/negocio/sincronizar.ts'), 'utf8');

  const i = fuente.indexOf("oc.columns(['org_id', 'ghl_contact_id']).doUpdateSet({");
  assert.ok(i > 0, 'cambió la forma del `on conflict` de la sincronización');
  const bloque = fuente.slice(i, fuente.indexOf('} as never)', i));

  assert.match(bloque, /crm_asignado_a:/, 'la sincronización dejó de pisar el asignado del CRM');
  for (const nuestra of ['responsable_id', 'sello_setter_id', 'etapa', 'score']) {
    assert.equal(
      new RegExp(`\\b${nuestra}:`).test(bloque),
      false,
      `la sincronización pisa \`${nuestra}\`, que es un dato NUESTRO y no del CRM`,
    );
  }
});

test('la columna existe y acepta nulos, que es el caso de 17 de los 152', async () => {
  await limpiar();
  const c = await unContacto(esc, { nombre: 'Alcance sin nada', crmAsignadoA: null });
  const leido = await conOrganizacion(esc.org, async () =>
    datos()
      .selectFrom('contactos')
      .select(['crm_asignado_a'])
      .where('id', '=', c.id)
      .executeTakeFirst(),
  );
  assert.equal(leido?.crm_asignado_a, null);
});
