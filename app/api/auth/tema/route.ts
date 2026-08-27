// ADR-0301 — Toda operación llama al portero.
//
// La preferencia de tema de quien está pidiendo. Una sola operación: PUT.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ NO ES `PATCH /api/auth/sesion`, QUE YA EXISTE
//
// Porque esa ruta exige `organizaciones.listar` y un rol de plataforma: es el conmutador de
// empresa. Colgarle el tema significaría o bien relajar su guardia —y entonces el conmutador queda
// abierto a quien no puede conmutar— o bien que sólo la gente de plataforma pueda elegir tema.
//
// ── LA CAPACIDAD ES `NINGUNA`, Y ES DELIBERADO ──────────────────────────────
//
// El `03` § 5 dice que una operación nueva nace cerrada, así que hay que justificar cada excepción.
// Ésta se sostiene en tres hechos que hay que poder comprobar juntos:
//
//   1 · **Sólo escribe sobre uno mismo.** El `where` es `contexto.usuarioId`, que sale de la cookie
//       de sesión y **no del cuerpo**. No hay forma de pedir el cambio de tema de otra persona
//       porque no hay ningún parámetro que nombre a otra persona.
//   2 · **No revela nada.** La respuesta es el tema que se acaba de escribir.
//   3 · **Tiene que funcionar en TODOS los estados de sesión**, incluido el de contraseña temporal:
//       esa pantalla también se dibuja con el tema de la persona, y si el botón no funcionara ahí,
//       alguien que entra por primera vez no podría cambiarlo hasta terminar un trámite. Es el mismo
//       argumento que el `03` § 5 hace para el cambio de la propia contraseña.
//
// `NINGUNA` es exactamente eso —«hace falta una sesión, ninguna capacidad»— y el Paso 4 del portero
// devuelve temprano, así que el alcance por sección tampoco puede encerrar a nadie acá. Ver el
// comentario de `exigir` sobre el orden de los pasos.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir, NINGUNA } from '../../../../lib/autorizacion/portero.ts';
import { ok } from '../../../../lib/autorizacion/respuesta.ts';
import { SIN_SECCION } from '../../../../lib/autorizacion/secciones.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import type { Tema } from '../../../../lib/autorizacion/sesion.ts';

const TEMAS: readonly Tema[] = ['oscuro', 'claro'];

export async function PUT(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, NINGUNA, SIN_SECCION);
  if (contexto instanceof Response) return contexto;

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return ok({ guardado: false, motivo: 'cuerpo_invalido' }, 400);
  }

  const pedido = (cuerpo as { tema?: unknown } | null)?.tema;
  /* La lista se comprueba ACÁ y no sólo en la base, y las dos comprobaciones se quedan. La de la
     base es la que no se puede saltear; ésta es la que devuelve un motivo que se puede leer en vez
     de un error del motor que nombra una restricción — `ADR-0704`: la forma de la base no sale en
     el cuerpo de un error. */
  if (typeof pedido !== 'string' || !TEMAS.includes(pedido as Tema)) {
    return ok({ guardado: false, motivo: 'tema_invalido' }, 400);
  }
  /* El estrechamiento se hace ACÁ y a mano porque `Array.includes` no lo hace solo: sin esta línea,
     `pedido` sigue siendo `string` para el compilador y la escritura pasaría cualquier cadena. */
  const tema: Tema = pedido as Tema;

  await conIdentidad(async (db) => {
    await db
      .updateTable('usuarios')
      // Sobre UNO MISMO, y el identificador sale de la sesión resuelta, nunca del cuerpo.
      .where('id', '=', contexto.usuarioId)
      .set({ tema })
      .execute();
  });

  /* NO se audita, y conviene decir por qué para que no parezca un olvido: `ADR-0809` pide auditar lo
     que cambia el ACCESO o los datos de otro. Esto no toca ni una cosa ni la otra — es una
     preferencia de quien mira, sobre sí mismo—, y una acción que se puede disparar dos veces por
     minuto llenaría la vigilancia de ruido justo donde hay que poder ver lo que importa. */
  return ok({ guardado: true, tema });
}
