// Los porcentajes de comisión de la empresa. Los fija quien administra, no la persona.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA CAPACIDAD ES `credenciales.*`, Y ES CONTRAINTUITIVO
//
// La elección obvia sería `configuracion.editar`, y está MAL por una razón medida. El reparto de
// capacidades se deriva por exclusión de prefijos: el rol `usuario` recibe **todas menos**
// `organizaciones.%`, `usuarios.%`, `roles.%` y `credenciales.%`. O sea que `configuracion.editar`
// **la tienen los tres roles, incluido `usuario`** — y con ella, cualquier persona del equipo podría
// fijarse su propio porcentaje con una petición a mano, y la auditoría lo registraría como un cambio
// legítimo.
//
// Ese defecto exacto ya se pagó una vez en este proyecto, y está escrito en `001_catalogo.sql`: al
// administrador se le quitaron las capacidades de `usuarios.%` porque *"la frontera vivía sólo en la
// interfaz… una petición a mano a POST /api/admin/usuarios funcionaba. La regla era cosmética"*.
//
// Una capacidad nueva —`comision.configurar`— caería **sola** en `usuario` por la misma derivación, y
// excluirla exigiría agregar a mano un cuarto `not like` al reparto y volver a correr `db/arranque`
// contra producción. Es más limpio conceptualmente y más caro operativamente; queda anotado.
//
// Así que se usa `credenciales.%`, que es la única familia que ya excluye a `usuario` **y** que ya es
// la puerta de la pantalla Ajustes. El costo honesto de esa decisión: la descripción de esa capacidad
// habla de credenciales y ahora también gobierna sueldos. Queda dicho acá en vez de disimulado.
//
// ── Y `ADR-0304`: EL GET PIDE EXACTAMENTE LO MISMO QUE EL DE CREDENCIALES ────
//
// Las dos operaciones viven en la pantalla `credenciales`, así que la comparación de conjuntos las
// obliga a pedir lo mismo. Está copiado de `app/api/admin/credenciales/route.ts`, no deducido:
// `['credenciales.ver']` para leer y `['credenciales.editar']` para escribir.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion, datos } from '../../../../lib/datos/contexto.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { porcentajesDeLaEmpresa, TIPO_CLOSER } from '../../../../lib/negocio/comision.ts';
import {
  TIPO_SETTER_DIFERIDO,
  TIPO_SETTER_DIRECTO,
} from '../../../../lib/negocio/comisionDelSetter.ts';
import { auditarAdministracion } from '../../../../lib/autenticacion/auditoria.ts';
import { usuarioObjetivo } from '../../../../lib/administracion/objetivo.ts';

export const PANTALLA = 'credenciales';

/**
 * Los TRES tramos que este endpoint puede escribir. **Lista cerrada.**
 *
 * Es la misma lista del `check` de la migración 025, y se repite acá a propósito: el `check` rechaza
 * un tramo inventado con el mensaje del motor —un 409 que no explica nada— y esto lo rechaza con un
 * motivo que dice qué valores hay. Y con `find` sobre la lista y no un `startsWith('setter')`: con
 * eso, un `setter_lo_que_sea` pasaría la validación y llegaría a la base.
 */
const TRAMOS = [TIPO_CLOSER, TIPO_SETTER_DIRECTO, TIPO_SETTER_DIFERIDO] as const;

const MOTIVOS: Record<string, string> = {
  cuerpo_invalido: 'El cuerpo de la petición no es JSON válido.',
  falta_usuario: 'Hay que decir de quién es el porcentaje.',
  tramo_invalido:
    'Hay que decir de qué tramo es el porcentaje: «closer», «setter_directo» (sus ventas chicas) o ' +
    '«setter_diferido» (lo que cobra sobre las ventas del closer en los leads que originó).',
  porcentaje_invalido:
    'El porcentaje tiene que ser un número entre 0 y 100, o `null` para dejarlo sin configurar. ' +
    'No es lo mismo: `0` significa que esa persona no cobra comisión, y `null` que todavía nadie ' +
    'lo definió.',
};

