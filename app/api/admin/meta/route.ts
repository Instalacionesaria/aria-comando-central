// `GET /api/admin/meta` — las conexiones con Meta de la empresa y sus cuentas publicitarias, para Ajustes.
//
// Lo que se ve: quién conectó (la empresa o un cliente con su portfolio), si la conexión está activa, cada cuenta
// publicitaria con su moneda y su estado en Meta, y a qué cliente va. **Ningún token**: la vista sale de
// `vistaDeMeta`, que no selecciona `token_cifrado`. Y si la app de Meta está configurada en el servidor, para que el
// botón «Conectar con Meta» sepa si ofrecerse.
import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok } from '../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { faltaDeLaAppDeMeta } from '../../../../lib/meta/app.ts';
import { vistaDeMeta } from '../../../../lib/meta/conexiones.ts';

export const PANTALLA = 'credenciales';

export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['credenciales.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  const vista = await conIdentidad((db) => vistaDeMeta(db, contexto.orgEfectiva));
  return ok({ appConfigurada: faltaDeLaAppDeMeta().length === 0, ...vista });
}
