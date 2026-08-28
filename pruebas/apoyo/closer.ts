// El andamio de las pruebas del Closer. UNO, compartido por las seis que lo usan.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ EXISTE, Y ES EL MISMO ARGUMENTO QUE `autorizados.ts` HACE PARA SU LISTA
//
// El Closer tiene **catorce rutas** y hasta ahora sólo tres se invocaban en alguna prueba; las otras
// once estaban cubiertas nada más por los guardias de arquitectura, que **leen el archivo** y no lo
// ejecutan. Un `exigir` con la capacidad correcta y una consulta que devuelve la organización
// equivocada pasan los dos guardias sin una queja.
//
// Cubrir once rutas significa sembrar contactos, citas, mensajes, notas, resultados y tareas una y
// otra vez. Escrito por archivo, eso son seis moldes que se van a separar: uno pondrá `territorio`
// y otro no, y la prueba del segundo va a pasar por el motivo equivocado.
//
// ── LA REGLA DE LIMPIEZA, QUE NO ES NEGOCIABLE ─────────────────────────────
//
// Todo lo que se siembra lleva la MARCA de quien lo sembró, y `limpiar(marca)` borra sólo lo suyo.
// La tentación es `delete from negocio.contactos` a secas —lo hace una prueba vieja— y con eso dos
// archivos que corran cerca se borran los datos mutuamente: el síntoma es una prueba que falla sola
// y pasa cuando se la corre aislada, que es el peor tipo de prueba que se puede tener.
// ═══════════════════════════════════════════════════════════════════════════════

import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { conectar, unaFila } from './conexiones.ts';
import { conIdentidad } from '../../lib/datos/capa.ts';
import { COOKIE_SESION, hashDeToken } from '../../lib/autorizacion/sesion.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';

/** El dominio que el portero espera. Se fija en `before`, y sin él todo rechaza por `ADR-0306`. */
export const DOMINIO = 'ejemplo.test';

export interface Escenario {
  admin: Client;
  /** La organización `alfa` del sembrado. */
  org: string;
  /** La otra, para probar que nada se cruza. */
  otraOrg: string;
  /** `ana@alfa.ejemplo`, la persona del sembrado en `alfa`. */
  quien: string;
  /** El token de una sesión activa de `quien`, con rol de administrador. */
  token: string;
  /** La marca de este archivo de pruebas. Todo lo sembrado la lleva. */
  marca: string;
}

/**
 * Prepara el escenario. Se llama UNA vez, en el `before` del archivo.
 *
 * @param marca Un nombre corto y único por archivo de pruebas — «Agenda», «Ficha». Va en el nombre
 *   de cada contacto sembrado y es lo que `limpiar` usa para borrar sólo lo propio.
 */
export async function montar(marca: string): Promise<Escenario> {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  const admin = await conectar('admin');

  const a = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug='alfa'`);
  const b = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug='beta'`);
  const u = await unaFila<{ id: string }>(admin, `select id from identidad.usuarios where email='ana@alfa.ejemplo'`);
  assert.ok(a && b && u, 'falta el sembrado: corré `npm run db:reset`');

  const esc: Escenario = {
    admin,
    org: a.id,
    otraOrg: b.id,
    quien: u.id,
    token: await sesionDe(u.id),
    marca,
  };
  await limpiar(esc);
  return esc;
}

/** Una sesión activa, y su token. El `estado` es `activa`: el Paso 4 del portero no corta. */
export async function sesionDe(usuarioId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await conIdentidad(async (db) => {
    await db
      .insertInto('sesiones')
      .values({
        usuario_id: usuarioId,
        token_hash: hashDeToken(token),
        estado: 'activa',
        expira_el: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      })
      .execute();
  });
  return token;
}

/**
 * Una petición con sesión, lista para pasarle a un manejador de ruta.
 *
 * Lleva `origin` porque `ADR-0306` lo exige en toda mutación y su ausencia rechaza antes de llegar a
 * la lógica — el modo de falla es una prueba que da 403 y parece un problema de permisos.
 */
