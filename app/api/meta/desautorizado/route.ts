// El aviso de Meta cuando un negocio quita la app de ARIA («Deauthorize callback URL», Meta directo M6).
//
// ═══════════════════════════════════════════════════════════════════════════════
// SIN SESIÓN, CON LA FIRMA DE META
//
// La llama Meta, no una persona: no hay sesión, así que no puede pasar por el portero, y no puede ser pública, porque
// cualquiera podría revocar las conexiones de otro. Su autenticación es la firma del `signed_request` con el secreto de
// la app, comparada con `timingSafeEqual` acá, a la vista (`RUTAS_CON_SECRETO_PROPIO`). Sin el secreto configurado
// responde 403 y no toca nada.
//
// Lo que hace: las conexiones de ese usuario de Meta quedan `revocada` (`lib/meta/borrado.ts`). Responde 200 aunque no
// haya ninguna, porque Meta reintenta lo que no recibe un 200.
// ═══════════════════════════════════════════════════════════════════════════════
import { timingSafeEqual } from 'node:crypto';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { secretoDeLaApp } from '../../../../lib/meta/app.ts';
import { desautorizar } from '../../../../lib/meta/borrado.ts';
import { partirSolicitudFirmada } from '../../../../lib/meta/solicitudFirmada.ts';

/** Un formulario de Meta mide unos cientos de bytes: uno enorme no se lee. */
const LARGO_MAXIMO = 8192;

export async function POST(peticion: Request): Promise<Response> {
  const secreto = secretoDeLaApp();
  if (!secreto) {
    console.error('meta: META_APP_SECRET no está configurado; el aviso de desautorización se rechazó sin tocar nada');
    return rechazo('sin_permiso');
  }
  const texto = await peticion.text();
  if (texto.length > LARGO_MAXIMO) return rechazo('peticion_invalida', 'El pedido es demasiado largo.');
  const solicitud = partirSolicitudFirmada(new URLSearchParams(texto).get('signed_request'), secreto);
  if (!solicitud || solicitud.recibida.length !== solicitud.esperada.length || !timingSafeEqual(solicitud.recibida, solicitud.esperada)) {
    return rechazo('sin_permiso');
  }

  await conIdentidad((db) => desautorizar(db, solicitud.usuario));
  return ok({ recibido: true });
}
