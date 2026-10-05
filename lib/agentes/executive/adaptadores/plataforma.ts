// Las dos herramientas que no son de un departamento: si las fuentes están al día (`frescura`) y en qué
// estado están las integraciones (`estado_de_integraciones`).
//
// ── `frescura`, SÓLO DE LO QUE ALIMENTA LO QUE LA PERSONA VE ─────────────────
//
// Cada tarea del barrido se ofrece a las secciones cuyas cifras salen de lo que esa tarea escribe:
//   · `contactos`, que relee `negocio.contactos` (`releerContactos`), en todas las que cuentan contactos:
//     Leads › De GHL, Acquisition, Creative, Conversion, Conversation, Sales y las colas del Setter y del
//     Closer (la primera versión la daba sólo en Leads, y la revisión de AG6 lo encontró);
//   · `citas` en Leads › De GHL —las dos frescuras que ya muestra su pantalla (`app/api/leads-portal`)—;
//   · `citas` también en la Agenda del Closer (`lib/negocio/agenda.ts`), en Sales (la cadena de cierre) y en
//     Conversation (la cancelación);
//   · `mensajes` donde se leen conversaciones: la ficha de contacto que se abre desde el Setter y el Closer
//     (`lib/negocio/ficha.ts`) y Lead Flow, en Conversation;
//   · `auditoria` y `mejora`, el auditor, en Conversation;
//   · `anuncios`, el gasto de Meta, en Acquisition y Creative;
//   · `analizadores` y `reintentos`, en Analizadores.
// La `sonda` es de la plataforma y no alimenta ninguna pantalla de negocio: no viaja.
//
// ── `estado_de_integraciones`, SIN VALORES ───────────────────────────────────
//
// Lo resuelve la ruta en identidad (`resolverCredenciales`) sólo para quien tiene `credenciales.ver`, y llega
// como dato con `cargado` y `estado` de cada una: ni el valor, ni la vista previa, ni los identificadores
// de las cuentas.

import { frescuraDe } from '../../../negocio/frescura.ts';
import type { Tarea } from '../../../negocio/barrido.ts';
import { SIN_ARGUMENTOS, type DefinicionDeHerramienta, tomar } from './comun.ts';

/** Qué tareas alimentan cada sección. Ver el encabezado. */
export const TAREAS_POR_SECCION: Readonly<Record<string, readonly Tarea[]>> = {
  contacts: ['contactos', 'citas'],
  closer: ['contactos', 'citas', 'mensajes'],
  setter: ['contactos', 'mensajes'],
  sales: ['contactos', 'citas'],
  conversation: ['contactos', 'citas', 'mensajes', 'auditoria', 'mejora'],
  conversion: ['contactos'],
  acquisition: ['contactos', 'anuncios'],
  creative: ['contactos', 'anuncios'],
  analizadores: ['analizadores', 'reintentos'],
};

export const HERRAMIENTAS_DE_LA_PLATAFORMA: readonly DefinicionDeHerramienta[] = [
  {
    nombre: 'frescura',
    descripcion:
      'Si las lecturas automáticas que alimentan lo que ves están al día: por cada una, hace cuántos minutos ' +
      'corrió, a partir de cuántos se considera atrasada y su estado (al_dia, atrasada, fallando, nunca). Una ' +
      'fuente parada explica una cifra que no se mueve.',
    secciones: Object.keys(TAREAS_POR_SECCION),
    esquema: SIN_ARGUMENTOS,
    async ejecutar(_argumentos, contexto) {
      const tareas = [...new Set(contexto.secciones.flatMap((s) => TAREAS_POR_SECCION[s] ?? []))];
      const salida: Record<string, unknown> = {};
      // En serie: es una transacción, y cada lectura es una fila.
      for (const t of tareas) salida[t] = tomar(await frescuraDe(t), ['estado', 'minutos', 'umbralMinutos', 'aviso'] as const);
      return { tareas: salida };
    },
  },
  {
    nombre: 'estado_de_integraciones',
    descripcion:
      'Integraciones: si cada una (CRM, IA, pagos, tl;dv, Meta) está cargada y en qué estado (activa, ausente, ' +
      'vencida, revocada, ilegible). Sin valores. Explica por qué una pantalla no tiene datos.',
    secciones: [],
    requiere: 'integraciones',
    esquema: SIN_ARGUMENTOS,
    async ejecutar(_argumentos, contexto) {
      const i = contexto.deLaRuta.integraciones;
      if (i === null) throw new Error('estado_de_integraciones sin el dato de la ruta');
      return { integraciones: Object.fromEntries(Object.entries(i).map(([k, v]) => [k, tomar(v, ['cargado', 'estado'] as const)])) };
    },
  },
];
