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
import { ok, rechazo } from '../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../lib/datos/capa.ts';
import { conOrganizacion } from '../../../lib/datos/contexto.ts';
import { resolverAccesoAlAuditor } from '../../../lib/credenciales/resolver.ts';
import { laPantallaDelTecnico, type PorQueNoAudita } from '../../../lib/auditor/pantalla.ts';
import { leerLosPrompts } from '../../../lib/auditor/prompts.ts';
import { tasaDeCancelacion } from '../../../lib/negocio/indicadoresDeCitas.ts';
import { indicadoresDelLead } from '../../../lib/negocio/indicadoresDelLead.ts';
import { atribucionDelLead } from '../../../lib/negocio/atribucionDelLead.ts';
import { consumoDelPrecall } from '../../../lib/negocio/consumoDelPrecall.ts';
import { sentimientoPorFlujo } from '../../../lib/auditor/sentimiento.ts';
import { periodoDe } from '../../../lib/negocio/periodo.ts';
import { AGENTES } from '../../../lib/auditor/veredicto.ts';

/* La pantalla es `conversation` y no `auditoria`, y la carpeta de esta ruta sigue diciendo
   `auditoria` a propósito: la RUTA es del auditor —su capacidad, su modelo, sus tablas— y la
   PANTALLA es dónde se dibuja. Desde que el supervisor pasó a ser dos pestañas de Conversation,
   son dos cosas distintas y conviene que el código lo muestre.

   `PANTALLA` decide qué sección concedida hace falta (el alcance por persona); la capacidad se
   pide aparte, abajo, y no cambió. */
export const PANTALLA = 'conversation';

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

  /* ── EL PERÍODO SE VALIDA CONTRA LA LISTA, Y LO QUE NO ESTÁ SE RECHAZA ─────
   *
   * No se corrige al valor por omisión. Pedir un período que no existe y recibir treinta días sin
   * enterarse es exactamente el defecto que `periodo.ts` cierra: la cifra sale bien calculada sobre
   * una ventana que nadie pidió, y no hay forma de notarlo mirando la pantalla. */
  const periodo = periodoDe(new URL(peticion.url).searchParams.get('periodo'));
  if (periodo === null) return rechazo('peticion_invalida', 'Ese período no existe.');

  const acceso = await conIdentidad((db) => resolverAccesoAlAuditor(db, contexto.orgEfectiva));
  const noAudita = acceso.tipo === 'listo' ? null : (COMO_LO_VE_LA_PANTALLA[acceso.que] ?? null);

  /* La cancelación viaja en la MISMA transacción que la pantalla. No es una optimización: son dos
     lecturas que se dibujan juntas, y en dos transacciones podrían ver estados distintos de la misma
     tabla — la cifra diría una cosa y la agenda de al lado otra, sin que nada falle. */
  const [pantalla, prompts, cancelacion, respuesta, atribucion, precall, sentimiento] =
    await conOrganizacion(
    contexto.orgEfectiva,
    async () => [
      await laPantallaDelTecnico(noAudita),
      await leerLosPrompts(),
      /* Las cinco reciben LA MISMA ventana, y no es una comodidad: la pantalla las dibuja juntas y
         con ventanas distintas dos cifras de la misma tarjeta hablarían de dos períodos sin decirlo.
         Es el mismo motivo por el que van en una sola transacción. */
      await tasaDeCancelacion(periodo.dias),
      await indicadoresDelLead(periodo.dias),
      await atribucionDelLead(periodo.dias),
      await consumoDelPrecall(periodo.dias),
      /* Uno por agente y no uno solo: son dos conversaciones distintas, y mezclarlas daría un
         promedio que no describe a ninguna. Medido, hoy pre-agenda no tiene ni un veredicto.
         La lista sale del catálogo: nombrar un agente acá está prohibido y el motivo es caro. */
      await sentimientoPorFlujo(periodo.dias),
    ],
  );

  return ok({
    ...pantalla,
    /* La clave viaja de vuelta y no se da por supuesta: la pantalla enciende el botón con LO QUE EL
       SERVIDOR CONTESTÓ, no con lo que pidió. Si un día las dos dejan de coincidir —una petición que
       se cruza con otra, una respuesta guardada— el botón encendido sigue describiendo las cifras que
       están abajo, que es lo único que importa. */
    periodo: periodo.clave,
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
    /* La primera cifra REAL de Appointment Flow. Viaja siempre, incluso cuando la empresa no audita:
       la cancelación se lee de las citas y no del auditor, así que existe aunque el freno esté
       puesto — y es justamente en esas empresas donde una pestaña con algo medido dice más que una
       pestaña vacía. */
    cancelacion,
    /* La primera cifra de Lead Flow, y la que parecía bloqueada: no necesita la atribución del
       agente, porque pregunta si el CONTACTO contestó. Ver `indicadoresDelLead`. */
    respuesta,
    /* De dónde vinieron los que agendaron. Estaba guardado desde la `048` y no lo leía nadie: es la
       atribución que se llegó a proponer conseguir conectando el API de Meta. */
    atribucion,
    /* El consumo del precall (§10.6). La pantalla lo declaraba imposible: los dos campos NUMERICAL
       de porcentaje están vacíos, pero el porcentaje viene adentro del vocabulario de un RADIO. */
    precall,
    /* El sentimiento se escribía en cada análisis desde que el auditor existe y no lo leía nadie.
       Va por flujo porque el §9.7 y el §10.7 lo piden como cifra del departamento. */
    sentimiento,
  });
}
