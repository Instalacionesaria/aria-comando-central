// Las dos empresas sintéticas con las que se prueban y se evalúan los agentes de IA.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ ES Y POR QUÉ ASÍ
//
// `docs/OTROS/agentes/07-LA-EVALUACION.md`, AG-100. El negocio real está detenido —sin gasto, sin ventas—,
// así que producción no sirve para probar casi ninguna regla de los agentes. Esto arma, SÓLO EN LOCAL, una
// empresa con datos que dispara cada caso del conjunto de preguntas (`AG-102`) y una vacía, sin datos ni
// llave.
//
// ── UN CONSTRUCTOR, DOS USOS ──────────────────────────────────────────────────
//
// El mismo código siembra para la evaluación real (`scripts/evaluar-agentes.mjs`) y arma la empresa de las
// pruebas de base. Las pruebas NO dependen de que alguien haya corrido el sembrado: cada una se arma la suya
// con un prefijo propio y la quita al terminar.
//
// ── NO QUEDA INSTALADO ───────────────────────────────────────────────────────
//
// No es parte de `db:sembrar`. La prueba `11-sembrado` exige exactamente las cinco empresas y las tres
// personas del sembrado de desarrollo, y varias pruebas vacían `negocio.contactos` entero. Así que quien
// siembra, quita: `sembrarCasosDeLosAgentes` empieza quitando lo de una corrida anterior, y la evaluación
// quita al terminar.
//
// ── ESCRIBE COMO LA APLICACIÓN, BORRA COMO EL ADMINISTRADOR ──────────────────
//
// Las filas entran por `conIdentidad` y `conOrganizacion`, con las mismas políticas que una petición: si una
// columna nueva rompe el sembrado, lo rompe igual que a la aplicación. Para borrar no alcanza: cada rol de
// la aplicación ve un solo dominio —`app_identidad` no tiene ningún permiso sobre `negocio`, y el inquilino
// sólo lee `identidad.organizaciones`—, y quitar una empresa es vaciar los dos, en el orden que pidan las
// claves foráneas, con sentencias que pueden fallar y reintentarse sin perder una transacción. El borrado va
// por `DATABASE_URL_ADMIN`, como `scripts/db.mjs arranque`, y sólo contra un anfitrión local.
//
// Todo lo sembrado es inventado: dominios `.test`, nombres de prueba, identificadores con el prefijo.
// ═══════════════════════════════════════════════════════════════════════════════

import pg from 'pg';
import { sql } from 'kysely';
import { conIdentidad } from '../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { exigirAnfitrionLocal } from '../../lib/datos/anfitrion.ts';
import { hashear } from '../../lib/datos/hash.ts';
import { CLAVE_DESARROLLO } from './organizaciones.ts';

/** El prefijo de la evaluación. Cada prueba usa el suyo, para no pisar una evaluación en curso. */
export const PREFIJO_DE_LA_EVALUACION = 'agentes-';

/** La zona de las dos empresas: la de la mayoría de los clientes, y con un día que no es el de UTC. */
export const ZONA_DE_LOS_CASOS = 'America/Lima';

/**
 * Las cifras que se siembran, las mismas que `07-LA-EVALUACION.md` pone en su tabla. `hace` es en días
 * locales de la empresa, desde hoy (`hace 0`). Las pruebas comparan contra esto, no contra números escritos
 * dos veces.
 */
