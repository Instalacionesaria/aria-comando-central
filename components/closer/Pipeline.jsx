'use client';

/* El Pipeline: las etapas del embudo que se le pida, una debajo de la otra.

 * ── UN SOLO COMPONENTE PARA LOS DOS EMBUDOS ─────────────────────────────────
 *
 * El closer tiene siete columnas y el setter ocho, con nombres distintos, y aun así **el dibujo es
 * el mismo**: cada columna con su nombre, su conteo —aunque sea cero— y su tinte, que sale de la
 * clave por CSS. Lo que cambia son los datos, no la acción, así que se comparte.
 *
 * El `camino` es lo único que difiere, y llega como propiedad para que la pantalla no lo deduzca de
 * en qué pestaña está: el territorio lo escribe el servidor en cada ruta.
 *
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * UNA COLUMNA VACÍA SE DIBUJA IGUAL, CON SU CERO
 *
 * Es la única regla de esta pantalla que hay que defender, porque la tentación contraria es fuerte:
 * siete columnas de las que cinco están vacías se ven mal. Pero una columna que desaparece cuando
 * está vacía **hace que nadie note que está vacía**, y `Ganado 0` es una afirmación mientras que un
 * Ganado ausente es una pregunta que nadie se hace.
 *
 * ── ANTES ERAN SIETE COLUMNAS AL COSTADO, Y NO ES UN CAMBIO DE GUSTO ───────
 *
 * El tablero era `display:flex` con `overflow-x:auto` y columnas de 232 px fijos: siete columnas
 * necesitan 1.700 px y la pantalla da menos, así que **de las siete se veían tres** y las otras
 * cuatro quedaban detrás de un desplazamiento horizontal que nadie usa. Justo el defecto que el
 * encabezado de acá arriba dice que hay que evitar: una etapa que no se ve es una etapa de la que
 * nadie se pregunta si está vacía. Se dibujaban las siete y se leían tres.
 *
 * Ahora son secciones apiladas con el molde de Mi Día —`.md-sec` + `.md-h` + su conteo—, que es el
 * que esta aplicación ya usa para «una lista de contactos con un título y un número». Se ve la
 * séptima igual que la primera, con un desplazamiento vertical que es el que la pantalla ya tiene.
 *
 * Y con eso la fila pasa a ser `components/negocio/Fila.jsx`, el MISMO componente de Mi Día. Antes
 * el Pipeline dibujaba su propia tarjeta —nombre, píldora y los seis íconos, apilados— así que el
 * mismo contacto se veía de dos maneras distintas en dos pestañas vecinas. Era exactamente lo que
 * ese archivo dice en su encabezado que existe para impedir: *"si se construyen por pantalla,
 * divergen"*.
 *
 * ── Y SE DICE DE DÓNDE SALIÓ CADA CLASIFICACIÓN ─────────────────────────────
 *
 * Mientras la mayoría esté clasificada por sus etiquetas del CRM y no por un Avanzar, las columnas
 * describen lo que el CRM etiquetó, no lo que alguien registró. Eso no es un defecto —es el estado
 * real hoy, con 239 contactos y los primeros resultados recién entrando— pero **el número no puede
 * parecer más firme de lo que es**. El servidor lo cuenta y esto lo muestra.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';
import Ficha from '../negocio/Ficha.jsx';
import Fila from '../negocio/Fila.jsx';

export default function Pipeline({ camino, pulso = 0 }) {
  const [datos, setDatos] = useState(null);
  const [situacion, setSituacion] = useState('cargando');
  const [causa, setCausa] = useState(null);
  const [abierta, setAbierta] = useState(null);
  const yaPedido = useRef(false);

  const cargar = useCallback(async () => {
    const r = await pedir(camino);
    if (r.tipo !== 'datos') {
      /* Las tres ramas sin colapsar (`ADR-0305`). Un rechazo por permiso NO es «no hay datos»: con
         una sola rama, alguien sin la capacidad de esa pantalla vería todas las columnas en cero y
         creería que no tiene contactos. */
      setCausa(
        r.tipo === 'rechazado'
          ? (r.detalle ?? `El servidor respondió ${r.estado}.`)
          : 'No se pudo contactar al servidor. No es que no tengas contactos: no se pudo preguntar.',
      );
      setSituacion(r.tipo);
      return;
    }
    setDatos(r.datos);
    setSituacion('listo');
  }, [camino]);

  useEffect(() => {
    if (yaPedido.current) return;
    yaPedido.current = true;
    void cargar();
  }, [cargar]);
  /* El pulso: el reloj de la vista lo incrementa después de traer mensajes nuevos, y acá se vuelve a
     preguntar. `> 0` saltea el montaje, o la primera carga sale dos veces. */
  useEffect(() => {
    if (pulso > 0) void cargar();
  }, [pulso, cargar]);


  /* Se recarga al cerrar la ficha, y no siempre: registrar un resultado ahí adentro mueve al
     contacto de columna, y dejar el tablero como estaba mostraría el contacto en la columna vieja
     justo después de haberlo movido. */
  const cerrarFicha = useCallback(() => {
    setAbierta(null);
    yaPedido.current = false;
    void cargar();
  }, [cargar]);

  if (situacion === 'cargando') {
    return (
      <div className="fd-aviso">
        <i>◍</i>
        <span>Cargando el pipeline…</span>
      </div>
    );
  }
  if (situacion !== 'listo') {
    return (
      <div className="aj-fila">
        <div className="fd-aviso mal">
          <i>◍</i>
          <span>{causa}</span>
        </div>
        <button type="button" className="fd-btn sec" onClick={() => void cargar()}>
          Reintentar
        </button>
      </div>
    );
  }

  const c = datos.clasificados;

  return (
    <>
      {/* DE DÓNDE SALE LA CLASIFICACIÓN. Ver el encabezado. */}
      <div className={`fd-aviso ${c.porResultado > 0 ? '' : 'falta'}`}>
        <i>◍</i>
        <span>
          {/* EL DESGLOSE, y sin él los números de esta pantalla no cierran con los de ninguna
              otra: `total` incluye a los congelados y las colas de Mi Día a ninguno. Un total que
              los suma sin distinguir obliga a adivinar la diferencia. */}
          <b>{datos.total}</b> contacto(s) en la cartera
          {datos.cartera && datos.cartera.congelados > 0 ? (
            <>
              {' '}— <b>{datos.cartera.activos}</b> en zona y{' '}
              <b>{datos.cartera.congelados}</b> fuera de zona
            </>
          ) : null}
          .{' '}
          {c.porResultado > 0 ? (
            <>
              <b>{c.porResultado}</b> con un resultado registrado en Avanzar
            </>
          ) : (
            <>
              <b>Ninguno</b> tiene todavía un resultado registrado en Avanzar
            </>
          )}
          {c.porEtiqueta > 0 ? `, ${c.porEtiqueta} clasificado(s) por sus etiquetas del CRM` : ''}
          {c.sinNada > 0 ? `, ${c.sinNada} sin nada todavía` : ''}.
          {c.porResultado === 0
            ? ' Las columnas describen lo que el CRM etiquetó, no lo que alguien registró.'
            : ''}
        </span>
      </div>

      {/* EL AVISO DE TRUNCADO. Un tablero que muestra una parte y parece mostrar el todo es el peor
          resultado posible de una lista con tope: los conteos se leerían como los reales. */}
      {datos.hayMas ? (
        <div className="fd-aviso falta">
          <i>⚠</i>
          <span>
            Esto es una parte del territorio: se alcanzó el tope de la consulta, así que los
            conteos de abajo están incompletos.
          </span>
        </div>
      ) : null}

      {/* Las siete etapas, cada una una sección. El orden lo manda el SERVIDOR: es el del embudo,
          y ordenarlo acá sería una segunda lista que puede desordenarse respecto de la suya. */}
      {/* `data-etapa` lleva la CLAVE del servidor, no un color ni un nombre. El color lo pone
          `app/closer.css` a partir de esa clave, así que esta pantalla no elige tonos — y el día que
          se agregue una etapa, el CSS es el único lugar donde hay que darle el suyo. Hasta que se lo
          den, la sección se dibuja sin canto de color en vez de heredar el de la anterior. */}
      {datos.columnas.map((col) => (
        <div className="md-sec" data-etapa={col.clave} key={col.clave}>
          <div className="md-h">
            {col.nombre}{' '}
            {/* El conteo va SIEMPRE, incluido el cero. Es la mitad visible de la regla del
                encabezado: `Ganado 0` es una afirmación y un Ganado ausente es una pregunta que
                nadie se hace. */}
            <span className="b">{col.cuantos}</span>
          </div>

          {col.filas.length === 0 ? (
            /* Vacía CON SU MOTIVO, no en blanco. Una sección en blanco se lee como un error de
               carga; «Nadie acá» dice que se miró y no hay. */
            <div className="dw-empty pipe-vacia">Nadie en esta etapa.</div>
          ) : (
            col.filas.map((f) => <Fila key={f.id} fila={f} onAbrir={(fila) => setAbierta(fila.id)} />)
          )}
        </div>
      ))}

      {/* La ficha se abre DONDE se la invoca y nunca navega: al cerrarla se vuelve al mismo
          tablero, en la misma posición. Ver `components/negocio/Ficha.jsx`. */}
      {abierta ? <Ficha contactoId={abierta} alCerrar={cerrarFicha} /> : null}
    </>
  );
}
