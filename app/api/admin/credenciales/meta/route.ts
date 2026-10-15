// «Probar conexión» con Meta, desde Ajustes › Credenciales.
//
// `POST` y no `GET` aunque no escribe nada: llama a un servicio ajeno con un secreto de la empresa, y un `GET` lo
// podría disparar un enlace o una vista previa sin que nadie apriete el botón. Pide `credenciales.editar`, el mismo
// permiso que cargar el token: probarlo es parte de cargarlo.
//
// El token se lee y se descifra DENTRO de la transacción de identidad, y Meta se llama FUERA: tres pedidos de red no
// tienen por qué tener abierta una transacción de la base. Lo que vuelve es el resultado de `probarConexionConMeta`:
// el motivo y un texto nuestro, nunca el mensaje de Meta ni el token.
import { exigir } from '../../../../../lib/autorizacion/portero.ts';
import { ok } from '../../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../../lib/datos/capa.ts';
import { resolverAccesoAMeta, TEXTO_DE_FALTA_META } from '../../../../../lib/credenciales/resolver.ts';
import { probarConexionConMeta } from '../../../../../lib/meta/conexion.ts';

// La misma pantalla que la ruta de las credenciales: el portero audita y rechaza por pantalla.
export const PANTALLA = 'credenciales';

// Tres pedidos a Meta, de hasta 20 s cada uno (`ESPERA_DE_META_MS`).
export const maxDuration = 90;

export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['credenciales.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  const acceso = await conIdentidad(async (db) => resolverAccesoAMeta(db, contexto.orgEfectiva));
  if (acceso.tipo !== 'listo') {
    return ok({ estado: 'sin_credencial', que: acceso.que, texto: TEXTO_DE_FALTA_META[acceso.que] });
  }
  return ok(await probarConexionConMeta(acceso.token, acceso.cuentaId));
}
