// ADR-0604 — Sin credencial, la organización no opera y lo dice.
// ADR-0606 — Un estado ausente y uno vencido no se muestran igual.
//
// Los ajustes de la organización: sus tres credenciales y sus tres identificadores de cuenta.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL CAMINO Y EL MÉTODO SON UNA DECISIÓN, NO UNA LECTURA
//
// **Ningún documento de los catorce da una ruta de credenciales.** Un grep de `/credenciales` sobre
// la especificación devuelve cero: el `03` § 6 lista rutas literales de autenticación y el `09` § 5
// también, y ninguna es de credenciales.
//
// Así que `GET`/`PUT /api/admin/credenciales` sigue la forma de las rutas de administración que ya
// existen, y queda declarado en `docs/ETAPA-6.md`. Lo que **sí** es del documento es todo lo demás:
// el enmascarado, los cuatro estados con su texto, y que el valor no sale nunca.
//
// ── EL ENMASCARADO SE CALCULA EN EL SERVIDOR ─────────────────────────────────
//
// `resolverCredenciales()` devuelve `vistaPrevia`, nunca el valor. Si el valor completo viajara para
// enmascararlo en el navegador, el secreto ya salió y el asterisco sería decoración sobre un dato
// que está en las herramientas de desarrollo.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ETAPA 11 · LO QUE ESTA RUTA HACÍA MAL, Y ERA DESTRUCTIVO
//
// Aceptaba dos campos —`crmToken` y `crmRefresco`— y escribía los dos SIEMPRE:
//
//     crm_refresh_cifrado: typeof refresco === 'string' && refresco ? cifrar(refresco) : null
//
// O sea que **rotar el token sin volver a mandar el de refresco BORRABA el de refresco**. Y no
// fallaba: la respuesta decía `activa` con su vista previa, todo verde. El síntoma aparecía días
// después, cuando el token vencía y `tokenVigente()` no encontraba con qué renovarlo: la
// organización quedaba desconectada y el registro decía que alguien había cargado credenciales
// correctamente.
//
// ── LA REGLA NUEVA: AUSENTE Y NULO NO SON LO MISMO ──────────────────────────
//
// Solo se escriben los campos **presentes en el cuerpo**. Un campo que no viene no se toca; para
// borrarlo hay que mandar `null` explícito. Es la misma distinción que este sistema hace en todas
// partes —*"un valor significa una sola cosa"*— aplicada al cuerpo de la petición: "no te lo mando"
// y "borralo" son dos intenciones distintas y antes eran indistinguibles.
//
// Y es lo que hace posible la pantalla de Ajustes tal como se pidió: cada empresa configura **lo
// suyo**, un campo a la vez, sin tener que volver a tipear los otros dos secretos para que no se
// borren.
//
// ── LAS TRES CREDENCIALES, Y POR QUÉ NO UNA VARIABLE DE ENTORNO ─────────────
//
// `ia_clave_cifrada` existía desde la migración 006 y **nada la escribía**, así que la pantalla
// `icp` respondía `sin_llave_de_ia` para siempre. El arreglo que se ve fácil desde lejos es una
// `ANTHROPIC_API_KEY` global en Vercel, y es exactamente la fuga que
// `lib/credenciales/resolver.ts` documenta en su encabezado: el consumo de todas las
// organizaciones facturado a una, sin que nada falle.
// ═══════════════════════════════════════════════════════════════════════════════

import { createHash, randomBytes } from 'node:crypto';
import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { cifrar } from '../../../../lib/credenciales/cifrado.ts';
import { resolverCredenciales } from '../../../../lib/credenciales/resolver.ts';
import { auditarAdministracion } from '../../../../lib/autenticacion/auditoria.ts';

export const PANTALLA = 'credenciales';

