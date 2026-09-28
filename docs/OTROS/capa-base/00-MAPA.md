# La capa base — las actas de construcción

Las actas de cierre de las etapas 0 a 9 de la capa base —infraestructura, esquema, aislamiento,
permisos, sesiones, administración, credenciales, publicación, detección y Fundaciones—, construida
contra la especificación del repositorio hermano. Estaban sueltas en la raíz de `docs/` y se juntaron
acá el 2026-09-28 con el mismo nombre. Lo único que cambió adentro son las rutas a otros documentos
que también se movieron, dentro de la misma línea: ninguna cita por número de línea se corrió.

**Son históricas.** Lo vigente está en el código y en `docs/estado actual/`. No se reescriben: el
código las cita como el lugar donde está escrito el porqué de una decisión —la firma de `exigir(`,
la deuda de `SECCIONES`, los pendientes de operación— y algunas citas van por número de línea.

| acta | qué cierra | desde |
|---|---|---|
| `ETAPA-0.md` | Infraestructura: el corredor de pruebas, el migrador, los roles y las decisiones registradas para después | 2026-08-21 |
| `ETAPA-1.md` | El esquema y sus invariantes | 2026-08-21 |
| `ETAPA-2.md` | El aislamiento entre organizaciones, y el riesgo residual de RLS | 2026-08-21 |
| `ETAPA-3.md` | Permisos y el portero, con las desviaciones de la especificación | 2026-08-21 |
| `ETAPA-4.md` | Contraseñas, sesiones y segundo factor | 2026-08-21 |
| `ETAPA-5.md` | Administración | 2026-08-21 |
| `ETAPA-5.5-EL-AVISO-DEL-CRM.md` | La recomendación sobre el aviso del CRM y su sondeo | 2026-08-28 |
| `ETAPA-6.md` | Credenciales | 2026-08-21 |
| `ETAPA-7.md` | El framework y lo que se publica | 2026-08-21 |
| `ETAPA-8.md` | Detección, y los pendientes de operación con su porqué | 2026-08-21 |
| `ETAPA-9.md` | Fundaciones dentro de ICP & Oferta, y el corte con el hub | 2026-08-23 |

**Lo que no tiene acta.** El código nombra las etapas 11 a 14, y ninguna tiene documento acá: su
porqué quedó en los comentarios del código y en los mensajes de commit. Las etapas de los
departamentos no son éstas —«la etapa 2 de Sales», LP-1 a LP-7, HT-0 a OB-4— y viven en la carpeta de
su pantalla: `docs/sales/`, `docs/leads-portal/`, `docs/analizadores/`.
