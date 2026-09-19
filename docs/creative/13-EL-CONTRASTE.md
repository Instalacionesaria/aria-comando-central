# Creative — el prototipo contra el documento contra lo medible hoy

> Tres columnas donde Acquisition tuvo dos. La tercera existe porque la medición del 2026-09-18
> (`14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md`) no coincide ni con lo que la maqueta dibuja ni con lo que el
> documento supone disponible.
>
> Si se va a leer un solo archivo de esta carpeta, **que sea éste o el `14`**.

---

## En una tabla

| | El documento lo pide | El prototipo lo dibuja | Se puede hoy |
|---|---|---|---|
| Unidad de análisis | el creativo (§ 5.1, § 18.12) | la pieza (8 inventadas) | **sí** — 32 piezas reales en 79 anuncios |
| Métricas de video | 6 (§ 18.7) | 2 inventadas (`hookRate`, `retention`) | **1** (hook rate) |
| Métricas de interacción | 5 (§ 18.7) | 0 | **4** (CTR, link CTR, LPV rate, click-to-landing) |
| Indicadores del § 18.12 | 9 | 6 inventados | **4** |
| Detecciones del § 18.13 | 10 | 0 | **6**, y 4 de ésas son de Acquisition por grano |
| Esquema de alerta | 14 campos persistidos | ninguno | **0** — no hay tabla |
| Curva de retención | no la pide | 1 interpolada de 7 puntos | **0**, y **nunca** por esta vía |
| Guion del video | «interpreta guion» (§ 18.12) | 30 frases escritas a mano | **0** — no existe la pieza |
| Formato, ángulo, duración, placement | sí (§ 18.12) | 6 + 6 + 8 valores inventados | **0** |
| Calidad del lead por pieza | no la pide | «calificados», 8 literales | **sí, y es lo mejor que hay** |
| Tasa de agenda por pieza | no la pide | «agendas», 8 literales | **sí** |
| Fatiga | sí (§ 18.7, § 18.12, § 18.13) | 0 (`FREQ` no se dibuja) | **sí, por CTR**; no por frecuencia |
| Ruta de servidor | — | ninguna | — |

---

## 1 · Lo que el documento pide y el prototipo no tiene

### 1.1 · El esquema de alerta, que es la mitad del § 18.13

Catorce campos, persistidos, con `alert_id` y `created_at`. El prototipo no tiene ni el concepto: sus
«recomendaciones» se recalculan al abrir el modal, así que no pueden decir cuándo aparecieron. Ver
`C11-05`.

### 1.2 · La tendencia histórica

El § 18.16 la entrega y el § 18.13 la necesita («aumento **sostenido** de CPL», «caídas
**inusuales**»). El prototipo no tiene tiempo: sus ocho piezas son un estado, no una serie.
**Y esto sí se puede hoy**: 2.528 filas diarias desde el 2026-08-18.

### 1.3 · El placement y la fase de aprendizaje

Los pide el § 18.12 y el § 18.13. El prototipo no los dibuja y la API no los da (`C14-06`, `C8-24`).

### 1.4 · Las «solicitudes de nuevas variantes»

El § 18.15 las pone en la vista del responsable creativo. El prototipo tiene frases que **sugieren**
variantes en un modal que se cierra, no solicitudes que alguien reciba. Falta el objeto.

---

## 2 · Lo que el prototipo tiene y el documento NO menciona

### 2.1 · La partición «Funciona / No funciona»

El documento pide medir; el prototipo **juzga**, y parte la biblioteca en dos con un rótulo que manda
a pausar. Es una decisión de producto que nadie escribió y que hay que defender o corregir: con los
datos reales, mezclando etapas, manda a pausar el 65 % del volumen (`C3-05`).

### 2.2 · El criterio de orden elegible

El documento no lo pide y es la mejor decisión del prototipo: el § 2.5 dice que *«un anuncio con bajo
CTR puede seguir siendo valioso»*, y un puntaje único escondería justo eso (`C3-01`).

### 2.3 · El cajón por pieza

El documento no lo pide. Es donde cabe la cobertura de cada cifra sin ensuciar la tarjeta, y por eso
es requisito (`C4-01`).

### 2.4 · Que cada cifra abra su población

El prototipo lo hace desde 18 cifras — con catorce personas inventadas detrás. La forma es el § 2.6
de explicabilidad; los nombres son lo más grave de la pantalla (`C9-04`).

---

## 3 · Donde los tres se contradicen

### 3.1 · El documento cree que el video es imposible sin Meta; el código lo escribió; y es falso a medias

`lib/ghl/anuncios.ts:41-46` y `db/migraciones/050:52-58` declararon imposibles ocho cosas. **Cuatro
llegan hoy**, por anuncio y por día, en una llamada que el cron ya hace. Ver `14`.

### 3.2 · El documento pone a Creative en dos lugares a la vez

Departamento propio cinco veces, componente de Acquisition dos. Se resuelve por **grano**, no por
fuente, y el criterio está en `07-LO-QUE-ENTREGA-Y-RECIBE.md`.

### 3.3 · El prototipo mezcla etapas y el documento no lo prohíbe; la medición sí

Ni el § 18.12 ni el § 18.15 mencionan TOFU y BOFU. La prohibición sale de medir: `evoluciona native`
(BOFU) agenda al 77 % y las tres piezas TOFU que traen el 65 % del volumen quedan bajo el promedio
(`C1-11`, `C3-05`).

### 3.4 · «Retención inicial» y «hook rate» no son lo mismo, y el prototipo los usa como si

