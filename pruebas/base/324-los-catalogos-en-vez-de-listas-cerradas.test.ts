// LOS CATÁLOGOS EN VEZ DE LISTAS CERRADAS: proveedores, tipos de mapeo, catálogos mapeables y el destino. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (la `079`, la `081` y la `084`, editadas antes del primer despliegue; la `106`)
//
// Lo que el flujo hace crecer (un proveedor, un tipo de mapeo, un catálogo de destino) es una fila de catálogo con su
// clave foránea, no un CHECK cerrado: después de subir, agregarlo es un INSERT.
//
//   · un proveedor que no está en catalogo.proveedores no entra en los eventos, la bandeja ni las claves (23503), y
//     uno nuevo sí — mutación: volver al CHECK de nueve;
//   · el mapeo de una cuenta: un tipo o un catálogo de destino que no existen dan 23503; un destino que no existe en su
//     catálogo lo rechaza el disparador (23514), también al editar; la opción de una pregunta es «pregunta.opcion»;
//     `campo` es parte de la clave — mutaciones: sacar el disparador, sacar `campo` de la clave;
//   · el mismo disparador cuida el mapeo de un snapshot;
//   · el origen y el grano de un input, la vía de una respuesta y el origen de una clasificación (106) son claves de
//     catálogo: lo desconocido da 23503 y uno nuevo es un INSERT (un input de TikTok entra sin más) — mutación: volver
//     a los CHECK cerrados;
//   · el diccionario de inputs dice la verdad: cada pregunta, evento y columna que nombra existe, y cada evento lo ve la
//     IA en la trayectoria (para_la_trayectoria, o su sección) — mutaciones: una columna mal escrita en la semilla, un
//     tipo del diccionario sin para_la_trayectoria;
//   · el mapeo «calendario» apunta a catalogo.tipos_de_cita — mutación: destino_valido sin su rama.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';

let admin: Client;
let org: string;
let cuenta: string;

before(async () => {
  admin = await conectar('admin');
  const o = await unaFila<{ id: string; cuenta: string }>(
    admin,
    `select o.id, c.id as cuenta from identidad.organizaciones o join identidad.cuentas c on c.org_id = o.id and c.es_por_omision where o.slug = 'alfa'`,
  );
  assert.ok(o, 'falta el sembrado');
  org = o.id;
  cuenta = o.cuenta;
});

after(async () => {
  await cerrarTodo();
  await cerrarClientes();
});

/** Corre `trabajo` en una transacción del admin que se deshace siempre. */
async function deshaciendo(trabajo: () => Promise<void>): Promise<void> {
  await admin.query('begin');
  try {
    await trabajo();
  } finally {
    await admin.query('rollback');
  }
}

/** Espera que la sentencia falle con ese código, dentro de un savepoint. */
async function falla(codigo: string, texto: string, valores: unknown[], porque: string): Promise<void> {
  await admin.query('savepoint s');
  await assert.rejects(admin.query(texto, valores), (e: { code?: string }) => e.code === codigo, porque);
  await admin.query('rollback to savepoint s');
}

test('un proveedor que no está en el catálogo no entra en los eventos, la bandeja ni las claves; uno nuevo sí', async () => {
  await deshaciendo(async () => {
    const evento = `insert into negocio.eventos (org_id, cuenta_id, ocurrio_el, tipo, actor_tipo, fuente, id_externo)
                    values ($1, $2, now(), 'etiqueta_agregada', 'sistema', $3, $4)`;
    await falla('23503', evento, [org, cuenta, 'proveedor_324', 'e324'], 'entró un evento de un proveedor desconocido');
    await falla(
      '23503',
      `insert into ingesta.recibidos (fuente, tipo, id_externo, huella, payload) values ('proveedor_324', 'x', 'r324', repeat('a', 64), '{}')`,
      [],
      'entró a la bandeja un proveedor desconocido',
    );
    await falla(
      '23503',
      `insert into ingesta.claves (fuente, ambito, id_externo, recibido_id) values ('proveedor_324', 'loc', 'k324', gen_random_uuid())`,
      [],
      'entró una clave de un proveedor desconocido',
    );
    // Un proveedor nuevo es un INSERT en el catálogo, y desde ahí entra.
    await admin.query(`insert into catalogo.proveedores (clave, nombre) values ('proveedor_324', 'Proveedor 324')`);
    await admin.query(evento, [org, cuenta, 'proveedor_324', 'e324']);
  });
});

