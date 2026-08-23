// ADR-0003 — Hay dos organizaciones con datos distintos en desarrollo. INNEGOCIABLE.
//
// El sembrado de desarrollo: tres organizaciones, un usuario en cada una.
//
// NO ES UNA MIGRACIÓN, y no puede serlo. La cadena completa de eliminaciones:
//
//   1. `insert` en una migración como `migrador`, después de RLS → FALLA POR
//      POLÍTICA. Ninguna política nombra a `migrador`. Correcto, e inusable.
//   2. Darle una política de mantenimiento a `migrador` → PROHIBIDO por
//      EJECUCION § 3 ("no se crea política para el rol que migra").
//   3. `set role app_identidad` dentro de la migración → exige
//      `grant app_identidad to migrador`, PROHIBIDO por el 09 § 2, y lo agarra la
//      comprobación de `pg_has_role` del corredor.
//   4. Quitar el `force` temporalmente → EXPLÍCITAMENTE prohibido: "una migración
//      que falle a la mitad deja la tabla sin forzar… es el peor de los tres porque
//      no se ve".
//   5. Insertar ANTES del `enable row level security`, en una migración anterior →
//      funciona técnicamente y es 100 % "desde las migraciones". Y sigue estando
//      MAL, por una razón que no tiene nada que ver con RLS: LAS MIGRACIONES CORREN
//      TAMBIÉN EN PRODUCCIÓN. Crearía dos organizaciones cliente con credenciales
//      de desarrollo en el servidor administrado.
//   6. Un programa aparte que escribe por `conIdentidad()`. ← esto.
//
// Por eso "el entorno de pruebas se levanta solo desde las migraciones" se lee como
// "desde artefactos versionados, con un comando, sin paso manual ni volcado cargado
// a mano" — no como "cada sentencia vive en migraciones/". La lectura literal es
// insatisfacible sin violar EJECUCION § 3 o sembrar producción.
//
// Y que sean DOS FILAS DISTINTAS de PRUEBAS —la 2 sobre migraciones y la 3 sobre el
// sembrado— es la evidencia textual de que son dos pasos.

import { conIdentidad } from '../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { hashear } from '../../lib/datos/hash.ts';
import { exigirAnfitrionLocal } from '../../lib/datos/anfitrion.ts';
import { asegurarControlesDeSonda } from '../controles/sonda.ts';

// Contraseña de desarrollo, obviamente falsa y nunca de producción. El guard de
// abajo impide que este programa corra contra algo que no sea local.
//
// Se exporta para que la prueba del sembrado pueda comprobar que el hash guardado
// VERIFICA de verdad. Sin eso, la prueba solo comprobaría que la columna no es nula
// —y una columna no nula con un hash inservible es precisamente un éxito reportado
// que no ocurrió.
export const CLAVE_DESARROLLO = 'desarrollo-no-usar';

/** Los slugs sembrados. `principal` es la plataforma; las otras dos son clientes. */
export const SLUG_PRINCIPAL = 'principal';
export const SLUGS_CLIENTE = ['alfa', 'beta'] as const;

interface OrgSembrada {
  slug: string;
  nombre: string;
  zona_horaria: string;
  es_principal: boolean;
  usuario: {
    nombre: string;
    email: string;
    es_admin_principal: boolean;
    /** La clave del rol de sistema que se le asigna. Los roles los crea la migración 003. */
    rol: 'superadministrador' | 'administrador';
  };
}

// TRES organizaciones, no dos.
//
// El criterio literal pide dos y dos alcanza, pero el cierre de la Etapa 1 necesita
// que fallen las tres cosas: borrar al administrador fundador, desactivar la
// organización principal, y asignar el rol de plataforma a un usuario de un cliente.
// Eso exige una organización principal MÁS dos clientes. Con solo dos, una tendría
// que ser la principal, y las pruebas de aislamiento de la Etapa 2 compararían la
// principal contra un cliente — cuyo usuario es el superadministrador con
// `orgEfectiva` conmutable, el peor fixture posible para la prueba más importante del
// proyecto.
//
// "Las dos organizaciones sembradas" del criterio de cierre son `alfa` y `beta`.
//
// Y los datos son DISTINTOS entre sí, no dos copias: slug, nombre y ZONA HORARIA.
// La zona distinta es a propósito, para que los defectos de frontera de día del
// 08 § 12.2 se manifiesten al programar y no en el informe de un cliente.
const ORGS: readonly OrgSembrada[] = [
  {
    slug: 'principal',
    nombre: 'ARIA IA (plataforma)',
    zona_horaria: 'UTC',
    es_principal: true,
    usuario: {
      nombre: 'Fundadora',
      email: 'fundadora@principal.ejemplo',
      es_admin_principal: true,
      // El rol de plataforma. Solo puede existir en la organización principal: lo hace
      // cumplir el disparador `usuarios_roles_plataforma_acotado`.
      rol: 'superadministrador',
    },
  },
  {
    slug: 'alfa',
    nombre: 'Cliente Alfa',
    zona_horaria: 'America/Lima',
    es_principal: false,
    usuario: {
      nombre: 'Ana Alfa',
      email: 'ana@alfa.ejemplo',
      es_admin_principal: false,
      rol: 'administrador',
    },
  },
  {
    slug: 'beta',
    nombre: 'Cliente Beta',
    zona_horaria: 'America/Argentina/Buenos_Aires',
    es_principal: false,
    usuario: {
      nombre: 'Bruno Beta',
      email: 'bruno@beta.ejemplo',
      es_admin_principal: false,
      rol: 'administrador',
    },
  },
];

