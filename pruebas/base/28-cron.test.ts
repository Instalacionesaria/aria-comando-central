// El barrido de todas las empresas y su punto de entrada. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE ARCHIVO PRUEBA, Y CADA COSA ES UN FALSO VERDE QUE YA OCURRIÓ EN ALGÚN LADO
//
//   1 · **El secreto sin definir.** Sin el guardia, la comparación es contra el literal
//       `'Bearer undefined'` y cualquiera en internet dispara la ingesta de todas las empresas.
//   2 · **El prefijo `Bearer `.** Vercel lo manda como parte del valor. La sonda de este mismo
//       repositorio compara la cabecera entera; copiado, son 403 en todas las corridas para siempre.
//   3 · **Una empresa que falla se lleva puestas a las siguientes.** `conElPulso` relanza, y el único
//       bucle sobre organizaciones que ya existía —el de la sonda— no tiene try/catch por vuelta.
//   4 · **Contar las empresas recorridas en vez de las que corrieron.** Es el falso verde exacto que
//       la sonda ya pagó y arregló contando las que tenían fila en vez de las que encontró.
//   5 · **Colapsar los cinco motivos de credencial.** `token_ilegible` en todas las empresas a la vez
//       significa que cambió la clave maestra del servidor, no que todos los clientes desconectaron
//       su CRM el mismo día.
//   6 · **No sellar cuando la tarea NO corrió.** Sin la fila de `saltada`, «esta empresa no tiene
//       token» es indistinguible de «el cron nunca pasó por acá». Los dos ceros del `11` § 9 regla 1.
//   7 · **Barrer una empresa desactivada.** Diez llamadas al proveedor por una empresa a la que nadie
//       puede entrar.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { TAREAS, barrerTodo, type EmpresaParaBarrer } from '../../lib/negocio/barrido.ts';
import type { AccesoAlAuditor } from '../../lib/credenciales/resolver.ts';

/**
 * El acceso al auditor de estas empresas: **ninguna lo tiene**, y es el caso real.
 *
 * Medido en producción: de cinco organizaciones, **una** tiene llave de IA. Estas pruebas miden el
 * orden de las tareas, el presupuesto y los sellos —no el auditor— y con la falta puesta la tarea
 * `auditoria` sale `saltada` con su motivo, que es exactamente lo que hace hoy en produccion para
 * cuatro de las cinco.
 */
const SIN_AUDITOR: AccesoAlAuditor = { tipo: 'falta', que: 'sin_llave_de_ia' };
import { GET as cron } from '../../app/api/cron/route.ts';
import type { OrganizacionListada } from '../../lib/administracion/organizaciones.ts';

let admin: Client;
let alfa: string;
let beta: string;

before(async () => {
  admin = await conectar('admin');
  const a = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = 'alfa'`);
  const b = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = 'beta'`);
  assert.ok(a && b, 'faltan las organizaciones del sembrado');
  alfa = a.id;
  beta = b.id;
  await limpiar();
});

after(async () => {
  await limpiar();
  delete process.env.CRON_SECRET;
  await cerrarTodo();
  await cerrarClientes();
});

async function limpiar(): Promise<void> {
  await admin.query('delete from negocio.tareas_programadas');
  await admin.query('delete from negocio.ingesta_pulso');
  await admin.query('delete from negocio.contactos');
}

/** Una organización como la devuelve el listado, sin ir a buscarla. */
function org(id: string, slug: string, activa = true): OrganizacionListada {
  return {
    id,
    slug,
    nombre: `Empresa ${slug}`,
    activa,
    esPrincipal: false,
    tieneCredencialDeCrm: true,
    // `null` y no un número: el barrido no mira el precio, y una fixture con un valor inventado
    // haría que una prueba futura sobre el ingreso pasara por el dato falso de este archivo.
    precioMensual: null,
    usuarios: 1,
    zonaHoraria: 'America/Lima',
    creadaEl: new Date(),
  };
}

const CON_TOKEN = { tipo: 'listo' as const, token: 'no-se-usa', locationId: 'loc' };