export const CASOS = {
  /** Gasto por día de cada campaña, repartido en partes iguales entre sus cuatro anuncios. */
  campanas: [
    {
      id: '120200000000000001',
      nombre: 'Clínicas - formulario',
      funnel: 'leadform',
      estado: 'ACTIVE',
      // La que sube su costo por contacto: 50 por día de hace 30 a hace 43 y 70 de hace 16 a hace 29, con
      // 14 contactos en cada ventana: de 50 a 70 por contacto, un 40 % más.
      gastoPorDia: (hace: number) => (hace >= 16 && hace <= 29 ? 70 : hace >= 30 && hace <= 60 ? 50 : null),
    },
    {
      id: '120200000000000002',
      nombre: 'Webinar - agenda',
      funnel: 'booking',
      estado: 'ACTIVE',
      // La que concentra el gasto: 182 por día de hace 16 a hace 50, 6.370 de 9.800 en los 60 días (65 %).
      gastoPorDia: (hace: number) => (hace >= 16 && hace <= 50 ? 182 : null),
    },
    {
      id: '120200000000000003',
      nombre: 'Remarketing - perfil',
      funnel: 'profile',
      estado: 'PAUSED',
      gastoPorDia: (hace: number) => (hace >= 16 && hace <= 60 ? 20 : null),
    },
  ],
  /** Días con métricas: de hace 1 a hace 60, todos cerrados. De hace 1 a hace 15, sin entrega. */
  diasDeMetricas: 60,
  ultimoDiaConGasto: 16,
  /**
   * Los contactos por campaña y por tramo de días. Los 120 de los últimos 30 días (hace 0 a hace 29) son
   * 98 con campaña (82 %) y 22 sin. Los de hace 30 a hace 43 son la ventana anterior del costo por contacto.
   * Los de hace 44 a hace 60 están para que la historia de contactos empiece con la de gasto: sin ellos, la
   * ventana anterior de 30 días no compara (`sin_historia`, `coberturaDeLaVentana`).
   */
  contactos: [
    { campana: 0, desde: 44, hasta: 60, cuantos: 17 },
    { campana: 0, desde: 30, hasta: 43, cuantos: 14 },
    { campana: 1, desde: 30, hasta: 43, cuantos: 30 },
    { campana: 2, desde: 30, hasta: 43, cuantos: 10 },
    { campana: 0, desde: 16, hasta: 29, cuantos: 14 },
    { campana: 1, desde: 16, hasta: 29, cuantos: 42 },
    { campana: 2, desde: 16, hasta: 29, cuantos: 16 },
    { campana: 1, desde: 15, hasta: 15, cuantos: 2 },
    { campana: 1, desde: 0, hasta: 14, cuantos: 18 },
    { campana: 0, desde: 0, hasta: 14, cuantos: 3 },
    { campana: 2, desde: 0, hasta: 14, cuantos: 3 },
    { campana: null, desde: 0, hasta: 14, cuantos: 22 },
  ],
  /** Citas pasadas, todas con calendario. Las tres primeras tienen resultado; ninguno es venta. */
  citasPasadas: 46,
  resultados: ['no_interesa', 'seguimiento', 'no_show'] as const,
  /** Llamadas de venta: 38 analizadas, 3 «no es», 2 pendientes y 1 fallida. 28 con el correo de un contacto. */
  llamadas: { total: 44, analizadas: 38, noEs: 3, pendientes: 2, fallidas: 1, vinculables: 28 },
  /** La objeción «precio»: 9 veces en las analizadas de hace 1 a hace 14, 3 en las de hace 15 a hace 28. */
  precio: { ultimos14: 9, anteriores14: 3 },
  /** Hallazgos abiertos del auditor: un rojo y dos amarillos por agente del CRM. */
  hallazgos: [
    { agente: 'chat_post_agenda', severidad: 'rojo', patron: 'promete_descuento', categoria: 'comportamiento' },
    { agente: 'chat_post_agenda', severidad: 'amarillo', patron: 'no_confirma_la_hora', categoria: 'comportamiento' },
    { agente: 'chat_post_agenda', severidad: 'amarillo', patron: 'precio_desactualizado', categoria: 'base_conocimiento' },
    { agente: 'chat_pre_agenda', severidad: 'rojo', patron: 'salta_la_calificacion', categoria: 'comportamiento' },
    { agente: 'chat_pre_agenda', severidad: 'amarillo', patron: 'no_pide_el_rubro', categoria: 'informacion_adicional' },
    { agente: 'chat_pre_agenda', severidad: 'amarillo', patron: 'horario_de_atencion', categoria: 'base_conocimiento' },
  ],
  analisisDelEspia: 2,
} as const;

/** Los identificadores del CRM de los dos closers: uno vinculado a su usuario y otro sin vincular. */
const CRM_DEL_CLOSER_UNO = 'crm-closer-uno';
const CRM_DE_OTRO = 'crm-otro-closer';

export interface PersonasDeLaEmpresa {
  admin: string;
  closerUno: string;
  closerDos: string;
  setter: string;
}

