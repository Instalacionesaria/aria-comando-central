// Los defectos del `07-ERRORES-A-EVITAR` que se pueden prohibir con una búsqueda.
// Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTE ARCHIVO EXISTE, SIENDO QUE `07` NO ES NORMATIVO
//
// `EJECUCION` § 4 clasifica el `07` como **contexto**: *"Se lee antes de cada etapa. No se
// implementa nada de acá: es una lista de errores a no cometer."* Y es correcto —el `07` no
// describe un sistema, describe cicatrices—. Pero hay una diferencia entre *"no se
// implementa"* y *"no se vigila"*: cada entrada de ese documento es un defecto que **ya
// ocurrió en producción** y que **no lanzó una excepción**.
//
// Las que se pueden convertir en una búsqueda de una línea están acá. No agregan
// funcionalidad; hacen que reintroducir el defecto rompa la suite.
//
// Y el motivo de escribirlas AHORA: todas tienen conteo CERO hoy. El propio `07` § 1 lo
// dice sobre la más caras de todas — *"escribila antes de la segunda operación, no después
// de la decimocuarta"*.
//
// Esta lista NO está en `PRUEBAS.md`. Es una decisión propia, registrada en
// `docs/ETAPA-3.md`.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { archivosFuente, archivosQueContienen, RAIZ } from '../apoyo/fuente.ts';

test('07 § 1 · `enterWith` está prohibido: abre el contexto y no lo cierra', () => {
  // "En los sistemas de contexto local asíncrono hay dos primitivas: una que 'entra' y no
  // cierra, y una que 'envuelve' y cierra. LA PRIMERA NO PROPAGA HACIA AFUERA DE UNA
  // FUNCIÓN ASÍNCRONA."
  //
  // Las dos consecuencias del `07` § 1 están MEDIDAS: en un bucle de organizaciones el
  // contexto de la primera sigue vivo cuando empieza la segunda; y en los ganchos de
  // preparación de las pruebas el contexto no queda puesto, lo que hizo que "una limpieza
  // nunca corriera y quedaran filas de prueba EN PRODUCCIÓN".
  //
  // `EJECUCION` § 3 ya eligió la que envuelve y cierra. Esto es lo que impide que alguien
  // "arregle" un contexto que no propaga cambiando de primitiva, que es la reacción
  // natural y exactamente la equivocada.
  assert.deepEqual(
    archivosQueContienen(/\.enterWith\s*\(/),
    [],
    'usá almacen.run(): enterWith abre el contexto y no lo cierra',
  );
});

test('07 § 1 · ningún respaldo implícito al entorno con `??`', () => {
  // El defecto más barato de la lista y uno de los más caros. La regla era "una
  // organización sin credencial no opera y lo dice". El código decía:
  //
  //   crmToken: () => credencialesActivas()?.token ?? entorno("CRM_TOKEN")
  //
  // Ese `??` convertía "esta organización no tiene token" en "usá el de la principal",
  // PARA TODAS. La regla estaba escrita, documentada y con pruebas; dos caracteres al final
  // de una línea la desactivaban.
  //
  // Se busca la FORMA, no el caso: cualquier `??` cuyo lado derecho sea el entorno. Es
  // angosto a propósito, y ataca justo el patrón que ya se pagó: el valor de una
  // organización cayendo al valor global.
  //
  // OJO CON LO QUE ESTA PRUEBA **NO** BENDICE. Que sea angosta no convierte al resto de
  // los `??` en seguros. El caso más peligroso está a una etapa de acá: un
  // `await pedir(…) ?? []` sobre la respuesta del cliente HTTP colapsa "no hay filas",
  // "te lo rechazaron" y "no pude preguntar" en el mismo valor — que es exactamente lo que
  // la regla 2 del `07` § 0 prohíbe, y el defecto que el `07` § 2 llama *"el peor de esta
  // lista"*. Ese caso lo cierra la forma de retorno del cliente, que no admite `??` porque
  // no tiene rama nula (`ADR-0305`), no esta búsqueda.
  const malos = archivosQueContienen(/\?\?[\s\S]{0,40}?(process\.env|entorno\s*\()/);
  assert.deepEqual(
    malos,
    [],
    'un respaldo al entorno tiene que ser explícito, nombrado y acotado a su organización: ' +
      'un `??` no se ve en una revisión',
  );
});

test('07 § 5 · nada pagina sin ordenar', () => {
  // "Pedir páginas sin `order by` NO GARANTIZA NADA: dos páginas seguidas pueden repetir
  // una fila y saltearse otra. Con inserciones concurrentes —lo normal— el conteo sale mal
  // Y NO HAY ERROR."
  //
  // Y la parte que la hace difícil de encontrar: "Puede no reproducirse en desarrollo,
  // porque el plan de ejecución resulta estable. La garantía sigue sin existir."
  //
  // LÍMITE HONESTO de esta comprobación: es por ARCHIVO, no por consulta. Un archivo con
  // dos consultas —una que ordena y otra que pagina— pasa. Erra del lado de dejar pasar, y
  // lo que agarra es el archivo que pagina sin ordenar NUNCA, que es como se ve el defecto
  // real. Una versión por consulta necesitaría un analizador, y un analizador a medias
  // sobre esto daría falsos rojos que terminarían con la prueba desactivada.
  //
  // No lleva cable trampa de conteo cero: la regla se activa sola el día que aparezca el
  // primer `.limit(`.
  const paginan = archivosFuente().filter((a) => /\.limit\s*\(/.test(a.limpio));
  const sinOrden = paginan.filter((a) => !/\.orderBy\s*\(|order\s+by/i.test(a.limpio));
  assert.deepEqual(
    sinOrden.map((a) => a.ruta),
    [],
    'una consulta con `.limit(` necesita `.orderBy(`, o las páginas repiten y saltean filas',
  );
});

test('07 § 6 · bajo `app/api/` solo hay manejadores de ruta', () => {
  // "En algunas plataformas sin servidor, CUALQUIER ARCHIVO bajo el directorio de la API se
  // publica. Un archivo de pruebas ahí adentro SE PUBLICA COMO ENDPOINT EJECUTABLE.
  // Averiguá la convención de exclusión de tu plataforma antes de poner el primer archivo
  // auxiliar."
  //
  // La convención de esta plataforma es al revés —solo `route.ts` se publica— así que el
  // riesgo literal no aplica. Pero la comprobación se queda por dos motivos que sí aplican:
  // un archivo auxiliar ahí adentro es invisible para la prueba del portero, que enumera
  // manejadores; y la convención de la plataforma es una decisión de la plataforma, no
  // nuestra, y puede cambiar sin avisarnos.
  //
  // Los auxiliares van en `lib/`. Si alguna vez hiciera falta uno acá, la carpeta con `_`
  // adelante es privada para el enrutador.
  const raizApi = join(RAIZ, 'app', 'api');
  let entradas: string[] = [];
  try {
    entradas = readdirSync(raizApi, { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => relative(RAIZ, join(e.parentPath, e.name)).split(sep).join('/'));
  } catch {
    // Todavía no existe `app/api/`. La comprobación se activa cuando exista.
    entradas = [];
  }

  const ajenos = entradas.filter((r) => {
    const partes = r.split('/');
    const nombre = partes.at(-1) ?? '';
    if (partes.some((p) => p.startsWith('_'))) return false;
    return nombre !== 'route.ts' && nombre !== 'route.js';
  });

  assert.deepEqual(
    ajenos,
    [],
    'los auxiliares van en `lib/`: un archivo que no es `route.ts` bajo `app/api/` es ' +
      'invisible para la prueba del portero',
  );
});
