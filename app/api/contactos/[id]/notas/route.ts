// La pestaña Notas de la ficha: leer y escribir.
//
// ═══════════════════════════════════════════════════════════════════════════════
// UN SOLO DESTINO Y UN SOLO CAMINO
//
// El `04` § 4 llama a esto «el defecto que costó más caro de toda la ficha», y eran **tres
// apilados**, ninguno de los cuales daba error:
//
//   · la nota se escribía en **otra tabla** según por qué camino se registrara, así que aparecía
//     en un lado y no en el otro;
//   · un módulo **no le hablaba a este endpoint por ninguna vía** —ni escribir, ni leer, ni
//     borrar— y sus notas vivían en memoria: **se perdían al recargar**;
//   · al recargar, la lista se reconstruía **con las notas vacías**, borrando la que se acababa
//     de crear.
//
// De la medición: *"de 13 resultados registrados con nota, solo 2 llegaron a la tabla"*.
//
// Las tres reglas que salieron de ahí, y las tres viven acá:
//
//   **1 · Un solo destino y un solo camino.** `negocio.notas` es una tabla y esta ruta es la
//   única puerta. Las notas del closer y las del setter van al mismo lugar por el mismo endpoint,
//   que acepta los dos roles — es el mismo dato sobre el mismo contacto, y *"no debería haber"* un
//   endpoint por rol.
//
//   **2 · Si la escritura falla, la respuesta lo dice.** Aunque sea accesoria. Una nota que no se
//   guardó con una operación que responde éxito es exactamente «un éxito que no ocurrió».
//
//   **3 · Recargar hace fusión, no reemplazo.** Ésa es del cliente, y está en `Ficha.jsx`.
//
// ── LAS DOS CAPACIDADES SON DISTINTAS, Y NO ROMPE `ADR-0304` ────────────────
//
// Leer pide `contactos.ver` como las otras cuatro pestañas; escribir pide `contactos.comentar`.
// La regla dice que las operaciones de una pantalla piden el mismo conjunto, y el defecto que
// previene es de LECTURAS —*"una sección con datos y cuatro en blanco"*—. Un botón que no está no
// es un panel vacío: se ve que la nota se puede leer y no escribir. El catálogo separa las dos a
// propósito.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../../lib/autorizacion/portero.ts';
import { SIN_SECCION } from '../../../../../lib/autorizacion/secciones.ts';
import { ok, rechazo } from '../../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion, datos } from '../../../../../lib/datos/contexto.ts';
import { notasDeLaFicha } from '../../../../../lib/negocio/ficha.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El tope del cuerpo. Una nota es una nota, no un documento. */
const TOPE = 4000;

const MOTIVOS = {
  cuerpo_invalido: 'El cuerpo de la petición no es JSON válido.',
  falta_texto: 'La nota está vacía.',
  demasiado_larga: `La nota no puede pasar de ${TOPE} caracteres.`,
} as const;

export async function GET(
  peticion: Request,
  ctx: RouteContext<'/api/contactos/[id]/notas'>,
): Promise<Response> {
  const contexto = await exigir(peticion, ['contactos.ver'], SIN_SECCION);
  if (contexto instanceof Response) return contexto;

  const { id } = await ctx.params;
  if (!UUID.test(id)) return rechazo('no_encontrado');

  const r = await conOrganizacion(contexto.orgEfectiva, () => notasDeLaFicha(id));
  return ok({ notas: r.filas, falta: r.falta });
}

export async function POST(
  peticion: Request,
  ctx: RouteContext<'/api/contactos/[id]/notas'>,
): Promise<Response> {
  const contexto = await exigir(peticion, ['contactos.comentar'], SIN_SECCION);
  if (contexto instanceof Response) return contexto;

  const { id } = await ctx.params;
  if (!UUID.test(id)) return rechazo('no_encontrado');

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return rechazo('peticion_invalida', MOTIVOS.cuerpo_invalido);
  }
  const texto = (cuerpo as { cuerpo?: unknown } | null)?.cuerpo;
  if (typeof texto !== 'string' || texto.trim().length === 0) {
    return rechazo('peticion_invalida', MOTIVOS.falta_texto);
  }
  if (texto.length > TOPE) return rechazo('peticion_invalida', MOTIVOS.demasiado_larga);

  const escrita = await conOrganizacion(contexto.orgEfectiva, async () => {
    // El contacto tiene que existir EN ESTA ORGANIZACIÓN, y no se comprueba con un `select`
    // aparte: la clave foránea compuesta `(org_id, contacto_id)` ya lo garantiza, y el
    // aislamiento por fila hace que un contacto de otra empresa no exista para esta consulta.
    //
    // Se comprueba igual antes de insertar, y no es redundante: sin esto el fallo llegaría como
    // un `23503` que hay que traducir, y `ADR-0704` prohíbe devolver el mensaje de la base. Un
    // 404 dicho a tiempo es más barato que un error estructural traducido.
    const existe = await datos()
      .selectFrom('contactos')
      .select('id')
      .where('id', '=', id)
      .executeTakeFirst();
    if (!existe) return null;

    return datos()
      .insertInto('notas')
      .values({
        contacto_id: id,
        cuerpo: texto.trim(),
        // QUIÉN la escribió, obligatorio. `null` en esta columna significa «la importó el
        // sistema desde el CRM», así que dejarla vacía acá haría pasar una nota de una persona
        // por una nota importada — y el `04` § 3 dice que atribuirle a alguien algo que no hizo
        // es lo que vuelve inútil el historial.
        autor_id: contexto.usuarioId,
        origen: 'plataforma',
      } as never)
      .returning(['id', 'creado_el'])
      .executeTakeFirst();
  });

  if (!escrita) return rechazo('no_encontrado');

  // Se devuelve la fila REAL, con su identificador y su fecha de la base. Es lo que le permite al
  // cliente fusionar en vez de reemplazar: sin el identificador de verdad, la nota optimista y la
  // guardada no se pueden atar y la recarga siguiente la duplica o la borra.
  //
  // Y VA EL NOMBRE DEL AUTOR, que no es un adorno: lo encontró la verificación en el navegador. Sin
  // este campo, la nota recién escrita apareció firmada por **`Sistema`** — porque el cliente no
  // tenía con qué llenar el autor y `null` significa «la importó el sistema». Se corrigía sola al
  // recargar, pero mientras tanto atribuía a un automatismo lo que escribió una persona, que es
  // exactamente lo que el `04` § 3 dice que vuelve inservible el historial.
  //
  // Lo manda el SERVIDOR y no lo pone la pantalla desde su sesión: el autor de la fila es el que se
  // guardó, y que las dos cosas coincidan no puede depender de que el cliente elija bien.
  return ok(
    { creada: true, id: escrita.id, creadoEl: escrita.creado_el, autor: contexto.usuarioNombre },
    201,
  );
}
