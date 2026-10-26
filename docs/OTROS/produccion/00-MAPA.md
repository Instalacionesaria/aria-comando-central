# Producción

Lo que se corre o se mide contra la base y el hosting reales. Estaban sueltos en la raíz de `docs/` y
se juntaron acá el 2026-09-28 con el mismo nombre. Lo único que cambió adentro son las rutas a otros
documentos que también se movieron, dentro de la misma línea.

| documento | qué es |
|---|---|
| `DESPLIEGUE.md` | El runbook y la bitácora de producción: el entorno medido, los pasos del catálogo y de las migraciones, y lo que queda pendiente. Es el destino de tres mensajes de error de producción —el portero, el cron y la sonda terminan en «Ver docs/OTROS/produccion/DESPLIEGUE.md»— |
| `META-DIRECTO.md` | «Conectar con Meta» y todos los datos de anuncios desde la Marketing API (2026-10-26, construido en local, sin subir): qué cambia, las conexiones, el viaje, el cron, lo que se ve, lo que Meta exige y lo que falta antes de producción |
| `COMPATIBILIDAD.md` | Las consultas de catálogo, de sólo lectura, para correr a mano contra la base real: lo que la suite local no puede comprobar |
| `CENSO-DE-SUPABASE.md` | **Sólo local.** Quién es dueño de cada tabla de la base compartida. No va a GitHub —decidido el 2026-09-23— y lo excluye `.git/info/exclude` por nombre, sin ruta, para que moverlo no lo exponga |