export function pedirComo(
  camino: string,
  token: string,
  opciones: { metodo?: string; cuerpo?: unknown } = {},
): Request {
  const { metodo = 'GET', cuerpo } = opciones;
  return new Request(`https://${DOMINIO}${camino}`, {
    method: metodo,
    headers: {
      origin: `https://${DOMINIO}`,
      cookie: `${COOKIE_SESION}=${token}`,
      ...(cuerpo === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
}

/** El cuerpo de una respuesta, con su estado. Sin `clone()` cada lectura consumiría el flujo. */
export async function leerRespuesta<T = Record<string, unknown>>(
  r: Response,
): Promise<{ estado: number; cuerpo: T }> {
  return { estado: r.status, cuerpo: (await r.clone().json()) as T };
}

// ── LO QUE SE SIEMBRA ──────────────────────────────────────────────────────

export interface ContactoSembrado {
  id: string;
  ghlId: string;
}

/**
 * Un contacto del territorio indicado.
 *
 * `territorio` por omisión `'closer'` y NO nulo: un contacto sin territorio no aparece en ninguna
 * pantalla del Closer, así que sembrarlo así hace que una prueba pase por la razón equivocada — la
 * lista sale vacía y la aserción de «no trae los de otro» se cumple sin haber probado nada.
 */
export async function unContacto(
  esc: Escenario,
  campos: {
    org?: string;
    territorio?: string | null;
    nombre?: string;
    etapa?: string | null;
    etiquetas?: string[];
    score?: string | null;
    telefono?: string | null;
    ultimoEntranteEl?: Date | null;
    ultimoEntranteTexto?: string | null;
  } = {},
): Promise<ContactoSembrado> {
  const ghlId = `${esc.marca.toLowerCase()}-${randomUUID()}`;
  const org = campos.org ?? esc.org;
  const id = await conOrganizacion(org, async () => {
    const f = await datos()
      .insertInto('contactos')
      .values({
        ghl_contact_id: ghlId,
        // El nombre lleva la MARCA: es lo que `limpiar` busca.
        nombre: campos.nombre ?? `${esc.marca} contacto`,
        territorio: campos.territorio === undefined ? 'closer' : campos.territorio,
        etapa: campos.etapa ?? null,
        etiquetas: campos.etiquetas ?? [],
        score: campos.score ?? null,
        telefono: campos.telefono ?? null,
        ultimo_entrante_el: campos.ultimoEntranteEl ?? null,
        ultimo_entrante_texto: campos.ultimoEntranteTexto ?? null,
      } as never)
      .returning('id')
      .executeTakeFirstOrThrow();
    return f.id;
  });
  return { id, ghlId };
}

/** Una cita de ese contacto. `inicioEl` es lo único que decide en qué día de la agenda cae. */
export async function unaCita(
  esc: Escenario,
  contactoId: string,
  campos: { org?: string; inicioEl: Date; estado?: string | null; salaUrl?: string | null } = {
    inicioEl: new Date(),
  },
): Promise<string> {
  const org = campos.org ?? esc.org;
  return conOrganizacion(org, async () => {
    const f = await datos()
      .insertInto('citas')
      .values({
        ghl_evento_id: `${esc.marca.toLowerCase()}-ev-${randomUUID()}`,
        contacto_id: contactoId,
        inicio_el: campos.inicioEl,
        fin_el: new Date(campos.inicioEl.getTime() + 30 * 60_000),
        estado_ghl: campos.estado === undefined ? 'booked' : campos.estado,
        sala_url: campos.salaUrl ?? null,
        titulo: `${esc.marca} cita`,
      } as never)
      .returning('id')
      .executeTakeFirstOrThrow();
    return f.id;
  });
}

/** Un mensaje del chat. `direccion` es `'entrante'` o `'saliente'`. */
export async function unMensaje(
  esc: Escenario,
  contactoId: string,
  campos: {
    org?: string;
    direccion: string;
    cuerpo?: string | null;
    enviadoEl?: Date;
    autor?: string;
    entrega?: string | null;
  },
): Promise<string> {
  const org = campos.org ?? esc.org;
  return conOrganizacion(org, async () => {
    const f = await datos()
      .insertInto('mensajes')
      .values({
        ghl_mensaje_id: `${esc.marca.toLowerCase()}-m-${randomUUID()}`,
        contacto_id: contactoId,
        canal: 'whatsapp',
        direccion: campos.direccion,
        cuerpo: campos.cuerpo === undefined ? `${esc.marca} mensaje` : campos.cuerpo,
        autor: campos.autor ?? (campos.direccion === 'entrante' ? 'contacto' : 'persona'),
        enviado_el: campos.enviadoEl ?? new Date(),
        estado_entrega: campos.entrega ?? null,
        estado_entrega_familia: campos.entrega ?? 'en_curso',
      } as never)
      .returning('id')
      .executeTakeFirstOrThrow();
    return f.id;
  });
}

/** Un resultado registrado POR alguien. `registrado_por` decide de quién es la comisión. */
export async function unResultado(
  esc: Escenario,
  contactoId: string,
  /* `nota` y `detalle` NO son adorno: Avanzar escribe la MISMA cadena en `resultados.nota`,
     `notas.cuerpo` y `tareas.nota` —está justificado en `lib/negocio/avanzar.ts`— y sin poder sembrar
     esa columna, ninguna prueba podía ver que el historial la mostraba tres veces. Se comprobó por
     mutación: devolver el `?? r.nota` que causaba la repetición dejaba la suite entera en verde. */
  campos: {
    org?: string;
    salida: string;
    monto?: number | null;
    quien?: string;
    nota?: string | null;
    detalle?: string | null;
  },
): Promise<void> {
  const org = campos.org ?? esc.org;
  await conOrganizacion(org, async () => {
    await datos()
      .insertInto('resultados')
      .values({
        contacto_id: contactoId,
        salida: campos.salida,
        monto: campos.monto ?? null,
        nota: campos.nota ?? null,
        detalle: campos.detalle ?? null,
        registrado_por: campos.quien ?? esc.quien,
        rol: 'closer',
      } as never)
      .execute();
  });
}

/**
 * Un seguimiento MANUAL pendiente, de los que Avanzar crea.
 *
 * `venceEl` va como `YYYY-MM-DD` y no como `Date`: la columna es `date`, y pasar un instante hace
 * que PostgreSQL lo recorte con la zona del servidor — el mismo corrimiento de un día que
 * `26-avanzar` mide. Quien siembre un vencimiento de «hoy» tiene que calcular el día en la ZONA DE
 * LA EMPRESA, no con el reloj del proceso.
 *
 * Existe porque de estas filas sale `pideManos: true`, que es el único sumando del contador de Mi
 * Día que no se puede provocar con etiquetas: sin una tarea sembrada, la identidad del contador se
 * cumple con ese término en cero y la mitad que importa queda sin medir.
 */
export async function unaTarea(
  esc: Escenario,
  contactoId: string,
  campos: {
    org?: string;
    venceEl: string;
    situacion?: string;
    modo?: string;
    nota?: string;
    quien?: string | null;
  },
): Promise<string> {
  const org = campos.org ?? esc.org;
  return conOrganizacion(org, async () => {
    const f = await datos()
      .insertInto('tareas')
      .values({
        contacto_id: contactoId,
        vence_el: campos.venceEl,
        situacion: campos.situacion ?? 'seguimiento',
        modo: campos.modo ?? 'manual',
        nota: campos.nota ?? `${esc.marca} tarea`,
        creada_por: campos.quien === undefined ? esc.quien : campos.quien,
      } as never)
      .returning('id')
      .executeTakeFirstOrThrow();
    return f.id;
  });
}

/** Una nota. `autor_id` nulo significa «la importó el sistema», y se ve distinto. */
export async function unaNota(
  esc: Escenario,
  contactoId: string,
  campos: { org?: string; cuerpo?: string; autorId?: string | null; origen?: string } = {},
): Promise<string> {
  const org = campos.org ?? esc.org;
  return conOrganizacion(org, async () => {
    const f = await datos()
      .insertInto('notas')
      .values({
        contacto_id: contactoId,
        cuerpo: campos.cuerpo ?? `${esc.marca} nota`,
        autor_id: campos.autorId === undefined ? esc.quien : campos.autorId,
        origen: campos.origen ?? 'plataforma',
      } as never)
      .returning('id')
      .executeTakeFirstOrThrow();
    return f.id;
  });
}

/**
 * Borra SÓLO lo que sembró esta marca.
 *
 * El orden va de las hojas al tronco: las claves foráneas de `citas`, `mensajes`, `notas`,
 * `resultados` y `tareas` apuntan a `contactos`, así que borrar el contacto primero falla — o peor,
 * en una base sin la restricción, deja huérfanas que la prueba siguiente encuentra.
 *
 * Se hace con el cliente ADMINISTRADOR y no con `conOrganizacion`: hay que barrer las dos
 * organizaciones del escenario, y el contexto de inquilino sólo ve una.
 */
export async function limpiar(esc: Escenario): Promise<void> {
  const marca = `${esc.marca.toLowerCase()}-%`;
  const contactos = `select id from negocio.contactos where ghl_contact_id like $1`;
  for (const tabla of ['citas', 'mensajes', 'notas', 'resultados', 'tareas', 'llamadas', 'hallazgos']) {
    await esc.admin.query(
      `delete from negocio.${tabla} where contacto_id in (${contactos})`,
      [marca],
    );
  }
  await esc.admin.query('delete from negocio.contactos where ghl_contact_id like $1', [marca]);
}
