// ADR-0602 — El nonce es distinto en cada cifrado.
// ADR-0603 — El descifrado fallido lanza con un mensaje accionable.
// Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LOS DOS DEFECTOS DE ESTE ARCHIVO SON DE FAMILIAS OPUESTAS
//
// **`ADR-0602` es catastrófico y silencioso.** El `06` § 3 lo llama *"el error más fácil de
// cometer… y el más caro"*:
//
//   "REUSAR UN NONCE CON LA MISMA CLAVE EN GCM ROMPE EL CIFRADO POR COMPLETO. No lo debilita:
//    permite recuperar el texto en claro de los mensajes afectados."
//
// Y nombra la tentación exacta, que es lo que hace que valga una prueba: *"parece razonable
// derivar el nonce del identificador de la organización, para que sea 'determinista'"*. Suena a
// prolijidad. Y todo sigue funcionando: cifra, descifra, las credenciales andan.
//
// **`ADR-0603` es ruidoso pero mal dirigido.** Un descifrado que devuelve nulo o cadena vacía
// manda un token vacío al servicio externo, que responde un error de autenticación *"tres capas
// más abajo, imposible de diagnosticar"*.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { archivosFuente } from '../apoyo/fuente.ts';
import { cifrar, claveMaestra, descifrar } from '../../lib/credenciales/cifrado.ts';

before(() => {
  // La clave de esta prueba, no la del entorno: así el archivo corre igual en una máquina sin
  // `.env.local` y no depende de un valor que alguien puede cambiar.
  process.env.CLAVE_MAESTRA = randomBytes(32).toString('base64');
});

// ─── ADR-0602 · el nonce ────────────────────────────────────────────────────

test('ADR-0602 · cifrar dos veces el MISMO texto da resultados distintos', () => {
  const secreto = 'token-del-proveedor-externo-12345';
  const a = cifrar(secreto);
  const b = cifrar(secreto);

  assert.notEqual(a, b, 'dos cifrados del mismo texto dieron lo mismo: el nonce se está reusando');
  // Y los dos descifran al mismo valor. Sin esta mitad, un `cifrar()` que devolviera basura
  // aleatoria pasaría la afirmación de arriba.
  assert.equal(descifrar(a), secreto);
  assert.equal(descifrar(b), secreto);

  // El nonce es la PRIMERA parte del blob, y tiene que diferir. Comparar los blobs enteros no
  // alcanza: si el nonce fuera fijo y solo variara el resto, los blobs también diferirían… y el
  // cifrado estaría roto igual.
  const [nonceA] = a.split(':');
  const [nonceB] = b.split(':');
  assert.notEqual(nonceA, nonceB, 'el nonce es el mismo en los dos cifrados');
});

test('ADR-0602 · sobre muchas muestras, ni un nonce repetido', () => {
  // Doce bytes de nonce son 2^96 valores: una colisión por azar no existe. Lo que esta prueba
  // agarra es un nonce DERIVADO —del texto, de un contador mal hecho, de la organización— que en
  // una muestra chica se repetiría enseguida.
  const nonces = new Set<string>();
  const MUESTRAS = 2000;
  for (let i = 0; i < MUESTRAS; i++) {
    nonces.add(cifrar('el mismo texto siempre').split(':')[0] ?? '');
  }
  assert.equal(nonces.size, MUESTRAS, `${MUESTRAS - nonces.size} nonce(s) repetido(s)`);
});

test('ADR-0602 · el nonce no se deriva de nada: la búsqueda que cierra la tentación', () => {
  // La prueba estadística agarra un nonce repetido. Ésta agarra la FORMA que el `06` § 3 nombra
  // como tentación: derivarlo del identificador de la organización *"para que sea determinista"*.
  // Un nonce derivado de un valor con mucha entropía pasaría la de arriba y seguiría estando mal.
  const c = archivosFuente(['lib']).find((a) => a.ruta === 'lib/credenciales/cifrado.ts');
  assert.ok(c, 'no se encontró el módulo de cifrado');
  assert.match(c.limpio, /randomBytes\s*\(\s*LARGO_NONCE\s*\)/, 'el nonce no es aleatorio');
  // Nada que huela a derivación.
  for (const forma of [/createHash/, /orgId/, /org_id/, /contador/, /counter/]) {
    assert.doesNotMatch(
      c.limpio,
      forma,
      `el módulo de cifrado menciona ${forma}: un nonce derivado rompe GCM por completo`,
    );
  }
});

// ─── ADR-0604 · ningún respaldo implícito ───────────────────────────────────