/**
 * El tope de largo de un campo. Ni una validación de formato ni una adivinanza del proveedor:
 * un freno para que un cuerpo de un megabyte no llegue a `cifrar()`.
 *
 * NO se valida el formato de los secretos —ni `sk-ant-`, ni un largo exacto— y es a propósito.
 * Los proveedores cambian sus prefijos y sus largos sin avisar, y una validación de formato que
 * se queda vieja rechaza una credencial VÁLIDA con el mensaje "clave inválida". Quien la carga
 * mira su clave, la ve bien, y no tiene forma de saber que el problema es nuestro.
 *
 * Lo que sí se comprueba es que la credencial SIRVA, y eso no se puede saber sin usarla: es
 * trabajo del cliente de GoHighLevel, no de esta validación.
 */
const TOPE = 4096;

/**
 * Los campos que esta ruta acepta, y a qué columna va cada uno.
 *
 * `secreto: true` = se cifra al guardar y nunca sale. `false` = identificador de una cuenta
 * ajena, va y viene completo (ver `Credenciales` en el resolvedor).
 */
const CAMPOS = [
  { entrada: 'crmToken', columna: 'crm_token_cifrado', secreto: true },
  { entrada: 'crmRefresco', columna: 'crm_refresh_cifrado', secreto: true },
  { entrada: 'iaClave', columna: 'ia_clave_cifrada', secreto: true },
  { entrada: 'pagosClave', columna: 'pagos_clave_cifrada', secreto: true },
  { entrada: 'crmCuentaId', columna: 'crm_cuenta_id', secreto: false },
  // El calendario de agendamiento. `secreto: false`: es el identificador de un calendario ajeno, va y
  // viene completo. Y NO es un filtro del barrido — ver la migración 016.
  { entrada: 'crmCalendarioId', columna: 'crm_calendario_id', secreto: false },
  { entrada: 'pagosComercioId', columna: 'pagos_comercio_id', secreto: false },
  { entrada: 'fundacionesClienteId', columna: 'fundaciones_cliente_id', secreto: false },
] as const;

export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['credenciales.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  const credenciales = await conIdentidad(async (db) =>
    resolverCredenciales(db, contexto.orgEfectiva),
  );
  return ok(credenciales);
}

