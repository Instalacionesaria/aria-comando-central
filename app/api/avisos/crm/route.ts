// `POST /api/avisos/crm` — LA puerta por la que GoHighLevel nos empuja lo que pasa.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA PRIMERA RUTA DE ESTE SISTEMA QUE RECIBE DATOS SIN SESIÓN
//
// Hasta acá había exactamente dos rutas sin sesión —`/api/cron` y `/api/sonda`— y las dos son
// DISPARADORES: alguien las llama y nosotros hacemos el trabajo con nuestros propios datos. Ninguna
// recibe contenido de afuera.
//
// Ésta sí. Y es multi-inquilino, así que el orden de las comprobaciones de abajo no es estilo: es la
// defensa, y va **de lo más barato a lo más caro** para que lo caro sea inalcanzable sin pasar lo
// barato.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA CABECERA TIENE DOS MITADES, Y LA IZQUIERDA EXISTE POR UN ATAQUE CONCRETO
//
//     X-Webhook-Secret: <pimienta-global>.<secreto-de-la-empresa>
//
// La plataforma anterior usaba una sola mitad y su flujo era: parsear el cuerpo → sacar el
// `locationId` → buscar la empresa → comparar su secreto. El propio archivo lo admitía: *«el costo es
// parsear JSON de alguien que todavía no se autenticó»*.
//
// El costo real es peor. Ese flujo obliga a una consulta a `identidad` **por cada petición sin
// autenticar**, y el agrupador de conexiones de `identidad` es `max: 5` (`lib/datos/capa.ts`) y es
// **el mismo** que usan el portero, las sesiones y el login de TODOS los inquilinos. Cualquiera que
// descubra la URL puede dejar sin login a todo el mundo con un bucle de veinte líneas.
//
// Y no es una regla que yo invente acá: `app/api/salud/route.ts` ya la tiene escrita — una
// comprobación que consulta la base es un endpoint que puede agotar el agrupador desde afuera.
//
// La mitad izquierda se compara contra `AVISO_PIMIENTA` con `timingSafeEqual` **antes de tocar la
// base**. Sin ella: 403, cero consultas, una línea al registro.
//
// ── POR QUÉ ESTO NO VIOLA LA PROHIBICIÓN DE `lib/credenciales/resolver.ts` ──
//
// Ese archivo prohíbe que una credencial de empresa se respalde en una variable de entorno, y con
// razón: sería un token global operando a nombre de cualquiera. La pimienta **no identifica ni
// autoriza a ninguna empresa** y no es respaldo de nada — no hay ningún `?? entorno(...)`. Un cuerpo
// con la pimienta correcta y un secreto de empresa inválido se rechaza igual. La autorización sigue
// siendo 100 % por empresa; la pimienta es un portón anterior cuya única función es que la base sea
// inalcanzable sin él.
//
// **Residual que no se oculta:** la pimienta es compartida entre todas las empresas, así que se filtra
// con la configuración de workflow de cualquiera de ellas, y rotarla obliga a tocar todos los
// workflows. Baja el costo del ataque de «cualquiera que descubra la URL» a «cualquiera con acceso a
// la configuración de un workflow de un cliente». Es mucho más chico, y no es cero. El techo que no
// depende de autenticarse está fuera de este repositorio: es una regla de tasa del firewall de la
// plataforma, y hay que pedirla.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA EMPRESA SALE DEL SECRETO, NUNCA DEL CUERPO
//
// Es la divergencia importante con la referencia. Allá el `locationId` del payload RUTEABA: decidía de
// quién era el evento. Acá solo se **compara**, y se guarda si coincide o no.
//
// La diferencia es que un aislamiento que depende de que el payload diga la verdad es una fuga
// esperando: el workflow de la empresa A con el `locationId` de B inyectaba eventos a nombre de B. Con
// el secreto como llave, el evento es de quien tiene el secreto — y punto.
//
// ═══════════════════════════════════════════════════════════════════════════════
// SIEMPRE 200, SALVO QUE FALLE NUESTRA BASE
//
// GoHighLevel desactiva un workflow ante fallos repetidos. Un evento que no supimos interpretar se
// guarda y responde 200: mejor una fila sin interpretar —que el monitor cuenta— que un workflow
// apagándose solo.
//
// La excepción es que NUESTRA base no responda: ahí 503, para que un proveedor que reintente pueda.
// **Y una deuda que no se tapa:** si GoHighLevel NO reintenta, ese 503 pierde el evento. No hay
// número del proveedor en ningún lado para saberlo. Lo que lo vuelve tolerable es que el sondeo lo
// trae igual, con hasta diez minutos de retraso — que es exactamente lo que esta ruta viene a mejorar.
//
// ── LA OPORTUNIDAD NO TIENE SONDEO, Y POR ESO TIENE REPROCESO ───────────────────
//
// La etapa y la Salida (`?evento=oportunidad.*`) llegan SÓLO por acá. Así que un aviso de oportunidad guardado que no
// se pudo procesar por algo transitorio —GoHighLevel respondió 429 al pedir el contacto, la base falló a mitad de
// camino, faltaba la credencial— lo reprocesa el barrido (`lib/negocio/reprocesoDeAvisos.ts`, en la tarea `contactos`)
// con la misma fila: el mismo id y la misma hora. Y el tope por hora no los descarta: por encima, se guardan y quedan
// para el reproceso (paso 5).
// ═══════════════════════════════════════════════════════════════════════════════

