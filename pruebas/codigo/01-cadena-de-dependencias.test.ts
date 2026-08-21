// ADR-7101 — Las versiones son exactas, sin rangos.
// ADR-7102 — El archivo de bloqueo está versionado.
// ADR-7103 — Los guiones de instalación están desactivados.
// Tipo: Código + Construcción.
//
// `PRUEBAS.md` los pone en la Etapa 7b. Acá están en la Etapa 0 a propósito: su
// contenido es infraestructura de ESTA semana, sobre la integración que se está
// construyendo. Dejarlos en 7b significaría que el servidor de construcción corre
// dependencias sin fijar y con guiones habilitados DURANTE TODO EL PROYECTO, mientras
// sostiene la clave maestra de cifrado.
//
// El `10` § 5 enuncia el modelo de amenaza sin vueltas: "una dependencia con un guion
// de instalación malicioso corre en el servidor de construcción, DONDE ESTÁN TODAS LAS
// VARIABLES DE ENTORNO. Incluida la clave maestra de cifrado. No hace falta que la
// dependencia esté en la ruta del login. Basta con que esté en el proyecto."

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { RAIZ, archivosQueContienen } from '../apoyo/fuente.ts';

interface Manifiesto {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

const pkg = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')) as Manifiesto;

test('ninguna versión lleva rango', () => {
  // "Un rango es un cambio que nadie aprobó." Incluye los `^` que ya venían en el
  // repo: la regla nace satisfecha en vez de fallar sobre una condición
  // preexistente, que es el camino más rápido a debilitar la regla.
  const malas: string[] = [];
  for (const grupo of ['dependencies', 'devDependencies'] as const) {
    for (const [nombre, version] of Object.entries(pkg[grupo] ?? {})) {
      if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) malas.push(`${grupo}: ${nombre}@${version}`);
    }
  }
  assert.deepEqual(malas, []);
});

test('`.npmrc` desactiva los guiones de instalación y fija versiones exactas', () => {
  const npmrc = readFileSync(join(RAIZ, '.npmrc'), 'utf8');
  assert.match(npmrc, /^\s*ignore-scripts\s*=\s*true\s*$/m);
  assert.match(npmrc, /^\s*save-exact\s*=\s*true\s*$/m);
});

test('el archivo de bloqueo existe, está versionado y coincide con el manifiesto', () => {
  assert.ok(existsSync(join(RAIZ, 'package-lock.json')), 'falta package-lock.json');

  // Versionado de verdad: que git lo tenga en el índice, no solo que exista en el
  // disco. Un lockfile ignorado es un lockfile que no reproduce nada.
  const trackeado = execFileSync('git', ['ls-files', '--error-unmatch', 'package-lock.json'], {
    cwd: RAIZ,
    encoding: 'utf8',
  }).trim();
  assert.equal(trackeado, 'package-lock.json');

  // Y que las versiones del manifiesto sean las que el bloqueo resolvió: si
  // divergen, `npm ci` falla en integración y nadie sabe por qué.
  const lock = JSON.parse(readFileSync(join(RAIZ, 'package-lock.json'), 'utf8')) as {
    packages?: Record<string, { version?: string }>;
  };
  const divergen: string[] = [];
  for (const grupo of ['dependencies', 'devDependencies'] as const) {
    for (const [nombre, version] of Object.entries(pkg[grupo] ?? {})) {
      const enLock = lock.packages?.[`node_modules/${nombre}`]?.version;
      if (enLock && enLock !== version) divergen.push(`${nombre}: manifiesto ${version} vs bloqueo ${enLock}`);
    }
  }
  assert.deepEqual(divergen, []);
});

test('ningún paquete con guion de instalación fuera de la lista de excepciones', () => {
  // El formato v3 del archivo de bloqueo registra `hasInstallScript`, así que esto es
  // una lectura de archivo, no una llamada a la red.
  //
  // La lista tiene UNA entrada. `fsevents` es solo de macOS y opcional, así que en
  // Windows y en la integración (Linux) no se instala nunca; y con
  // `ignore-scripts=true` ningún guion corre de todos modos. Esta comprobación existe
  // para AVISAR cuando entra un paquete NUEVO con guion — que es el evento que
  // importa, no el estado de hoy.
  const JUSTIFICADAS = ['node_modules/fsevents'];

  const lock = JSON.parse(readFileSync(join(RAIZ, 'package-lock.json'), 'utf8')) as {
    packages?: Record<string, { hasInstallScript?: boolean }>;
  };
  const conGuion = Object.entries(lock.packages ?? {})
    .filter(([, v]) => v.hasInstallScript === true)
    .map(([k]) => k)
    .sort();

  assert.deepEqual(
    conGuion.filter((p) => !JUSTIFICADAS.includes(p)),
    [],
    'un paquete nuevo trae guion de instalación: justificalo y agregalo a la lista',
  );

  // Entradas muertas: si una excepción ya no hace falta, se saca. Una lista blanca
  // sin esta comprobación es un permiso permanente.
  assert.deepEqual(
    JUSTIFICADAS.filter((p) => !conGuion.includes(p)),
    [],
    'hay excepciones muertas en la lista: sacalas',
  );
});

test('ninguna variable con el prefijo público del empaquetador', () => {
  // 08 § 4: "una variable con ese prefijo que contenga la clave maestra de cifrado,
  // la contraseña del rol de base o el token de un cliente es una filtración TOTAL,
  // PERMANENTE Y PUBLICADA" — permanente porque queda en un paquete que la gente ya
  // descargó y en la caché de la red de distribución.
  //
  // Esta comprobación es más barata que la del artefacto construido y dispara ANTES
  // de `next build`. La del paquete construido llega en la Etapa 6, cuando existan
  // secretos que buscar.
  assert.deepEqual(archivosQueContienen(/NEXT_PUBLIC_/), []);
});