export async function PUT(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['credenciales.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  // ── LOS RECHAZOS VAN POR `rechazo(`, NO POR `ok(…, 400)` ──────────────────
  //
  // La versión anterior devolvía `ok({ guardada: false, motivo }, 400)`, y eso **no llegaba a
  // la pantalla**: `lib/http/cliente.ts` clasifica cualquier respuesta no-ok como
  // `{ tipo: 'rechazado' }` y solo conserva `codigo` y `detalle` del cuerpo. El `motivo` se
  // perdía en el camino, así que los seis motivos distintos se veían todos como
  // «Rechazado (400)» — seis diagnósticos colapsados en uno, que es el defecto que `ADR-0305`
  // persigue.
  //
  // `peticion_invalida` ya existe en la tabla de rechazos con su 400. Lo que distingue un caso
  // de otro va en el `detalle`, que el cliente sí conserva y la pantalla muestra tal cual.
  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return rechazo('peticion_invalida', 'El cuerpo de la petición no es JSON válido.');
  }
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) {
    return rechazo('peticion_invalida', 'El cuerpo tiene que ser un objeto con los campos a guardar.');
  }
  const recibido = cuerpo as Record<string, unknown>;

  // `Object.hasOwn` y NO `!== undefined`. Con la segunda forma, `{"crmToken": undefined}` en el
  // JSON —que `JSON.parse` convierte en la clave ausente— y la clave realmente ausente serían
  // lo mismo; pero peor: `{"iaClave": null}` pasaría a leerse como "no vino" y **borrar dejaría
  // de funcionar**, en silencio y solo para ese caso.
  const cambios: Record<string, string | null> = {};
  for (const campo of CAMPOS) {
    if (!Object.hasOwn(recibido, campo.entrada)) continue;
    const valor = recibido[campo.entrada];

    // `null` explícito = borrar. Es la única forma de borrar, y tiene que ser explícita.
    if (valor === null) {
      cambios[campo.columna] = null;
      continue;
    }
    if (typeof valor !== 'string') {
      return rechazo(
        'peticion_invalida',
        `El campo ${campo.entrada} tiene que ser texto, o null para borrarlo.`,
      );
    }
    const limpio = valor.trim();
    // La cadena vacía NO es un borrado. Es el caso del formulario enviado sin tocar: aceptarla
    // como borrado haría que abrir Ajustes y guardar borre los tres secretos. Quien quiera
    // borrar manda `null`.
    if (limpio.length === 0) {
      return rechazo(
        'peticion_invalida',
        `El campo ${campo.entrada} llegó vacío. Para quitarlo hay que mandar null, que es una intención distinta.`,
      );
    }
    if (limpio.length > TOPE) {
      return rechazo(
        'peticion_invalida',
        `El campo ${campo.entrada} supera los ${TOPE} caracteres: eso no es una credencial.`,
      );
    }
    cambios[campo.columna] = campo.secreto ? cifrar(limpio) : limpio;
  }

  if (Object.keys(cambios).length === 0) {
    return rechazo(
      'peticion_invalida',
      'No vino ningún campo conocido. Nada se guardó, y se dice en vez de responder que sí.',
    );
  }

  // El estado del CRM se pone en `activa` SOLO si vino un token de CRM nuevo. Antes se ponía
  // siempre, así que cargar la llave de IA de una organización con el token de GoHighLevel
  // vencido lo declaraba activo — y la pantalla decía que la integración andaba mientras cada
  // llamada a GHL fallaba.
  if (Object.hasOwn(cambios, 'crm_token_cifrado')) {
    cambios['crm_estado'] = cambios['crm_token_cifrado'] === null ? 'ausente' : 'activa';
    // Y el vencimiento del token viejo no puede sobrevivir al nuevo: `tokenVigente()` lo lee
    // para decidir si hay que renovar, y una fecha del token anterior lo haría renovar uno que
    // acaba de cargarse, o —peor— tratarlo como vigente cuando ya no lo es.
    cambios['crm_expira_el'] = null;
  }

  return conIdentidad(async (db) => {
    // La fila puede no existir: una organización nueva nace sin ninguna (05 § 2). `on conflict` es
    // lo que hace que cargar la primera credencial y rotar una existente sean el mismo camino.
    //
    // Y en la rama de conflicto se escriben SOLO las columnas de `cambios`, que es la propiedad
    // que hace que esto no borre nada que no se le pidió borrar.
    await db
      .insertInto('organizaciones_credenciales')
      .values({
        org_id: contexto.orgEfectiva,
        actualizado_por: contexto.usuarioId,
        actualizado_el: new Date(),
        ...cambios,
      } as never)
      .onConflict((oc) =>
        oc.column('org_id').doUpdateSet({
          actualizado_por: contexto.usuarioId,
          actualizado_el: new Date(),
          ...cambios,
        } as never),
      )
      .execute();

    // El tipo `Detalle` de la auditoría no tiene campo donde quepa un token, así que esto no
    // depende de que nadie se olvide: la credencial no puede quedar registrada aunque se quiera.
    await auditarAdministracion(db, {
      accion: 'credenciales_cargadas',
      actor: contexto.usuarioId,
      objetivo: contexto.orgEfectiva,
      orgId: contexto.orgEfectiva,
    });

    // Se devuelve el estado resuelto, no un `{ ok: true }`: quien la cargó tiene que ver que quedó
    // activa y con qué vista previa, o el "se guardó" es un éxito reportado sin verificar.
    return ok(await resolverCredenciales(db, contexto.orgEfectiva));
  });
}


