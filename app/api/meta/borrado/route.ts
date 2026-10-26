// El pedido de borrado de datos que reenvía Meta («Data Deletion Request URL», Meta directo M6).
//
// ═══════════════════════════════════════════════════════════════════════════════
// SIN SESIÓN, CON LA FIRMA DE META
//
// Como la desautorización: la llama Meta, sin sesión, y se autentica con la firma del `signed_request` y el secreto de
// la app, comparada con `timingSafeEqual` acá (`RUTAS_CON_SECRETO_PROPIO`). Sin el secreto, 403 y nada se borra.
//
// Contesta lo que Meta pide, tal cual: `{ url, confirmation_code }`. Meta le muestra el código a quien pidió el borrado, y
// la URL es la página pública que dice en qué quedó.
//
// ── TRES PASOS, Y QUÉ QUEDA SI SE CORTA ───────────────────────────────────────
//
//   1. IDENTIDAD: se anota el pedido y se junta qué borrar (`anotarPedidoDeBorrado`).
//   2. NEGOCIO: lo leído de esas cuentas se borra en cada cliente de cada organización, con el ámbito del cliente
//      (`borrarLoLeidoDeMeta`, una transacción por cliente).
//   3. IDENTIDAD: se borran las conexiones con su token y sus cuentas, y el pedido queda hecho.
//
// Si se corta en el 2 o el 3, el pedido queda «en curso» en la página de estado, las conexiones siguen y lo que se borró
// no vuelve: Meta reintenta lo que no recibe un 200, y el reintento repite los tres pasos —borrar lo ya borrado no
// hace nada—. Lo que nunca pasa es el orden inverso: borrar el token antes que los datos dejaría datos sin forma de
// encontrarlos por quien los pidió.
// ═══════════════════════════════════════════════════════════════════════════════
import { timingSafeEqual } from 'node:crypto';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { secretoDeLaApp, urlPublica } from '../../../../lib/meta/app.ts';
import { anotarPedidoDeBorrado, cerrarPedidoDeBorrado } from '../../../../lib/meta/borrado.ts';
import { ambitoDeUnCliente } from '../../../../lib/negocio/ambitoDelCliente.ts';
import { borrarLoLeidoDeMeta } from '../../../../lib/negocio/recolectarDeMeta.ts';
import { partirSolicitudFirmada } from '../../../../lib/meta/solicitudFirmada.ts';

/** Un formulario de Meta mide unos cientos de bytes: uno enorme no se lee. */
const LARGO_MAXIMO = 8192;

/** Borrar los 12 meses de varias cuentas son unas pocas consultas por cuenta. */
export const maxDuration = 60;

export async function POST(peticion: Request): Promise<Response> {
  const secreto = secretoDeLaApp();
  if (!secreto) {
    console.error('meta: META_APP_SECRET no está configurado; el pedido de borrado se rechazó sin tocar nada');
    return rechazo('sin_permiso');
  }
  const texto = await peticion.text();
  if (texto.length > LARGO_MAXIMO) return rechazo('peticion_invalida', 'El pedido es demasiado largo.');
  const solicitud = partirSolicitudFirmada(new URLSearchParams(texto).get('signed_request'), secreto);
  if (!solicitud || solicitud.recibida.length !== solicitud.esperada.length || !timingSafeEqual(solicitud.recibida, solicitud.esperada)) {
    return rechazo('sin_permiso');
  }

  const pedido = await conIdentidad((db) => anotarPedidoDeBorrado(db, solicitud.usuario));
  for (const { orgId, acts, clientes } of pedido.porOrganizacion) {
    for (const cliente of clientes) await borrarLoLeidoDeMeta(ambitoDeUnCliente(orgId, cliente), acts);
  }
  await conIdentidad((db) => cerrarPedidoDeBorrado(db, pedido));
  return ok({ url: urlPublica(`/meta/borrado/${pedido.codigo}`), confirmation_code: pedido.codigo });
}