export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['credenciales.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  /* ── EL TRAMO VIENE EN LA CADENA DE CONSULTA, Y TIENE OMISIÓN ────────────────
   *
   * Acá sí hay valor por omisión —`closer`— y en el `PUT` no, y la asimetría es deliberada: **leer
   * el tramo equivocado se ve, escribirlo no.** Quien lea `closer` cuando quería el setter ve nombres
   * con números que no reconoce; quien ESCRIBA `closer` sin querer le cambia el sueldo a alguien en una
   * fila que la otra pantalla no muestra, y nadie lo nota.
   *
   * Y la omisión es la que conserva el contrato que ya existía: este `GET` respondía los porcentajes
   * del closer, y sigue haciendo eso para quien no pida otra cosa. */
  const pedido = new URL(peticion.url).searchParams.get('tramo');
  const tramo = pedido === null ? TIPO_CLOSER : TRAMOS.find((t) => t === pedido);
  if (tramo === undefined) return rechazo('peticion_invalida', MOTIVOS['tramo_invalido']);

  const usuarios = await conOrganizacion(contexto.orgEfectiva, () => porcentajesDeLaEmpresa(tramo));
  return ok({ usuarios, tramo });
}

/**
 * Fija —o borra— el porcentaje de UNA persona. **Nunca toca la meta.**
 *
 * Las dos columnas se escriben desde endpoints distintos a propósito: la meta la fija la propia
 * persona y el porcentaje quien administra. Un solo endpoint que escribiera las dos con `?? null`
 * borraría la mitad ajena en cada guardado — y el síntoma sería «se me borró la meta» sin ninguna
 * pista de quién la borró.
 */