El prototipo tiene los dos campos, `hookRate` y `retention`, y los trata como el arranque y el final
de la misma curva. **El hook rate mide cuántos empiezan a ver; la retención, cuántos se quedan.** Hoy
se puede medir el primero y no el segundo, así que publicar uno con el nombre del otro sería la
confusión más fácil de cometer en toda la pantalla.

---

## 4 · Qué se puede construir hoy, medido

La consulta, ejecutable tal cual contra producción:

```sql
with c as (
  select lower(btrim(atribucion_primera->>'utmContent'))            as creativo,
         upper(btrim(atribucion_primera->>'campaign'))              as campana,
         nullif(campos_del_crm->>'9HXxl5DW6aayQgKUPiOS','')         as icp,
         id
  from negocio.contactos
  where alta_en_el_crm >= now() - interval '30 days'
    and coalesce(atribucion_primera->>'utmContent','') <> ''
)
select creativo,
       count(*)                                                     as contactos,
       count(*) filter (where exists (
         select 1 from negocio.citas t where t.contacto_id = c.id))  as agendaron,
       count(icp)                                                    as con_icp,
       round(avg(icp::numeric) filter (where icp ~ '^[0-9]+([.][0-9]+)?$'), 1) as icp_prom
from c
group by creativo
having count(*) >= 10          -- PISO_DE_UNA_TASA
order by count(*) desc;
```

**Resultado del 2026-09-18:**

```
creativo                          contactos  agendaron  tasa   n ICP    ICP
agendamiento - yaping                   112         48   43 %    112   42,7
agendamiento - yaping - 23/07            65         37   57 %     59   48,6
el app                                   59         23   39 %     59   45,4
evoluciona native                        39         30   77 %     39   69,2
economia us latino                       26          8   31 %     26   29,2
link_in_bio                              14          8   57 %     13   55,6
```

**Seis piezas sobre el piso, ICP de 29,2 a 69,2 (factor 2,4) y tasa de agenda de 31 % a 77 %.**
Sin conectar nada, sin credenciales nuevas y sin una sola llamada a la API.

> `link_in_bio` no es una pieza: es tráfico orgánico (`C1-06`). Aparece en la consulta porque el
> filtro es por `utmContent` y no por cruce contra `negocio.anuncios`, y **tiene que aparecer** —
> descartarlo haría que la tabla no sumara la cohorte (`C1-03`). Lo que la pantalla tiene que hacer es
> rotularlo, no esconderlo.

Y del lado de Meta, ya guardado: **79 anuncios, 32 piezas, 2.528 filas diarias del 2026-08-18 al
09-18, $3.511,28 de gasto, 263 filas con gasto > 0.**

---

## 5 · Lo que bloquea al resto, en una línea

**Para el video completo, el placement y el activo creativo: conectar Meta directo** — una app, un
token de larga duración y una revisión de la plataforma. Es lo único que cierra los cuatro huecos que
`14` midió como imposibles, y con ellos la curva de retención, el guion y la mitad interpretativa del
§ 18.12.

**Para todo lo demás: nada.** El desglose de acciones ya está llegando y se está tirando; el ICP y la
agenda por pieza se pueden calcular hoy; la serie para la fatiga lleva 32 días acumulados y crece
sola.

---

## 6 · Preguntas abiertas de esta carpeta, juntas

| id | pregunta | cómo se contesta |
|---|---|---|
| `C1-P02` | Si conviene guardar el nombre anterior de la pieza para sobrevivir a un renombre | falta saber si esta cuenta renombró alguna vez un anuncio; no hay historia |
| `C1-P03` | Dos piezas distintas con el mismo nombre se funden y nada lo dice | no se puede distinguir con estos datos; se mitiga publicando el conteo de anuncios |
| `C2-P01` | Los umbrales de fatiga y el piso de impresiones | **el § 18.19 lo declara pendiente.** Hay que decidirlo, no deducirlo |
| `C3-P01` | Si el promedio es el corte correcto, aun dentro de la etapa | no hay respuesta medida; lo que sí está decidido es declarar el corte en pantalla |
| `C6-P01` | Las «solicitudes de nuevas variantes» son una entidad y no hay tabla | decisión de producto: ¿vive en Creative o en el Team Execution del § 7? |
| `C7-P01` | Si el Espía de Anuncios debería poder correr sobre las piezas propias | decisión de producto |
| `C8-P01` | Si la cobertura de `videoView` se concentra en las piezas no-video | agrupando la cobertura por pieza, con los datos que se van a recolectar |
| `C8-P02` | Por qué los cinco días más recientes no tienen contactos atribuidos | esperar más días, o revisar la ingesta |
| `C8-P03` / `C14-P02` | Si `results.lead` es la población de Meta o la nuestra | comparando dos columnas, **después** de guardarlas |
| `C11-P01` | Cómo se fecha el «antes» de un cambio que se hizo fuera del producto | falta el objeto «tarea» |
| `C12-P01` | Si los tres roles del § 18.15 son tres pantallas o tres alcances | Creative no lo decide solo |
| `C14-P01` | Qué cuenta exactamente `videoView` | GoHighLevel no lo documenta. Mientras tanto se rotula «reproducciones que Meta contó» |
| `C14-P03` | Si `results` puede llegar como arreglo en otras cuentas | el lector tiene que tolerar las dos formas o contar como ilegible lo que no reconozca |
| `C4-09` / `C8-28` | Si el ángulo y el formato se derivan del nombre de la pieza | es una **decisión de producto**, no una lectura. No se infiere sin decidirlo |
