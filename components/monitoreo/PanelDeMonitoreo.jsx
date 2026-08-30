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

   Aquél tenía además una vista «Datos scrapeados» que abría los leads de un usuario. Acá está, y
   se llega igual —haciendo clic en la fila— pero muestra una cosa MÁS que la vieja: los scrapeos
   disparados, con qué se buscó y en qué terminó cada uno. Ver `DetalleDeEmpresa.jsx`.

   Lo que no se hizo es reusar «Mis Leads» de Tools para eso. Parece la misma tabla y no lo es:
   aquélla lee la organización de la SESIÓN —`contexto.orgEfectiva`— y ésta lee la organización
   que se pidió en la URL, con una autorización distinta (`monitoreo.ver` y ser de la principal,
   contra `tools.ver`). Reusar el componente habría significado un componente que decide de quién
   son los datos según quién lo monta, que es exactamente cómo se filtra un inquilino.

   ── LOS CEROS QUE NO SON CEROS ────────────────────────────────────────────

   Dos casos, y los dos se dibujan distinto de un cero normal, porque en un tablero de consumo un
   cero silencioso se lee como *«esta empresa no scrapeó»*:

     · `ilegible` → no se pudo leer esa empresa. La fila se atenúa y lo dice.
     · `saldo: null` → esa empresa no tiene monedero, o sea que nunca fue provisionada en el
       scraper. Se muestra «sin monedero», no «0»: una empresa recién dada de alta y una que se
       quedó sin leads piden acciones opuestas. */

import { useCallback, useEffect, useState } from 'react';

import { FUENTES, NOMBRE_DE_FUENTE } from '@/lib/monitoreo/fuentes';
import { aCsv, leerPanel, margen, num, totales, usd } from '@/lib/monitoreo/panel';
import DetalleDeEmpresa from './DetalleDeEmpresa';