export async function PUT(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['credenciales.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return rechazo('peticion_invalida', MOTIVOS['cuerpo_invalido']);
  }
  const c = cuerpo as { usuarioId?: unknown; porcentaje?: unknown; tramo?: unknown } | null;

  /* ── EL TRAMO, Y POR QUÉ ES OBLIGATORIO SIN VALOR POR OMISIÓN ──────────────
   *
   * Un `?? TIPO_CLOSER` acá convierte un olvido del navegador en **escribirle el sueldo de closer** a
   * esa persona, en una fila que la pantalla del setter no muestra. Dos defectos de un solo descuido:
   * el porcentaje que se quería cargar no aparece, y aparece uno que nadie decidió.
   *
   * Se valida contra la lista y no contra el `check` de la base: el `check` también lo rechazaría,
   * pero con un 409 y el mensaje del motor. */
  const tramo = TRAMOS.find((t) => t === c?.tramo);
  if (tramo === undefined) return rechazo('peticion_invalida', MOTIVOS['tramo_invalido']);

  // Solo que VENGA. Que sea un uuid válido lo decide `usuarioObjetivo(`, que devuelve 404 tanto para
  // un identificador mal formado como para uno de otra empresa — *"distinguirlos también es un
  // oráculo, más débil pero gratis de cerrar"*.
  if (typeof c?.usuarioId !== 'string' || c.usuarioId.trim() === '') {
    return rechazo('peticion_invalida', MOTIVOS['falta_usuario']);
  }

  /* ── PRESENCIA, Y UNA CORRECCIÓN A LO QUE ESTE COMENTARIO DECÍA ───────────
   *
   * Decía que `Object.hasOwn` evita que `{"porcentaje": null}` se lea como «no vino». **Eso es falso
   * acá**, y lo demostró una mutación: sobre un cuerpo que viene de JSON, `Object.hasOwn(c, 'x')` y
   * `c.x !== undefined` son equivalentes, porque JSON no puede expresar `undefined` — un campo o
   * viene con un valor, o no viene. La distinción existe en JavaScript, no en la frontera HTTP.
   *
   * Se usa `Object.hasOwn` igual, por una razón más chica y honesta: es la forma que usa
   * `PUT /api/admin/credenciales` para lo mismo, y dos endpoints hermanos que leen la presencia de un
   * campo de dos maneras distintas invitan a preguntarse cuál de las dos está mal.
   *
   * Lo que SÍ importa de este bloque es lo de abajo: un cuerpo **sin** el campo se rechaza en vez de
   * responder «guardado». Este endpoint tiene una sola cosa que hacer, y un cuerpo que no la pide es
   * un error del cliente, no una orden de no hacer nada. Y `porcentaje: null` **sí** es una orden:
   * borrar, que es la única manera de volver de «0 % a propósito» a «nadie lo configuró».
   */
  if (!Object.hasOwn(c, 'porcentaje')) {
    return rechazo('peticion_invalida', MOTIVOS['porcentaje_invalido']);
  }
  const p = c.porcentaje;
  const esNumeroValido = typeof p === 'number' && Number.isFinite(p) && p >= 0 && p <= 100;
  if (p !== null && !esNumeroValido) {
    // Una cadena vacía cae acá, y tiene que caer: es el formulario enviado sin tocar el campo, y
    // guardarla como 0 afirmaría que esa persona no cobra comisión.
    return rechazo('peticion_invalida', MOTIVOS['porcentaje_invalido']);
  }
  const porcentaje = p === null ? null : (p as number);

  const objetivo = c.usuarioId;

  /* ── QUE LA PERSONA SEA DE ESTA EMPRESA ─────────────────────────────────────
   *
   * La clave foránea compuesta ya lo impide, y el `insert` fallaría — pero con un rechazo de la base:
   * un 409 con el mensaje del motor. Comprobarlo antes da un 404, que es lo que `ADR-0501` pide: la
   * existencia de un usuario de otra empresa no se confirma ni se niega.
   *
   * Va por `usuarioObjetivo(`, el único lugar del sistema donde vive el filtro por organización de
   * esa tabla, y **por la conexión de identidad**. Las dos cosas se aprendieron a golpes en este
   * archivo:
   *
   *   1 · La primera versión tenía su propio `selectFrom('usuarios')` acá, y el guardia de ADR-0501
   *       disparó con razón: una consulta más es un lugar más donde olvidarse la línea.
   *   2 · La segunda llamó a `usuarioObjetivo(datos(), …)` —con la conexión del inquilino— y falló
   *       con **«permission denied for table usuarios»**. El rol del inquilino tiene concedidas
   *       cinco columnas de esa tabla y `es_admin_principal` no es una de ellas. O sea que esa
   *       función es de identidad, y no por convención: por privilegios.
   *
   * ── ADR-0209 · POR QUÉ CRUZAR LOS DOS DOMINIOS ACÁ ES ACEPTABLE ───────────
   *
   * La pregunta obligatoria es qué queda a medias si la segunda mitad falla: **nada**, porque la
   * primera no escribe. Es la misma forma y la misma justificación que
   * `app/api/mensajes/ingesta/route.ts`: se lee de identidad, se escribe en negocio.
   *
   * Y la auditoría NO va por acá: va con la conexión del inquilino, en la misma transacción que la
   * comisión. Ver abajo.
   */
  const persona = await conIdentidad((db) => usuarioObjetivo(db, objetivo, contexto.orgEfectiva));
  if (!persona) return rechazo('no_encontrado');

  await conOrganizacion(contexto.orgEfectiva, async () => {
    await datos()
      .insertInto('comisiones')
      .values({
        usuario_id: objetivo,
        tipo: tramo,
        porcentaje,
        actualizado_el: new Date(),
        actualizado_por: contexto.usuarioId,
      } as never)
      .onConflict((oc) =>
        // **Solo `porcentaje`.** `meta_mensual` no aparece, así que un guardado acá no puede
        // pisarla.
        oc.columns(['org_id', 'usuario_id', 'tipo']).doUpdateSet({
          porcentaje,
          actualizado_el: new Date(),
          actualizado_por: contexto.usuarioId,
        } as never),
      )
      .execute();

    /* ── LA AUDITORÍA, EN LA MISMA TRANSACCIÓN ────────────────────────────
     *
     * Es un número que decide cuánto cobra una persona: quién lo cambió y cuándo tiene que ser
     * reconstruible.
     *
     * Y va por la conexión del INQUILINO, no por `conIdentidad(`. Se puede porque la migración 005 le
     * da a ese rol `insert` sobre `identidad.auditoria_accesos` con una política que exige que
     * `org_id` sea el de la sesión. Eso es mejor que cruzar los dos dominios: **la comisión y su
     * rastro van en la misma transacción**, así que no existe el estado «se cambió el porcentaje y no
     * quedó registrado quién».
     */
    await auditarAdministracion(datos(), {
      accion: 'comision_configurada',
      actor: contexto.usuarioId,
      objetivo,
      orgId: contexto.orgEfectiva,
    });
  });

  /* Se devuelve la lista COMPLETA **del tramo que se tocó**, no un `{ ok: true }`: quien guardó tiene
     que ver lo que quedó, y un «se guardó» sin haber leído de vuelta es un éxito sin verificar.
     Del tramo que se tocó y no de los tres: devolver los tres obligaría a cada pantalla a elegir el
     suyo, y elegir mal se ve como un número plausible. */
  const usuarios = await conOrganizacion(contexto.orgEfectiva, () => porcentajesDeLaEmpresa(tramo));
  return ok({ usuarios, tramo });
}
