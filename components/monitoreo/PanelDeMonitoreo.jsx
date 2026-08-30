'use client';

/* La tabla del Panel de Monitoreo: una fila por empresa, una columna por scraper.
   ==========================================================================

   ── DE DÓNDE VIENE, Y QUÉ SE DEJÓ ATRÁS A PROPÓSITO ───────────────────────

   Del «Panel de Control» de ARIA-brain, que se borró al escribir esto. Aquél era una aplicación
   aparte —ruta `/admin`, barra lateral propia, 406 líneas de CSS propio— porque en el hub no
   había un lugar donde ponerlo sin tocar archivos compartidos. Acá SÍ lo hay: es una pestaña más
   del menú, con el mismo armazón, el mismo tema y el mismo modelo de permisos que las demás. Las
   406 líneas de estilos no se portaron; `app/monitoreo.css` son ochenta y usan los tokens del
   sistema.

   Y una cosa que aquél tenía y ésta no: la vista «Datos scrapeados», que abría los leads de un
   usuario. No se portó porque **ya existe y es mejor**: es «Mis Leads», dentro de Tools, con
   paginado y filtro por fuente. Duplicarla acá habría significado dos pantallas que muestran la
   misma tabla y divergen en la primera corrección.

   ── LOS CEROS QUE NO SON CEROS ────────────────────────────────────────────

   Dos casos, y los dos se dibujan distinto de un cero normal, porque en un tablero de consumo un
   cero silencioso se lee como *«esta empresa no scrapeó»*:

     · `ilegible` → no se pudo leer esa empresa. La fila se atenúa y lo dice.
     · `saldo: null` → esa empresa no tiene monedero, o sea que nunca fue provisionada en el
       scraper. Se muestra «sin monedero», no «0»: una empresa recién dada de alta y una que se
       quedó sin leads piden acciones opuestas. */

import { useCallback, useEffect, useState } from 'react';

import { FUENTES, NOMBRE_DE_FUENTE } from '@/lib/monitoreo/fuentes';
import { aCsv, leerPanel, num, totales } from '@/lib/monitoreo/panel';

