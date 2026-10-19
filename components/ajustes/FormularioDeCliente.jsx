'use client';

/* El formulario de un cliente (el nivel 3): el alta y la edición, con los mismos campos.
 *
 * Los valores posibles salen del catálogo común (`catalogo.*`), que llega con la lista en `GET /api/admin/cuentas`:
 * el nicho, el modelo de negocio, el país y la moneda no se escriben a mano, se eligen. Así un cliente de Lima y otro
 * de Bogotá del mismo nicho se pueden comparar, que es para lo que existe el catálogo.
 *
 * Confirmar el nicho lo hace una persona mirando el nicho elegido: sin confirmar, el cliente no entra a los
 * benchmarks. Cambiar el nicho sin confirmarlo deja de estar confirmado (el servidor lo hace igual). */

import { ZONAS } from '../../lib/negocio/zonas.ts';

/** Los nichos agrupados por su sector, en el orden del catálogo. */
function nichosPorSector(nichos) {
  const sectores = nichos.filter((n) => n.nivel === 1);
  const hijos = (padre) => nichos.filter((n) => n.padre === padre);
  return sectores.map((s) => ({
    sector: s,
    nichos: hijos(s.clave).flatMap((n) => [n, ...hijos(n.clave)]),
  }));
}

/** Los campos de un cliente. `valores` y `alCambiar` los maneja quien lo usa; acá sólo se dibuja. */
export default function FormularioDeCliente({ valores, alCambiar, catalogo, prefijo }) {
  const cambiar = (campo) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    alCambiar({ ...valores, [campo]: v });
  };
  const grupos = nichosPorSector(catalogo?.nichos ?? []);

  return (
    <>
      <div className="fd-campo">
        <label htmlFor={`${prefijo}-nombre`}>Nombre del cliente</label>
        <input id={`${prefijo}-nombre`} type="text" value={valores.nombre} placeholder="Clínica Ejemplo" onChange={cambiar('nombre')} />
      </div>

      <div className="fd-rejilla dos">
        <div className="fd-campo">
          <label htmlFor={`${prefijo}-nicho`}>Nicho</label>
          <select id={`${prefijo}-nicho`} value={valores.nicho} onChange={cambiar('nicho')}>
            <option value="">Sin elegir</option>
            {grupos.map((g) => (
              <optgroup key={g.sector.clave} label={g.sector.nombre}>
                {g.nichos.map((n) => (
                  <option key={n.clave} value={n.clave}>
                    {n.nivel === 3 ? `· ${n.nombre}` : n.nombre}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="fd-campo">
          <label htmlFor={`${prefijo}-modelo`}>Modelo de negocio</label>
          <select id={`${prefijo}-modelo`} value={valores.modeloDeNegocio} onChange={cambiar('modeloDeNegocio')}>
            <option value="">Sin elegir</option>
            {(catalogo?.modelos ?? []).map((m) => (
              <option key={m.clave} value={m.clave}>
                {m.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="aj-casilla">
        <input type="checkbox" checked={valores.confirmarNicho} disabled={!valores.nicho} onChange={cambiar('confirmarNicho')} />
        <span>
          El nicho está confirmado. <span className="aj-ayuda">Sin confirmar, el cliente no entra a las comparaciones entre negocios.</span>
        </span>
      </label>

      <div className="fd-rejilla dos">
        <div className="fd-campo">
          <label htmlFor={`${prefijo}-pais`}>País</label>
          <select
            id={`${prefijo}-pais`}
            value={valores.pais}
            onChange={(e) => {
              /* El país propone su moneda y su zona, si todavía no se eligieron: es lo que casi siempre corresponde, y
                 se pueden cambiar. */
              const pais = (catalogo?.paises ?? []).find((p) => p.codigo === e.target.value);
              alCambiar({
                ...valores,
                pais: e.target.value,
                moneda: valores.moneda || pais?.moneda || '',
                zonaHoraria: valores.zonaTocada ? valores.zonaHoraria : (pais?.zonaHoraria ?? valores.zonaHoraria),
              });
            }}
          >
            <option value="">Sin elegir</option>
            {(catalogo?.paises ?? []).map((p) => (
              <option key={p.codigo} value={p.codigo}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="fd-campo">
          <label htmlFor={`${prefijo}-moneda`}>Moneda</label>
          <select id={`${prefijo}-moneda`} value={valores.moneda} onChange={cambiar('moneda')}>
            <option value="">Sin elegir</option>
            {(catalogo?.monedas ?? []).map((m) => (
              <option key={m.codigo} value={m.codigo}>
                {m.codigo} · {m.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="fd-campo">
        <label htmlFor={`${prefijo}-zona`}>Zona horaria</label>
        <select
          id={`${prefijo}-zona`}
          value={valores.zonaHoraria}
          onChange={(e) => alCambiar({ ...valores, zonaHoraria: e.target.value, zonaTocada: true })}
        >
          {ZONAS.some((z) => z.valor === valores.zonaHoraria) ? null : (
            <option value={valores.zonaHoraria}>{valores.zonaHoraria}</option>
          )}
          {ZONAS.map((z) => (
            <option key={z.valor} value={z.valor}>
              {z.nombre}
            </option>
          ))}
        </select>
        <div className="aj-ayuda">Decide qué es «hoy» para los números de este cliente.</div>
      </div>
    </>
  );
}

/** Los valores del formulario de un cliente nuevo, o de uno que ya existe. */
export function valoresDe(cliente) {
  return {
    nombre: cliente?.nombre ?? '',
    nicho: cliente?.nicho ?? '',
    confirmarNicho: Boolean(cliente?.nichoConfirmado),
    modeloDeNegocio: cliente?.modeloDeNegocio ?? '',
    pais: cliente?.pais ?? '',
    moneda: cliente?.moneda ?? '',
    zonaHoraria: cliente?.zonaHoraria ?? 'America/Lima',
    zonaTocada: Boolean(cliente),
  };
}

/** Lo que se manda: lo vacío viaja como `null` («sin elegir»), nunca como texto vacío. */
export function cuerpoDe(valores) {
  const oNulo = (v) => (v === '' ? null : v);
  return {
    nombre: valores.nombre.trim(),
    nicho: oNulo(valores.nicho),
    confirmarNicho: Boolean(valores.nicho) && valores.confirmarNicho,
    modeloDeNegocio: oNulo(valores.modeloDeNegocio),
    pais: oNulo(valores.pais),
    moneda: oNulo(valores.moneda),
    zonaHoraria: valores.zonaHoraria,
  };
}