test('el mapeo de una cuenta: tipo y catálogo del catálogo, destino que exista (también al editar), y campo en la clave', async () => {
  await deshaciendo(async () => {
    const mapeo = `insert into negocio.mapeos_de_cuenta (org_id, cuenta_id, tipo, campo, valor_origen, destino_catalogo, destino_clave)
                   values ($1, $2, $3, $4, $5, $6, $7)`;
    await falla('23503', mapeo, [org, cuenta, 'tipo_324', '', 'x', 'etapas', 'lead'], 'entró un tipo de mapeo desconocido');
    await falla('23503', mapeo, [org, cuenta, 'etiqueta', '', 'x', 'catalogo_324', 'lead'], 'entró un catálogo de destino desconocido');
    await falla('23514', mapeo, [org, cuenta, 'etiqueta', '', 'x', 'salidas', 'no_existe_324'], 'entró un destino que no está en su catálogo');

    // Los destinos nuevos: una Salida, una entrada, un dolor común y la opción de una pregunta («pregunta.opcion»).
    await admin.query(mapeo, [org, cuenta, 'salida_de_oportunidad', 'contact.salida', 'Seguimiento 14d', 'salidas', 'seguimiento']);
    await admin.query(mapeo, [org, cuenta, 'etiqueta', '', 'comentarioig', 'entradas', 'ig_comentario']);
    await admin.query(mapeo, [org, cuenta, 'valor_de_campo', 'contact.freno', 'No me responden', 'dolores_comunes', 'velocidad_de_respuesta']);
    await admin.query(mapeo, [org, cuenta, 'opcion_de_campo', 'contact.decisor', 'Soy el dueño', 'opciones_de_pregunta', 'quien_decide.yo_dueno']);
    await falla('23514', mapeo, [org, cuenta, 'opcion_de_campo', 'contact.decisor', 'Otro', 'opciones_de_pregunta', 'quien_decide.no_existe'], 'entró una opción que no es de su pregunta');
    // Un calendario se traduce a un tipo de cita (catalogo.tipos_de_cita), y uno que no existe no entra.
    await admin.query(mapeo, [org, cuenta, 'calendario', '', 'cal-onboarding-324', 'tipos_de_cita', 'onboarding']);
    await falla('23514', mapeo, [org, cuenta, 'calendario', '', 'cal-otro-324', 'tipos_de_cita', 'upsell_324'], 'entró un tipo de cita que no existe');

    // El mismo valor en dos campos son dos filas (M1): «No en este momento» de dos preguntas no choca.
    await admin.query(mapeo, [org, cuenta, 'valor_de_campo', 'contact.inversion', 'No en este momento', 'opciones_de_pregunta', 'inversion_disponible.no_en_este_momento']);
    await admin.query(mapeo, [org, cuenta, 'valor_de_campo', 'contact.compromiso', 'No en este momento', 'opciones_de_pregunta', 'compromiso_video.no_puedo_comprometerme']);

    // Editar también pasa por el disparador.
    await falla(
      '23514',
      `update negocio.mapeos_de_cuenta set destino_clave = 'no_existe_324' where org_id = $1 and valor_origen = 'comentarioig'`,
      [org],
      'una edición dejó el mapeo apuntando a la nada',
    );
    // «ignorar» no lleva clave.
    await admin.query(mapeo, [org, cuenta, 'etiqueta', '', 'ruido_324', 'ignorar', null]);
    await falla('23514', mapeo, [org, cuenta, 'etiqueta', '', 'ruido_324b', 'ignorar', 'algo'], 'ignorar con una clave');
  });
});

test('el mismo disparador cuida el mapeo de un snapshot', async () => {
  await deshaciendo(async () => {
    const v = await unaFila<{ id: string }>(
      admin,
      `insert into catalogo.snapshot_versiones (snapshot, version, publicada_el) values ('s0_core', 'v324', current_date) returning id`,
    );
    const mapeo = `insert into catalogo.mapeos_de_snapshot (snapshot_version_id, tipo, campo, valor_origen, destino_catalogo, destino_clave)
                   values ($1, $2, $3, $4, $5, $6)`;
    await admin.query(mapeo, [v!.id, 'etapa_del_pipeline', 'Pipeline Maestro', 'Asistió', 'etapas', 'asistio']);
    await falla('23514', mapeo, [v!.id, 'etapa_del_pipeline', 'Pipeline Maestro', 'Perdido', 'etapas', 'perdido'], 'entró la etapa perdido, que ya no existe');
    await falla('23503', mapeo, [v!.id, 'tipo_324', '', 'x', 'etapas', 'lead'], 'entró un tipo de mapeo desconocido');
  });
});

