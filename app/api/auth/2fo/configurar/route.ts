// ADR-0301 — Toda operación llama al portero.
// ADR-0413 — Un usuario con un rol que exige segundo factor no obtiene sesión habilitada.
//
// Empieza el alta del segundo factor: devuelve el secreto para inscribir el dispositivo.
//
// Solo alcanzable desde `debe_configurar_2fo`, que es su única entrada en las listas de
// `ESTADOS`. Pide `NINGUNA` capacidad: es la salida de un estado, y si exigiera una capacidad
// quien no la tenga queda encerrado.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL SECRETO SE DEVUELVE UNA VEZ, Y SE GUARDA CIFRADO
//
// La respuesta de este endpoint es el único momento en que el secreto existe en claro fuera del
// dispositivo de la persona. Se guarda cifrado con la clave maestra (`08` § 10) y **no hay
// ninguna operación que lo vuelva a devolver**.
//
// Y `confirmado_el` queda en nulo: hasta que no se pruebe un código, este alta no cuenta. Es lo
// que hace que un alta abandonada no deje la cuenta en `pendiente_2fo` para siempre.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir, NINGUNA } from '../../../../../lib/autorizacion/portero.ts';
import { ok } from '../../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../../lib/datos/capa.ts';
import { cifrar } from '../../../../../lib/credenciales/cifrado.ts';
import { secretoNuevo } from '../../../../../lib/autenticacion/totp.ts';

export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, NINGUNA);
  if (contexto instanceof Response) return contexto;

  const secreto = secretoNuevo();

  await conIdentidad(async (db) => {
    // `on conflict` porque volver a empezar el alta es legítimo: alguien que perdió el
    // teléfono a mitad de camino tiene que poder rehacerlo. Lo que NO se puede es rehacerla
    // cuando ya está confirmada — eso lo impide la lista de `ESTADOS`, porque una sesión
    // `activa` no llega acá… pero un usuario con el factor confirmado que vuelve a entrar cae
    // en `pendiente_2fo`, no en `debe_configurar_2fo`, así que tampoco llega. Las dos vías
    // cerradas por la misma lista blanca.
    await db
      .insertInto('usuarios_segundo_factor')
      .values({
        usuario_id: contexto.usuarioId,
        secreto_cifrado: cifrar(secreto),
        confirmado_el: null,
      })
      .onConflict((oc) =>
        oc.column('usuario_id').doUpdateSet({
          secreto_cifrado: cifrar(secreto),
          confirmado_el: null,
        }),
      )
      .execute();
  });

  // El secreto en claro, una vez. `emisor` y `cuenta` son para armar el código QR del lado del
  // cliente; el servidor no genera imágenes.
  return ok({ secreto, emisor: 'ARIA Comando Central', cuenta: contexto.usuarioId });
}
