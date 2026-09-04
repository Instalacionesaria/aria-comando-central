'use client';

// Los hooks que leen un camino CON MEMORIA. La primitiva está en `lib/lecturas.ts`.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO QUE ESTO ARREGLA
//
// Llegó como queja: *«todo el rato se queda cargando cuando entro a cada pestaña»*. Y no es lo que
// parece — las pestañas de arriba NO recargan: `components/CommandCenter.jsx` monta todas las
// vistas a la vez y cambiar de pantalla es puro CSS.
//
// Las que recargan son las SUB-pestañas. `CloserView` y `SetterView` dibujan
// `{sub === 'x' ? <C/> : null}`, así que ir al Pipeline y volver **desmonta** el componente; el
// que vuelve es otro, nace sin datos, y pide de nuevo.
//
// Y la regla que lo arregla ya estaba escrita en `CloserView`: *«la pantalla solo se vacía cuando
// no hay nada que mostrar»*. No alcanzaba porque al remontar no había nada. Lo que faltaba no era
// la regla: era que el dato sobreviviera.
//
// ── LA EMPRESA VA EN LA CLAVE, Y LA PONEN ESTOS HOOKS ──────────────────────
//
// `ADR-0703` — *toda memorización incluye la organización efectiva. INNEGOCIABLE.* La alternativa
// era que cada pantalla pasara su empresa, y entonces **cuatro pantallas tendrían que acordarse**;
// olvidarse en una no falla en ninguna parte — la caché funcionaría igual, mezclando dos empresas.
//
// Leyendo la sesión acá, la fila se cumple por construcción. El motivo largo y por qué no alcanza
// con que hoy cambiar de empresa recargue la página están en `lib/lecturas.ts`.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';
import { pedir, type Respuesta } from './http/cliente.ts';
import { CADENCIA } from './cadencia.ts';
import { useSesion } from '../app/sesion-contexto.tsx';
import { claveDeLectura, estaFresco, guardar, leerGuardado, olvidar } from './lecturas.ts';
/**
 * La empresa efectiva de quien mira, para la clave.
 *
 * ── ES EL PRIMER `lib/` QUE IMPORTA DE `app/`, Y ES A PROPÓSITO ────────
 *
 * La dirección natural es la contraria, así que conviene decir por qué se invierte acá: la
 * alternativa era que el hook recibiera la empresa por parámetro, y entonces **seis pantallas
 * tendrían que acordarse de pasársela**. Olvidarse en una es exactamente lo que `ADR-0703`
 * prohibe, y es un olvido que no falla en ninguna parte: la caché funcionaría igual, mezclando
 * dos empresas.
 *
 * Leyendo la sesión acá, la fila se cumple **por construcción** y no por disciplina de seis
 * llamadores. Y no es una inversión rara: este módulo es del navegador —`'use client'`, como
 * `lib/reloj.ts`— y `app/sesion-contexto.tsx` es donde el navegador tiene la empresa efectiva.
 *
 * Mientras la sesión no llegó devuelve `null`, y con `null` **no se usa la caché**: se pide y no se
 * guarda. Es un render de atraso y es la dirección prudente — guardar bajo una clave sin empresa
 * sería exactamente lo que `ADR-0703` prohíbe, y con un valor de reserva del tipo `'sin-empresa'`
 * dos organizaciones compartirían esa clave durante el primer render de cada carga.
 */
function usarEmpresaDeLaSesion(): string | null {
  const sesion = useSesion();
  return sesion?.organizacion.id ?? null;
}

/**
 * La clave de un camino para quien NO puede usar `usarLectura`.
 *
 * ── PARA UNA SOLA PANTALLA, Y CON MOTIVO ──────────────────────────────────
 *
 * `components/negocio/ListaDeContactos.jsx` acumula páginas: lo que muestra no es una respuesta
 * sino «la página 0 más las que se pidieron después», y eso no lo puede guardar un hook que
 * memoriza *una* respuesta. Guarda su propio estado —filas, página y si hay más— con la
 * primitiva.
 *
 * Lo que NO se hace es pedirle la empresa: la clave la arma este módulo. Es la misma razón por la
 * que `usarLectura` lee la sesión — `ADR-0703` se cumple por construcción, no porque un llamador
 * se acuerde. Devuelve `null` mientras la sesión no llegó, y con `null` no se guarda nada.
 */
export function usarClaveDeLectura(camino: string): string | null {
  const empresaId = usarEmpresaDeLaSesion();
  return empresaId === null ? null : claveDeLectura(empresaId, camino);
}

/** Lo que la pantalla necesita saber. Las mismas tres situaciones que ya usaba (`ADR-0305`). */
export interface Lectura<T> {
  datos: T | null;
  situacion: 'cargando' | 'listo' | 'rechazado' | 'sin_respuesta';
  /** El texto para mostrar. Con `situacion: 'listo'` significa «esto no se pudo actualizar». */
  causa: string | null;
  /** El `codigo` del rechazo, para las pantallas que distinguen entre los cinco 403. */
  codigo: string | null;
  /** Vuelve a preguntar **ignorando la ventana de frescura**. Para después de escribir. */
  refrescar: () => Promise<void>;
}