test('ADR-0604 · nada cae a la credencial de otra organización', () => {
  // El caso literal del `07` § 1, que ya se pagó:
  //
  //     crmToken: () => credencialesActivas()?.token ?? entorno("CRM_TOKEN")
  //
  // *"Ese `??` convertía 'esta organización no tiene token' en 'usá el de la principal', PARA
  // TODAS. La regla estaba escrita, documentada y con pruebas; dos caracteres al final de una
  // línea la desactivaban."* Y el `05` § 2 cuenta el resultado: la organización nueva escribía en
  // la cuenta externa de otra empresa, con la API respondiendo 200.
  //
  // La búsqueda general de `?? process.env` ya existe en `20-errores-ya-pagados`. Ésta es la
  // específica de credenciales, y es más angosta y más fuerte: en los módulos de credenciales
  // **ningún** `??` puede tener del otro lado algo que no sea de esta misma organización.
  const modulos = archivosFuente(['lib', 'app']).filter(
    (a) => a.ruta.includes('credenciales') || a.ruta.includes('credencial'),
  );
  assert.ok(modulos.length > 0, 'no hay módulos de credenciales: la prueba pasaría en vacío');

  for (const m of modulos) {
    // Un `??` cuyo lado derecho sea el entorno, o algo que se llame "principal" o "global" o
    // "defecto". Son los tres nombres con los que este respaldo se escribe.
    assert.doesNotMatch(
      m.limpio,
      /\?\?[\s\S]{0,60}?(process\.env|entorno\s*\(|principal|global|porDefecto|DEFECTO)/i,
      `${m.ruta}: un respaldo implícito acá convierte "no opera" en "opera en la cuenta de otro"`,
    );
  }
});

test('ADR-0604 · no hay caché de credenciales entre peticiones', () => {
  // El `07` § 3: *"en funciones sin servidor, las instancias se reutilizan entre peticiones de
  // ORGANIZACIONES DISTINTAS. Un caché de proceso 'para no descifrar dos veces' es exactamente
  // cómo el token de una organización termina usándose para otra."*
  //
  // No hay prueba prescripta para esto en ningún documento: es decisión propia, registrada en
  // `docs/ETAPA-6.md`. Y es barata, porque la forma es reconocible — un `Map` o un objeto en el
  // nivel superior del módulo.
  const modulos = archivosFuente(['lib', 'app']).filter((a) => a.ruta.includes('credencial'));
  for (const m of modulos) {
    const nivelSuperior = m.limpio
      .split('\n')
      .filter((l) => /^(const|let|var)\s/.test(l))
      .join('\n');
    assert.doesNotMatch(
      nivelSuperior,
      /new\s+(Map|Set|WeakMap)\b/,
      `${m.ruta}: un caché de proceso mezcla credenciales entre organizaciones`,
    );
  }
});

// ─── ADR-0603 · el descifrado fallido ───────────────────────────────────────

test('ADR-0603 · un valor MODIFICADO lanza, y no devuelve nada', () => {
  const blob = cifrar('token-real');
  const [nonce, etiqueta, cifrado] = blob.split(':');
  assert.ok(nonce && etiqueta && cifrado);

  // Se cambia un byte del texto cifrado. Con un modo sin autenticación esto devolvería basura que
  // parece un token; con AEAD tiene que fallar.
  const bytes = Buffer.from(cifrado, 'base64');
  bytes[0] = (bytes[0] ?? 0) ^ 0xff;
  const alterado = [nonce, etiqueta, bytes.toString('base64')].join(':');

  assert.throws(
    () => descifrar(alterado),
    /No se pudo descifrar/,
    'un valor modificado no lanzó: el modo no está autenticando',
  );
});

test('ADR-0603 · con OTRA clave maestra lanza con un mensaje accionable', () => {
  // El caso que el `06` § 3 dice que *"pasa seguido: cada vez que alguien corre el proyecto en
  // otra máquina, o restaura una copia de la base en otro entorno"*. El mensaje explícito *"es lo
  // que convierte media hora de depuración en diez segundos"*.
  const blob = cifrar('token-real');
  const original = process.env.CLAVE_MAESTRA;
  try {
    process.env.CLAVE_MAESTRA = randomBytes(32).toString('base64');
    let mensaje = '';
    assert.throws(() => descifrar(blob), (e: Error) => {
      mensaje = e.message;
      return true;
    });
    // ACCIONABLE: dice qué pasó **y qué hacer**. Un "decryption failed" cumple lo primero y no lo
    // segundo, y es el que sale por omisión.
    assert.match(mensaje, /clave maestra cambió/i, 'el mensaje no nombra la causa probable');
    assert.match(mensaje, /volver a cargar la credencial/i, 'el mensaje no dice qué hacer');
  } finally {
    process.env.CLAVE_MAESTRA = original;
  }
});

test('ADR-0603 · NUNCA devuelve nulo ni vacío, por ningún camino', () => {
  // La fila lo dice así: *"nunca devuelve nulo ni vacío"*. Un token vacío *"produce un error de
  // autenticación del servicio externo, tres capas más abajo, imposible de diagnosticar"*.
  //
  // Se recorren todas las formas de entrada rota que se me ocurrieron. Ninguna puede devolver.
  const rotos = [
    '',
    'no-tiene-dos-puntos',
    'solo:dos',
    'a:b:c:d',
    ':::',
    'AAAA:AAAA:AAAA',
    // Un nonce de largo equivocado: es la comprobación explícita del módulo.
    `${Buffer.alloc(8).toString('base64')}:${Buffer.alloc(16).toString('base64')}:AAAA`,
    // Y uno bien formado con etiqueta de autenticación equivocada.
    `${randomBytes(12).toString('base64')}:${randomBytes(16).toString('base64')}:${randomBytes(20).toString('base64')}`,
  ];

  for (const roto of rotos) {
    let devolvio: unknown = Symbol('no devolvió');
    try {
      devolvio = descifrar(roto);
    } catch (e) {
      assert.ok(e instanceof Error, `${JSON.stringify(roto)}: lanzó algo que no es un Error`);
      assert.ok(e.message.length > 0, `${JSON.stringify(roto)}: lanzó con mensaje vacío`);
      continue;
    }
    assert.fail(
      `${JSON.stringify(roto)}: NO lanzó, devolvió ${JSON.stringify(devolvio)}. ` +
        'Un valor vacío se convierte en un error del servicio externo tres capas más abajo.',
    );
  }
});

test('ADR-0603 · sin `CLAVE_MAESTRA` lanza al USARSE, no al importarse', () => {
  // La validación perezosa no es un detalle de estilo: si el módulo validara al cargarse, un
  // despliegue sin la variable **tumbaría el build** en vez de fallar en la primera operación que
  // la necesita. Es la misma regla que `lib/datos/entorno.ts`, y la que hace que empujar a `main`
  // no pueda romper producción.
  const original = process.env.CLAVE_MAESTRA;
  try {
    delete process.env.CLAVE_MAESTRA;
    assert.throws(() => claveMaestra(), /CLAVE_MAESTRA no está definida/);
    // Y el mensaje dice el FORMATO, que es el error de configuración más común.
    assert.throws(() => claveMaestra(), /32 bytes/);
  } finally {
    process.env.CLAVE_MAESTRA = original;
  }

  // La otra mitad: el módulo no lee el entorno en el cuerpo, solo dentro de funciones.
  const c = archivosFuente(['lib']).find((a) => a.ruta === 'lib/credenciales/cifrado.ts');
  assert.ok(c);
  const fueraDeFuncion = c.limpio
    .split('\n')
    .filter((l) => /process\.env/.test(l) && !/^\s{2,}/.test(l));
  assert.deepEqual(
    fueraDeFuncion,
    [],
    'el módulo lee el entorno en el nivel superior: eso valida al importarse y rompe el build',
  );
});

test('ADR-0603 · los DOS formatos de clave maestra, y solo 32 bytes', () => {
  // El `06` § 4: aceptar base64 y hexadecimal *"evita el error de configuración más común, que es
  // pegar la clave en el formato que no era"*.
  const bytes = randomBytes(32);
  const original = process.env.CLAVE_MAESTRA;
  try {
    for (const formato of ['base64', 'hex'] as const) {
      process.env.CLAVE_MAESTRA = bytes.toString(formato);
      assert.deepEqual(claveMaestra(), bytes, `no aceptó el formato ${formato}`);
    }

    // Y un largo equivocado LANZA. `Buffer.from` no falla sobre entrada inválida —trunca en
    // silencio— así que sin la comprobación de largo una clave mal pegada produciría una clave
    // más corta y todo "funcionaría" con cifrado débil.
    for (const mala of ['corta', randomBytes(16).toString('base64'), randomBytes(48).toString('hex')]) {
      process.env.CLAVE_MAESTRA = mala;
      assert.throws(() => claveMaestra(), /32 bytes/, `aceptó una clave inválida: ${mala}`);
    }
  } finally {
    process.env.CLAVE_MAESTRA = original;
  }
});
