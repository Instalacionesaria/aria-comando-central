# El monitor de atribución, dormido

> **Estado:** **fuera de la pantalla desde el 2026-09-30** (AQ-4), por decisión del usuario: el módulo
> queda en el repositorio, con sus pruebas, y no se calcula en ninguna carga. Este archivo dice **qué
> es, por qué salió y cómo volvería**, para que nadie lo borre por creerlo muerto ni lo reconstruya por
> creerlo perdido.

---

## 1 · Qué es

El Attribution Monitor del § 18.14 del documento de requisitos: cuánto valen las cifras por anuncio,
medido. Cinco puntos —contactos con anuncio, citas con anuncio, ventas con anuncio, UTM incompletas y
contactos sin campaña (`PuntoDeAtribucion.clave`)— cada uno con su cifra y con **qué deja de valer por
culpa de esa cifra**. Los
otros dos puntos del § 18.14 no se pueden medir por esta vía, y el encabezado del módulo dice por qué.

- El cálculo: `lib/negocio/calidadDeLaAtribucion.ts`.
- Sus pruebas contra la base: `pruebas/base/99-costo-del-anuncio.test.ts`, que siguen corriendo en cada
  suite. Es lo que lo mantiene vivo mientras duerme: si un cambio de esquema lo rompe, la suite lo dice.

## 2 · Por qué salió de la pantalla

1. **La pantalla volvió al prototipo** (`docs/acquisition/14-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`), y
   el prototipo no tenía monitor. El usuario pidió la estética al 100 %.
2. **Su cifra clave ya está en la pantalla.** La nota bajo las cinco cifras dice «N de M leads traen
   campaña» (A14-12), que es el punto «contactos sin campaña», contado con la MISMA ventana que el resto.
3. **Mezclaba dos «Hoy».** El monitor cuenta ventanas móviles de 24 horas por día; los funnels, días de
   calendario cerrados (A14-10). En la misma respuesta, «7 días» quería decir dos cosas.
4. **Calcularlo para nadie costaba una lectura en cada carga**, así que también salió de la ruta
   (`app/api/acquisition/route.ts`).

## 3 · Cómo volvería

- **Con los agentes de IA**, como fuente de las Señales: «el 37 % de los contactos de esta semana no
  conserva `meta_ad_id`; las conclusiones por anuncio son incompletas» es exactamente la forma de una
  señal (`docs/OTROS/futuro/plan-y-senales-de-acquisition.md`).
- **O en la vista de gerencia**, que es donde el § 18.15 lo pone: Executive, el día que deje de ser
  maqueta.

En cualquiera de los dos casos, antes de publicarlo hay que **pasarlo a días de calendario**, con la
misma regla de ventanas que `embudosDeAcquisition` (A14-10), para que una pantalla no vuelva a mezclar
dos «7 días».
