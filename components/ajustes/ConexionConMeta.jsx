'use client';

/* «Probar conexión» con Meta, debajo de las credenciales.
 *
 * Existe porque cargar el token no dice si sirve. Un token con un permiso de menos, o la cuenta act_… mal escrita, se
 * guardan igual —la ruta no valida formatos, a propósito (`app/api/admin/credenciales/route.ts`, `TOPE`)— y el único
 * síntoma sería que Creative nunca muestra miniaturas. Con este botón, quien carga el token sabe en el momento si
 * quedó bien y, si no, en cuál de tres pasos falla y qué hacer.
 *
 * No guarda nada ni cambia nada: tres lecturas a Meta (`lib/meta/conexion.ts`). Los textos de cada falla vienen del
 * servidor, para que no haya dos versiones. */

import { useCallback, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';

/* La ruta declara `maxDuration = 90`: el navegador espera más que eso, o cortaría una prueba que el servidor está por
   terminar bien (la regla de `ESPERA_MS` en `lib/http/cliente.ts`). */
const ESPERA_DE_LA_PRUEBA_MS = 100_000;

const PASOS = {
  token: '1 · El token',
  cuenta: '2 · La cuenta publicitaria',
  anuncios: '3 · La lectura de los anuncios',
};

export default function ConexionConMeta({ cargado }) {
  const [probando, setProbando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const probar = useCallback(async () => {
    setProbando(true);
    setResultado(null);
    const r = await pedir('/api/admin/credenciales/meta', { metodo: 'POST', espera: ESPERA_DE_LA_PRUEBA_MS });
    setProbando(false);
    if (r.tipo === 'sin_respuesta') {
      setResultado({ mal: true, texto: 'No se pudo contactar al servidor. Prueba de nuevo.' });
      return;
    }
    if (r.tipo === 'rechazado') {
      setResultado({ mal: true, texto: r.detalle ?? `El servidor respondió ${r.estado}.` });
      return;
    }
    const d = r.datos;
    if (d.estado === 'conectado') {
      const miniaturas =
        d.anuncios === 0
          ? 'La cuenta todavía no tiene anuncios para leer.'
          : `De los últimos ${d.anuncios} anuncios, ${d.conMiniatura} traen su miniatura.`;
      setResultado({
        mal: !d.cuenta.activa,
        texto:
          `Conectado con «${d.cuenta.nombre}»${d.cuenta.moneda ? ` (${d.cuenta.moneda})` : ''}. ${miniaturas}` +
          (d.cuenta.activa ? '' : ' La cuenta no está activa en Meta: sin anuncios en curso no hay miniaturas nuevas.'),
      });
      return;
    }
    if (d.estado === 'falla') {
      setResultado({ mal: true, paso: PASOS[d.paso], texto: d.texto });
      return;
    }
    // `sin_credencial`: falta el token o la cuenta, con el texto del resolvedor.
    setResultado({ mal: true, texto: d.texto });
  }, []);

  return (
    <div className="pr-box">
      <div className="dw-sec-t">
        La conexión con Meta
        <span className="r">
          {cargado ? <span className="tagx ag">token cargado</span> : <span className="tagx no">sin token</span>}
        </span>
      </div>
      <p className="aj-intro">
        Con el <b>Token de Meta</b> y la <b>Cuenta publicitaria</b> cargados arriba, Creative muestra la miniatura de cada
        anuncio. Este botón comprueba que los dos sirven, sin cambiar nada en Meta.
      </p>
      <div className="aj-fila">
        <button type="button" className="fd-btn" disabled={probando} onClick={() => void probar()}>
          {probando ? 'Probando…' : 'Probar conexión'}
        </button>
      </div>
      {resultado ? (
        <div className={`fd-aviso ${resultado.mal ? 'mal' : 'bien'}`} role="status">
          <i>{resultado.mal ? '⚠' : '✓'}</i>
          <span>
            {resultado.paso ? <b>{resultado.paso}: </b> : null}
            {resultado.texto}
          </span>
        </div>
      ) : null}
    </div>
  );
}
