# closer-setter-cc-0

Conectar las pestañas **Closer** y **Setter** a datos reales.

Todos los números de acá los medí contra la base el 2026-08-23. No son estimaciones.

---

## 1 · Qué son hoy esas dos pestañas

Las dos están **inventadas de punta a punta**. Ni un dato sale de la base.

| Pestaña | Dónde vive | Qué tiene |
| --- | --- | --- |
| Closer | `lib/aios/closer.js` (189 líneas) | 6 listas escritas a mano con nombres de personas falsos |
| Closer | `components/views/CloserView.jsx` (56) | el armazón, con un contador `27` fijo |
| Setter | `components/views/SetterView.jsx` (222) | todo literal: los 4 números y las filas de escalados |

Además, **2 de las 4 sub-pestañas del Closer ni existen**: Pipeline y Agenda son carteles que dicen "acá va a ir…".

---

## 2 · Lo que voy a borrar

En `lib/aios/closer.js`:

| Qué | Qué era |
| --- | --- |
| `CL` | métricas del mes: cash, ventas, tasa, llamadas, show |
| `CL.hist` | 5 meses de facturación inventada |
| `AGENDA` | 6 citas con nombres falsos |
| `URGENTES` | 1 contacto marcado por IA |
| `BUZON` | 7 mensajes pendientes |
| `SEGUI` / `HECHAS` | seguimientos vencidos y hechos |

En `components/views/SetterView.jsx`: los 4 números de las tarjetas (9, 3, 4, 6) y las filas de escalados con sus nombres.

**Lo que NO se borra:** el diseño, las clases CSS, la navegación entre sub-pestañas, los iconos. Toda la parte visual se queda igual. Solo cambia de dónde vienen los números.

---

## 3 · Lo que hay de verdad para llenarlo

Esto es lo importante. La base está **viva**: hay mensajes y llamadas de hoy.

| Panel | Sale de | Cuánto hay | ¿Sirve? |
| --- | --- | --- | --- |
| **Agenda del Closer** | `closer_citas` | 125 citas · **18 futuras · 10 hoy** | ✅ sí |
| **Buzón** (le debemos respuesta) | `closer_contactos` | **72 contactos** esperando respuesta | ✅ sí |
| **Escalados por la IA** (Setter) | `closer_hallazgo_agente` | **37 hallazgos**, todos abiertos | ✅ sí |
| **Llamadas** | `closer_llamadas` | 180 · 54 contestadas · las últimas hoy | ✅ sí |
| **Contactos activos 48 h** | `closer_contactos` | 13 | ✅ sí |
| **Conversaciones** | `closer_mensajes` | 1.946 mensajes, el último hoy | ✅ sí |

---

## 4 · Lo que va a quedar vacío, y hay que saberlo antes

No todo tiene datos. Si conecto esto tal cual, tres paneles quedan en cero:

| Panel | Por qué | Qué falta |
| --- | --- | --- |
| **Cash collected / ventas** | **0 de 255 contactos tienen monto cargado** | alguien tiene que registrar los montos de las ventas |
| **Pipeline por etapa** | **251 de 255 contactos no tienen etapa** | alguien tiene que mover los contactos por el embudo |
| **Seguimientos** | hay **1** seguimiento en toda la base | se usan poco o se registran en otro lado |

O sea: el Closer va a mostrar **$0** de cash y un pipeline casi vacío. **No es un error del código: es lo que hay en la base.**

Y una más: los **255 contactos son todos de una sola organización**. El multiempresa existe en el diseño pero no en los datos.

---

## 5 · La decisión que necesito de vos

Los datos están en las tablas `closer_*`, que son **de la app vieja**. Nuestro sistema hoy **no tiene ningún permiso** sobre ellas — lo dejamos así a propósito para no romper nada.

Para conectar las pestañas hay que elegir un camino:

**A · Darle permiso de lectura a nuestro rol** sobre 5 o 6 tablas `closer_*`.
Rápido, y las pestañas muestran los datos reales de hoy. Toca los permisos de tablas que la app vieja usa en producción.

**B · Copiar los datos a nuestro esquema `negocio`**, con un guion que sincronice.
No toca nada de la app vieja y los datos quedan protegidos por política de fila. Bastante más trabajo, y los datos llegan con retraso.

**C · Leer con la clave de servicio de Supabase.**
Es lo que hace la app vieja. Lo menciono para descartarlo: esa clave se salta todo el aislamiento y hay una prueba que falla si aparece en el repo.

**Mi recomendación: A**, con permiso de **solo lectura** y solo sobre las tablas que estas dos pestañas necesitan. Es reversible con una línea y no puede modificar nada de la app vieja.

---

## 6 · Lo demás que tengo que preguntarte

1. **¿Quién ve qué?** Un closer, ¿ve solo sus contactos o los de todos? Hoy hay 2 closers en la base.
2. **Pipeline y Agenda del Closer no existen.** ¿Las construyo ahora o las dejo como cartel?
3. **Los tres paneles vacíos** (cash, pipeline, seguimientos): ¿los muestro en cero, o los escondo hasta que haya datos?

---

## 7 · Orden de trabajo, cuando elijas

1. Permisos de lectura sobre las tablas `closer_*` que hacen falta.
2. Rutas de API nuevas, una por panel, cada una pasando por el portero.
3. Borrar los datos inventados y pedirle los números a las rutas.
4. Pipeline y Agenda del Closer, si van.

Los pasos 1 y 2 son la mitad del trabajo. El 3 es rápido: el diseño ya está hecho.
