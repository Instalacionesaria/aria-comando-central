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
// ═══════════════════════════════════════════════════════════════════════════════

import { createHash, timingSafeEqual } from 'node:crypto';
import { sql } from 'kysely';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../../../lib/datos/contexto.ts';
import { resolverAccesoAGhl } from '../../../../lib/credenciales/resolver.ts';
import { locationIdDelCuerpo } from '../../../../lib/ghl/avisos.ts';
import { leerCuerpoAcotado } from '../../../../lib/http/cuerpoAcotado.ts';
import { interpretarAviso } from '../../../../lib/negocio/avisoDelCrm.ts';

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

/** Cuántos avisos por hora y por empresa antes de frenar. */
const TOPE_POR_HORA = 240;

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

  // ── 3 · LA EMPRESA, POR EL HASH DEL SECRETO ────────────────────────────────
  const fila = await conIdentidad(async (db) =>
    db
      .selectFrom('organizaciones_credenciales as c')
      .innerJoin('organizaciones as o', 'o.id', 'c.org_id')
      .select(['c.org_id', 'c.aviso_secreto_hash', 'o.activa'])
      .where('c.aviso_secreto_hash', '=', sha256(secreto))
      .executeTakeFirst(),
  );

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

  // ── 4 · EL CUERPO Y LA ATRIBUCIÓN, que se COMPARA y no rutea ───────────────
  let cuerpo: Record<string, unknown> | null = null;
  try {
    const crudo: unknown = JSON.parse(leido.texto);
    cuerpo = crudo !== null && typeof crudo === 'object' ? (crudo as Record<string, unknown>) : null;
  } catch {
    cuerpo = null;
  }

  const acceso = await conIdentidad((db) => resolverAccesoAGhl(db, orgId));
  const location = locationIdDelCuerpo(cuerpo);
  const atribucion =
    cuerpo === null
      ? 'ilegible'
      : location === null
        ? 'ausente'
        : acceso.tipo === 'listo' && location === acceso.locationId
          ? 'coincide'
          : 'discordante';

  const evento = new URL(peticion.url).searchParams.get('evento');
  const huella = sha256(leido.texto);

  // ── 5 · LA CUARENTENA: se guarda CRUDO antes de interpretar ────────────────
  let guardado: { id: string; repeticiones: number } | undefined;
  try {
    guardado = await conOrganizacion(orgId, async () => {
      // El tope por hora va DENTRO del contexto, o sea después de autenticar: acá ya sabemos de quién
      // es. El techo de lo no autenticado lo pone la pimienta del paso 1.
      const cuantos = await datos()
        .selectFrom('avisos_del_crm')
        .select(({ fn }) => fn.countAll<string>().as('n'))
        .where('recibido_el', '>', new Date(Date.now() - 60 * 60 * 1000))
        .executeTakeFirst();
      if (Number(cuantos?.n ?? 0) >= TOPE_POR_HORA) return undefined;

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
        } as never)
        .onConflict((oc) =>
          oc.columns(['org_id', 'huella']).doUpdateSet({
            // `+ 1` en SQL y no leído-y-sumado: dos entregas simultáneas del mismo cuerpo sumarían
            // una sola vez si el valor se calculara en la aplicación.
            repeticiones: sql`avisos_del_crm.repeticiones + 1`,
            visto_ultimo_el: new Date(),
          } as never),
        )
        .returning(['id', 'repeticiones'])
        .execute();
      return filas[0] as { id: string; repeticiones: number } | undefined;
    });
  } catch (e) {
    // Nuestra base no respondió. 503 para que un proveedor que reintente pueda — y NUNCA el mensaje
    // del motor (`ADR-0704`), que puede llevar nombres de tabla.
    console.error('avisos/crm: no se pudo guardar el aviso', e);
    return rechazo('base_no_disponible');
  }

  if (guardado === undefined) {
    console.warn(`avisos/crm: la empresa pasó el tope de ${TOPE_POR_HORA} avisos por hora.`);
    return rechazo('avisos_demasiados');
  }

  // Un cuerpo que no es JSON se guardó y no se interpreta: es la única evidencia de que el proveedor
  // cambió de forma, y responder 400 la perdería.
  if (cuerpo === null) return ok({ recibido: true, procesado: false, porque: 'ilegible' });

  // Sin credencial del CRM no se puede refrescar el contacto. El aviso queda guardado para reprocesar.
  if (acceso.tipo !== 'listo') {
    await anotarError(orgId, guardado.id, `sin credencial del CRM: ${acceso.que}`);
    return ok({ recibido: true, procesado: false, porque: 'sin_credencial' });
  }

  // ── 6 · INTERPRETAR ───────────────────────────────────────────────────────
  try {
    const r = await interpretarAviso(orgId, acceso, evento, cuerpo);

    if (r.tipo === 'listo') {
      await conOrganizacion(orgId, async () => {
        await datos()
          .updateTable('avisos_del_crm')
          .set({ procesado_el: new Date(), error: null } as never)
          .where('id', '=', guardado.id)
          .execute();
      });
      // El territorio viaja en la respuesta: es lo que permite comprobar de un vistazo que el aviso
      // llegó al lugar correcto —closer, setter, o ninguno— sin entrar a la base.
      return ok({ recibido: true, procesado: true, territorio: r.territorio, mensaje: r.mensaje });
    }

    // No se interpretó, y no es un error de entrega. Queda con su motivo para que el monitor lo cuente.
    await anotarError(orgId, guardado.id, r.tipo === 'desconocido' ? `evento desconocido: ${r.evento ?? '(sin parámetro)'}` : r.tipo);
    return ok({ recibido: true, procesado: false, porque: r.tipo });
  } catch (e) {
    /* El mapeo falló. El evento YA está guardado, así que se anota y se responde 200: reintentar no
       ayudaría —el problema es nuestro mapeo, no la entrega— y haría que GoHighLevel desactive el
       workflow por fallos repetidos. El mensaje va al registro, no al cuerpo. */
    console.error(`avisos/crm: ${evento ?? '(sin evento)'} falló`, e);
    await anotarError(orgId, guardado.id, 'el mapeo no pudo completarse');
    return ok({ recibido: true, procesado: false, porque: 'fallo_de_mapeo' });
  }
}

/** Anota por qué un aviso no se procesó. Su lector es el monitor de frescura. */
async function anotarError(orgId: string, id: string, motivo: string): Promise<void> {
  try {
    await conOrganizacion(orgId, async () => {
      await datos()
        .updateTable('avisos_del_crm')
        .set({ error: motivo.slice(0, 500) } as never)
        .where('id', '=', id)
        .execute();
    });
  } catch (e) {
    // Si ni el error se pudo anotar, se registra y se sigue: la respuesta al proveedor no cambia.
    console.error('avisos/crm: no se pudo anotar el error del aviso', e);
  }
}
