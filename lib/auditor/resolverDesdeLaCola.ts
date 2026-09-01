// Resolver una intervención desde la cola roja. El lado del navegador.
//
// ═══════════════════════════════════════════════════════════════════════════════
// «SE HIZO» Y «SALIÓ BIEN» LLEGAN SEPARADOS, Y ACÁ SE MANTIENEN SEPARADOS
//
// La ruta devuelve `resuelto` y `crm.etiquetasQuitadas` en dos campos distintos, y no es un detalle
// de implementación: mientras la etiqueta siga puesta en el CRM, **el agente sigue pausado**.
//
// Colapsarlos en un booleano acá desharía todo el trabajo del servidor: el vendedor vería «listo» y
// el bot de ese contacto no volvería a atender, sin que nadie se enterara hasta que el contacto
// escriba y no le conteste nadie.
// ═══════════════════════════════════════════════════════════════════════════════

import { pedir } from '../http/cliente.ts';

export type LoQueDijoResolver =
  | { tipo: 'ok'; resuelto: boolean; etiquetasQuitadas: boolean }
  | { tipo: 'fallo'; mensaje: string };

/** Resuelve la intervención de un contacto. */
export async function resolverIntervencion(contactoId: string): Promise<LoQueDijoResolver> {
  const r = await pedir<{ resuelto: boolean; crm: { etiquetasQuitadas: boolean } }>(
    `/api/contactos/${encodeURIComponent(contactoId)}/resolver`,
    { metodo: 'POST' },
  );
  if (r.tipo === 'datos') {
    return {
      tipo: 'ok',
      resuelto: r.datos.resuelto,
      etiquetasQuitadas: r.datos.crm.etiquetasQuitadas,
    };
  }
  /* Los dos fallos se distinguen: «el servidor dijo que no» —sin token del CRM, por ejemplo— y «no
     se pudo llegar al servidor» mandan a mirar dos cosas distintas. */
  if (r.tipo === 'rechazado') {
    return { tipo: 'fallo', mensaje: r.detalle || 'No se pudo resolver esta intervención.' };
  }
  return { tipo: 'fallo', mensaje: 'No se pudo conectar para resolver esta intervención.' };
}

/** Qué se le dice al vendedor. **Tres respuestas, no dos.** */
export function queDecir(r: LoQueDijoResolver): string {
  if (r.tipo === 'fallo') return r.mensaje;
  /* El caso que más importa: se resolvió acá y el CRM no aceptó el borrado. **No es un error** —la
     resolución ya ocurrió y el contacto ya salió de la cola— pero el agente sigue pausado, y eso
     hay que decirlo o nadie lo va a reactivar. */
  if (!r.etiquetasQuitadas) {
    return 'Resuelto acá. El CRM no aceptó quitar las etiquetas, así que el agente sigue pausado: ' +
      'hay que quitarlas a mano.';
  }
  return r.resuelto ? 'Resuelto.' : 'No había nada abierto; se quitaron las etiquetas igual.';
}