async function sellos(): Promise<{ slug: string; tarea: string; estado: string; motivo: string | null }[]> {
  return (
    await filas<{ slug: string; tarea: string; ultimo_estado: string; ultimo_motivo: string | null }>(
      admin,
      `select o.slug, t.tarea, t.ultimo_estado, t.ultimo_motivo
         from negocio.tareas_programadas t
         join identidad.organizaciones o on o.id = t.org_id
        order by o.slug, t.tarea`,
    )
  ).map((f) => ({ slug: f.slug, tarea: f.tarea, estado: f.ultimo_estado, motivo: f.ultimo_motivo }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · LA PUERTA
// ═══════════════════════════════════════════════════════════════════════════════

const pedir = (cabeceras: Record<string, string> = {}) =>
  cron(new Request('https://ejemplo.test/api/cron', { headers: cabeceras }));

test('SIN el secreto configurado, la ruta rechaza y NO corre nada', async () => {
  // El guardia que va PRIMERO. Sin él la comparación es contra `'Bearer undefined'`, que cualquiera
  // puede mandar — y del otro lado hay la ingesta y el barrido de todas las empresas.
  await limpiar();
  delete process.env.CRON_SECRET;

  const r = await pedir({ authorization: 'Bearer Bearer undefined' });
  assert.equal(r.status, 403);
  const r2 = await pedir({ authorization: 'Bearer undefined' });
  assert.equal(r2.status, 403);
  assert.deepEqual(await sellos(), [], 'con el secreto sin definir no puede haber corrido nada');
});

test('el cuerpo del rechazo NO nombra la variable de entorno', async () => {
  // Esta ruta es alcanzable sin autenticar por naturaleza, así que un `detalle` con el nombre de la
  // variable se lo cuenta a cualquiera que la golpee. Va al registro, no al cuerpo.
  delete process.env.CRON_SECRET;
  const r = await pedir();
  const texto = await r.text();
  assert.doesNotMatch(texto, /CRON_SECRET/, 'el cuerpo nombra la variable de entorno');
});

test('EL PREFIJO `Bearer `: con prefijo pasa, sin prefijo no', async () => {
  // La mutación que el grep de `timingSafeEqual` NO ve. Vercel manda el prefijo como parte del valor;
  // comparar la cabecera entera —como hace la sonda— da 403 en todas las corridas para siempre, y el
  // síntoma no es un error sino «el cron no hace nada».
  await limpiar();
  const secreto = randomBytes(24).toString('hex');
  process.env.CRON_SECRET = secreto;

  const conPrefijo = await pedir({ authorization: `Bearer ${secreto}` });
  assert.equal(conPrefijo.status, 200, 'con el prefijo que Vercel manda tiene que pasar');

  const sinPrefijo = await pedir({ authorization: secreto });
  assert.equal(sinPrefijo.status, 403, 'sin el prefijo no es lo que Vercel manda');

  const otro = await pedir({ authorization: 'Bearer 000000000000000000000000000000000000000000000000' });
  assert.equal(otro.status, 403);
  const vacio = await pedir();
  assert.equal(vacio.status, 403);
});

test('el user agent NO autoriza', async () => {
  // `vercel-cron/1.0` y `x-vercel-cron-schedule` los escribe el cliente. Sirven para enrutar, jamás
  // para autorizar — y es el atajo que parece razonable cuando el secreto da problemas.
  process.env.CRON_SECRET = randomBytes(24).toString('hex');
  const r = await pedir({ 'user-agent': 'vercel-cron/1.0', 'x-vercel-cron-schedule': '0 12 * * *' });
  assert.equal(r.status, 403);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · EL BUCLE
// ═══════════════════════════════════════════════════════════════════════════════

test('una empresa que FALLA no se lleva puestas a las que vienen después', async () => {
  // `conElPulso` anota el fallo y lo RELANZA. Sin try/catch por vuelta, la tercera empresa desaparece
  // del reporte — y una lista corta que se ve completa es el peor resultado posible acá.
  await limpiar();

  // Se hace fallar a `beta` con un acceso listo pero un identificador de organización que no existe:
  // la ingesta va a lanzar al intentar abrir su contexto.
  const inexistente = randomUUID();
  const empresas: EmpresaParaBarrer[] = [
    { org: org(alfa, 'alfa'), acceso: { tipo: 'falta', que: 'sin_token' }, auditor: SIN_AUDITOR },
    { org: org(inexistente, 'rota'), acceso: CON_TOKEN, auditor: SIN_AUDITOR },
    { org: org(beta, 'beta'), acceso: { tipo: 'falta', que: 'sin_token' }, auditor: SIN_AUDITOR },
  ];

  const r = await barrerTodo('0 12 * * *', empresas);
  const porSlug = new Map(r.renglones.filter((x) => x.tarea === 'mensajes').map((x) => [x.slug, x.estado]));
  assert.equal(porSlug.get('rota'), 'fallo');
  assert.equal(porSlug.get('alfa'), 'saltada', 'la de antes tiene que estar');
  assert.equal(porSlug.get('beta'), 'saltada', 'la de DESPUÉS tiene que estar: es la que se perdía');

  /* ═══════════════════════════════════════════════════════════════════════
     Y LAS TRES TAREAS DE LA EMPRESA ROTA FALLAN, CADA UNA POR SU CUENTA

     Esta parte se agregó porque un mutante sobrevivió: reemplazar el despacho de `contactos` por un
     `{ corrio: false }` fijo —o sea una tarea que se anuncia y no hace nada— dejaba TODO el archivo
     en verde. El resto de las pruebas de acá usa empresas sin credencial, y ahí el despacho no se
     alcanza nunca: se sellan como `saltada` antes de llegar.

     Con la empresa de identificador inexistente y token «listo», cada tarea intenta abrir su contexto
     de inquilino y lanza. Que las TRES digan `fallo` es lo que prueba que las tres se despachan de
     verdad, y no que una es un adorno en la lista de `HORARIOS`.

     `contactos` es la que importa de las tres, porque es la nueva y porque su ausencia no se ve: una
     tarea que se anuncia, sella `frenada` y no lee ninguna etiqueta deja al sistema exactamente como
     estaba —con la marca de agua pasándole por encima a los contactos nuevos— y el reporte del cron
     se vería perfecto. ════════════════════════════════════════════════════════════════ */
  const deLaRota = new Map(
    r.renglones.filter((x) => x.slug === 'rota').map((x) => [x.tarea, x.estado]),
  );
  assert.deepEqual(
    [...deLaRota.entries()].sort(),
    [
      /* `auditoria` sale SALTADA y no `fallo`, y la diferencia es exactamente lo que la tarea nueva
         agrega: **no le habla al CRM**. Esta empresa tiene un identificador inexistente, así que las
         tres tareas del CRM revientan contra la base; el auditor ni llega a intentarlo porque no tiene
         llave de IA, que es una falta distinta y con su propio texto. */
      ['auditoria', 'saltada'],
      ['citas', 'fallo'],
      ['contactos', 'fallo'],
      ['mensajes', 'fallo'],
    ],
    'una de las cuatro tareas no se despachó de verdad contra la empresa: se anunció y no tocó nada',
  );

  /* El SELLO de «rota» no se comprueba, y conviene decir por qué: su identificador no existe en
     `identidad.organizaciones`, así que `sellar` también falla por la clave foránea y no hay fila que
     leer. Es lo que hace que este fixture sirva para probar el try/catch por vuelta —una empresa que
     revienta de la forma más tonta posible— y a la vez lo que lo deja sin sello. El sello de cada
     tarea lo cubren las dos pruebas de la sección 3. */
});

test('`corrieron` cuenta las que DE VERDAD corrieron, no las recorridas', async () => {
  // El falso verde exacto que la sonda ya pagó. Con tres empresas sin credencial, un contador de
  // recorridas diría «3 corrieron» sobre una corrida que no hizo absolutamente nada.
  await limpiar();
  const empresas: EmpresaParaBarrer[] = [
    { org: org(alfa, 'alfa'), acceso: { tipo: 'falta', que: 'sin_token' }, auditor: SIN_AUDITOR },
    { org: org(beta, 'beta'), acceso: { tipo: 'falta', que: 'token_ilegible' }, auditor: SIN_AUDITOR },
  ];
  const r = await barrerTodo('0 12 * * *', empresas);
  assert.equal(r.corrieron, 0, 'ninguna tenía credencial: nada corrió');
  assert.ok(
    r.renglones.length >= 6,
    'y aun así las seis filas se reportan: 2 empresas × 3 tareas por empresa — `contactos`, ' +
      '`mensajes` y `citas`; la sonda no es de ninguna empresa',
  );
});

test('los cinco motivos de credencial NO se colapsan', async () => {
  // `sin_token` es una empresa recién creada; `token_ilegible` es que cambió la clave maestra del
  // servidor. Con un «no se pudo» para los dos, la segunda situación —que es grave y afecta a todas
  // las empresas a la vez— se lee como cinco clientes desconectando su CRM.
  await limpiar();
  const empresas: EmpresaParaBarrer[] = [
    { org: org(alfa, 'alfa'), acceso: { tipo: 'falta', que: 'sin_token' }, auditor: SIN_AUDITOR },
    { org: org(beta, 'beta'), acceso: { tipo: 'falta', que: 'token_ilegible' }, auditor: SIN_AUDITOR },
  ];
  const r = await barrerTodo('0 12 * * *', empresas);
  const motivos = new Map(r.renglones.filter((x) => x.tarea === 'citas').map((x) => [x.slug, x.porque]));
  assert.equal(motivos.get('alfa'), 'sin_token');
  assert.equal(motivos.get('beta'), 'token_ilegible');

  // Y el motivo llega al SELLO, no solo a la respuesta: el reporte dura una hora en los registros y
  // el sello sobrevive.
  const s = await sellos();
  assert.ok(s.some((x) => x.slug === 'beta' && x.motivo === 'token_ilegible'));
});

test('una empresa sin credencial cuesta CERO llamadas', async () => {
  await limpiar();
  const r = await barrerTodo('0 12 * * *', [
    { org: org(alfa, 'alfa'), acceso: { tipo: 'falta', que: 'sin_token' }, auditor: SIN_AUDITOR },
  ]);
  for (const x of r.renglones) assert.equal(x.llamadas, 0, `${x.tarea} gastó llamadas sin credencial`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · EL SELLO
// ═══════════════════════════════════════════════════════════════════════════════

test('SE SELLA TAMBIÉN cuando la tarea no corrió', async () => {
  // Es toda la razón de ser de la tabla. Sin la fila de `saltada`, «esta empresa no tiene token» y
  // «el cron nunca pasó por acá» se ven exactamente igual: no hay fila.
  await limpiar();
  await barrerTodo('0 12 * * *', [
    { org: org(alfa, 'alfa'), acceso: { tipo: 'falta', que: 'sin_token' }, auditor: SIN_AUDITOR },
  ]);
  const s = await sellos();
  // Las CUATRO tareas por empresa. `contactos` entre ellas porque una empresa sin token tampoco puede
  // releer sus etiquetas; y `auditoria` porque **su falta es otra** —no tiene llave de IA— y el sello
  // tiene que decir esa y no la del CRM: son dos proveedores y dos acciones distintas para arreglarlo.
  assert.deepEqual(
    s.map((x) => `${x.tarea}:${x.estado}`).sort(),
    ['auditoria:saltada', 'citas:saltada', 'contactos:saltada', 'mensajes:saltada'],
  );
  /* ── Y CADA SELLO LLEVA SU PROPIO MOTIVO, QUE ES LO QUE SE GANÓ ACÁ ──────
   *
   * Las tres del CRM dicen `sin_token`; la del auditor dice lo suyo. Un motivo compartido haría que
   * quien mire la pantalla fuera a cargar el token del CRM para arreglar el auditor — son dos
   * proveedores, dos llaves y dos acciones distintas. */
  const porTarea = new Map(s.map((x) => [x.tarea, x.motivo]));
  assert.equal(porTarea.get('contactos'), 'sin_token');
  assert.equal(porTarea.get('mensajes'), 'sin_token');
  assert.equal(porTarea.get('citas'), 'sin_token');
  assert.match(String(porTarea.get('auditoria')), /llave de IA/);
});

test('dos corridas idénticas dejan UNA fila por (empresa, tarea), sin contadores que crezcan', async () => {
  // La plataforma admite corridas duplicadas y no reintenta. Un `+1` en cualquier columna contaría de
  // más con una entrega doble y de menos con una perdida, y nadie podría saber cuál pasó.
  await limpiar();
  const empresas: EmpresaParaBarrer[] = [
    { org: org(alfa, 'alfa'), acceso: { tipo: 'falta', que: 'sin_token' }, auditor: SIN_AUDITOR },
  ];
  await barrerTodo('0 12 * * *', empresas);
  const primera = await filas<{ n: string }>(admin, 'select count(*)::text as n from negocio.tareas_programadas');
  await barrerTodo('0 12 * * *', empresas);
  const segunda = await filas<{ n: string }>(admin, 'select count(*)::text as n from negocio.tareas_programadas');
  /* CUATRO por empresa —`contactos`, `mensajes`, `auditoria` y `citas`— y no cinco: `sonda` no es de
     ninguna empresa y no deja sello, que es una decisión escrita en el pie de `barrerTodo`. */
  assert.equal(primera[0]?.n, '4', 'cuatro tareas por empresa; `sonda` no deja sello');
  assert.equal(segunda[0]?.n, '4', 'la segunda corrida agregó filas: el upsert no está haciendo su trabajo');
});

test('el sello se puede leer con el contexto de SU empresa, y no se ve el de otra', async () => {
  // El aislamiento de la tabla nueva. Sin la llamada a `aplicar_aislamiento`, el cron de una empresa
  // vería —y podría pisar— los sellos de las demás.
  await limpiar();
  await barrerTodo('0 12 * * *', [
    { org: org(alfa, 'alfa'), acceso: { tipo: 'falta', que: 'sin_token' }, auditor: SIN_AUDITOR },
    { org: org(beta, 'beta'), acceso: { tipo: 'falta', que: 'sin_token' }, auditor: SIN_AUDITOR },
  ]);

  const deAlfa = await conOrganizacion(alfa, () =>
    datos().selectFrom('tareas_programadas').select(['tarea']).execute(),
  );
  const deBeta = await conOrganizacion(beta, () =>
    datos().selectFrom('tareas_programadas').select(['tarea']).execute(),
  );
  assert.equal(deAlfa.length, 4, 'alfa tiene que ver sus cuatro sellos');
  assert.equal(deBeta.length, 4);
  // Y el total desde el propietario es OCHO: cada una vio la mitad, no todo.
  const todos = await filas<{ n: string }>(admin, 'select count(*)::text as n from negocio.tareas_programadas');
  assert.equal(todos[0]?.n, '8', 'cada empresa tiene que ver solo sus cuatro sellos');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · EL ORDEN Y EL PRESUPUESTO
// ═══════════════════════════════════════════════════════════════════════════════

test('la empresa SIN sello va antes que la que ya tiene uno', async () => {
  // Es lo que convierte una corrida perdida en un problema que se arregla solo. Ordenar por nombre
  // haría que la última empresa de la lista fuera siempre la que se queda sin tiempo, para siempre.
  await limpiar();
  // `beta` ya fue barrida; `alfa` nunca.
  await barrerTodo('0 12 * * *', [{ org: org(beta, 'beta'), acceso: { tipo: 'falta', que: 'sin_token' }, auditor: SIN_AUDITOR }]);

  const r = await barrerTodo('0 12 * * *', [
    { org: org(beta, 'beta'), acceso: { tipo: 'falta', que: 'sin_token' }, auditor: SIN_AUDITOR },
    { org: org(alfa, 'alfa'), acceso: { tipo: 'falta', que: 'sin_token' }, auditor: SIN_AUDITOR },
  ]);
  // El primer renglón tiene que ser de `alfa`, que nunca se barrió, aunque venga segunda en la lista.
  assert.equal(r.renglones[0]?.slug, 'alfa', 'la que nunca se barrió tiene que ir primera');
});

test('con el presupuesto agotado, las que faltan salen como `sin_tiempo` y NO se intentan', async () => {
  // Con el reloj inyectado: sin la costura, comprobar esto exigiría una prueba de tres minutos.
  await limpiar();
  let llamadasAlReloj = 0;
  const reloj = () => {
    llamadasAlReloj += 1;
    // La primera lectura es el arranque; a partir de la segunda ya pasaron diez minutos.
    return llamadasAlReloj === 1 ? 0 : 600_000;
  };

  const r = await barrerTodo(
    '0 12 * * *',
    [
      { org: org(alfa, 'alfa'), acceso: CON_TOKEN, auditor: SIN_AUDITOR },
      { org: org(beta, 'beta'), acceso: CON_TOKEN, auditor: SIN_AUDITOR },
    ],
    reloj,
  );

  assert.ok(r.renglones.length > 0);
  assert.ok(
    r.renglones.every((x) => x.estado === 'sin_tiempo'),
    'con el presupuesto agotado no se tendría que haber intentado ninguna',
  );
  // Y quedó anotado: el sello distingue «no me alcanzó el tiempo» de «no tengo credencial».
  const s = await sellos();
  assert.ok(s.length > 0 && s.every((x) => x.estado === 'sin_tiempo'));
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5 · EL HORARIO DESCONOCIDO, POR EL CAMINO REAL
// ═══════════════════════════════════════════════════════════════════════════════

test('un horario desconocido corre TODO y la respuesta lo dice', async () => {
  await limpiar();
  process.env.CRON_SECRET = randomBytes(24).toString('hex');
  const r = await cron(
    new Request('https://ejemplo.test/api/cron', {
      headers: {
        authorization: `Bearer ${process.env.CRON_SECRET}`,
        'x-vercel-cron-schedule': '0 4 * * *',
      },
    }),
  );
  assert.equal(r.status, 200);
  const cuerpo = (await r.json()) as { horarioDesconocido?: boolean; tareas: string[] };
  assert.equal(cuerpo.horarioDesconocido, true);
  /* Contra `TAREAS` y no contra una lista escrita acá: es la única lista en tiempo de ejecución, y una
     copia divergiría diciendo que el respaldo está mal cuando está bien. */
  assert.deepEqual([...cuerpo.tareas].sort(), [...(TAREAS as readonly string[])].sort());
});

test('las empresas DESACTIVADAS no se barren', async () => {
  // El listado no filtra por `activa` a propósito —el panel tiene que mostrar una empresa apagada— así
  // que el filtro lo pone el cron. Sin él son diez llamadas al proveedor por una empresa a la que
  // nadie puede entrar.
  await limpiar();
  process.env.CRON_SECRET = randomBytes(24).toString('hex');
  await admin.query(`update identidad.organizaciones set activa = false where slug = 'beta'`);
  try {
    const r = await cron(
      new Request('https://ejemplo.test/api/cron', {
        headers: {
          authorization: `Bearer ${process.env.CRON_SECRET}`,
          'x-vercel-cron-schedule': '0 12 * * *',
        },
      }),
    );
    assert.equal(r.status, 200);
    const cuerpo = (await r.json()) as { renglones: { slug: string }[] };
    const slugs = new Set(cuerpo.renglones.map((x) => x.slug));
    assert.ok(!slugs.has('beta'), 'se barrió una empresa desactivada');
    // Y las dos de la sonda tampoco: no son empresas.
    assert.ok(!slugs.has('control-a') && !slugs.has('control-b'));
  } finally {
    await admin.query(`update identidad.organizaciones set activa = true where slug = 'beta'`);
  }
});