/**
 * Lee un camino, con memoria.
 *
 * ── LOS TRES CASOS AL MONTAR, Y NI UNO MÁS ────────────────────────────────
 *
 *   · **Sin nada guardado** → `'cargando'` y se pide. Igual que antes de este archivo.
 *   · **Guardado y fresco** → el dato al instante y **no sale ninguna petición**.
 *   · **Guardado y viejo** → el dato al instante, y se refresca por detrás.
 *
 * ── LA REGLA QUE NO SE PUEDE PERDER ───────────────────────────────────────
 *
 * **Teniendo datos, la pantalla no se vacía nunca** — ni cuando la recarga falla. Viene de
 * `CloserView`, que lo aprendió midiendo: poner `'cargando'` en una recarga reemplazaba el cuerpo
 * entero y **se llevaba puesta la ficha abierta**, así que volver a la pestaña la cerraba. Lo que
 * sí se hace es decirlo: `causa` queda con el motivo y `situacion` sigue en `'listo'`.
 *
 * @param camino     el mismo que se le pasaba a `pedir()`. Es parte de la clave.
 * @param opciones.sinRespuesta  qué decir cuando no se pudo preguntar. Cada pantalla tiene su
 *                   frase porque el defecto que evita es propio: en el Pipeline, *«no es que no
 *                   tengas contactos»*.
 * @param opciones.frescura  cuánto vale lo guardado. Por omisión `CADENCIA.lecturas`.
 */
export function usarLectura<T>(
  camino: string,
  opciones: {
    sinRespuesta?: string;
    frescura?: number;
    /**
     * Cómo se dice cada `codigo` de rechazo, cuando el servidor no manda `detalle`.
     *
     * Existe porque tres de estas pantallas ya tenían su propio mapa y la cadena era siempre la
     * misma: `detalle` primero —es el único texto escrito para que lo lea una persona— y si no
     * viene, la frase de la pantalla. Sin esto, migrar una pantalla que tuviera ese mapa cambiaba
     * su mensaje por un «El servidor respondió 403», que es peor y no lo notaría nadie.
     */
    motivos?: Readonly<Record<string, string>>;
  } = {},
): Lectura<T> {
  const {
    sinRespuesta = 'No se pudo contactar al servidor.',
    frescura = CADENCIA.lecturas,
    motivos = {},
  } = opciones;

  const empresaId = usarEmpresaDeLaSesion();
  const clave = empresaId === null ? null : claveDeLectura(empresaId, camino);

  /* El arranque sale de la caché en el PRIMER render, no en un efecto. En un efecto habría un
     render con `'cargando'` en el medio, o sea el parpadeo que este archivo vino a sacar. */
  const guardadoAlMontar = clave === null ? null : leerGuardado<T>(clave);
  const [datos, setDatos] = useState<T | null>(guardadoAlMontar?.valor ?? null);
  const [situacion, setSituacion] = useState<Lectura<T>['situacion']>(
    guardadoAlMontar ? 'listo' : 'cargando',
  );
  const [causa, setCausa] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);

  /* Vivo, para no escribir estado después del desmontaje. Sin esto, cambiar de sub-pestaña con una
     petición en vuelo avisa por consola y —peor— pisa el estado de un componente que ya no está. */
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const traer = useCallback(async () => {
    const r: Respuesta<T> = await pedir<T>(camino);

    /* Se guarda ANTES de mirar si el componente sigue vivo: el dato llegó y sirve para la próxima
       visita, aunque quien lo pidió ya se haya ido de la pantalla. Es justo el caso que esta caché
       existe para aprovechar. */
    if (r.tipo === 'datos' && clave !== null) guardar(clave, r.datos);
    if (!vivo.current) return;

    if (r.tipo === 'datos') {
      setDatos(r.datos);
      setCausa(null);
      setCodigo(null);
      setSituacion('listo');
      return;
    }

    /* Las tres ramas sin colapsar (`ADR-0305`): un rechazo por permiso NO es «no hay datos». Con
       una sola rama, quien no tiene la capacidad de esa pantalla vería todo en cero y creería que
       no tiene trabajo. */
    setCausa(
      r.tipo === 'rechazado'
        ? (r.detalle ?? motivos[r.codigo] ?? `El servidor respondió ${r.estado}.`)
        : sinRespuesta,
    );
    setCodigo(r.tipo === 'rechazado' ? r.codigo : null);
    /* Y ACÁ está la regla: teniendo datos NO se cambia de situación. La pantalla sigue mostrando lo
       de hace un momento con el aviso al lado, en vez de borrarle el día de trabajo a alguien por
       un corte de red de dos segundos. */
    setSituacion((antes) => (antes === 'listo' ? antes : r.tipo));
  }, [camino, clave, sinRespuesta, motivos]);

  /** Ignora la ventana. Es lo que hay que llamar DESPUÉS DE ESCRIBIR. */
  const refrescar = useCallback(async () => {
    if (clave !== null) olvidar(clave);
    await traer();
  }, [clave, traer]);

  /* La primera lectura. `pedido` y no un booleano de estado: cambiar de camino —el `verComo` del
     closer, por ejemplo— tiene que volver a pedir, y con un booleano habría que acordarse de
     bajarlo. Con la clave adentro, el efecto se vuelve a correr solo cuando de verdad cambió. */
  const pedido = useRef<string | null>(null);
  useEffect(() => {
    const marca = clave ?? camino;
    if (pedido.current === marca) return;
    pedido.current = marca;

    /* Fresco: no se pide NADA. Es el ahorro medible de este archivo — ir y volver cinco veces
       entre dos sub-pestañas cuesta una consulta en vez de cinco. */
    const g = clave === null ? null : leerGuardado<T>(clave);
    if (g && estaFresco(g.cuando, frescura)) {
      setDatos(g.valor);
      setSituacion('listo');
      return;
    }
    void traer();
  }, [clave, camino, frescura, traer]);

  return { datos, situacion, causa, codigo, refrescar };
}
