// «Probar conexión»: comprueba, sin escribir nada, que el token de Meta cargado en Ajustes sirve para lo que Creative
// necesita, y si no, dice en cuál de tres pasos falla y qué hacer.
//
// Existe porque un token pegado con un permiso de menos, o una cuenta mal escrita, no falla en ningún lado visible: la
// tarea de los activos quedaría `saltada` o vacía y quien cargó el token no se enteraría nunca. Los tres pasos van en
// el orden en que se arreglan: primero el token, después la cuenta, después la lectura de los anuncios.
import { medioPermitido, LARGO_MAXIMO_DE_MINIATURA } from '../negocio/urlExterna.ts';
import { fallaDeMeta, pedirAMeta, TEXTO_DE_FALLA_DE_META, type FallaDeMeta } from './graph.ts';

/** El paso que falló. */
export type PasoDeLaPrueba = 'token' | 'cuenta' | 'anuncios';

export type PruebaDeMeta =
  | {
      estado: 'conectado';
      /** La cuenta publicitaria, como la ve Meta. El nombre es el de la cuenta, no el de una persona. */
      cuenta: { nombre: string; moneda: string | null; activa: boolean };
      /** De los últimos anuncios leídos (hasta 25), cuántos hay y cuántos traen una miniatura que se puede mostrar. */
      anuncios: number;
      conMiniatura: number;
    }
  | { estado: 'falla'; paso: PasoDeLaPrueba; motivo: FallaDeMeta; texto: string };

/** `account_status` de Meta: 1 es ACTIVE; el resto (deshabilitada, cerrada, en revisión…) no entrega anuncios. */
const CUENTA_ACTIVA = 1;

const falla = (paso: PasoDeLaPrueba, motivo: FallaDeMeta): PruebaDeMeta => ({
  estado: 'falla',
  paso,
  motivo,
  texto: TEXTO_DE_FALLA_DE_META[motivo],
});

/**
 * Prueba el token contra la cuenta. `cuentaId` ya normalizada a `act_…` (`cuentaDeMeta`). Tres `GET`; nada se guarda.
 */
export async function probarConexionConMeta(token: string, cuentaId: string): Promise<PruebaDeMeta> {
  const yo = await pedirAMeta<{ id?: string }>('me', token, { fields: 'id' });
  if (yo.tipo !== 'datos') return falla('token', fallaDeMeta(yo));

  const cuenta = await pedirAMeta<{ name?: string; currency?: string; account_status?: number }>(cuentaId, token, {
    fields: 'name,currency,account_status',
  });
  if (cuenta.tipo !== 'datos') {
    const motivo = fallaDeMeta(cuenta);
    // Un token válido que «no encuentra» la cuenta es la cuenta mal escrita o sin asignar: se dice `no_existe`.
    return falla('cuenta', motivo === 'otro' ? 'no_existe' : motivo);
  }

  const anuncios = await pedirAMeta<{ data?: { creative?: { thumbnail_url?: string; image_url?: string } }[] }>(
    `${cuentaId}/ads`,
    token,
    { fields: 'creative{thumbnail_url,image_url}', limit: '25' },
  );
  if (anuncios.tipo !== 'datos') return falla('anuncios', fallaDeMeta(anuncios));

  const filas = Array.isArray(anuncios.datos.data) ? anuncios.datos.data : [];
  const conMiniatura = filas.filter((a) => {
    const url = a.creative?.image_url ?? a.creative?.thumbnail_url;
    return medioPermitido(url, LARGO_MAXIMO_DE_MINIATURA);
  }).length;

  return {
    estado: 'conectado',
    cuenta: {
      nombre: typeof cuenta.datos.name === 'string' ? cuenta.datos.name : cuentaId,
      moneda: typeof cuenta.datos.currency === 'string' ? cuenta.datos.currency : null,
      activa: cuenta.datos.account_status === CUENTA_ACTIVA,
    },
    anuncios: filas.length,
    conMiniatura,
  };
}