import { createHash, timingSafeEqual } from 'node:crypto';
import { sql } from 'kysely';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../../../lib/datos/contexto.ts';
import { ambitoDeUnCliente, type AmbitoDeUnCliente } from '../../../../lib/negocio/ambitoDelCliente.ts';
import { resolverAccesoAGhl } from '../../../../lib/credenciales/resolver.ts';
import { locationIdDelCuerpo } from '../../../../lib/ghl/avisos.ts';
import { leerCuerpoAcotado } from '../../../../lib/http/cuerpoAcotado.ts';
import { interpretarAviso } from '../../../../lib/negocio/avisoDelCrm.ts';
import {
  MOTIVO_EN_ESPERA,
  MOTIVO_FALLO,
  MOTIVO_SIN_CREDENCIAL,
  motivoDelAviso,
} from '../../../../lib/negocio/reprocesoDeAvisos.ts';

/**
 * `maxDuration` bajo y declarado EN LA RUTA.
 *
 * En la ruta y no en `vercel.json` porque una prueba prohíbe declarar `functions` ahí
 * (`pruebas/codigo/99-cron.test.ts`). Y BAJO a propósito: una ruta pública con el presupuesto de 300
 * segundos es un multiplicador de agotamiento — diez peticiones colgadas ocupan diez funciones por
 * cinco minutos. Diez segundos alcanzan de sobra para lo que hace: dos consultas y, como mucho, una
 * llamada al CRM.
 */
export const maxDuration = 10;

/**
 * Cuántos avisos por hora y por cliente antes de frenar. Los de oportunidad se cuentan APARTE: una mudanza en bloque
 * del pipeline no puede dejar sin pasar los mensajes del cliente, ni al revés.
 */
const TOPE_POR_HORA = 240;

/**
 * Por encima de `TOPE_POR_HORA`, un aviso de oportunidad se GUARDA sin interpretar y lo procesa el reproceso: no tiene
 * otra puerta, así que no se descarta. Éste es el techo de lo que se guarda (diez veces el tope): pasado, 429 como los
 * demás, para que un workflow desbocado no llene la cuarentena.
 */
const TECHO_DE_OPORTUNIDADES_POR_HORA = TOPE_POR_HORA * 10;

/**
 * La misma rama con el mismo cuerpo, ¿es una reentrega o un hecho nuevo? Si la fila no se vio en los últimos
 * `MINUTOS_DE_UNA_REENTREGA`, es un hecho nuevo (el lead volvió a faltar días después): la fila toma la hora de ahora
 * como la del hecho y vuelve a quedar sin procesar. Quince minutos porque una reentrega de GoHighLevel (la función se
 * cortó a los 10 s y reintenta) llega en segundos o pocos minutos, y un mismo lead que pasa dos veces por la misma rama
 * en menos de un cuarto de hora es una corrección a mano, no dos hechos. No está medido: ver el doc 23 § 9.
 */
const MINUTOS_DE_UNA_REENTREGA = 15;

