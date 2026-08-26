/** @type {import('next').NextConfig} */
const nextConfig = {
  /* El indicador flotante de desarrollo tapa la esquina inferior izquierda,
     justo donde el diseño coloca contenido. */
  devIndicators: false,

  // Etapa 9 · los archivos de metodología de Fundaciones entran al paquete.
  // ------------------------------------------------------------------------
  // Los `SKILL.md` de `lib/fundaciones/skills/` son las metodologías de las
  // siete herramientas, y la ruta de generación los lee del disco con
  // `readFileSync`. El trazado de archivos de Next sigue los `import`, y estos
  // `.md` no se importan — así que sin esta entrada NO entran al paquete.
  //
  // El síntoma de olvidarla es el peor posible: en desarrollo funciona (los
  // archivos están en el árbol) y en producción cada generación responde
  // `metodologia_ilegible`. Es el par "anda en mi máquina / no anda en prod" en
  // su forma más pura, y por eso está acá con su nombre y su motivo.
  //
  // Y con comentarios de línea, no de bloque: el patrón glob lleva `**/` + `*`,
  // y esa secuencia CIERRA un comentario de bloque. Escrito entre `/*` y `*/`,
  // este archivo no parsea y Next falla al arrancar con "Unexpected token".
  outputFileTracingIncludes: {
    '/api/fundaciones/generar': ['./lib/fundaciones/skills/**/*'],
    // La pantalla `tools` genera por su propia ruta y lee los mismos archivos. Se declara
    // explícito aunque el trazado ya los arrastre por el módulo compartido: depender de eso es
    // depender de cómo Next agrupa los fragmentos, que puede cambiar entre versiones. Y el modo
    // de falla es el peor par posible — funciona en desarrollo y falla en producción.
    '/api/tools/generar': ['./lib/fundaciones/skills/**/*'],
  },
};

export default nextConfig;
