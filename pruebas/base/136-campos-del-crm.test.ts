// Los campos personalizados de GoHighLevel en la pestaña Perfil. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE ARCHIVO MIDE, Y QUÉ DEFECTO MATA CADA COSA
//
// **1 · Un campo sin valor no se dibuja.** El `04` § 2: *«un campo vacío afirma algo falso»*. El
// filtro es el mismo `poner` que ya usaban el correo y la calificación — escribir uno nuevo para
// los campos del CRM habría dado dos filtros del mismo hecho, y el día que divergieran ganaría el
// que nadie mira.
//
// **2 · El valor numérico sobrevive.** «Puntaje | ICP» es `NUMERICAL` y GoHighLevel lo devuelve
// como el número `68`, no como texto. Declararlo `string` compila igual y llega a la pantalla como
// `"[object Object]"` en cuanto aparece un campo de casillas.
//
// **3 · Una carpeta sin grupo NO se muestra.** Es la política entera: la subcuenta tiene 24
// carpetas y se muestran cuatro. Si el filtro se invierte —mostrar todo salvo lo prohibido—, la
// atribución de campañas, los enlaces internos y una carpeta llamada «OLD FIELDS» aparecen en la
// pantalla del closer sin que nadie haga nada.
//
// **4 · Abrir la ficha no borra los campos.** `refrescarUnContacto` llama a `guardar()` con lo que
// devuelve `GET /contacts/{id}`. Es el defecto silencioso que este trabajo tuvo que descartar por
// medición antes de escribirse: los campos aparecerían al sincronizar y se irían al abrir la ficha,
// que es justo cuando alguien los mira, sin que nada fallara en ninguna parte.
//
// **5 · El `falta` dice CUÁL de las tres cosas pasa.** Sin catálogo, con catálogo y sin respuestas,
// y con campos. Colapsarlos manda a mirar el lugar equivocado — es lo que este trabajo acaba de
// arreglar en `FALTA.perfil`.
//
// **6 · Nada de esto cruza organizaciones.** El catálogo es por empresa y las etiquetas de sus
// campos son las preguntas de sus formularios: verlas desde otra cuenta sería filtrar su
// operación entera.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { conectar, cerrarTodo, filas } from '../apoyo/conexiones.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { sql } from 'kysely';
import { perfilDeLaFicha } from '../../lib/negocio/ficha.ts';
import {
  camposQueSeMuestran,
  hayCatalogo,
  refrescarCatalogoDeCampos,
} from '../../lib/negocio/camposDelCrm.ts';
import { camposDelContacto } from '../../lib/ghl/cliente.ts';
import { CARPETAS_DEL_PERFIL, ETIQUETAS_CORTAS } from '../../lib/ghl/contrato.ts';

let admin: Client;
let alfa: string;
let beta: string;

/* Identificadores inventados para la prueba, NO los de la subcuenta real. Los de verdad viven en
   `lib/ghl/contrato.ts` y esta prueba no los usa a propósito: si los usara, mediría que el contrato
   dice lo que dice —una prueba satisfecha por su propio dato— en vez de medir el mecanismo. */
const CARPETA_VISIBLE = 'carpeta-que-se-muestra';
const CARPETA_ESCONDIDA = 'carpeta-sin-grupo';
const CAMPO_TEXTO = 'campo-de-texto';
const CAMPO_NUMERO = 'campo-numerico';
const CAMPO_VACIO = 'campo-sin-respuesta';
const CAMPO_ESCONDIDO = 'campo-de-carpeta-escondida';