export default function PanelDeMonitoreo() {
  const [empresas, setEmpresas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [medidoEl, setMedidoEl] = useState(null);
  /* `true` = falta `APIFY_API_TOKEN` en el entorno, así que la columna de costos NO se va a llenar
     sola nunca. Viaja desde el servidor en vez de deducirse acá: la pantalla no puede distinguir
     «todavía no se consultó» de «no se puede consultar», y son dos avisos distintos. */
  const [sinApify, setSinApify] = useState(false);
  /* La empresa abierta, o `null` para la tabla. Se guarda la FILA entera y no sólo el
     identificador: así el detalle puede escribir el nombre en su encabezado desde el primer
     píxel, sin un instante de «Cargando…» donde va el título de lo que acabás de clickear. */
  const [abierta, setAbierta] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    const r = await leerPanel();
    if (r.tipo === 'datos') {
      setEmpresas(r.empresas);
      setSinApify(r.sinTokenDeApify);
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

  /* El detalle REEMPLAZA la tabla en vez de abrirse en una ventana: son dos tablas largas, y un
     modal con scroll propio dentro de una pantalla con scroll propio es donde la gente se pierde.
     Se dibuja antes de calcular los totales porque no los necesita. */
  if (abierta) {
    return <DetalleDeEmpresa empresa={abierta} alVolver={() => setAbierta(null)} />;
  }

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
        <div className="mon-tarjeta">
          <span className="mon-cifra">{usd(t.ingreso)}</span>
          <span className="mon-rotulo">Ingreso mensual</span>
          {/* El pie DICE cuántas faltan. Sin eso, «$1.500» se lee como el ingreso total cuando
              puede ser el de una empresa de cuatro. */}
          <span className="mon-pie">
            {t.empresasSinPrecio > 0
              ? `${num(t.empresasSinPrecio)} sin precio cargado`
              : 'todas las empresas con precio'}
          </span>
        </div>
        <div className="mon-tarjeta">
          <span className="mon-cifra">{usd(t.costo)}</span>
          <span className="mon-rotulo">Costo de Apify</span>
          <span className="mon-pie">
            {t.scrapeosSinCosto > 0
              ? `${num(t.scrapeosSinCosto)} corridas sin medir`
              : 'todas las corridas medidas'}
          </span>
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

      {/* El costo vacío se EXPLICA. Una columna en blanco en un tablero de gastos se lee como
          «no nos cuestan nada», y el arreglo acá no es de código: es cargar una variable. */}
      {sinApify ? (
        <div className="fd-aviso falta">
          <i>◍</i>
          <span>
            Los costos de Apify están <b>sin medir</b>: falta la variable de entorno{' '}
            <code>APIFY_API_TOKEN</code> en Vercel (Production). Es la misma cuenta de Apify que usa
            el backend de scraping. Mientras no esté, la columna «Costo» queda vacía — no en cero.
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
                  <th className="mon-n">Ingreso</th>
                  <th className="mon-n">Costo</th>
                  <th className="mon-n">Margen</th>
                </tr>
              </thead>
              <tbody>
                {empresas.map((e) => (
                  /* La fila entera abre el detalle. `onKeyDown` además del clic, y `tabIndex`,
                     porque un `<tr>` clicable no es alcanzable con el teclado por sí solo: sin
                     esto, la única forma de abrir una empresa sería el mouse. */
                  <tr
                    key={e.orgId}
                    className={`mon-fila${e.ilegible ? ' mon-ilegible' : ''}`}
                    tabIndex={0}
                    role="button"
                    aria-label={`Ver qué scrapeó ${e.nombre}`}
                    onClick={() => setAbierta(e)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault();
                        setAbierta(e);
                      }
                    }}
                  >
                    <td>
                      <span className="mon-empresa">
                        <b>{e.nombre}</b>
                        {e.esPrincipal ? <span className="tagx ag">Principal</span> : null}
                        {/* Una empresa desactivada sigue en la tabla: el `02` regla 7 es
                            explícito sobre que lo apagado se ve. Lo que no puede pasar es que
                            se vea igual que una activa. */}
                        {!e.activa ? <span className="tagx nu">Inactiva</span> : null}
                        {e.ilegible ? <span className="tagx nu">Sin leer</span> : null}
                        {/* El galón. Sin una pista visible, una tabla clicable se descubre por
                            accidente — y la mitad de la pantalla queda sin usar. */}
                        <span className="mon-galon" aria-hidden="true">›</span>
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
                    {/* Los tres de plata. Cada ausencia se dibuja con SU palabra, no con un cero
                        ni con un guion genérico: «sin cargar» se arregla en Ajustes → Empresas y
                        «sin medir» se arregla con el token de Apify. Un guion para las dos
                        mandaría a buscar al lugar equivocado. */}
                    <td className="mon-n">
                      {e.precioMensual === null ? (
                        <span className="mon-cero">sin cargar</span>
                      ) : (
                        usd(e.precioMensual)
                      )}
                    </td>
                    <td className="mon-n">
                      {e.costoUsd === null ? (
                        <span className="mon-cero">sin medir</span>
                      ) : (
                        usd(e.costoUsd)
                      )}
                    </td>
                    <td className={margen(e) !== null && margen(e) < 0 ? 'mon-n mon-fallo' : 'mon-n'}>
                      {margen(e) === null ? <span className="mon-cero">—</span> : usd(margen(e))}
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
                  <td className="mon-n">{usd(t.ingreso)}</td>
                  <td className="mon-n">{usd(t.costo)}</td>
                  {/* El margen total se calcula sobre los DOS totales, y sale `—` si a alguno le
                      falta un lado. Restar un total parcial de otro total parcial daría un número
                      con forma de margen que no describe ninguna empresa. */}
                  <td className="mon-n">
                    {t.ingreso === null || t.costo === null ? (
                      <span className="mon-cero">—</span>
                    ) : (
                      usd(t.ingreso - t.costo)
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : null}
      </div>
    </>
  );
}
