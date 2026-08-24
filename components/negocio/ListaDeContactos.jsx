'use client';

/* La lista de contactos de una pestaña. UN SOLO archivo para las dos.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * LO ÚNICO QUE CAMBIA ENTRE CLOSER Y SETTER ES EL `camino`
 *
 * Y el territorio NO viaja en un parámetro: cada pestaña tiene su propia ruta
 * (`/api/closer/contactos`, `/api/setter/contactos`) con el territorio escrito en el SERVIDOR.
 *
 * Si fuera `/api/contactos?territorio=…`, **el navegador elegiría el territorio**: un setter
 * pediría `territorio=closer` y lo recibiría, porque la capacidad que el portero comprobó
 * sería la misma para los dos. La separación quedaría dependiendo de que el cliente pida lo
 * que le corresponde. Está explicado en `app/api/setter/contactos/route.ts`.
 *
 * ── LAS TRES RAMAS, SIN COLAPSAR ────────────────────────────────────────────
 *
 * `ADR-0305`: un rechazo por permiso NO se muestra como "no hay datos". Son tres hechos
 * distintos y se dibujan distinto:
 *
 *   · no pude preguntar  → se puede reintentar, y se dice que no es culpa de los datos
 *   · no tenés permiso   → NO se ofrece reintentar: reintentar no cambia tus capacidades
 *   · no hay contactos   → el vacío legítimo, que dice POR QUÉ está vacío
 *
 * Colapsarlos es cómo un 403 termina viéndose como una bandeja de trabajo vacía — y una
 * bandeja vacía nadie la reporta.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';
import Fila from './Fila.jsx';

const MOTIVOS = {
  sin_permiso: 'Tu usuario no tiene permiso para ver esta pestaña.',
  organizacion_inactiva: 'Esta organización está desactivada.',
  // Los cuatro de GoHighLevel NO tienen texto acá a propósito: el servidor manda un `detalle`
  // que dice cuál de los cinco faltantes es, o qué respondió GoHighLevel. Un texto genérico
  // local lo taparía, y esos cinco faltantes llevan a cinco acciones distintas.
};

export default function ListaDeContactos({ camino, zona }) {
  const [filas, setFilas] = useState(null);
  const [situacion, setSituacion] = useState('cargando');
  const [causa, setCausa] = useState(null);
  const [codigo, setCodigo] = useState(null);
  const [trayendo, setTrayendo] = useState(false);
  const [resultado, setResultado] = useState(null);
  const yaPedido = useRef(false);

  const cargar = useCallback(async () => {
    setSituacion('cargando');
    const r = await pedir(camino);
    if (r.tipo === 'sin_respuesta') {
      setCausa('No se pudo contactar al servidor.');
      setCodigo(null);
      setSituacion('sin_respuesta');
      return;
    }
    if (r.tipo === 'rechazado') {
      setCausa(r.detalle ?? MOTIVOS[r.codigo] ?? `El servidor respondió ${r.estado}.`);
      setCodigo(r.codigo);
      setSituacion('rechazado');
      return;
    }
    setFilas(r.datos.filas ?? []);
    setSituacion('listo');
  }, [camino]);

  useEffect(() => {
    if (yaPedido.current) return;
    yaPedido.current = true;
    void cargar();
  }, [cargar]);

  /* Traer de GoHighLevel. Es una operación APARTE de cargar la lista, y se ve aparte.
   *
   * Colapsarlas —traer siempre al abrir la pestaña— tendría dos problemas: abrir la pestaña
   * pasaría a depender de que GoHighLevel esté arriba, y cada apertura gastaría peticiones
   * contra un límite de tasa ajeno. La lista lee lo que YA está guardado; traer es explícito. */
  const traer = useCallback(async () => {
    setTrayendo(true);
    setResultado(null);
    const r = await pedir('/api/contactos/sincronizar', { metodo: 'POST' });
    setTrayendo(false);

    if (r.tipo === 'sin_respuesta') {
      setResultado({ mal: true, texto: 'No llegó al servidor. No se trajo nada.' });
      return;
    }
    if (r.tipo === 'rechazado') {
      setResultado({ mal: true, texto: r.detalle ?? MOTIVOS[r.codigo] ?? `Rechazado (${r.estado}).` });
      return;
    }

    /* El resumen COMPLETO, no un «listo». Lo que importa que se vea son los dos casos en que
       la lista queda corta y parece completa: contactos salteados, y el tope de páginas. */
    const d = r.datos;
    const guardados = (d.guardados?.closer ?? 0) + (d.guardados?.setter ?? 0);
    const partes = [`${guardados} contacto(s) guardado(s)`];
    if (d.salteados?.length) partes.push(`${d.salteados.length} salteado(s): ${d.salteados[0].porque}`);
    if (d.truncado) partes.push('se llegó al tope de páginas: puede faltar gente');
    setResultado({ mal: Boolean(d.salteados?.length || d.truncado), texto: partes.join(' · ') });

    // Y se vuelve a leer la lista. Decir "guardados 12" sin releer sería reportar un éxito sin
    // verificar que se puede ver.
    yaPedido.current = false;
    await cargar();
  }, [cargar]);

  const boton = (
    <button type="button" className="fd-btn sec" disabled={trayendo} onClick={() => void traer()}>
      {trayendo ? 'Trayendo de GoHighLevel…' : 'Traer de GoHighLevel'}
    </button>
  );

  const avisoDeTraida = resultado ? (
    <div className={`fd-aviso ${resultado.mal ? 'falta' : 'bien'}`} role="status">
      <i>{resultado.mal ? '⚠' : '✓'}</i>
      <span>{resultado.texto}</span>
    </div>
  ) : null;

  if (situacion === 'cargando') {
    return (
      <div className="fd-aviso">
        <i>◍</i>
        <span>Trayendo tus contactos…</span>
      </div>
    );
  }

  if (situacion === 'sin_respuesta') {
    return (
      <div className="aj-fila">
        <div className="fd-aviso mal">
          <i>◍</i>
          <span>{causa} No es que no tengas contactos: no se pudo preguntar.</span>
        </div>
        <button type="button" className="fd-btn sec" onClick={() => void cargar()}>
          Reintentar
        </button>
      </div>
    );
  }

  if (situacion === 'rechazado') {
    const sinPermiso = codigo === 'sin_permiso' || codigo === 'organizacion_inactiva';
    return (
      <div className={`fd-aviso ${sinPermiso ? 'falta' : 'mal'}`}>
        <i>◍</i>
        <span>{causa}</span>
      </div>
    );
  }

  if (filas.length === 0) {
    /* El vacío LEGÍTIMO, y dice por qué. El `11` § 4: *"no hay datos cargados → `—`, con una
       línea que diga qué falta"*. Un panel que simplemente parece vacío no se reporta, y con
       él se pierde el único síntoma de que la conexión con GoHighLevel no está puesta. */
    return (
      <>
        {avisoDeTraida}
        <div className="empty">
          <div className="e-ic">◔</div>
          <div className="e-t">Todavía no hay contactos en {zona}</div>
          <div className="e-d">
            Los contactos llegan de GoHighLevel según su etiqueta: los de <b>{zona}</b> aparecen
            acá. Si es la primera vez, traelos. Si ya lo hiciste y sigue vacío, revisá en{' '}
            <b>Ajustes</b> que estén cargados el token y el Location ID de tu subcuenta.
          </div>
          <div className="aj-fila" style={{ justifyContent: 'center', marginTop: 14 }}>{boton}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="aj-fila">
        {boton}
        {avisoDeTraida}
      </div>
      <div className="md-sec">
        <div className="md-h">
          Tus contactos <span className="b">{filas.length}</span>
        </div>
        {filas.map((f) => (
          <Fila key={f.id} fila={f} />
        ))}
      </div>
    </>
  );
}
