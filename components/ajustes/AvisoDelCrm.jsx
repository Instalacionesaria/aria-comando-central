'use client';

/* El panel que configura el AVISO DEL CRM: la cabecera y las siete URLs.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * LAS SIETE URLs SALEN DEL CATÁLOGO, NUNCA DE UNA LISTA DE ACÁ
 *
 * El archivo equivalente de la plataforma anterior abre contando el defecto que esto evita: los
 * nombres de evento vivían en DOS listas —el tipo y el array— y el panel necesitaba una TERCERA para
 * mostrar las URLs. Tres listas del mismo hecho divergen en silencio, y los dos síntomas son
 * indistinguibles de «el webhook no funciona»:
 *
 *   · un evento en el `switch` y no en el panel → la URL nunca se configura;
 *   · un evento en el panel y no en el `switch` → la URL responde 200 y no hace nada.
 *
 * Así que este componente importa `EVENTOS_DEL_AVISO` y no escribe un solo nombre de evento. Una
 * prueba de forma exige que no haya ninguna cadena literal de evento acá.
 *
 * ── Y NO SE OFRECE LA URL BASE, SIN `?evento=` ──────────────────────────────
 *
 * Es el único error silencioso que la referencia documentó de su propio panel: pegar la URL sin el
 * parámetro hace que GoHighLevel entregue, que nosotros respondamos 200, y que el aviso quede sin
 * interpretar **para siempre**. No hay error, no hay reintento, y la pantalla no dibuja nada.
 *
 * Por eso cada fila de abajo tiene su URL completa y no hay ningún «la base es ésta, agregale el
 * evento».
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * EL SECRETO SE MUESTRA UNA VEZ, Y SE MUESTRA LA CABECERA COMPLETA
 *
 * No es un campo de formulario: lo genera el servidor con 32 bytes al azar. La razón está en la
 * referencia y es corta — *«un campo que se puede dejar vacío se deja vacío»*, y una empresa sin
 * secreto no puede recibir avisos.
 *
 * Y lo que se muestra es la cabecera ARMADA (`<pimienta>.<secreto>`), no las dos mitades por
 * separado: la pimienta vive en una variable de entorno del servidor, así que pedirle a alguien que
 * la busque y la pegue con el secreto sería mandarlo a copiar un secreto por tres lugares. Acá se
 * copia una sola cosa.
 *
 * Después de recargar la pantalla ya no está — solo queda «configurado». Rotar invalida el anterior
 * en el acto. */