/**
 * Se niega a correr contra cualquier cosa que no sea la base local.
 *
 * El 10 § 4 es explícito: "nunca datos reales en desarrollo", y su recíproco importa
 * igual — nunca datos de desarrollo en algo que no sea desarrollo. Este programa
 * escribe usuarios con una contraseña conocida.
 *
 * La lista de anfitriones locales vive en `lib/datos/anfitrion.ts` desde que las
 * pruebas necesitaron el mismo guard. Tenía que ser UNA lista y no dos: la copia que
 * nadie mira es la que se queda vieja, y en este caso "vieja" significa que un
 * proveedor nuevo pasa por un lado y no por el otro.
 *
 * Lo que SÍ cambió al unificar: `ARIA_SEMBRADO_FORZADO=1` ya no puede apuntar esto a
 * un proveedor administrado. Servía para un anfitrión local con otro nombre, y ahora
 * es lo único para lo que sirve.
 */
function exigirBaseLocal(): void {
  const url = process.env.DATABASE_URL_IDENTIDAD;
  if (!url) throw new Error('DATABASE_URL_IDENTIDAD no está definida.');
  exigirAnfitrionLocal(url, {
    quien: 'el sembrado',
    porque: 'escribe usuarios con una contraseña de desarrollo conocida.',
    escotilla: 'ARIA_SEMBRADO_FORZADO',
  });
}

export interface ResumenSembrado {
  organizaciones: number;
  usuarios: number;
  asignaciones: number;
  control: number;
  creadas: string[];
}

/**
 * Las filas de negocio, POR BUCLE DE ORGANIZACIONES.
 *
 * No es una preferencia de estilo: `conIdentidad()` usa el rol `app_identidad`, que
 * **no tiene ningún permiso sobre el esquema `negocio`** — consultarlo lanza permiso
 * denegado. Así que estas filas solo se pueden escribir abriendo el contexto de cada
 * organización, una por una, exactamente como lo haría una petición normal.
 *
 * Y eso es lo que el `09` § 2 prescribe para TODO relleno de datos: "los rellenos se
 * escriben por bucle de organizaciones, con la variable puesta, igual que una tarea
 * programada". La alternativa —una política de mantenimiento para el rol que migra—
 * está prohibida por EJECUCION § 3.
 *
 * Con las políticas puestas y sin esto, una migración de datos INFORMA ÉXITO Y NO TOCA
 * UNA FILA: `update` y `delete` devuelven cero filas afectadas SIN ERROR. Queda marcada
 * como aplicada, el despliegue sigue, y la columna nueva queda vacía en producción.
 */
async function sembrarControl(orgs: ReadonlyArray<{ id: string; slug: string }>): Promise<string[]> {
  const creadas: string[] = [];
  for (const org of orgs) {
    await conOrganizacion(org.id, async () => {
      const db = datos();
      const existente = await db
        .selectFrom('control_aislamiento')
        .select(['id'])
        .where('marca', '=', `control-${org.slug}`)
        .executeTakeFirst();
      if (existente) return;

      // Nótese que NO se escribe `org_id`: la capa fina lo inyecta. Si el código de
      // negocio tuviera que acordarse de ponerlo, volveríamos a "acordate de filtrar".
      await db
        .insertInto('control_aislamiento')
        .values({ marca: `control-${org.slug}` })
        .execute();
      creadas.push(`control:${org.slug}`);
    });
  }
  return creadas;
}