export interface EmpresasDeLosAgentes {
  conDatos: string;
  vacia: string;
  personas: PersonasDeLaEmpresa;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LA GUARDA
// ═══════════════════════════════════════════════════════════════════════════════

/** Se niega fuera de la base local: escribe personas con la contraseña de desarrollo. */
export function exigirBaseLocalParaLosCasos(): void {
  for (const variable of ['DATABASE_URL_IDENTIDAD', 'DATABASE_URL_ADMIN'] as const) {
    const url = process.env[variable];
    if (!url) throw new Error(`${variable} no está definida.`);
    exigirAnfitrionLocal(url, {
      quien: 'el sembrado de los agentes',
      porque: 'escribe empresas y personas sintéticas, y borra todo lo de esas empresas.',
      escotilla: 'ARIA_SEMBRADO_FORZADO',
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUITAR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Borra las empresas con ese prefijo y todo lo suyo, en las dos bases de datos lógicas.
 *
 * Recorre TODAS las tablas con `org_id` y no una lista escrita a mano: las etapas siguientes suman tablas
 * (las conversaciones del cerebro, las señales) y una lista se quedaría vieja sin que nada fallara hasta
 * que la empresa no se pudiera borrar. Una clave foránea que frena se resuelve con otra pasada.
 */
export async function quitarEmpresasDeLosAgentes(prefijo: string): Promise<number> {
  exigirBaseLocalParaLosCasos();
  const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL_ADMIN });
  await cliente.connect();
  try {
    const orgs = (
      await cliente.query<{ id: string }>('select id from identidad.organizaciones where slug like $1', [`${prefijo}%`])
    ).rows.map((f) => f.id);
    if (orgs.length === 0) return 0;
    const tablas = (
      await cliente.query<{ t: string }>(
        `select format('%I.%I', table_schema, table_name) as t from information_schema.columns
          where column_name = 'org_id' and table_schema in ('negocio', 'identidad')
            and table_name <> 'organizaciones'
            and (table_schema, table_name) in (select table_schema, table_name from information_schema.tables where table_type = 'BASE TABLE')`,
      )
    ).rows
      .map((f) => f.t)
      // `negocio` antes que `identidad`: las personas son lo último que se puede borrar.
      .sort((a, b) => Number(a.startsWith('identidad.')) - Number(b.startsWith('identidad.')));
    let pendientes = tablas;
    for (let pasada = 0; pendientes.length > 0 && pasada < 10; pasada++) {
      const frenadas: string[] = [];
      for (const t of pendientes) {
        try {
          await cliente.query(`delete from ${t} where org_id = any($1)`, [orgs]);
        } catch (e) {
          /* `23503`: otra tabla todavía apunta a estas filas. `23502`: una clave compuesta `on delete set
             null` sin lista de columnas (`resultados.cita_id`, de la `049`) quiso anular también `org_id`
             de quien apunta. Las dos se arreglan borrando primero a quien apunta: otra pasada. */
          const codigo = (e as { code?: string }).code;
          if (codigo === '23503' || codigo === '23502') frenadas.push(t);
          else throw e;
        }
      }
      pendientes = frenadas;
    }
    if (pendientes.length > 0) throw new Error(`no se pudieron vaciar: ${pendientes.join(', ')}`);
    await cliente.query('delete from identidad.organizaciones where id = any($1)', [orgs]);
    return orgs.length;
  } finally {
    await cliente.end();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREAR LAS EMPRESAS Y LAS PERSONAS
// ═══════════════════════════════════════════════════════════════════════════════

/** Las dos empresas y las cuatro personas de la que tiene datos, por la conexión de identidad. */
async function crearEmpresas(prefijo: string): Promise<EmpresasDeLosAgentes> {
  const correo = (quien: string) => `${quien}@${prefijo.replace(/[^a-z0-9]/g, '')}.test`;
  return conIdentidad(async (db) => {
    const empresa = async (sufijo: string, nombre: string) =>
      (
        await db
          .insertInto('organizaciones')
          .values({ slug: `${prefijo}${sufijo}`, nombre, zona_horaria: ZONA_DE_LOS_CASOS, es_principal: false })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    const conDatos = await empresa('con-datos', 'Empresa sintética con datos');
    const vacia = await empresa('vacia', 'Empresa sintética vacía');

    const rol = async (clave: string) =>
      (await db.selectFrom('roles').select('id').where('clave', '=', clave).where('org_id', 'is', null).executeTakeFirstOrThrow()).id;
    const administrador = await rol('administrador');
    const usuario = await rol('usuario');
    const hash = hashear(CLAVE_DESARROLLO);

    const persona = async (nombre: string, quien: string, rolId: string, secciones: string[]) => {
      const id = (
        await db
          .insertInto('usuarios')
          .values({ org_id: conDatos, nombre, email: correo(quien), password_hash: hash, es_admin_principal: false })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
      await db.insertInto('usuarios_roles').values({ usuario_id: id, rol_id: rolId }).execute();
      for (const seccion of secciones) {
        await db.insertInto('usuarios_secciones').values({ usuario_id: id, seccion } as never).execute();
      }
      return id;
    };
    return {
      conDatos,
      vacia,
      personas: {
        admin: await persona('Admin sintético', 'admin', administrador, []),
        closerUno: await persona('Closer Uno', 'closer-uno', usuario, ['closer']),
        closerDos: await persona('Closer Dos', 'closer-dos', usuario, ['closer']),
        setter: await persona('Setter Uno', 'setter-uno', usuario, ['setter']),
      },
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOS DATOS DE LA EMPRESA
// ═══════════════════════════════════════════════════════════════════════════════

/** El día local `hace` días antes de hoy, como fecha de la base. */
const fechaHace = (hace: number) => sql<string>`((now() at time zone ${ZONA_DE_LOS_CASOS})::date - ${hace}::int)`;
/** Ese día a una hora local, como instante. */
const momentoHace = (hace: number, hora: string) =>
  sql<Date>`((((now() at time zone ${ZONA_DE_LOS_CASOS})::date - ${hace}::int) + ${hora}::time) at time zone ${ZONA_DE_LOS_CASOS})`;

/** Reparte `cuantos` en los días de `desde` a `hasta`, en orden y de a uno. */
function repartir(desde: number, hasta: number, cuantos: number): number[] {
  const dias = hasta - desde + 1;
  return Array.from({ length: cuantos }, (_, i) => desde + (i % dias));
}

/**
 * Llena la empresa con datos. Supone una empresa recién creada: no borra nada. Las personas tienen que ser
 * de esa empresa (`crearEmpresas`).
 */
export async function construirEmpresaConDatos(org: string, personas: PersonasDeLaEmpresa, prefijo: string): Promise<void> {
  const id = (tipo: string, n: number) => `${prefijo}${tipo}-${String(n).padStart(3, '0')}`;
  const correoDe = (n: number) => `lead-${n}@contactos-${prefijo.replace(/[^a-z0-9]/g, '')}.test`;

  // ── Acquisition: campañas, anuncios y sesenta días de métricas ─────────────
  const anuncios: { id: string; campana: number; nombre: string; conjunto: string }[] = [];
  await conOrganizacion(org, async () => {
    for (const [i, c] of CASOS.campanas.entries()) {
      await datos().insertInto('campanas').values({ meta_campana_id: c.id, nombre: c.nombre, estado: c.estado } as never).execute();
      await datos().insertInto('funnels_de_campana').values({ meta_campana_id: c.id, funnel: c.funnel } as never).execute();
      for (let a = 1; a <= 4; a++) {
        const anuncio = { id: `${c.id.slice(0, 14)}${i + 1}00${a}`, campana: i, nombre: `${c.nombre} · anuncio ${a}`, conjunto: `${c.id}9` };
        anuncios.push(anuncio);
        await datos()
          .insertInto('anuncios')
          .values({ meta_anuncio_id: anuncio.id, meta_campana_id: c.id, meta_conjunto_id: anuncio.conjunto, nombre: anuncio.nombre } as never)
          .execute();
      }
    }
    const filas = [];
    for (const anuncio of anuncios) {
      for (let hace = 1; hace <= CASOS.diasDeMetricas; hace++) {
        const porDia = CASOS.campanas[anuncio.campana]!.gastoPorDia(hace);
        // Sin entrega, el proveedor omite las métricas enteras: nulas, no cero. La fila está igual, y es lo
        // que hace que el día cuente como cerrado.
        const gasto = porDia === null ? null : porDia / 4;
        filas.push({
          meta_anuncio_id: anuncio.id,
          fecha: fechaHace(hace),
          gasto,
          impresiones: gasto === null ? null : Math.round(gasto * 40),
          clics: gasto === null ? null : Math.round(gasto / 2),
          acciones: gasto === null ? null : JSON.stringify({ linkClick: Math.round(gasto / 2) }),
        });
      }
    }
    await datos().insertInto('metricas_de_anuncio').values(filas as never).execute();
  });

  // ── Los contactos, con su atribución ──────────────────────────────────────
  const contactos: { id: string; n: number; hace: number; campana: number | null }[] = [];
  await conOrganizacion(org, async () => {
    let n = 0;
    for (const tramo of CASOS.contactos) {
      for (const hace of repartir(tramo.desde, tramo.hasta, tramo.cuantos)) {
        n += 1;
        const c = tramo.campana === null ? null : CASOS.campanas[tramo.campana]!;
        const anuncio = tramo.campana === null ? null : anuncios.filter((a) => a.campana === tramo.campana)[n % 4]!;
        const atribucion =
          c === null || anuncio === null
            ? {}
            : {
                campaignId: c.id,
                campaign: c.nombre,
                adId: anuncio.id,
                utmTerm: anuncio.conjunto,
                utmContent: anuncio.nombre,
                utmSource: 'facebook',
                utmMedium: 'paid',
              };
        const fila = await datos()
          .insertInto('contactos')
          .values({
            ghl_contact_id: id('contacto', n),
            nombre: `Contacto sintético ${n}`,
            email: correoDe(n),
            territorio: tramo.campana === 1 ? 'closer' : 'setter',
            alta_en_el_crm: momentoHace(hace, '10:00'),
            atribucion_primera: JSON.stringify(atribucion),
            atribucion_ultima: JSON.stringify(atribucion),
          } as never)
          .returning('id')
          .executeTakeFirstOrThrow();
        contactos.push({ id: (fila as { id: string }).id, n, hace, campana: tramo.campana });
      }
    }
  });

  // ── Citas pasadas y sus tres resultados, ninguno venta ────────────────────
  // Los agendados son los primeros contactos de la ventana reciente que tienen al menos dos días: la cita
  // es dos días después del alta, y tiene que haber pasado.
  const agendados = contactos.filter((c) => c.hace >= 3 && c.hace <= 29 && c.campana !== null).slice(0, CASOS.citasPasadas);
  if (agendados.length !== CASOS.citasPasadas) throw new Error(`hay ${agendados.length} agendables, no ${CASOS.citasPasadas}`);
  await conOrganizacion(org, async () => {
    for (const [i, c] of agendados.entries()) {
      // Los primeros treinta, del closer vinculado: es lo que «mío» le muestra a Closer Uno.
      const crm = i < 30 ? CRM_DEL_CLOSER_UNO : CRM_DE_OTRO;
      await datos().updateTable('contactos').set({ crm_asignado_a: crm, score: 80 } as never).where('id', '=', c.id).execute();
      const cita = await datos()
        .insertInto('citas')
        .values({
          contacto_id: c.id,
          ghl_evento_id: id('cita', i + 1),
          ghl_calendario_id: `${prefijo}calendario`,
          inicio_el: momentoHace(c.hace - 2, '15:00'),
          fin_el: momentoHace(c.hace - 2, '15:45'),
          estado_ghl: 'confirmed',
          reservada_el: momentoHace(c.hace, '11:00'),
          crm_asignado_a: crm,
        } as never)
        .returning('id')
        .executeTakeFirstOrThrow();
      const salida = CASOS.resultados[i];
      if (salida) {
        await datos()
          .insertInto('resultados')
          .values({
            contacto_id: c.id,
            cita_id: (cita as { id: string }).id,
            salida,
            rol: 'closer',
            registrado_por: personas.closerUno,
            creado_el: momentoHace(c.hace - 2, '17:00'),
          } as never)
          .execute();
      }
    }
  });

  // ── Sales: los dos closers, el setter y la comisión ───────────────────────
  await conOrganizacion(org, async () => {
    await datos().insertInto('closer_asignado').values({ usuario_id: personas.closerUno, crm_usuario_id: CRM_DEL_CLOSER_UNO } as never).execute();
    await datos().insertInto('closer_asignado').values({ usuario_id: personas.closerDos, crm_usuario_id: null } as never).execute();
    await datos().insertInto('comisiones').values({ usuario_id: personas.closerUno, tipo: 'closer', porcentaje: 10, meta_mensual: 5000 } as never).execute();
    await datos().insertInto('comisiones').values({ usuario_id: personas.setter, tipo: 'setter_directo', porcentaje: 5, meta_mensual: 2000 } as never).execute();
  });

  // ── Las llamadas de venta ─────────────────────────────────────────────────
  await conOrganizacion(org, async () => {
    const { total, analizadas, noEs, pendientes, vinculables } = CASOS.llamadas;
    // Las vinculables llevan el correo de un contacto agendado; las demás, uno que no está en el CRM.
    let precioReciente = 0;
    let precioAnterior = 0;
    for (let i = 0; i < total; i++) {
      const hace = 1 + (i % 28);
      const email = i < vinculables ? correoDe(agendados[i]!.n) : `prospecto-${i}@fuera-${prefijo.replace(/[^a-z0-9]/g, '')}.test`;
      const prospecto = await datos()
        .insertInto('analizador_prospectos')
        .values({ nombre: `Prospecto sintético ${i + 1}`, email } as never)
        .returning('id')
        .executeTakeFirstOrThrow();
      const estado = i < analizadas ? 'DONE' : i < analizadas + noEs ? 'NOT_MATCH' : i < analizadas + noEs + pendientes ? 'PENDING' : 'FAILED';
      const llamada = await datos()
        .insertInto('analizador_llamadas')
        .values({
          prospecto_id: (prospecto as { id: string }).id,
          tipo: estado === 'NOT_MATCH' ? 'OTRO' : 'HT',
          proveedor: 'TLDV',
          reunion_externa_id: id('reunion', i + 1),
          titulo: `Llamada de venta ${i + 1}`,
          prospecto_nombre: `Prospecto sintético ${i + 1}`,
          prospecto_email: email,
          estado,
          motivo: estado === 'NOT_MATCH' ? 'Es una reunión interna del equipo.' : null,
          error: estado === 'FAILED' ? 'El modelo no devolvió JSON parseable.' : null,
          fecha_de_la_reunion: momentoHace(hace, '16:00'),
          duracion_seg: 1800 + i * 30,
          organizador_nombre: i % 3 === 2 ? 'Closer Dos' : 'Closer Uno',
          organizador_email: i % 3 === 2 ? `closer-dos@${prefijo.replace(/[^a-z0-9]/g, '')}.test` : `closer-uno@${prefijo.replace(/[^a-z0-9]/g, '')}.test`,
        } as never)
        .returning('id')
        .executeTakeFirstOrThrow();
      const llamadaId = (llamada as { id: string }).id;
      await datos()
        .insertInto('analizador_transcripciones')
        .values({
          llamada_id: llamadaId,
          texto: '[00:05] Closer: Hola, gracias por venir.\n[02:10] Prospecto: Me preocupa el precio.',
          segmentos: JSON.stringify([
            { startSec: 5, endSec: 9, speaker: 'Closer', text: 'Hola, gracias por venir.' },
            { startSec: 130, endSec: 136, speaker: 'Prospecto', text: 'Me preocupa el precio.' },
          ]),
          con_marcas_de_tiempo: true,
        } as never)
        .execute();
      if (estado !== 'DONE') continue;

      // «Precio» en las 9 primeras analizadas de los últimos 14 días y en las 3 primeras de los 14 anteriores.
      const conPrecio = hace <= 14 ? precioReciente < CASOS.precio.ultimos14 : precioAnterior < CASOS.precio.anteriores14;
      if (conPrecio && hace <= 14) precioReciente += 1;
      else if (conPrecio) precioAnterior += 1;
      const objeciones = [...(conPrecio ? ['precio'] : []), ...(i % 4 === 0 ? ['tiempo'] : []), ...(i % 5 === 1 ? ['confianza'] : [])];
      const puntaje = 3 + (i % 6);
      await datos()
        .insertInto('analizador_analisis')
        .values({
          llamada_id: llamadaId,
          tipo: 'HT',
          coincide: true,
          analisis: JSON.stringify(analisisHt(puntaje, objeciones)),
          modelo: 'claude-sonnet-5',
          version_de_rubrica: 'rubric.es.md@v8.1',
          puntaje,
          resultado: 'NO_CERRADA',
          color_del_puntaje: puntaje >= 7 ? 'VERDE' : puntaje >= 4 ? 'AMARILLO' : 'ROJO',
          resumen: 'Una llamada sintética de venta, sin cierre.',
          analizado_el: momentoHace(hace, '17:00'),
        } as never)
        .execute();
    }
    if (precioReciente !== CASOS.precio.ultimos14 || precioAnterior !== CASOS.precio.anteriores14) {
      throw new Error(`«precio» quedó ${precioReciente} y ${precioAnterior}, no ${CASOS.precio.ultimos14} y ${CASOS.precio.anteriores14}`);
    }
  });

  // ── Los hallazgos del auditor, sobre contactos sin campaña ────────────────
  const conversaciones = contactos.filter((c) => c.campana === null);
  await conOrganizacion(org, async () => {
    for (const [i, h] of CASOS.hallazgos.entries()) {
      const c = conversaciones[i]!;
      const rojo = h.severidad === 'rojo';
      const analisis = await datos()
        .insertInto('analisis_del_agente')
        .values({
          contacto_id: c.id,
          agente: h.agente,
          auditable: true,
          nivel: h.severidad,
          intervencion: rojo,
          motivo: rojo ? 'El agente prometió algo que la empresa no ofrece.' : null,
          resumen: 'Una conversación sintética.',
          disparo: 'debounce',
          mensajes_del_agente: 6,
        } as never)
        .returning('id')
        .executeTakeFirstOrThrow();
      await datos()
        .insertInto('hallazgos')
        .values({
          contacto_id: c.id,
          analisis_id: (analisis as { id: string }).id,
          agente: h.agente,
          titulo: `Hallazgo sintético: ${h.patron.replace(/_/g, ' ')}`,
          patron: h.patron,
          correccion: 'Agregar al prompt la regla que falta.',
          evidencia_agente: 'Una línea sintética del agente.',
          severidad: h.severidad,
          categoria: h.categoria,
          diagnostico: 'Un diagnóstico sintético.',
        } as never)
        .execute();
    }
  });

  // ── Lo que guardó el Espía ────────────────────────────────────────────────
  await conOrganizacion(org, async () => {
    for (let i = 1; i <= CASOS.analisisDelEspia; i++) {
      await datos()
        .insertInto('analisis_del_espia')
        .values({
          trabajo_id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
          texto: `## Hooks\n\n- Un hook sintético ${i}.\n\n## Ángulos\n\n- Un ángulo sintético.`,
          usuario_id: personas.admin,
        } as never)
        .execute();
    }
  });
}

/** Un análisis HT con la forma de la rúbrica v8.1 (`lib/analizadores/nucleo/ht.ts`), sintético. */
function analisisHt(puntaje: number, objeciones: string[]): unknown {
  return {
    niche: { name: 'clínicas', isNew: false, confidence: 'ALTA' },
    score: puntaje,
    outcome: 'NO_CERRADA',
    outcomeReason: 'El prospecto pidió pensarlo.',
    summary: 'Una llamada sintética de venta, sin cierre.',
    scoreJustification: 'Descubrimiento corto.',
    coachingPriority: 'Profundizar el descubrimiento.',
    seller: {
      phaseScores: ['apertura_rapport', 'descubrimiento', 'presentacion_oferta', 'manejo_objeciones', 'cierre'].map((phase) => ({
        phase,
        score: puntaje,
        rationale: 'Sintético.',
        toReachTen: 'Sintético.',
      })),
      strengths: [],
      improvements: [],
      objections: objeciones.map((objection) => ({
        objection,
        howHandled: 'Lo dejó pasar.',
        howToRespond: 'Preguntar qué compara.',
        evidence: { startSec: 130, endSec: 136, quote: 'Me preocupa el precio.' },
      })),
    },
    client: {
      interestLevel: 'MEDIO',
      knowledgeLevel: 'MEDIO',
      budget: { ability: 'DESCONOCIDO', note: '' },
      authority: 'DECISOR',
      motivations: [],
      pains: [],
      personality: '',
      liked: [],
      disliked: [],
      objections: objeciones,
      buyingSignals: [],
      redFlags: [],
      insightsForNextCall: [],
    },
    keyMoments: [{ startSec: 130, endSec: 136, label: 'Objeción', quote: 'Me preocupa el precio.' }],
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TODO JUNTO
// ═══════════════════════════════════════════════════════════════════════════════

/** Quita lo de una corrida anterior con ese prefijo y siembra las dos empresas de nuevo. */
export async function sembrarCasosDeLosAgentes(prefijo: string = PREFIJO_DE_LA_EVALUACION): Promise<EmpresasDeLosAgentes> {
  exigirBaseLocalParaLosCasos();
  await quitarEmpresasDeLosAgentes(prefijo);
  const empresas = await crearEmpresas(prefijo);
  await construirEmpresaConDatos(empresas.conDatos, empresas.personas, prefijo);
  return empresas;
}