import { useCallback, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';
import { EVENTOS_DEL_AVISO, urlDelEvento } from '../../lib/ghl/avisos.ts';

/**
 * La base de las URLs.
 *
 * Del navegador y no de una variable del servidor, y no es pereza: es el dominio por el que quien
 * está mirando llegó hasta acá, o sea el que de verdad funciona. Una variable podría decir un dominio
 * que no resuelve, y el síntoma sería un workflow configurado contra una URL que nunca entrega.
 */
function baseDeLaAplicacion() {
  return typeof window === 'undefined' ? '' : window.location.origin;
}

export default function AvisoDelCrm({ configurado, alGenerar }) {
  const [cabecera, setCabecera] = useState(null);
  const [pimientaFalta, setPimientaFalta] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [copiado, setCopiado] = useState(null);

  const generar = useCallback(async () => {
    setGenerando(true);
    setAviso(null);
    const r = await pedir('/api/admin/credenciales', { metodo: 'POST' });
    setGenerando(false);

    /* Las tres ramas sin colapsar (`ADR-0305`). Un rechazo por permiso no es «no se pudo»: con una
       sola rama, alguien sin `credenciales.editar` leería «probá de nuevo» para siempre. */
    if (r.tipo === 'sin_respuesta') {
      setAviso('No se pudo contactar al servidor. El secreto anterior sigue valiendo.');
      return;
    }
    if (r.tipo === 'rechazado') {
      setAviso(r.detalle ?? `El servidor respondió ${r.estado} · ${r.codigo}.`);
      return;
    }
    setCabecera(r.datos.avisoCabecera ?? null);
    setPimientaFalta(r.datos.avisoPimientaConfigurada === false);
    // Se recarga el estado de la pantalla: `avisoSecretoConfigurado` pasó a `true`, y quien rotó
    // tiene que ver que quedó.
    alGenerar?.();
  }, [alGenerar]);

  const copiar = useCallback(async (texto, cual) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(cual);
      // Se limpia solo: un «copiado» que se queda para siempre deja de significar algo.
      setTimeout(() => setCopiado((c) => (c === cual ? null : c)), 2000);
    } catch {
      // Sin portapapeles —contexto no seguro, permiso denegado— el texto está a la vista igual, así
      // que no se inventa un error: se dice que hay que copiarlo a mano.
      setAviso('El navegador no dejó copiar. El texto está acá arriba: seleccionalo y copialo.');
    }
  }, []);

  const base = baseDeLaAplicacion();

  return (
    <div className="pr-box">
      <div className="dw-sec-t">
        El aviso del CRM
        <span className="r">
          {configurado ? (
            <span className="tagx ag">secreto configurado</span>
          ) : (
            <span className="tagx no">sin configurar</span>
          )}
        </span>
      </div>

      <p className="aj-intro">
        Con esto, un mensaje que entra en GoHighLevel aparece acá en <b>segundos</b> en vez de esperar
        el próximo ciclo de diez minutos. No reemplaza al ciclo: lo complementa — el aviso trae rápido
        y el ciclo recoge lo que el aviso no pudo entregar.
      </p>

      {/* ── PASO 1 · LA CABECERA ─────────────────────────────────────────── */}
      <div className="fd-campo">
        <label htmlFor="aviso-cabecera">1 · La cabecera, para pegar en cada workflow</label>
        {cabecera ? (
          <>
            <textarea id="aviso-cabecera" rows={2} readOnly value={cabecera} />
            <div className="aj-fila">
              <button type="button" className="fd-btn" onClick={() => void copiar(cabecera, 'cabecera')}>
                {copiado === 'cabecera' ? 'Copiado ✓' : 'Copiar la cabecera'}
              </button>
            </div>
            {/* SE MUESTRA UNA SOLA VEZ, y hay que decirlo ANTES de que la persona cierre la
                pantalla. Un aviso después de perderlo no sirve de nada. */}
            <div className="fd-aviso falta">
              <i>◍</i>
              <span>
                Copiala ahora: <b>no se vuelve a mostrar</b>. Si la perdés, generás otra — y la
                anterior deja de funcionar en el momento, así que hay que actualizar los workflows.
              </span>
            </div>
            {pimientaFalta ? (
              <div className="fd-aviso mal">
                <i>⚠</i>
                <span>
                  Falta la variable <code>AVISO_PIMIENTA</code> en el servidor, así que esta cabecera
                  NO va a funcionar todavía. El valor que dice <code>FALTA_LA_PIMIENTA</code> es el
                  hueco.
                </span>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <span className="aj-ayuda">
              {configurado
                ? 'Ya hay un secreto configurado, y no se puede volver a mostrar. Si lo perdiste, generá otro: el anterior deja de funcionar en el momento.'
                : 'Todavía no hay secreto, así que el aviso no puede autenticarse y GoHighLevel va a recibir un rechazo en cada entrega.'}
            </span>
            <div className="aj-fila">
              <button type="button" className="fd-btn" disabled={generando} onClick={() => void generar()}>
                {generando ? 'Generando…' : configurado ? 'Generar otra cabecera' : 'Generar la cabecera'}
              </button>
            </div>
          </>
        )}
        <span className="aj-ayuda">
          En GoHighLevel va en <b>Encabezados</b>, con el nombre <code>X-Webhook-Secret</code>.
        </span>
      </div>

      {aviso ? (
        <div className="fd-aviso mal" role="alert">
          <i>⚠</i>
          <span>{aviso}</span>
        </div>
      ) : null}

      {/* ── PASO 2 · LAS SIETE URLs ──────────────────────────────────────── */}
      <div className="fd-campo">
        <label htmlFor="aviso-urls">2 · Una URL por workflow</label>
        <span className="aj-ayuda" id="aviso-urls">
          Cada workflow de GoHighLevel usa <b>su propia URL</b>. El método es <code>POST</code>. No
          hay una URL «general»: sin el <code>?evento=</code> del final, el aviso llega y no se
          interpreta — y eso no da ningún error.
        </span>
        <div className="kv-box">
          {EVENTOS_DEL_AVISO.map((e) => {
            const url = urlDelEvento(base, e.evento);
            return (
              <div className="kv" key={e.evento}>
                <span>
                  {e.titulo}
                  <br />
                  <small style={{ color: 'var(--txt-faint)' }}>{e.descripcion}</small>
                </span>
                <b>
                  <code style={{ wordBreak: 'break-all', fontSize: '11px' }}>{url}</code>
                  <br />
                  <button
                    type="button"
                    className="fd-btn sec"
                    style={{ marginTop: '6px' }}
                    onClick={() => void copiar(url, e.evento)}
                  >
                    {copiado === e.evento ? 'Copiada ✓' : 'Copiar'}
                  </button>
                </b>
              </div>
            );
          })}
        </div>
      </div>

      <p className="aj-ayuda">
        El más importante es el primero. Con ese solo, un mensaje del cliente entra en segundos; los
        demás mantienen al día el territorio y las citas.
      </p>
    </div>
  );
}