/** Idempotente: correrlo diez veces deja el mismo resultado. */
export async function sembrar(): Promise<ResumenSembrado> {
  exigirBaseLocal();

  const identidad = await conIdentidad(async (db) => {
    const creadas: string[] = [];

    for (const org of ORGS) {
      let fila = await db
        .selectFrom('organizaciones')
        .select(['id'])
        .where('slug', '=', org.slug)
        .executeTakeFirst();

      if (!fila) {
        fila = await db
          .insertInto('organizaciones')
          .values({
            slug: org.slug,
            nombre: org.nombre,
            zona_horaria: org.zona_horaria,
            es_principal: org.es_principal,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        creadas.push(`organizacion:${org.slug}`);
      }

      let existente = await db
        .selectFrom('usuarios')
        .select(['id'])
        .where('email', '=', org.usuario.email)
        .executeTakeFirst();

      if (!existente) {
        existente = await db
          .insertInto('usuarios')
          .values({
            org_id: fila.id,
            nombre: org.usuario.nombre,
            email: org.usuario.email,
            // El formato guarda sus propios parámetros, así que endurecer el costo
            // más adelante no invalida estas filas.
            password_hash: hashear(CLAVE_DESARROLLO),
            es_admin_principal: org.usuario.es_admin_principal,
            // Nace debiendo cambiarla: es lo que hace un alta real.
            debe_cambiar_password: true,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        creadas.push(`usuario:${org.usuario.email}`);
      }

      // El rol de sistema. Los roles y el catálogo de capacidades los crea la
      // migración 003 —son datos de REFERENCIA, los necesita todo entorno—; la
      // ASIGNACIÓN es dato de entorno y va acá.
      //
      // Que el fundador tenga el rol de plataforma es lo que hace testeable el
      // disparador `usuarios_roles_fundador`: sin una asignación que proteger, esa
      // invariante no tiene sujeto.
      const rol = await db
        .selectFrom('roles')
        .select(['id'])
        .where('clave', '=', org.usuario.rol)
        .where('org_id', 'is', null)
        .executeTakeFirstOrThrow();

      const yaAsignado = await db
        .selectFrom('usuarios_roles')
        .select(['usuario_id'])
        .where('usuario_id', '=', existente.id)
        .where('rol_id', '=', rol.id)
        .executeTakeFirst();

      if (!yaAsignado) {
        await db
          .insertInto('usuarios_roles')
          .values({ usuario_id: existente.id, rol_id: rol.id })
          .execute();
        creadas.push(`rol:${org.usuario.rol}->${org.usuario.email}`);
      }
    }

    const orgs = await db
      .selectFrom('organizaciones')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .executeTakeFirstOrThrow();
    const usuarios = await db
      .selectFrom('usuarios')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .executeTakeFirstOrThrow();

    const asignaciones = await db
      .selectFrom('usuarios_roles')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .executeTakeFirstOrThrow();

    const filas = await db.selectFrom('organizaciones').select(['id', 'slug']).execute();

    return {
      organizaciones: Number(orgs.n),
      usuarios: Number(usuarios.n),
      asignaciones: Number(asignaciones.n),
      creadas,
      filas,
    };
  });

  // Y ahora el dominio del INQUILINO, en otra conexión y con la variable de transacción
  // puesta por organización. Entre los dos dominios NO hay atomicidad (09 § 6): son dos
  // transacciones distintas y una puede confirmar y la otra fallar. Es aceptable acá
  // porque el sembrado es idempotente y `db.mjs verificar` comprueba el EFECTO, no la
  // ausencia de error — y porque `reset` dice qué fases completó en vez de un "listo" liso.
  // Solo las TRES de desarrollo. Las dos de control de la sonda tienen su propia fila,
  // con su propia marca, y las crea `db/controles/sonda.ts` — pasarlas por acá les
  // pondría una segunda fila de control con otra marca, y la sonda cuenta filas.
  const slugsDeDesarrollo = new Set(ORGS.map((o) => o.slug));
  const creadasControl = await sembrarControl(
    identidad.filas.filter((f) => slugsDeDesarrollo.has(f.slug)),
  );

  // Y las dos de control de la sonda, por el mismo camino que en producción.
  //
  // El sembrado las crea ADEMÁS de las tres de desarrollo, en vez de reusar `alfa` y
  // `beta`: así la sonda mira lo MISMO en los dos entornos. Cuando `alfa` y `beta` eran
  // los controles, la sonda pasaba en desarrollo y avisaba gravedad máxima en
  // producción cada hora — la peor combinación posible, porque el entorno donde se
  // prueba era el único donde funcionaba.
  const controles = await asegurarControlesDeSonda();

  // El conteo se hace también por bucle, porque una sola consulta sin contexto no puede
  // ver `negocio` — que es precisamente la garantía que se está construyendo.
  //
  // Y se relee la lista de organizaciones: `identidad.filas` se leyó ANTES de que
  // `asegurarControlesDeSonda()` creara las dos de control, así que en la primera corrida
  // no las incluíría y el conteo reportado sería dos menos que la realidad. Un conteo que
  // miente en la primera corrida y acierta en la segunda es peor que ninguno.
  const todas = await conIdentidad(async (db) =>
    db.selectFrom('organizaciones').select(['id', 'slug']).execute(),
  );

  let control = 0;
  for (const org of todas) {
    control += await conOrganizacion(org.id, async () => {
      const f = await datos()
        .selectFrom('control_aislamiento')
        .select((eb) => eb.fn.countAll<string>().as('n'))
        .executeTakeFirstOrThrow();
      return Number(f.n);
    });
  }

  return {
    organizaciones: todas.length,
    usuarios: identidad.usuarios,
    asignaciones: identidad.asignaciones,
    control,
    creadas: [
      ...identidad.creadas,
      ...creadasControl,
      ...controles.organizaciones.map((s2) => `organizacion-de-control:${s2}`),
      ...controles.filas.map((s2) => `control-de-sonda:${s2}`),
    ],
  };
}
