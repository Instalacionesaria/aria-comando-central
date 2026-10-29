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
import { leerRespuesta, montar, pedirComo, sesionDe, unaCita, unContacto, type Escenario } from '../apoyo/closer.ts';
import {
  alcanceDe,
  alcanceDeQuienMira,
  alcancePedido,
  closersDeLaEmpresa,
  eleccionDelAlcance,
  puedeElegirCloser,
  puedeSupervisarClosers,
  verComoDeLaUrl,
  type AlcanceDelCloser,
  type CloserConfigurado,
} from '../../lib/negocio/alcanceDelCloser.ts';
import { GET as verMiDia } from '../../app/api/closer/mi-dia/route.ts';
import { GET as verBrief } from '../../app/api/closer/brief/route.ts';
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
  await conOrganizacion(esc.org, () => asignarCloser(esc.quien, CRM_UNO, esc.quien, esc.principal));

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
  await conOrganizacion(esc.org, () => asignarCloser(esc.quien, CRM_UNO, esc.quien, esc.principal));

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
  await conOrganizacion(esc.org, () => asignarCloser(esc.quien, null, esc.quien, esc.principal));

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
  await conOrganizacion(esc.org, () => asignarCloser(esc.quien, CRM_UNO, esc.quien, esc.principal));

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
  await conOrganizacion(esc.org, () => asignarCloser(esc.quien, CRM_UNO, esc.quien, esc.principal));

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
      vinculos: [{ cuentaId: esc.principal, crmUsuarioId: CRM_UNO }],
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
    await asignarCloser(esc.quien, CRM_UNO, esc.quien, esc.principal);
  });

  const closers: CloserConfigurado[] = await conOrganizacion(esc.org, () => closersDeLaEmpresa());
  const vinculoDos = [{ cuentaId: esc.principal, crmUsuarioId: CRM_DOS }];
  const otro: CloserConfigurado = {
    usuarioId: '00000000-0000-4000-8000-000000000001',
    nombre: 'Otro',
    vinculos: vinculoDos,
    vinculosALaVista: vinculoDos,
    actualizadoEl: new Date(),
  };
  const lista = [...closers, otro];

  // Quien ve todo SÍ puede mirar los números de un closer.
  assert.deepEqual(
    alcancePedido({ tipo: 'todo' }, otro.usuarioId, lista),
    { tipo: 'mio', usuarioId: otro.usuarioId, vinculos: vinculoDos },
    'quien administra no puede elegir de quién ver los números',
  );

  // Y un closer NO, ni mandando el identificador del otro a mano.
  const propio = alcanceDe(esc.quien, lista);
  assert.deepEqual(
    alcancePedido(propio, otro.usuarioId, lista),
    { tipo: 'mio', usuarioId: esc.quien, vinculos: [{ cuentaId: esc.principal, crmUsuarioId: CRM_UNO }] },
    'un closer pudo ver los leads de otro mandando `verComo` a mano',
  );
});

