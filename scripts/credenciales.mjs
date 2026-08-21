// Genera las cuatro cadenas de conexión para el contenedor local efímero.
//
// Por omisión IMPRIME y no escribe nada. Escribir secretos al disco sin que nadie
// lo pida es la clase de comodidad que después nadie recuerda haber aceptado, así
// que hay que decirlo con `--escribir`.
//
//   node scripts/credenciales.mjs                # imprime el bloque para pegar
//   node scripts/credenciales.mjs --escribir     # escribe .env.local si no existe
//   node scripts/credenciales.mjs --github-env   # lo agrega a $GITHUB_ENV (integración)

import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));

// Tienen que coincidir con docker-compose.yml.
const ANFITRION = '127.0.0.1:55432/aria';
const ADMIN = 'postgresql://postgres:postgres_local@' + ANFITRION;

// Hexadecimal: seguro dentro de una URL sin percent-encoding, y sin comillas ni
// barras invertidas que compliquen el citado en SQL.
const clave = () => randomBytes(24).toString('hex');

const vars = {
  DATABASE_URL_ADMIN: ADMIN,
  DATABASE_URL_MIGRADOR: `postgresql://migrador:${clave()}@${ANFITRION}`,
  DATABASE_URL_INQUILINO: `postgresql://app_inquilino:${clave()}@${ANFITRION}`,
  DATABASE_URL_IDENTIDAD: `postgresql://app_identidad:${clave()}@${ANFITRION}`,

  // ── Etapa 6 · las tres que faltaban, y por qué eso era un agujero ──────────
  //
  // Hasta acá este script emitía SOLO las cuatro cadenas de conexión, y eso volvía
  // **decorativa** la mitad más importante de la fila ⛔ de la Etapa 6.
  //
  // El razonamiento completo, porque no es obvio: la fila exige que el paquete construido no
  // contenga *"los nombres NI LOS VALORES"* de ninguna variable secreta. La prueba busca el
  // valor de `CLAVE_MAESTRA` dentro del paquete. Pero si el build de la integración corre SIN
  // esa variable, un `NEXT_PUBLIC_CLAVE_MAESTRA` se inlinearía como `undefined` —no hay nada
  // que encontrar, la prueba pasa— y el mismo código en producción se inlinearía **con la clave
  // real**. La integración diría verde sobre exactamente el defecto que existe para atrapar.
  //
  // Así que el build de la integración necesita valores para TODAS las variables clasificadas
  // como secretas. Son efímeros y no protegen nada: existen para que haya algo que buscar.
  CLAVE_MAESTRA: randomBytes(32).toString('base64'),

  // Estas dos NO son secretas —el dominio es público y la cabecera es un nombre de cabecera—
  // pero el build y las pruebas las necesitan para no tomar caminos distintos que en producción.
  DOMINIO_ESPERADO: 'ejemplo.test',
  CABECERA_DIRECCION_REAL: 'x-real-ip',
};

const bloque = Object.entries(vars)
  .map(([k, v]) => `${k}=${v}`)
  .join('\n');

const argv = new Set(process.argv.slice(2));

if (argv.has('--github-env')) {
  const destino = process.env.GITHUB_ENV;
  if (!destino) {
    console.error('credenciales.mjs: --github-env pero GITHUB_ENV no está definida.');
    process.exit(1);
  }
  appendFileSync(destino, bloque + '\n', 'utf8');
  console.log(
    `credenciales.mjs: ${Object.keys(vars).length} variables agregadas a GITHUB_ENV ` +
      '(valores no impresos).',
  );
  console.log('  ' + Object.keys(vars).join('\n  '));
} else if (argv.has('--escribir')) {
  const ruta = join(RAIZ, '.env.local');
  if (existsSync(ruta)) {
    console.error(`credenciales.mjs: ${ruta} ya existe. No se sobrescribe.`);
    console.error('Borralo a mano si querés credenciales nuevas.');
    process.exit(1);
  }
  const encabezado = [
    '# Generado por scripts/credenciales.mjs para el contenedor local efímero.',
    '# Ignorado por git. Las contraseñas de los tres roles se leen DE ACÁ en el',
    '# arranque del clúster: así el rol creado y la cadena que lo usa no pueden',
    '# divergir.',
    '',
  ].join('\n');
  writeFileSync(ruta, encabezado + bloque + '\n', 'utf8');
  console.log('credenciales.mjs: .env.local escrito. Nombres (sin valores):');
  console.log('  ' + Object.keys(vars).join('\n  '));
} else {
  console.log('# Pegá esto en .env.local (ignorado por git):');
  console.log(bloque);
}