/**
 * `POST` — GENERAR (o rotar) el secreto del aviso del CRM.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * EL SECRETO SE LO DAMOS AL CLIENTE, NO SE LO PEDIMOS
 *
 * Es la decisión que la plataforma anterior ya tomó, con el motivo escrito: *«un campo que se puede
 * dejar vacío se deja vacío»*. Si el secreto fuera un campo del formulario, la mitad de las empresas
 * quedaría sin él — y una empresa sin secreto no puede recibir avisos, o peor, invita a poner uno
 * corto y adivinable.
 *
 * Así que **no está en la tabla `CAMPOS`**: no se acepta un valor de afuera. Se generan 32 bytes con
 * `randomBytes` en el servidor, se guarda su `sha256`, y el valor completo se devuelve **UNA sola
 * vez**, en esta respuesta. El `GET` nunca lo trae, ni siquiera el hash.
 *
 * ── POR QUÉ ES UN `POST` EN ESTA MISMA RUTA Y NO UNA RUTA NUEVA ───────────
 *
 * Comparte la `PANTALLA` y la capacidad con el `PUT` que ya existe, así que una ruta aparte tendría
 * que repetir las dos — y `ADR-0304` exige que las operaciones de una pantalla pidan el mismo
 * conjunto, que es exactamente lo que estaría copiando.
 *
 * Y el portero se comprueba **método por método**, no por archivo: este `POST` llama a `exigir` por su
 * cuenta, igual que el `GET` y el `PUT`. Olvidarlo dejaría un generador de secretos abierto a
 * cualquiera con sesión.
 */
export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['credenciales.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  /* 32 bytes en base64url: 43 caracteres sin caracteres que haya que escapar en una cabecera HTTP ni
     en la interfaz de GoHighLevel. El mismo largo y la misma codificación que los tokens de sesión de
     este sistema, por el mismo motivo. */
  const secreto = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(secreto).digest('hex');

  return conIdentidad(async (db) => {
    /* `onConflict` porque la fila de credenciales puede no existir todavía: una empresa nueva puede
       querer configurar el aviso antes que el token del CRM, y no hay motivo para forzar el orden. */
    await db
      .insertInto('organizaciones_credenciales')
      .values({ org_id: contexto.orgEfectiva, aviso_secreto_hash: hash } as never)
      .onConflict((oc) =>
        oc.column('org_id').doUpdateSet({ aviso_secreto_hash: hash } as never),
      )
      .execute();

    /* Se audita QUE se generó, nunca el valor. El tipo `Detalle` de la auditoría no tiene campo donde
       quepa un secreto, así que esto no depende de que nadie se olvide. */
    await auditarAdministracion(db, {
      accion: 'aviso_secreto_generado',
      actor: contexto.usuarioId,
      objetivo: contexto.orgEfectiva,
      orgId: contexto.orgEfectiva,
    });

    /* ── SE DEVUELVE LA CABECERA COMPLETA, NO EL SECRETO SUELTO ──────────────
     *
     * Lo que hay que pegar en GoHighLevel es `<pimienta>.<secreto>`, así que devolver solo la mitad
     * derecha obligaría a alguien a armar la cabecera a mano — y la pimienta vive en una variable de
     * entorno, o sea que habría que ir a buscarla al panel de Vercel y pegarla en un chat o en un
     * documento. Cada uno de esos pasos es un lugar donde un secreto queda escrito.
     *
     * Devolviendo la cabecera armada, la pimienta **nunca sale de este servidor por otra vía**: la ve
     * quien administra la empresa, una vez, en la pantalla, y la copia entera.
     *
     * Es la ÚNICA vez que estos dos valores salen de acá. El `GET` no los trae ni siquiera hasheados,
     * y rotar invalida el anterior en el acto — el índice único es sobre una sola columna, así que no
     * hay dos vigentes.
     *
     * Si la pimienta no está configurada, la cabecera igual se devuelve con la marca visible: es
     * mejor que quien mira vea `FALTA_LA_PIMIENTA.<secreto>` y pregunte, que recibir una cabecera de
     * apariencia normal que la ruta va a rechazar siempre. */
    const pimienta = process.env.AVISO_PIMIENTA ?? 'FALTA_LA_PIMIENTA';
    return ok({
      ...(await resolverCredenciales(db, contexto.orgEfectiva)),
      avisoCabecera: `${pimienta}.${secreto}`,
      avisoPimientaConfigurada: process.env.AVISO_PIMIENTA !== undefined,
    });
  });
}