test('un `verComo` que no es de la empresa cae en «toda la empresa», no en un error', async () => {
  /* La lista sale de `closer_asignado` leída por la conexión del inquilino, así que ya viene acotada
     por la política de fila: un identificador de otra organización no está en ella. Lo que se afirma
     es qué pasa entonces — se ignora, y quien pide sigue viendo todo. */
  const lista: CloserConfigurado[] = [
    {
      usuarioId: 'a',
      nombre: 'A',
      vinculos: [{ cuentaId: esc.principal, crmUsuarioId: CRM_UNO }],
      vinculosALaVista: [{ cuentaId: esc.principal, crmUsuarioId: CRM_UNO }],
      actualizadoEl: new Date(),
    },
  ];
  assert.deepEqual(alcancePedido({ tipo: 'todo' }, 'de-otra-empresa', lista), { tipo: 'todo' });

  /* Y un closer SIN VINCULAR tampoco se puede elegir: no tiene leads propios, así que su opción
     daría lo mismo que «toda la empresa» — y sin vínculos la consulta no tendría ningún par contra
     el que comparar y devolvería CERO filas. Un tablero vacío que parece un dato. */
  const sinVinculo: CloserConfigurado[] = [
    { usuarioId: 'b', nombre: 'B', vinculos: [], vinculosALaVista: [], actualizadoEl: new Date() },
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
    await asignarCloser(esc.quien, CRM_UNO, esc.quien, esc.principal);
    await asignarCloser(segundo, CRM_DOS, esc.quien, esc.principal);
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
    await asignarCloser(esc.quien, CRM_UNO, esc.quien, esc.principal);
    return asignarCloser(otro, CRM_UNO, esc.quien, esc.principal);
  });
  assert.equal(porque, 'crm_ya_vinculado');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5 · LA COLUMNA, Y QUÉ PISA LA SINCRONIZACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

test('`crm_asignado_a` se PISA al sincronizar, y `responsable_id` NO', async () => {
  /* ══════════════════════════════════════════════════════════════════════════
     LAS DOS MITADES DE LA MISMA REGLA, Y SE ROMPEN PARA LADOS OPUESTOS

     `lib/negocio/sincronizar.ts` protege del `do update` las columnas que son NUESTRAS —el sello del
     setter y la etapa— porque pisarlas borraría trabajo hecho acá.

     ── `score` CAMBIÓ DE LADO EL 2026-09-21, Y NO ES UN AJUSTE DE LA PRUEBA ──

     Estaba en esta lista, y estaba mal. Se lo creía nuestro porque `esquema.ts` decía que *«nada
     calcula el score»*, y **medido, eso era falso**: el CRM lo calcula —«Puntaje | ICP»— y estaba en
     471 de los 590 contactos con rango 0–100, guardado en `campos_del_crm` y sin que nada lo
     derivara a su columna.

     O sea que es un hecho de GoHighLevel, no nuestro, y va del lado de `crm_asignado_a`: **se pisa**.
     Y por el mismo motivo que ese, además: el CRM recalcula el puntaje cuando el lead responde el
     cuestionario, así que una columna que sólo se escribe al nacer se queda con el primer valor para
     siempre — mostrando un número creíble y viejo.

     `responsable_id` también salió de la lista, pero por lo contrario: la columna se borró
     (migración `054`). No tenía escritor ni lector y `crm_asignado_a` la reemplazó.

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
  /* El puntaje se pisa, como el asignado: los dos los decide el CRM y los dos cambian. Va afirmado
     y no sólo ausente de la lista de abajo — sin esto, quitarlo del `set` volvería al defecto de la
     columna que se escribe una vez y envejece sin que nada falle. */
  assert.match(bloque, /\bscore:/, 'la sincronización dejó de pisar el puntaje del CRM');
  for (const nuestra of ['sello_setter_id', 'etapa']) {
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

// ═══════════════════════════════════════════════════════════════════════════════
// 6 · EL SELECTOR DE CLOSER DE LA CABECERA (2026-10-29)
//
// El pedido: *«en el menú de dashboard de closer debe estar la parte para seleccionar el closer como antes estaba»*.
// El selector existía, pero el administrador principal de la empresa también estaba designado y vinculado como
// closer: su alcance era «mío» y `alcancePedido` le ignoraba `verComo`, así que operaba el Closer viendo 27 de 314
// contactos. Ahora elige quien ve todo O supervisa (`credenciales.editar`, calculado con la sesión), y además de un
// closer valen `todo` y `sin_asignar`. Un closer `usuario` sigue sin poder: se le ignora, sin 403.
// ═══════════════════════════════════════════════════════════════════════════════

/** Un closer `usuario` de verdad: rol `usuario`, la sección `closer` y una sesión. Como los dos de producción. */
async function unCloserUsuario(nombre: string): Promise<{ id: string; token: string }> {
  const id = await unaPersona(nombre);
  await esc.admin.query(
    `insert into identidad.usuarios_roles (usuario_id, rol_id, asignado_por)
     select $1, id, null from identidad.roles where clave = 'usuario'`,
    [id],
  );
  await esc.admin.query(
    `insert into identidad.usuarios_secciones (usuario_id, seccion, concedida_por) values ($1, 'closer', null)`,
    [id],
  );
  return { id, token: await sesionDe(id) };
}

/** Los nombres que ve un alcance en la cartera del Closer. */
async function nombresDe(alcance: AlcanceDelCloser): Promise<string[]> {
  return conOrganizacion(esc.org, async () => {
    const { filas } = await filasDeTerritorio('closer', { todas: true, alcance });
    return filas.map((f) => f.nombre).sort();
  });
}

test('quien supervisa ELIGE aunque sea closer vinculado: otro closer, toda la empresa o los sin asignar', async () => {
  await limpiar();
  await tresContactos();
  // Uno asignado a un usuario del CRM que no es closer: tampoco es de ningún closer, así que va con los sin asignar.
  await unContacto(esc, { nombre: 'Alcance de nadie del equipo', crmAsignadoA: 'crmQueNoEsCloser' });
  const dos = await unaPersona('Dos');
  await conOrganizacion(esc.org, async () => {
    await asignarCloser(esc.quien, CRM_UNO, esc.quien, esc.principal);
    await asignarCloser(dos, CRM_DOS, esc.quien, esc.principal);
  });

  const como = (verComo: string | null, supervisa: boolean) =>
    conOrganizacion(esc.org, () => alcanceDeQuienMira(esc.quien, verComo, supervisa));

  // Sin elegir, lo suyo: la omisión «Toda la empresa» la pone la pantalla (`useState('todo')`), no el servidor.
  assert.deepEqual(await nombresDe((await como(null, true)).alcance), ['Alcance de uno']);
  assert.deepEqual(
    await nombresDe((await como(dos, true)).alcance),
    ['Alcance de dos'],
    'un supervisor que también es closer no pudo ver los números de otro closer',
  );
  assert.deepEqual(
    await nombresDe((await como('todo', true)).alcance),
    ['Alcance de dos', 'Alcance de nadie del equipo', 'Alcance de uno', 'Alcance sin asignar'],
    'un supervisor que también es closer no pudo ver toda la empresa',
  );
  assert.deepEqual(
    await nombresDe((await como('sin_asignar', true)).alcance),
    ['Alcance de nadie del equipo', 'Alcance sin asignar'],
    '«sin asignar» no es lo que no es de ningún closer: o trae contactos de un closer, o pierde los que el CRM no asignó',
  );
  // Y la elección que la píldora marca es la aplicada.
  assert.equal(eleccionDelAlcance((await como(dos, true)).alcance), dos);
  assert.equal(eleccionDelAlcance((await como('sin_asignar', true)).alcance), 'sin_asignar');
  assert.equal(eleccionDelAlcance((await como(esc.quien, true)).alcance), esc.quien, '«Lo mío» es su propio identificador');

  // Sin la capacidad, el MISMO closer vinculado no elige nada: ni un closer, ni `todo`, ni `sin_asignar`.
  for (const pedido of [dos, 'todo', 'sin_asignar']) {
    assert.deepEqual(
      await nombresDe((await como(pedido, false)).alcance),
      ['Alcance de uno'],
      `un closer sin \`credenciales.editar\` eligió «${pedido}» mandándolo a mano`,
    );
  }
});

test('«sin asignar» es el complemento exacto: con el «mío» de cada closer, suma la empresa entera', async () => {
  await limpiar();
  await tresContactos();
  await unContacto(esc, { nombre: 'Alcance de nadie del equipo', crmAsignadoA: 'crmQueNoEsCloser', etiquetas: ['noshow'] });
  // Y un no-show de un closer: sin el corte, el cockpit de «sin asignar» lo contaría como suyo.
  await unContacto(esc, { nombre: 'Alcance noshow de uno', crmAsignadoA: CRM_UNO, etiquetas: ['noshow'] });
  const dos = await unaPersona('Dos');
  await conOrganizacion(esc.org, async () => {
    await asignarCloser(esc.quien, CRM_UNO, esc.quien, esc.principal);
    await asignarCloser(dos, CRM_DOS, esc.quien, esc.principal);
  });
  const closers = await conOrganizacion(esc.org, () => closersDeLaEmpresa());
  const partes = [
    ...(await nombresDe(alcancePedido({ tipo: 'todo' }, esc.quien, closers))),
    ...(await nombresDe(alcancePedido({ tipo: 'todo' }, dos, closers))),
    ...(await nombresDe(alcancePedido({ tipo: 'todo' }, 'sin_asignar', closers))),
  ].sort();
  assert.deepEqual(partes, await nombresDe({ tipo: 'todo' }), 'un contacto quedó en dos partes o en ninguna');

  // Y el cockpit cuenta los mismos: el conteo por etiqueta se corta con el mismo complemento, y el dinero no es de nadie.
  const cockpit = await conOrganizacion(esc.org, () =>
    cockpitDelMes('UTC', 0, { tipo: 'sin_asignar', asignados: closers.flatMap((k) => k.vinculos) }),
  );
  assert.equal(cockpit.noShows.valor, 1, 'el cockpit de «sin asignar» no cuenta lo que no es de ningún closer');
  assert.equal(cockpit.cobrado.valor, null, '«sin asignar» mostró dinero, y no es de ningún closer');
  assert.match(cockpit.cobrado.falta ?? '', /sin asignar/);
});

test('un `verComo` de OTRA empresa cae en el alcance propio, también para quien supervisa', async () => {
  await limpiar();
  await tresContactos();
  await conOrganizacion(esc.org, () => asignarCloser(esc.quien, CRM_UNO, esc.quien, esc.principal));
  // Un closer real de `beta`, vinculado allá: el identificador existe y es closer, pero no de esta empresa.
  const deBeta = await esc.admin.query<{ id: string; cuenta: string }>(
    `select u.id, (select c.id from identidad.cuentas c where c.org_id = u.org_id and c.es_por_omision) as cuenta
       from identidad.usuarios u where u.org_id = $1 order by u.creado_el limit 1`,
    [esc.otraOrg],
  );
  const beta = deBeta.rows[0]!;
  assert.ok(beta?.id && beta.cuenta, 'el sembrado no tiene una persona y un cliente en `beta`');
  await conOrganizacion(esc.otraOrg, () => asignarCloser(beta.id, CRM_DOS, beta.id, beta.cuenta));
  try {
    const { alcance } = await conOrganizacion(esc.org, () => alcanceDeQuienMira(esc.quien, beta.id, true));
    assert.deepEqual(
      alcance,
      { tipo: 'mio', usuarioId: esc.quien, vinculos: [{ cuentaId: esc.principal, crmUsuarioId: CRM_UNO }] },
      'el closer de otra empresa se pudo elegir desde ésta',
    );
  } finally {
    await esc.admin.query('delete from negocio.closer_asignado where org_id = $1 and usuario_id = $2', [esc.otraOrg, beta.id]);
  }

  // Y la forma: sólo un uuid, `todo` o `sin_asignar` llegan a `alcancePedido`.
  const url = (v: string) => new Request(`https://ejemplo.test/api/closer/mi-dia?verComo=${v}`);
  assert.equal(verComoDeLaUrl(url('todo')), 'todo');
  assert.equal(verComoDeLaUrl(url('sin_asignar')), 'sin_asignar');
  assert.equal(verComoDeLaUrl(url('TODO')), null);
  assert.equal(verComoDeLaUrl(url('mio')), null);
});

test('la ruta de Mi Día: el supervisor-closer recibe el selector y elige; el closer `usuario`, ni lo uno ni lo otro', async () => {
  await limpiar();
  await tresContactos();
  const k = await unCloserUsuario('Usuario');
  await conOrganizacion(esc.org, async () => {
    await asignarCloser(esc.quien, CRM_UNO, esc.quien, esc.principal);
    await asignarCloser(k.id, CRM_DOS, esc.quien, esc.principal);
  });

  type MiDia = {
    puedeElegirCloser: boolean;
    eleccion: string;
    miCloserId: string | null;
    mirando: { usuarioId: string } | null;
  };
  const pedir = async (token: string, verComo: string | null): Promise<MiDia> => {
    const r = await verMiDia(pedirComo(`/api/closer/mi-dia${verComo ? `?verComo=${verComo}` : ''}`, token));
    const { estado, cuerpo } = await leerRespuesta<MiDia>(r);
    assert.equal(estado, 200, `Mi Día respondió ${estado}: ${JSON.stringify(cuerpo)}`);
    return cuerpo;
  };

  // El administrador (tiene `credenciales.editar`) que además es closer vinculado.
  const deAna = await pedir(esc.token, 'todo');
  assert.equal(deAna.puedeElegirCloser, true, 'al supervisor que es closer no se le ofrece el selector');
  assert.equal(deAna.eleccion, 'todo', 'el supervisor que es closer pidió «Toda la empresa» y no la recibió');
  assert.equal(deAna.miCloserId, esc.quien, '«Lo mío» no se ofrece a quien es closer vinculado');
  assert.equal((await pedir(esc.token, k.id)).mirando?.usuarioId, k.id, 'el supervisor eligió un closer y Mi Día no lo obedeció');

  // El closer `usuario`: sin selector, y lo que mande se ignora —200 con lo suyo, no 403—.
  for (const pedido of ['todo', 'sin_asignar', esc.quien]) {
    const deK = await pedir(k.token, pedido);
    assert.equal(deK.puedeElegirCloser, false, 'a un closer `usuario` se le ofreció el selector');
    assert.equal(deK.eleccion, k.id, `un closer \`usuario\` eligió «${pedido}» mandándolo a mano`);
  }
});

test('el Brief obedece el alcance elegido, con el mismo candado', async () => {
  await limpiar();
  const k = await unCloserUsuario('Brief');
  await conOrganizacion(esc.org, async () => {
    await asignarCloser(esc.quien, CRM_UNO, esc.quien, esc.principal);
    await asignarCloser(k.id, CRM_DOS, esc.quien, esc.principal);
  });
  const deK = await unContacto(esc, { nombre: 'Alcance brief de dos', crmAsignadoA: CRM_DOS });
  const cita = await unaCita(esc, deK.id, { inicioEl: new Date(Date.now() + 86_400_000) });

  const estado = async (token: string, verComo: string | null): Promise<number> =>
    (await verBrief(pedirComo(`/api/closer/brief?cita=${cita}${verComo ? `&verComo=${verComo}` : ''}`, token))).status;

  // El supervisor-closer: sin elegir, la cita de otro no existe para él; eligiendo, sí.
  assert.equal(await estado(esc.token, null), 404);
  assert.equal(await estado(esc.token, 'todo'), 200, 'el Brief no obedece «Toda la empresa» del selector');
  assert.equal(await estado(esc.token, k.id), 200, 'el Brief no obedece al closer elegido');
  assert.equal(await estado(esc.token, 'sin_asignar'), 404, 'el Brief de un contacto asignado salió en «sin asignar»');
  // El closer dueño la ve.
  assert.equal(await estado(k.token, null), 200);

  // Y el candado del lado de un closer `usuario`: la cita de ana no la abre ni pidiendo «Toda la empresa».
  const deAna = await unContacto(esc, { nombre: 'Alcance brief de uno', crmAsignadoA: CRM_UNO });
  const citaDeAna = await unaCita(esc, deAna.id, { inicioEl: new Date(Date.now() + 86_400_000) });
  const r = await verBrief(pedirComo(`/api/closer/brief?cita=${citaDeAna}&verComo=todo`, k.token));
  assert.equal(r.status, 404, 'un closer `usuario` abrió el Brief de otro pidiendo «Toda la empresa»');
});

test('el selector se ofrece a quien ve todo o supervisa, y sólo con algún closer elegible', async () => {
  const vinculo = [{ cuentaId: esc.principal, crmUsuarioId: CRM_UNO }];
  const elegible: CloserConfigurado = {
    usuarioId: 'a',
    nombre: 'A',
    vinculos: vinculo,
    vinculosALaVista: vinculo,
    actualizadoEl: new Date(),
  };
  // Vinculado sólo en un cliente que no está a la vista: con el foco en otro, no se puede elegir.
  const fuera: CloserConfigurado = { ...elegible, usuarioId: 'b', vinculosALaVista: [] };
  const mio: AlcanceDelCloser = { tipo: 'mio', usuarioId: 'a', vinculos: vinculo };

  assert.equal(puedeElegirCloser({ tipo: 'todo' }, [elegible], false), true);
  assert.equal(puedeElegirCloser(mio, [elegible], true), true);
  assert.equal(puedeElegirCloser(mio, [elegible], false), false, 'al closer `usuario` se le ofrece el selector');
  assert.equal(puedeElegirCloser({ tipo: 'todo' }, [fuera], true), false);
  assert.deepEqual(alcancePedido({ tipo: 'todo' }, 'b', [fuera], true), { tipo: 'todo' }, 'se eligió un closer sin vínculo a la vista');
  assert.equal(puedeSupervisarClosers(new Set(['closer.ver'])), false);
  assert.equal(puedeSupervisarClosers(new Set(['credenciales.editar'])), true);
});
