// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0304 — Las operaciones de una misma pantalla piden el mismo conjunto de capacidades.
//
// La pantalla del técnico: las tarjetas, los patrones, las conversaciones y los prompts.
//
// ═══════════════════════════════════════════════════════════════════════════════
// UNA SOLA LECTURA PARA TODA LA PANTALLA, Y NO ES PEREZA
//
// Cuatro bloques —tarjetas, casos, conversaciones y los prompts cargados— en un `GET`. Podrían ser
// cuatro rutas, y sería peor por dos motivos, uno de corrección y uno de producto:
//
//   · **`ADR-0304` compara conjuntos de capacidades entre los `GET` de una misma pantalla**, y cuatro
//     rutas son cuatro lugares donde ese conjunto puede divergir. Con uno solo, la pregunta no existe.
//
//   · Y la pantalla se dibuja **entera o no se dibuja**. Con cuatro peticiones, quien abre la pestaña
//     ve las tarjetas llenas y la lista de patrones todavía vacía, y esos dos segundos se leen como
//     *«no hay hallazgos»* — que es exactamente el cero indistinguible que este módulo persigue.
//
// ── EL FRENO DE LA EMPRESA SE RESUELVE ACÁ Y NO EN LA CONSULTA ─────────────
//
// «Esta empresa no audita» sale de las credenciales, que viven en `identidad`. La pantalla vive en el
// dominio del inquilino. Cruzar los dos dentro de una consulta de negocio es lo que `ADR-0209` acota,
// así que el manejador lee lo suyo de cada lado y se lo pasa armado — igual que hace el cron.
//
// Y las tarjetas se dibujan **igual** cuando la empresa no audita: si auditó antes y alguien apagó el
// interruptor, los análisis siguen ahí y el técnico tiene que poder verlos. El freno cambia el
// encabezado de la tarjeta, no su contenido.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../lib/autorizacion/portero.ts';
import { ok } from '../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../lib/datos/capa.ts';
import { conOrganizacion } from '../../../lib/datos/contexto.ts';
import { resolverAccesoAlAuditor } from '../../../lib/credenciales/resolver.ts';
import { laPantallaDelTecnico, type PorQueNoAudita } from '../../../lib/auditor/pantalla.ts';
import { leerLosPrompts } from '../../../lib/auditor/prompts.ts';
import { AGENTES } from '../../../lib/auditor/veredicto.ts';

export const PANTALLA = 'auditoria';

/**
 * Las cuatro faltas del auditor, traducidas a los tres estados que la pantalla dibuja.
 *
 * `llave_de_ia_ilegible` se colapsa con `sin_clave_ia` **acá y no antes**, y hay que decir por qué no
 * es una pérdida: para el técnico las dos significan lo mismo —*«hay que volver a cargar la llave en
 * Integraciones»*— y son la misma acción. La distinción sí importa donde se toma la decisión de
 * operar, y ahí se conserva: el sello del cron guarda el motivo exacto, que es lo que distingue «nadie
 * la cargó» de «cambió la clave maestra del servidor».
 */
const COMO_LO_VE_LA_PANTALLA: Readonly<Record<string, PorQueNoAudita>> = {
  auditor_apagado: 'auditor_apagado',
  sin_llave_de_ia: 'sin_clave_ia',
  llave_de_ia_ilegible: 'sin_clave_ia',
  sin_id_del_agente: 'sin_id_del_agente',
};

export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['auditor.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  const acceso = await conIdentidad((db) => resolverAccesoAlAuditor(db, contexto.orgEfectiva));
  const noAudita = acceso.tipo === 'listo' ? null : (COMO_LO_VE_LA_PANTALLA[acceso.que] ?? null);

  const [pantalla, prompts] = await conOrganizacion(contexto.orgEfectiva, async () => [
    await laPantallaDelTecnico(noAudita),
    await leerLosPrompts(),
  ]);

  return ok({
    ...pantalla,
    /* Los prompts viajan con la pantalla y no en una ruta aparte: el cuadro de edición se dibuja en la
       misma pestaña, y una segunda petición para llenarlo dejaría el cuadro vacío unos segundos — que
       se lee como «esta empresa no tiene prompt», justo lo contrario de lo que pasa.
       `null` en un agente **es un estado normal**, no un fallo: en la plataforma anterior los cuatro
       espacios estaban vacíos. */
    prompts: AGENTES.map((agente) => ({
      agente,
      texto: prompts[agente]?.texto ?? null,
      actualizadoEl: prompts[agente]?.actualizadoEl ?? null,
    })),
  });
}