export default function PanelDeMonitoreo() {
  const [empresas, setEmpresas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [medidoEl, setMedidoEl] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    const r = await leerPanel();
    if (r.tipo === 'datos') {
      setEmpresas(r.empresas);
      /* La hora de la medición, no la de la pantalla. Un tablero sin fecha se lee como «ahora»
         para siempre: la pestaña queda abierta, alguien vuelve a las tres horas y toma una
         decisión sobre números de la mañana. */
      setMedidoEl(new Date());
    } else {
      setError(r.mensaje);
      setEmpresas([]);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const t = totales(empresas);

  const descargar = () => {
    /* El BOM al principio: sin él, Excel en Windows abre el CSV en la codificación del sistema y
       «Espía de Anuncios» aparece con la tilde rota. Es el mismo detalle que `lib/tools/leads.ts`. */
    const url = URL.createObjectURL(
      new Blob([`﻿${aCsv(empresas)}`], { type: 'text/csv;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `monitoreo-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="mon-totales">
        <div className="mon-tarjeta">
          <span className="mon-cifra">{num(t.scrapeos)}</span>
          <span className="mon-rotulo">Scrapeos</span>
          <span className="mon-pie">
            {/* El desglose entre lo que terminó bien y lo que no. Sin él, «120 scrapeos» no
                distingue una operación sana de una que falla la mitad de las veces. */}
            {num(empresas.reduce((s, e) => s + e.completados, 0))} completados
          </span>
        </div>
        <div className="mon-tarjeta">
          <span className="mon-cifra">{num(t.leads)}</span>
          <span className="mon-rotulo">Leads guardados</span>
          <span className="mon-pie">en el historial de todas las empresas</span>
        </div>
        <div className="mon-tarjeta">
          <span className="mon-cifra">{num(t.activas)}</span>
          <span className="mon-rotulo">Empresas que scrapean</span>
          <span className="mon-pie">de {num(t.empresas)} dadas de alta</span>
        </div>
        {FUENTES.filter((f) => t.porFuente[f] > 0).map((f) => (
          <div className="mon-tarjeta" key={f}>
            <span className="mon-cifra">{num(t.porFuente[f])}</span>
            <span className="mon-rotulo">{NOMBRE_DE_FUENTE[f] ?? f}</span>
            <span className="mon-pie">scrapeos</span>
          </div>
        ))}
      </div>

      {/* Las tarjetas de arriba dejan de ser totales en cuanto hay una empresa ilegible: les
          faltan sus números. Decirlo es la diferencia entre un tablero y un tablero en el que se
          puede confiar. */}
      {t.ilegibles > 0 ? (
        <div className="fd-aviso falta">
          <i>◍</i>
          <span>
            {t.ilegibles === 1
              ? 'Una empresa no se pudo leer, así que los totales no la incluyen.'
              : `${t.ilegibles} empresas no se pudieron leer, así que los totales no las incluyen.`}{' '}
            Están marcadas abajo.
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="fd-aviso error">
          <i>◍</i>
          <span>{error}</span>
        </div>
      ) : null}

      <div className="mon-bloque">
        <div className="mon-cabeza">
          <span>
            Consumo por empresa
            {medidoEl ? (
              <span className="mon-pie" style={{ display: 'inline', marginLeft: 8 }}>
                medido a las{' '}
                {medidoEl.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
              </span>
            ) : null}
          </span>
          <div className="mon-acciones">
            <button type="button" className="fd-btn-menor" onClick={cargar} disabled={cargando}>
              {cargando ? 'Actualizando…' : 'Actualizar'}
            </button>
            {empresas.length > 0 ? (
              <button type="button" className="fd-btn-menor" onClick={descargar}>
                Descargar CSV
              </button>
            ) : null}
          </div>
        </div>

        {cargando && empresas.length === 0 ? <p className="mon-vacio">Cargando…</p> : null}

        {!cargando && !error && empresas.length === 0 ? (
          <p className="mon-vacio">Todavía no hay ninguna empresa dada de alta.</p>
        ) : null}

        {empresas.length > 0 ? (
          <div className="mon-scroll">
            <table className="mon-tabla">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th className="mon-n">Scrapeos</th>
                  {FUENTES.map((f) => (
                    <th className="mon-n" key={f}>{NOMBRE_DE_FUENTE[f] ?? f}</th>
                  ))}
                  <th className="mon-n">Leads</th>
                  <th className="mon-n">Disponibles</th>
                </tr>
              </thead>
              <tbody>
                {empresas.map((e) => (
                  <tr key={e.orgId} className={e.ilegible ? 'mon-ilegible' : undefined}>
                    <td>
                      <span className="mon-empresa">
                        <b>{e.nombre}</b>
                        {e.esPrincipal ? <span className="tagx ag">Principal</span> : null}
                        {/* Una empresa desactivada sigue en la tabla: el `02` regla 7 es
                            explícito sobre que lo apagado se ve. Lo que no puede pasar es que
                            se vea igual que una activa. */}
                        {!e.activa ? <span className="tagx nu">Inactiva</span> : null}
                        {e.ilegible ? <span className="tagx nu">Sin leer</span> : null}
                      </span>
                    </td>
                    <td className="mon-n">
                      {e.ilegible ? '—' : num(e.scrapeos)}
                      {!e.ilegible && e.scrapeos > e.completados ? (
                        <span className="mon-cero"> ({num(e.scrapeos - e.completados)} sin terminar)</span>
                      ) : null}
                    </td>
                    {FUENTES.map((f) => {
                      const n = e.porFuente[f] ?? 0;
                      return (
                        <td className={n > 0 ? 'mon-n' : 'mon-n mon-cero'} key={f}>
                          {e.ilegible ? '—' : num(n)}
                        </td>
                      );
                    })}
                    <td className="mon-n">{e.ilegible ? '—' : num(e.leads)}</td>
                    <td className="mon-n">
                      {e.ilegible ? '—' : e.saldo ? num(e.saldo.disponibles) : (
                        <span className="mon-cero">sin monedero</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="mon-n">{num(t.scrapeos)}</td>
                  {FUENTES.map((f) => (
                    <td className="mon-n" key={f}>{num(t.porFuente[f])}</td>
                  ))}
                  <td className="mon-n">{num(t.leads)}</td>
                  {/* El saldo NO se suma. Sumar monederos de empresas distintas da un número que
                      no significa nada: nadie puede gastar el saldo de otra. */}
                  <td className="mon-n mon-cero">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : null}
      </div>
    </>
  );
}
