// Lo que el cliente lee no nombra a quién subcontratamos. Tipo: Código.
//
// ══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO, TAL COMO LLEGÓ
//
// La pestaña Llamada de la ficha decía, cuando no hay llamadas:
//
//     «Las llamadas llegan por aviso de Assistable, no se consultan.»
//
// Y eso no va. Para quien usa esta aplicación, **el proveedor somos nosotros**. Nombrar al de abajo
// le cuenta a un cliente —y a cualquiera que mire su pantalla en una llamada compartida— con quién
// subcontratamos: no es información que le sirva, y sí es información que puede usar.
//
// El texto no perdió nada al sacarlo, y eso vale decirlo: la primera frase ya decía «la plataforma
// de voz», así que el nombre era redundante además de filtrado.
//
// ── POR QUÉ ESTE PROVEEDOR SÍ Y GOHIGHLEVEL NO ────────────────────────────
//
// GoHighLevel se nombra en toda la interfaz a propósito —«Todavía no se trajeron los mensajes de
// GoHighLevel», «Traer de GoHighLevel», «Esta cita no tiene sala en GoHighLevel»— y tiene que
// seguir así: **es la subcuenta del cliente**. Él la contrató, él la administra, y el nombre es lo
// que le dice DÓNDE mirar cuando algo falta. Esconderlo dejaría los mensajes de «falta» sin la
// única pieza que los hace accionables.
//
// La diferencia no es el tamaño del proveedor: es de quién es la cuenta. Lo que el cliente contrató
// se nombra; lo que nosotros contratamos para servirle, no.
//
// ── Y POR QUÉ SE MIRA EL CÓDIGO SIN COMENTARIOS ───────────────────────────
//
// Un comentario que explique de qué proveedor hablamos es información técnica legítima y necesaria:
// el día que alguien conecte esa plataforma, tiene que poder saber a qué API le está hablando. Lo
// que no puede llevar el nombre es lo que **el cliente lee**. Así que se limpian los comentarios
// antes de buscar, y lo que queda —cadenas, identificadores, atributos— es lo que se afirma.
// ══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { archivosFuente, sinComentarios } from '../apoyo/fuente.ts';

/**
 * Proveedores que servimos NOSOTROS y que el cliente no contrató.
 *
 * Cada entrada dice qué es, para que quien agregue el siguiente sepa el criterio en vez de copiar
 * la forma. Si alguna vez un cliente contrata su propia cuenta de alguno de éstos, sale de la
 * lista — y entonces nombrarlo pasa a ser lo correcto, igual que con GoHighLevel.
 */
const NO_SE_NOMBRAN: readonly { nombre: string; porque: string }[] = [
  {
    nombre: 'assistable',
    porque:
      'La plataforma de voz que manda los avisos de llamada. La cuenta es NUESTRA: el cliente no ' +
      'la contrató, no la administra y no puede hacer nada con su nombre. Lo que sí le sirve —que ' +
      'las llamadas llegan por aviso y no se consultan— se dice sin nombrarla.',
  },
];

/**
 * Archivos donde el nombre SÍ puede aparecer, con su motivo.
 *
 * Vacía hoy, y se deja declarada a propósito: el día que se conecte la plataforma, el cliente que
 * le habla necesita su nombre en la URL y en las cabeceras. Ese archivo entra acá con su motivo, y
 * el resto de la aplicación sigue sin poder nombrarla.
 */
const DONDE_SÍ: readonly { archivo: string; porque: string }[] = [];

/** Lo que el cliente puede llegar a leer: la interfaz y los textos que el servidor le manda. */
const DIRS = ['app', 'components', 'lib'];

test('ningún proveedor nuestro se nombra en lo que el cliente lee', () => {
  const eximidos = new Set(DONDE_SÍ.map((x) => x.archivo));
  const colados: string[] = [];

  for (const a of archivosFuente(DIRS)) {
    if (eximidos.has(a.ruta)) continue;
    /* `limpio` de `archivosFuente` ya viene sin comentarios, y se vuelve a pasar por
       `sinComentarios` no por desconfianza sino porque esta prueba depende de ESO y no de un
       detalle de otro archivo: si mañana `limpio` cambia de significado, acá sigue siendo cierto. */
    const codigo = sinComentarios(a.contenido);
    for (const p of NO_SE_NOMBRAN) {
      if (new RegExp(p.nombre, 'i').test(codigo)) colados.push(`${a.ruta}: «${p.nombre}»`);
    }
  }

  assert.deepEqual(
    colados,
    [],
    'hay un proveedor nuestro nombrado en algo que el cliente puede leer. Para quien usa esto, el ' +
      'proveedor somos nosotros:\n  ' +
      colados.join('\n  ') +
      '\n\nSi es código de integración que necesita el nombre, va en `DONDE_SÍ` con su motivo.',
  );
});

test('la lista dice el criterio, y no solo los nombres', () => {
  /* Una lista de nombres sin motivo se copia mal: el próximo agrega GoHighLevel «por las dudas» y
     rompe los mensajes de «falta», que son accionables justamente porque lo nombran. El criterio
     —de quién es la cuenta— tiene que viajar con la lista. */
  for (const p of NO_SE_NOMBRAN) {
    assert.ok(
      p.porque.length > 80,
      `la entrada «${p.nombre}» no dice por qué no se nombra, así que el criterio se pierde`,
    );
  }
  for (const e of DONDE_SÍ) {
    assert.ok(e.porque.length > 60, `la exención de \`${e.archivo}\` no dice por qué`);
    assert.ok(
      archivosFuente(DIRS).some((a) => a.ruta === e.archivo),
      `\`${e.archivo}\` ya no existe: sacalo de \`DONDE_SÍ\` o es una puerta abierta que nadie ve`,
    );
  }
});

test('GoHighLevel SÍ se sigue nombrando: es la cuenta del cliente', () => {
  /* La otra mitad, y la que impide que este archivo se aplique de más. Si alguien «limpiara» todos
     los nombres de proveedor, los mensajes de falta perderían lo único que los hace accionables:
     dónde mirar. Esta prueba falla si eso pasa.
     *
     Se comprueba sobre el catálogo de textos de `falta`, que es donde vive el caso concreto. */
  const ficha = archivosFuente(['lib']).find((a) => a.ruta === 'lib/negocio/ficha.ts');
  assert.ok(ficha, 'no está `lib/negocio/ficha.ts`');
  const codigo = sinComentarios(ficha.contenido);

  /* Se afirma sobre la ENTRADA concreta y no sobre el archivo entero. Lo encontró una mutación:
     saqué el nombre del texto de los mensajes y la prueba siguió pasando, porque el archivo lo
     menciona en otras diez partes. Una aserción que se satisface con cualquier aparición del
     archivo no está mirando el texto que le importa. */
  const mensajes = /mensajes:\s*\n?\s*((?:\s*'[^']*'\s*\+?\s*)+)/.exec(codigo)?.[1] ?? '';
  assert.ok(mensajes !== '', 'no se pudo leer el texto de `falta.mensajes`');
  assert.match(
    mensajes,
    /GoHighLevel/,
    'el texto de «falta» de los mensajes dejó de nombrar GoHighLevel: es la subcuenta del CLIENTE, ' +
      'y su nombre es lo único que le dice DÓNDE mirar cuando una conversación no llegó',
  );
});
