'use client';

/* La evidencia de una respuesta del cerebro: un desplegable dentro de la burbuja (`D-28`;
 * `docs/OTROS/agentes/03-EL-CEREBRO.md`, AG-48), con lo que leyó cada herramienta.
 *
 * La forma de cada evidencia es la proyección de su adaptador (`lib/agentes/executive/adaptadores/`), que
 * cambia de una herramienta a otra, así que se dibuja por su FORMA y no por su nombre: un valor suelto como
 * texto, una lista de filas como tabla —con «mostrando X de N» cuando el adaptador cortó en veinte—, y un
 * objeto como una lista de nombre y valor, hasta tres niveles. Así una herramienta nueva se ve sin tocar
 * este archivo, y nada de lo que se ve sale de otro lado que la evidencia.
 *
 * Los nombres de las claves son los del código (`tasaDeAgenda`): se parten en palabras para leerlos, sin
 * traducirlos, porque son los mismos que cita cada cifra en su `campo`. */

const NUMERO = new Intl.NumberFormat('es', { maximumFractionDigits: 2 });
const NIVELES = 3;

/** `tasaDeAgenda` → «tasa de agenda». */
const legible = (clave) => clave.replace(/([a-z])([A-Z])/g, (_, a, b) => `${a} ${b}`).replace(/_/g, ' ').toLowerCase();

const esPrimitivo = (v) => v === null || ['string', 'number', 'boolean'].includes(typeof v);

function primitivo(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return NUMERO.format(v);
  if (typeof v === 'boolean') return v ? 'sí' : 'no';
  return String(v);
}

/** Una lista de filas como tabla: las columnas son las claves de valor suelto de las filas. */
function Tabla({ filas, total }) {
  const columnas = [...new Set(filas.flatMap((f) => Object.keys(f).filter((k) => esPrimitivo(f[k]))))];
  return (
    <div className="cb-tabla">
      {typeof total === 'number' && total > filas.length ? (
        <p className="cb-detalle">
          Mostrando {filas.length} de {total}
        </p>
      ) : null}
      <table>
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c} scope="col">
                {legible(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i}>
              {columnas.map((c) => (
                <td key={c}>{primitivo(f[c])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Un valor de evidencia, dibujado por su forma. Lo usa también la tarjeta de Señales de Acquisition. */
export function Valor({ v, nivel = 0 }) {
  if (esPrimitivo(v)) return <span>{primitivo(v)}</span>;
  if (Array.isArray(v)) {
    if (v.length === 0) return <span>—</span>;
    if (v.every(esPrimitivo)) return <span>{v.map(primitivo).join(', ')}</span>;
    if (v.every((x) => x && typeof x === 'object' && !Array.isArray(x))) return <Tabla filas={v} />;
    return <span>{JSON.stringify(v)}</span>;
  }
  // `{ filas, total }`: lo que arma `primeras` en los adaptadores.
  if (Array.isArray(v.filas) && typeof v.total === 'number') {
    return v.filas.length === 0 ? <span>—</span> : <Tabla filas={v.filas} total={v.total} />;
  }
  if (nivel >= NIVELES) return <span>{JSON.stringify(v)}</span>;
  return (
    <dl className="cb-datos">
      {Object.entries(v).map(([k, x]) => (
        <div key={k}>
          <dt>{legible(k)}</dt>
          <dd>
            <Valor v={x} nivel={nivel + 1} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function Evidencia({ evidencia }) {
  return (
    <details className="cb-evidencia">
      <summary>Evidencia ({evidencia.map((e) => e.id).join(', ')})</summary>
      {evidencia.map((e) => (
        <section key={e.id} className="cb-ev">
          <h4>
            {e.id} · {legible(e.herramienta)}
            {typeof e.argumentos?.periodo === 'string' ? <span className="cb-detalle"> · {e.argumentos.periodo}</span> : null}
          </h4>
          <Valor v={e.datos} />
        </section>
      ))}
    </details>
  );
}