/**
 * Comparación en tiempo constante, copiada de `app/api/cron/route.ts` y de `app/api/sonda/route.ts`.
 *
 * Se copia y no se importa porque en las tres es la misma media docena de líneas y el guard de
 * `pruebas/codigo/30-portero.test.ts` exige ver la LLAMADA literal a `timingSafeEqual(` en cada ruta
 * con secreto propio — una mutación pasó dejando el `import` sin usar, y por eso el guard es así.
 *
 * El largo se compara primero porque `timingSafeEqual` **lanza** con longitudes distintas, y ahí sí se
 * filtra el largo del secreto. Es información y no alcanza para nada, pero es gratis no darla.
 */
function coincide(dado: string, esperado: string): boolean {
  const a = Buffer.from(dado);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

export async function POST(peticion: Request): Promise<Response> {
  // ── 1 · LA PIMIENTA, ANTES DE TOCAR LA BASE ────────────────────────────────
  const pimientaEsperada = process.env.AVISO_PIMIENTA;
  if (!pimientaEsperada) {
    /* Sin la variable configurada se rechaza TODO, y no se abre la puerta «por ahora». Es la misma
       decisión que `/api/cron` toma con `CRON_SECRET`, y el motivo es idéntico: sin el guard, la
       comparación sería contra `undefined` y cualquiera la pasaría. */
    console.error('avisos/crm: AVISO_PIMIENTA no está definida: se rechaza todo.');
    return rechazo('sin_permiso');
  }

  const cabecera = peticion.headers.get('x-webhook-secret') ?? '';
  const corte = cabecera.indexOf('.');
  const pimienta = corte === -1 ? '' : cabecera.slice(0, corte);
  const secreto = corte === -1 ? '' : cabecera.slice(corte + 1);
  if (!coincide(pimienta, pimientaEsperada)) {
    // Al registro y NO al cuerpo: quien golpea la puerta no se lleva ninguna pista de por qué falló.
    console.warn('avisos/crm: pimienta inválida o ausente.');
    return rechazo('sin_permiso');
  }
  if (secreto === '') return rechazo('sin_permiso');

  // ── 2 · EL TAMAÑO, todavía sin tocar la base ───────────────────────────────
  const leido = await leerCuerpoAcotado(peticion);
  if (!leido.ok) {
    if (leido.porque === 'demasiado_grande') {
      console.warn('avisos/crm: cuerpo sobre el tope.');
      // Sin `detalle`: la ruta es alcanzable sin autenticar (`ADR-0704`).
      return rechazo('cuerpo_demasiado_grande');
    }
    return rechazo('peticion_invalida');
  }

  // ── 3 · LA EMPRESA Y SU CLIENTE, POR EL HASH DEL SECRETO ───────────────────
  //
  // Dos lugares, en este orden (el nivel 3, `091`): el secreto de la empresa —que es el de su cliente por omisión— y,
  // si no, el de un cliente con su propia subcuenta. El segundo sólo de clientes ACTIVOS que no son el por omisión: la
  // fila del por omisión en `cuentas_credenciales` puede tener una copia vieja del secreto de la empresa, y aceptarla
  // dejaría entrar un secreto ya rotado.
  const fila = await conIdentidad(async (db) => {
    const hash = sha256(secreto);
    const deLaEmpresa = await db
      .selectFrom('organizaciones_credenciales as c')
      .innerJoin('organizaciones as o', 'o.id', 'c.org_id')
      .innerJoin('cuentas as k', (j) => j.onRef('k.org_id', '=', 'c.org_id').on('k.es_por_omision', '=', true))
      .select(['c.org_id', 'c.aviso_secreto_hash', 'o.activa', 'k.id as cuenta_id', 'k.es_por_omision'])
      .where('c.aviso_secreto_hash', '=', hash)
      .executeTakeFirst();
    if (deLaEmpresa) return deLaEmpresa;
    return db
      .selectFrom('cuentas_credenciales as c')
      .innerJoin('cuentas as k', (j) => j.onRef('k.id', '=', 'c.cuenta_id').onRef('k.org_id', '=', 'c.org_id'))
      .innerJoin('organizaciones as o', 'o.id', 'c.org_id')
      .select(['c.org_id', 'c.aviso_secreto_hash', 'o.activa', 'k.id as cuenta_id', 'k.es_por_omision'])
      .where('c.aviso_secreto_hash', '=', hash)
      .where('k.es_por_omision', '=', false)
      .where('k.estado', '=', 'activa')
      .executeTakeFirst();
  });

  /* Las tres respuestas de abajo son EL MISMO 403, byte por byte: hash desconocido, secreto que no
     coincide, y empresa desactivada. Si se distinguieran, esta ruta sería un enumerador de empresas
     —`ADR-0501`— y bastaría un bucle para saber qué secretos existen. */
  if (!fila || fila.aviso_secreto_hash === null) return rechazo('sin_permiso');
  /* Y la comparación en tiempo constante, aunque el índice único ya igualó el hash y esto NO puede
     devolver falso. Su valor es sobrevivir al día en que alguien cambie el `=` por un `like` o le
     agregue un `or` — y satisface el guard de `pruebas/codigo/30-portero.test.ts`, que exige la
     llamada literal porque una mutación pasó dejando el `import` sin usar. */
  if (!coincide(sha256(secreto), fila.aviso_secreto_hash)) return rechazo('sin_permiso');
  if (!fila.activa) return rechazo('sin_permiso');

  const orgId = fila.org_id;
  // El cliente del aviso: su registro, su contacto y sus mensajes van en su ámbito, y el puente pone su cuenta.
  const ambito = ambitoDeUnCliente(orgId, fila.cuenta_id);
  const cliente = { id: fila.cuenta_id, esPorOmision: fila.es_por_omision };

  // ── 4 · EL CUERPO Y LA ATRIBUCIÓN, que se COMPARA y no rutea ───────────────
  let cuerpo: Record<string, unknown> | null = null;
  try {
    const crudo: unknown = JSON.parse(leido.texto);
    cuerpo = crudo !== null && typeof crudo === 'object' ? (crudo as Record<string, unknown>) : null;
  } catch {
    cuerpo = null;
  }

  const acceso = await conIdentidad((db) => resolverAccesoAGhl(db, orgId, cliente));
  const location = locationIdDelCuerpo(cuerpo);
  const atribucion =
    cuerpo === null
      ? 'ilegible'
      : location === null
        ? 'ausente'
        : acceso.tipo === 'listo' && location === acceso.locationId
          ? 'coincide'
          : 'discordante';

  const url = new URL(peticion.url);
  const evento = url.searchParams.get('evento');
  /* La huella de un aviso de OPORTUNIDAD lleva la consulta de la URL: cada rama de PM-02/PM-03 manda el MISMO cuerpo
     nativo con su `&etapa=` o `&salida=` fija, y con la huella sólo del cuerpo dos ramas distintas del mismo lead se
     fundían en una fila (la segunda era una «repetición» y su etapa no se registraba). Los demás eventos siguen con la
     huella del cuerpo: cambiarla duplicaría las filas que ya están. */
  const huella =
    evento !== null && evento.startsWith('oportunidad.')
      ? sha256(`${url.search.replace(/^\?/, '')}\n${leido.texto}`)
      : sha256(leido.texto);
  // Los de oportunidad se cuentan aparte en el tope, guardan su consulta y distinguen un hecho nuevo de una reentrega.
  const deOportunidad = evento?.startsWith('oportunidad.') === true;
  const consulta = url.search.replace(/^\?/, '');

  // ── 5 · LA CUARENTENA: se guarda CRUDO antes de interpretar ────────────────
  let guardado: { id: string; repeticiones: number; recibido_el: Date; enEspera: boolean } | undefined;
  /* Un 23505 se reintenta UNA vez: mientras conviven la clave vieja (org_id, huella) y la del cliente —de la `090` a la
     `092`— la vieja no es árbitro, y dos entregas simultáneas del mismo cuerpo chocan en ella en vez de sumar una
     repetición. En el segundo intento la fila ya está y el `on conflict` la encuentra. */
  const guardar = () => conOrganizacion(ambito, async () => {
      // El tope por hora va DENTRO del contexto, o sea después de autenticar: acá ya sabemos de quién
      // es. El techo de lo no autenticado lo pone la pimienta del paso 1. Los de oportunidad, aparte.
      const cuantos = await datos()
        .selectFrom('avisos_del_crm')
        .select([
          sql<string>`count(*) filter (where evento like 'oportunidad.%')`.as('de_oportunidad'),
          sql<string>`count(*) filter (where evento is null or evento not like 'oportunidad.%')`.as('otros'),
        ])
        .where('recibido_el', '>', new Date(Date.now() - 60 * 60 * 1000))
        .executeTakeFirst();
      const n = Number((deOportunidad ? cuantos?.de_oportunidad : cuantos?.otros) ?? 0);
      if (n >= (deOportunidad ? TECHO_DE_OPORTUNIDADES_POR_HORA : TOPE_POR_HORA)) return undefined;
      // Por encima del tope, uno de oportunidad se guarda igual y queda para el reproceso (sin interpretar ahora).
      const enEspera = deOportunidad && n >= TOPE_POR_HORA;

      /* La misma rama con el mismo cuerpo que no se vio en `MINUTOS_DE_UNA_REENTREGA` es un hecho NUEVO: la fila toma
         la hora de ahora como la del hecho (`recibido_el`, que es la del evento: otra hora es otro evento en el único
         de `eventos`) y vuelve a quedar sin procesar. Dentro de esos minutos es una reentrega, y no toca nada. Las
         columnas de la derecha leen la fila VIEJA, así que las tres comparan contra la misma `visto_ultimo_el`. */
      const hechoNuevo = sql<boolean>`avisos_del_crm.visto_ultimo_el < now() - make_interval(mins => ${MINUTOS_DE_UNA_REENTREGA})`;

      /* `do update` y NO `do nothing`, y esa palabra resuelve dos cosas: una entrega repetida deja de
         ser invisible (se cuenta), y `visto_ultimo_el` permite ver que un workflow está disparando de
         más sin tener que mirar los registros del proveedor. */
      const filas = await datos()
        .insertInto('avisos_del_crm')
        .values({
          huella,
          evento,
          cuerpo: leido.texto,
          bytes: leido.bytes,
          atribucion,
          // La rama (`&etapa=`, `&salida=`): el reproceso la necesita, y en la huella está sólo hasheada.
          consulta: deOportunidad ? consulta.slice(0, 2000) : null,
          error: enEspera ? MOTIVO_EN_ESPERA : null,
        } as never)
        .onConflict((oc) =>
          // La clave con el cliente (`090`): el mismo cuerpo que llega a dos clientes es de cada uno.
          oc.columns(['org_id', 'cuenta_id', 'huella']).doUpdateSet({
            // `+ 1` en SQL y no leído-y-sumado: dos entregas simultáneas del mismo cuerpo sumarían
            // una sola vez si el valor se calculara en la aplicación.
            repeticiones: sql`avisos_del_crm.repeticiones + 1`,
            visto_ultimo_el: new Date(),
            ...(deOportunidad
              ? {
                  recibido_el: sql`case when ${hechoNuevo} then now() else avisos_del_crm.recibido_el end`,
                  procesado_el: sql`case when ${hechoNuevo} then null else avisos_del_crm.procesado_el end`,
                  error: sql`case when ${hechoNuevo} then ${enEspera ? MOTIVO_EN_ESPERA : null}::text else avisos_del_crm.error end`,
                }
              : {}),
          } as never),
        )
        /* `recibido_el` es la llegada del HECHO: la primera (el `do update` no la toca), salvo un hecho nuevo de la misma
           rama (arriba). Es la hora determinista de una oportunidad. */
        .returning(['id', 'repeticiones', 'recibido_el'])
        .execute();
      const f = filas[0] as { id: string; repeticiones: number; recibido_el: Date } | undefined;
      return f && { ...f, enEspera };
    });
  try {
    try {
      guardado = await guardar();
    } catch (e) {
      if ((e as { code?: string }).code !== '23505') throw e;
      guardado = await guardar();
    }
  } catch (e) {
    // Nuestra base no respondió. 503 para que un proveedor que reintente pueda — y NUNCA el mensaje
    // del motor (`ADR-0704`), que puede llevar nombres de tabla.
    console.error('avisos/crm: no se pudo guardar el aviso', e);
    return rechazo('base_no_disponible');
  }

  if (guardado === undefined) {
    console.warn(`avisos/crm: el cliente pasó el tope de avisos por hora${deOportunidad ? ' de oportunidad' : ''}.`);
    return rechazo('avisos_demasiados');
  }
  const { id: idDelAviso, recibido_el: recibidoEl } = guardado;

  // Por encima del tope por hora: guardado y sin interpretar. Lo procesa el reproceso del barrido, en orden.
  if (guardado.enEspera) {
    console.warn(`avisos/crm: ${evento} por encima del tope de ${TOPE_POR_HORA} por hora: queda para el reproceso.`);
    return ok({ recibido: true, procesado: false, porque: 'en_espera' });
  }

  // Un cuerpo que no es JSON se guardó y no se interpreta: es la única evidencia de que el proveedor
  // cambió de forma, y responder 400 la perdería.
  if (cuerpo === null) return ok({ recibido: true, procesado: false, porque: 'ilegible' });

  /* Sin credencial del CRM no se puede refrescar el contacto. El aviso queda guardado: si es de oportunidad, lo
     reprocesa el barrido cuando la credencial vuelva (un mensaje lo trae el sondeo). */
  if (acceso.tipo !== 'listo') {
    await anotarError(ambito, idDelAviso, recibidoEl, `${MOTIVO_SIN_CREDENCIAL}: ${acceso.que}`);
    return ok({ recibido: true, procesado: false, porque: 'sin_credencial' });
  }

  // ── 6 · INTERPRETAR ───────────────────────────────────────────────────────
  try {
    const r = await interpretarAviso(ambito, acceso, evento, cuerpo, undefined, {
      id: idDelAviso,
      recibidoEl,
      parametros: url.searchParams,
    });

    if (r.tipo === 'listo') {
      await conOrganizacion(ambito, async () => {
        await datos()
          .updateTable('avisos_del_crm')
          .set({ procesado_el: new Date(), error: null } as never)
          .where('id', '=', idDelAviso)
          /* Con SU hora: un hecho nuevo de la misma rama que llegó mientras tanto queda pendiente. Al milisegundo: la base
             guarda microsegundos y la hora que volvió a JavaScript, no. */
          .where(sql<boolean>`date_trunc('milliseconds', recibido_el) = ${recibidoEl}`)
          .execute();
      });
      // El territorio viaja en la respuesta: es lo que permite comprobar de un vistazo que el aviso
      // llegó al lugar correcto —closer, setter, o ninguno— sin entrar a la base.
      return ok({
        recibido: true,
        procesado: true,
        territorio: r.territorio,
        mensaje: r.mensaje,
        // De un aviso de oportunidad: si la etapa avanzó, quedó igual o retrocedió, y cuántos eventos escribió.
        ...(r.historia ? { historia: r.historia } : {}),
      });
    }

    // No se interpretó, y no es un error de entrega. Queda con su motivo para que el monitor lo cuente.
    await anotarError(ambito, idDelAviso, recibidoEl, motivoDelAviso(r));
    return ok({ recibido: true, procesado: false, porque: r.tipo });
  } catch (e) {
    /* El mapeo falló. El evento YA está guardado, así que se anota y se responde 200: GoHighLevel desactiva el
       workflow por fallos repetidos. Si es de oportunidad, el motivo es transitorio y lo reprocesa el barrido con la
       misma fila (`lib/negocio/reprocesoDeAvisos.ts`); un mensaje lo trae el sondeo. El mensaje va al registro, no al
       cuerpo. */
    console.error(`avisos/crm: ${evento ?? '(sin evento)'} falló`, e);
    await anotarError(ambito, idDelAviso, recibidoEl, MOTIVO_FALLO);
    return ok({ recibido: true, procesado: false, porque: 'fallo_de_mapeo' });
  }
}

/** Anota por qué un aviso no se procesó. Sus lectores son el monitor de frescura y el reproceso de las oportunidades. */
async function anotarError(ambito: AmbitoDeUnCliente, id: string, recibidoEl: Date, motivo: string): Promise<void> {
  try {
    await conOrganizacion(ambito, async () => {
      await datos()
        .updateTable('avisos_del_crm')
        .set({ error: motivo.slice(0, 500) } as never)
        .where('id', '=', id)
        .where(sql<boolean>`date_trunc('milliseconds', recibido_el) = ${recibidoEl}`)
        .execute();
    });
  } catch (e) {
    // Si ni el error se pudo anotar, se registra y se sigue: la respuesta al proveedor no cambia.
    console.error('avisos/crm: no se pudo anotar el error del aviso', e);
  }
}