test('un input de otro proveedor, un grano, una vía de obtención o un origen de clasificación nuevos son un INSERT', async () => {
  await deshaciendo(async () => {
    const input = `insert into catalogo.inputs_del_flujo (clave, nombre, etapa, origen, grano, donde_vive) values ($1, 'Prueba 324', 'lead', $2, $3, 'pendiente:negocio.no_existe_324')`;
    // Cada proveedor del catálogo ya es un origen: TikTok entra sin tocar nada.
    await admin.query(input, ['input_324_tiktok', 'tiktok', 'lead']);
    await falla('23503', input, ['input_324_x', 'origen_324', 'lead'], 'entró un input de un origen desconocido');
    await falla('23503', input, ['input_324_y', 'meta', 'mensaje'], 'entró un input de un grano desconocido');
    await admin.query(`insert into catalogo.granos (clave, nombre, descripcion) values ('mensaje', 'Mensaje', 'Prueba 324.')`);
    await admin.query(input, ['input_324_y', 'meta', 'mensaje']);

    const contacto = await unaFila<{ id: string }>(
      admin,
      `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre) values ($1, $2, 'c324', 'Contacto 324') returning id`,
      [org, cuenta],
    );
    const respuesta = `insert into negocio.respuestas_del_lead (org_id, cuenta_id, contacto_id, origen_clave, valor_texto, proveedor, obtenida_por, observada_el)
                       values ($1, $2, $3, 'campo_324', 'x', 'ghl', $4, now())`;
    await falla('23503', respuesta, [org, cuenta, contacto!.id, 'ia_setter'], 'entró una respuesta de una vía desconocida');
    await admin.query(`insert into catalogo.vias_de_obtencion (clave, nombre, descripcion) values ('ia_setter', 'IA Setter', 'Prueba 324.')`);
    await admin.query(respuesta, [org, cuenta, contacto!.id, 'ia_setter']);

    const clasificacion = `insert into negocio.clasificaciones (org_id, cuenta_id, contacto_id, cuadrante, origen) values ($1, $2, $3, 'valida', $4)`;
    await falla('23503', clasificacion, [org, cuenta, contacto!.id, 'formulario_324'], 'entró una clasificación de un origen desconocido');
    await admin.query(`insert into catalogo.origenes_de_clasificacion (clave, nombre, descripcion) values ('formulario_324', 'Formulario', 'Prueba 324.')`);
    await admin.query(clasificacion, [org, cuenta, contacto!.id, 'formulario_324']);
  });
});

test('el diccionario de inputs dice la verdad: cada pregunta, evento y columna que nombra existe', async () => {
  const inputs = await filas<{ clave: string; donde_vive: string }>(admin, `select clave, donde_vive from catalogo.inputs_del_flujo order by clave`);
  assert.ok(inputs.length >= 60, `el diccionario tiene ${inputs.length} inputs`);
  const malos: string[] = [];
  for (const { clave, donde_vive } of inputs) {
    const [tipo, resto] = [donde_vive.slice(0, donde_vive.indexOf(':')), donde_vive.slice(donde_vive.indexOf(':') + 1)];
    if (tipo === 'pregunta') {
      const f = await unaFila(admin, `select 1 from catalogo.preguntas_estandar where clave = $1`, [resto]);
      if (!f) malos.push(`${clave}: no existe la pregunta ${resto}`);
    } else if (tipo === 'evento') {
      const f = await unaFila<{ para_la_trayectoria: boolean }>(admin, `select bool_or(para_la_trayectoria) as para_la_trayectoria from catalogo.tipos_de_evento where clave = $1 having count(*) > 0`, [resto]);
      if (!f) malos.push(`${clave}: no existe el tipo de evento ${resto}`);
      // Lo que el flujo espera de un lead, la IA lo ve: en «eventos» de la trayectoria, o en su sección (etapas, salidas).
      else if (!f.para_la_trayectoria && !['etapa_cambiada', 'salida_marcada'].includes(resto)) {
        malos.push(`${clave}: la IA no ve el tipo de evento ${resto} (para_la_trayectoria = false)`);
      }
    } else if (tipo === 'columna') {
      const [esquema, tabla, columna] = resto.split('.');
      const f = await unaFila(
        admin,
        `select 1 from information_schema.columns where table_schema = $1 and table_name = $2 and column_name = $3`,
        [esquema, tabla, columna],
      );
      if (!f) malos.push(`${clave}: no existe la columna ${resto}`);
    } else if (tipo === 'pendiente') {
      // Lo que todavía no tiene tabla: que de verdad no la tenga (si ya existe, el diccionario tiene que apuntarle).
      const [esquema, tabla] = resto.split('.');
      const f = await unaFila(admin, `select 1 from information_schema.tables where table_schema = $1 and table_name = $2`, [esquema, tabla]);
      if (f) malos.push(`${clave}: ${resto} ya existe y sigue como pendiente`);
    }
  }
  assert.deepEqual(malos, []);
});