before(async () => {
  admin = await conectar('admin');
  const orgs = await filas<{ id: string; slug: string }>(
    admin,
    `select id, slug from identidad.organizaciones where slug in ('alfa','beta') order by slug`,
  );
  assert.equal(orgs.length, 2, 'hacen falta las dos organizaciones cliente del sembrado');
  alfa = orgs[0]!.id;
  beta = orgs[1]!.id;
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

/** Por el camino del INQUILINO: si hiciera falta el propietario, los permisos estarían mal. */
async function limpiar(): Promise<void> {
  for (const org of [alfa, beta]) {
    await conOrganizacion(org, async () => {
      await datos().deleteFrom('contactos').execute();
      // Los campos ANTES que las carpetas: la clave foránea va en ese sentido.
      await datos().deleteFrom('campos_del_crm').execute();
      await datos().deleteFrom('carpetas_del_crm').execute();
    });
  }
}

/** El catálogo de una organización: una carpeta que se muestra y otra que no. */
async function sembrarCatalogo(org: string): Promise<void> {
  await conOrganizacion(org, async () => {
    await datos()
      .insertInto('carpetas_del_crm')
      .values([
        { carpeta_id: CARPETA_VISIBLE, nombre: 'Calificación', grupo: 'calificacion' },
        // Sin grupo. Es la carpeta que el Perfil tiene que ignorar entera.
        { carpeta_id: CARPETA_ESCONDIDA, nombre: 'Atribución de campañas', grupo: null },
      ] as never)
      .execute();

    await datos()
      .insertInto('campos_del_crm')
      .values([
        {
          campo_id: CAMPO_TEXTO,
          nombre: '¿Cual es tu ticket promedio mensual por cliente?',
          etiqueta_corta: 'Ticket promedio',
          carpeta_id: CARPETA_VISIBLE,
          tipo: 'SINGLE_OPTIONS',
          posicion: 2,
        },
        {
          campo_id: CAMPO_NUMERO,
          nombre: 'Puntaje | ICP',
          carpeta_id: CARPETA_VISIBLE,
          tipo: 'NUMERICAL',
          // Posición 1.5: `numeric` y no entero, que es como llega de GoHighLevel.
          posicion: 1.5,
        },
        {
          campo_id: CAMPO_VACIO,
          nombre: 'Meta de facturación 6 meses',
          carpeta_id: CARPETA_VISIBLE,
          tipo: 'RADIO',
          posicion: 3,
        },
        {
          campo_id: CAMPO_ESCONDIDO,
          nombre: 'Last UTM Source',
          carpeta_id: CARPETA_ESCONDIDA,
          tipo: 'TEXT',
          posicion: 1,
        },
      ] as never)
      .execute();
  });
}

/** Un contacto con el mapa de campos ya guardado, como lo deja la sincronización. */
async function contactoCon(org: string, campos: Record<string, string>): Promise<string> {
  return conOrganizacion(org, async () => {
    const c = await datos()
      .insertInto('contactos')
      .values({
        ghl_contact_id: `ghl-${randomUUID()}`,
        nombre: 'Contacto con campos',
        territorio: 'closer',
        campos_del_crm: JSON.stringify(campos),
      } as never)
      .returning('id')
      .executeTakeFirstOrThrow();
    return c.id;
  });
}

// ─── 1 · La normalización, antes de que nada toque la base ───────────────────

test('un valor numérico llega como texto y uno vacío NO entra al mapa', () => {
  const mapa = camposDelContacto({
    id: 'x',
    customFields: [
      { id: CAMPO_NUMERO, value: 68 },
      { id: CAMPO_TEXTO, value: 'Más de $3,000' },
      // Las cuatro formas de «no contestó». GoHighLevel manda el campo igual.
      { id: 'vacio-texto', value: '' },
      { id: 'vacio-espacios', value: '   ' },
      { id: 'vacio-nulo', value: null },
      { id: 'vacio-ausente', value: undefined },
      // Un campo de casillas. No hay ninguno en las cuatro carpetas de hoy, y por eso mismo está
      // acá: el día que alguien agregue uno, esto ya está decidido y no sale `[object Object]`.
      { id: 'casillas', value: ['Sí', 'Tal vez'] },
      // Y un arreglo VACÍO, que no es lo mismo que un arreglo con cosas: no deja nada que mostrar.
      { id: 'casillas-vacias', value: [] },
      // Sin identificador utilizable no hay con qué nombrarlo después.
      { id: '', value: 'huérfano' },
    ],
  });

  assert.equal(
    mapa[CAMPO_NUMERO],
    '68',
    'el número se perdió: «Puntaje | ICP» es NUMERICAL y vuelve como número, no como texto',
  );
  assert.equal(mapa[CAMPO_TEXTO], 'Más de $3,000');
  assert.equal(mapa['casillas'], 'Sí, Tal vez');

  // Las claves vacías NO existen. No es lo mismo que existir con `""`: guardarlas obligaría al
  // Perfil a volver a filtrar lo mismo, y ese segundo filtro es el que un día se cae.
  for (const k of ['vacio-texto', 'vacio-espacios', 'vacio-nulo', 'vacio-ausente', 'casillas-vacias', '']) {
    assert.equal(k in mapa, false, `«${k}» quedó guardado y no tiene nada que mostrar`);
  }
  assert.equal(Object.keys(mapa).length, 3, 'entró algo que no debía');
});

// ─── 2 · El Perfil: qué se dibuja y qué no ───────────────────────────────────

test('el Perfil muestra los campos con valor de las carpetas elegidas, y nada más', async () => {
  await limpiar();
  await sembrarCatalogo(alfa);

  const id = await contactoCon(alfa, {
    [CAMPO_TEXTO]: 'Más de $3,000',
    [CAMPO_NUMERO]: '68',
    // El escondido SÍ tiene valor guardado: es lo que hace que la prueba mida el filtro por
    // carpeta y no la casualidad de que ese campo estuviera vacío.
    [CAMPO_ESCONDIDO]: 'fb_ad',
    // Y `CAMPO_VACIO` no está en el mapa, que es como la sincronización deja a un campo sin
    // contestar.
  });

  const perfil = await conOrganizacion(alfa, () => perfilDeLaFicha(id));
  const etiquetas = perfil.filas.map((f) => f.etiqueta);

  // La corta gana sobre el nombre de GoHighLevel: el `04` § 2 pide la etiqueta, no la pregunta.
  assert.ok(
    etiquetas.includes('Ticket promedio'),
    'no se usó la etiqueta corta; llegó la pregunta entera del formulario',
  );
  assert.equal(
    etiquetas.includes('¿Cual es tu ticket promedio mensual por cliente?'),
    false,
    'viajó el nombre largo de GoHighLevel teniendo etiqueta corta',
  );
  // Y cuando no hay corta, el nombre de GoHighLevel. Sin este respaldo la fila saldría en blanco.
  assert.ok(etiquetas.includes('Puntaje | ICP'), 'un campo sin etiqueta corta se quedó sin nombre');

  assert.equal(
    etiquetas.includes('Meta de facturación 6 meses'),
    false,
    'se dibujó un campo que el contacto no contestó: un campo vacío afirma algo falso',
  );
  assert.equal(
    etiquetas.includes('Last UTM Source'),
    false,
    'se coló un campo de una carpeta SIN grupo: el filtro por carpeta no está filtrando',
  );

  // Los dos que sí van, en el grupo de su carpeta y con su valor intacto.
  const puntaje = perfil.filas.find((f) => f.etiqueta === 'Puntaje | ICP');
  assert.equal(puntaje?.valor, '68');
  assert.equal(puntaje?.grupo, 'calificacion');

  /* Con campos del CRM, `falta` es NULO. Es la mitad que se rompe si alguien deja el texto viejo
     incondicional «todavía no se leen»: un perfil completo diciendo que no hay nada. */
  assert.equal(perfil.falta, null, 'el perfil tiene campos del CRM y aun así dice que falta algo');
});

// ─── 3 · Las tres razones de que no haya campos, que NO son la misma ─────────

test('el `falta` distingue «no hay catálogo» de «este contacto no contestó»', async () => {
  await limpiar();

  // (a) Sin catálogo. Es un estado del SISTEMA: nadie leyó los campos de GoHighLevel todavía.
  const sinNada = await contactoCon(alfa, {});
  const a = await conOrganizacion(alfa, () => perfilDeLaFicha(sinNada));
  assert.notEqual(a.falta, null, 'sin catálogo el perfil no dice por qué solo hay datos básicos');
  assert.match(a.falta ?? '', /catálogo/i);
  assert.equal(await conOrganizacion(alfa, () => hayCatalogo()), false);

  // (b) Con catálogo y sin respuestas. Es un hecho sobre ESTE CONTACTO, y manda a mirar otro lado.
  await sembrarCatalogo(alfa);
  const b = await conOrganizacion(alfa, () => perfilDeLaFicha(sinNada));
  assert.notEqual(b.falta, null);
  assert.notEqual(
    b.falta,
    a.falta,
    'las dos situaciones devuelven el mismo texto: una de las dos manda a mirar el lugar equivocado',
  );
  assert.match(b.falta ?? '', /formulario/i);
  assert.equal(await conOrganizacion(alfa, () => hayCatalogo()), true);

  /* (c) Con catálogo Y con un campo contestado, no falta nada.
     Este caso mide algo que `mostrables.length` no puede: el catálogo ofrece tres campos en las dos
     situaciones, y lo que cambia es cuántos ENTRARON. Contar lo ofrecido habría devuelto `null` en
     el caso (b) y dejado esa pantalla sin explicación. */
  const conAlgo = await contactoCon(alfa, { [CAMPO_TEXTO]: 'Más de $3,000' });
  const c = await conOrganizacion(alfa, () => perfilDeLaFicha(conAlgo));
  assert.equal(c.falta, null);
});

// ─── 4 · El orden, que es lo que mantiene juntas las preguntas de un formulario ─

test('los campos salen ordenados por carpeta y por su posición dentro de ella', async () => {
  await limpiar();
  await sembrarCatalogo(alfa);

  const mostrables = await conOrganizacion(alfa, () => camposQueSeMuestran());
  const ids = mostrables.map((m) => m.campoId);

  assert.deepEqual(
    ids,
    [CAMPO_NUMERO, CAMPO_TEXTO, CAMPO_VACIO],
    'el orden no es el de `posicion`: las preguntas de un mismo formulario salen mezcladas',
  );
  /* `posicion` es `numeric` y llega fraccionario —se midió `12.5` en la subcuenta real—. El campo
     numérico está en la 1.5 justamente para que un `integer` lo truncara a 1 y el orden siguiera
     saliendo bien por casualidad: acá la 1.5 tiene que ordenar ANTES que la 2. */
  assert.equal(
    mostrables.length,
    3,
    'entró un campo de la carpeta sin grupo, o se perdió uno de la carpeta elegida',
  );
});

// ─── 5 · La lectura del catálogo: lo que cuesta y lo que no pisa ─────────────

test('el catálogo se lee una vez, aplica el contrato, y no vuelve a pedirse mientras esté fresco', async () => {
  await limpiar();

  const elegida = CARPETAS_DEL_PERFIL[0]!;
  const OTRA = 'carpeta-que-el-contrato-no-lista';
  /* Un campo que el contrato SÍ tiene acortado. No es «la prueba usa su propio dato»: lo que se
     mide es que el mecanismo consulte esa lista, y para eso el identificador tiene que estar en
     ella. Que el texto sea el correcto lo decide quien lo escribió, no esta prueba. */
  const [CAMPO_ACORTADO, ETIQUETA_ESPERADA] = Object.entries(ETIQUETAS_CORTAS)[0]!;
  let llamadasDeCatalogo = 0;
  let llamadasDeCarpeta = 0;

  const original = globalThis.fetch;
  globalThis.fetch = (async (entrada: RequestInfo | URL) => {
    const url = typeof entrada === 'string' ? entrada : String((entrada as Request).url ?? entrada);
    // El nombre de UNA carpeta: `…/customFields/{id}`. Va primero porque el otro patrón lo contiene.
    const m = /\/customFields\/([^/?]+)$/.exec(url);
    if (m) {
      llamadasDeCarpeta += 1;
      return new Response(JSON.stringify({ customField: { name: `Nombre de ${m[1]}` } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (/\/customFields$/.test(url)) {
      llamadasDeCatalogo += 1;
      return new Response(
        JSON.stringify({
          customFields: [
            {
              id: CAMPO_ACORTADO,
              name: '¿Cual es tu ticket promedio mensual por cliente?',
              parentId: elegida.id,
              dataType: 'SINGLE_OPTIONS',
              position: 2,
              documentType: 'field',
            },
            {
              id: CAMPO_ESCONDIDO,
              name: 'Last UTM Source',
              parentId: OTRA,
              dataType: 'TEXT',
              position: 1,
              documentType: 'field',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof globalThis.fetch;

  try {
    const primera = await conOrganizacion(alfa, () =>
      refrescarCatalogoDeCampos({ token: 'x', locationId: 'loc' }),
    );
    assert.equal(primera?.saltado, false);
    assert.equal(primera?.campos, 2);
    assert.equal(primera?.carpetasNuevas, 2);
    // 1 por el catálogo + 1 por cada carpeta cuyo nombre no se sabía.
    assert.equal(primera?.llamadas, 3, 'la cuenta de llamadas no coincide con las que se hicieron');
    assert.equal(llamadasDeCatalogo, 1);
    assert.equal(llamadasDeCarpeta, 2);

    /* El contrato decide qué se muestra, y solo eso: la carpeta que lista nace con grupo, la otra
       nace en nulo. Si la asignación fuera al revés —o si no existiera— la subcuenta entera
       aparecería en el Perfil, que son 24 carpetas incluida una llamada «OLD FIELDS». */
    const mostrables = await conOrganizacion(alfa, () => camposQueSeMuestran());
    assert.deepEqual(
      mostrables.map((m) => m.campoId),
      [CAMPO_ACORTADO],
      'el contrato no se aplicó al descubrir la carpeta, o se aplicó a la que no corresponde',
    );
    assert.equal(mostrables[0]!.grupo, elegida.grupo);

    // Y la etiqueta corta del contrato entró: el nombre de GoHighLevel es la pregunta entera.
    assert.equal(
      mostrables[0]!.etiqueta,
      ETIQUETA_ESPERADA,
      'llegó la pregunta entera de GoHighLevel: el contrato de etiquetas cortas no se aplicó',
    );

    // ── Fresco: no se vuelve a pedir NADA ──────────────────────────────────
    const segunda = await conOrganizacion(alfa, () =>
      refrescarCatalogoDeCampos({ token: 'x', locationId: 'loc' }),
    );
    assert.equal(segunda?.saltado, true);
    assert.equal(segunda?.llamadas, 0);
    assert.equal(
      llamadasDeCatalogo,
      1,
      'el catálogo se volvió a pedir estando fresco: una llamada por corrida, para siempre',
    );

    // ── Envejecido: se relee, y lo NUESTRO sobrevive ───────────────────────
    await conOrganizacion(alfa, async () => {
      await sql`update negocio.campos_del_crm set visto_el = now() - interval '2 days'`.execute(datos());
      // Dos decisiones tomadas «en producción»: esconder la carpeta elegida y renombrar un campo.
      await datos().updateTable('carpetas_del_crm').set({ grupo: null } as never).where('carpeta_id', '=', elegida.id).execute();
      await datos().updateTable('campos_del_crm').set({ etiqueta_corta: 'Escrito a mano' } as never).where('campo_id', '=', CAMPO_ACORTADO).execute();
    });

    const tercera = await conOrganizacion(alfa, () =>
      refrescarCatalogoDeCampos({ token: 'x', locationId: 'loc' }),
    );
    assert.equal(tercera?.saltado, false, 'el tope de frescura no soltó nunca: el catálogo se congela');
    assert.equal(tercera?.carpetasNuevas, 0, 'la relectura duplicó carpetas que ya existían');
    assert.equal(llamadasDeCarpeta, 2, 'volvió a pedir el nombre de una carpeta que ya lo tenía');

    const despues = await conOrganizacion(alfa, async () =>
      datos()
        .selectFrom('campos_del_crm')
        .select('etiqueta_corta')
        .where('campo_id', '=', CAMPO_ACORTADO)
        .executeTakeFirst(),
    );
    assert.equal(
      despues?.etiqueta_corta,
      'Escrito a mano',
      'la relectura pisó la etiqueta escrita a mano: una corrección en producción dura horas',
    );
    assert.deepEqual(
      await conOrganizacion(alfa, () => camposQueSeMuestran()),
      [],
      'la relectura volvió a encender una carpeta que alguien había escondido a propósito',
    );
  } finally {
    globalThis.fetch = original;
  }
});

// ─── 6 · El aislamiento ──────────────────────────────────────────────────────

test('el catálogo de una organización no se ve desde la otra', async () => {
  await limpiar();
  await sembrarCatalogo(alfa);

  // Beta no sembró nada. Si viera algo, estaría viendo las preguntas de los formularios de alfa.
  const deBeta = await conOrganizacion(beta, () => camposQueSeMuestran());
  assert.deepEqual(deBeta, [], 'beta ve el catálogo de alfa');
  assert.equal(await conOrganizacion(beta, () => hayCatalogo()), false);

  /* Y un contacto de beta con el MISMO identificador de campo guardado no dibuja nada: el mapa del
     contacto solo se sabe leer con el catálogo de su propia organización. La mezcla que esto
     impide es la peor de todas porque parece correcta — el contacto de beta con las preguntas de
     los formularios de alfa.

     ── LO QUE ESTA PRUEBA **NO** PUEDE MEDIR, Y CONVIENE SABERLO ──────────
     Medido con el arnés de mutación: sacar `org_id` del `onRef` del `join` en
     `camposQueSeMuestran` **no la hace fallar**. Y es correcto que no falle: quien aísla acá es la
     política de fila, que ya dejó las dos tablas reducidas a la organización del contexto antes de
     que el `join` las mire. El `org_id` en el `onRef` acompaña a la clave foránea compuesta —que sí
     es estructural y `aplicar_aislamiento` exige— pero no es lo que sostiene esta propiedad.
     Decirlo importa: sin esto, alguien lee la aserción de abajo y cree que el `join` está cubierto. */
  const id = await contactoCon(beta, { [CAMPO_TEXTO]: 'Más de $3,000' });
  const perfil = await conOrganizacion(beta, () => perfilDeLaFicha(id));
  assert.equal(
    perfil.filas.some((f) => f.etiqueta === 'Ticket promedio'),
    false,
    'un contacto de beta se dibujó con una etiqueta del catálogo de alfa',
  );
  assert.match(perfil.falta ?? '', /catálogo/i, 'beta no tiene catálogo y el perfil no lo dice');
});
