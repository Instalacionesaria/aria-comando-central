'use client';

/* La franja de saldo de Tools: cuántos leads le quedan a la empresa, cuántos le regalamos, cuántos
   usó y cuántos compró. Aprobada sobre mockup (Kevin, 2026-09-13: «me gusta mucho»).

   Vive arriba de las pestañas de Tools y no dentro de una, porque el saldo se gasta desde tres de
   ellas y se consulta desde la cuarta. Una sola lectura al montar: el número cambia cuando termina
   un scraping, y ahí la pantalla ya se refresca por su lado. */

import { useEffect, useState } from 'react';

import { MINIMO_LEADS_MAPS } from '@/lib/tools/scrapers';
import { leerSaldo } from '@/lib/tools/saldo';

const num = (n) => new Intl.NumberFormat('es-PE').format(n);

export default function SaldoDeLeads() {
  const [resultado, setResultado] = useState(null);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    let vivo = true;
    leerSaldo().then((r) => {
      if (vivo) setResultado(r);
    });
    return () => {
      vivo = false;
    };
  }, []);

  if (!resultado || resultado.tipo === 'fallo') return null;

  if (resultado.tipo === 'sin_monedero') {
    return (
      <div className="sl-franja" role="status">
        <span className="sl-nota">Todavía no usaste leads. Tu saldo aparece acá con el primer scraping.</span>
      </div>
    );
  }

  const s = resultado.saldo;
  if (s.estado === 'sin_limite') return null;

  const total = Math.max(1, s.regalados + s.comprados);
  const porcentaje = Math.max(0, Math.min(100, Math.round((s.disponibles / total) * 100)));
  const clase = s.estado === 'agotado' ? 'agotado' : s.estado === 'bajo' ? 'alerta' : '';

  return (
    <div className={`sl-franja ${clase}`} role="status">
      <div className="sl-linea">
        <div className="sl-n">
          {num(s.disponibles)} <small>leads disponibles</small>
        </div>
        <div className="sl-barra" aria-hidden="true">
          <i className={s.estado === 'agotado' ? 'cero' : s.estado === 'bajo' ? 'bajo' : ''} style={{ width: `${porcentaje}%` }} />
        </div>
        <div className="sl-desglose">
          <span className="g"><b>{num(s.regalados)}</b> de regalo</span>
          <span className="u"><b>{num(s.usados)}</b> usados</span>
          <span className="p"><b>{num(s.comprados)}</b> comprados</span>
        </div>
        {s.estado === 'agotado' ? (
          <span className="sl-aviso">Se acabaron los leads de regalo. Hablá con tu coach para cargar más.</span>
        ) : s.estado === 'bajo' ? (
          <span className="sl-aviso">Una búsqueda de Google Maps necesita al menos {MINIMO_LEADS_MAPS}.</span>
        ) : (
          <button type="button" className="sl-como" onClick={() => setAbierto((a) => !a)} aria-expanded={abierto}>
            ¿Cómo se descuentan? {abierto ? '▴' : '▾'}
          </button>
        )}
      </div>
      {abierto ? (
        <p className="sl-explica">
          Cada negocio de Google Maps, cada página de Facebook y cada contacto de LinkedIn descuenta 1. El Espía de
          Anuncios no descuenta. En Research, una mirada al mercado descuenta hasta 200. Los leads de regalo se usan
          antes que los comprados.
        </p>
      ) : null}
    </div>
  );
}
