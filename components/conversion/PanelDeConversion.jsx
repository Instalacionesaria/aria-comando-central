'use client';

/* El tablero de Conversion: por dónde entra la gente, y cuántos abandonan el formulario.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * LO QUE ESTE ARCHIVO REEMPLAZA
 *
 * Hasta acá la pestaña la dibujaba `lib/aios/conversion.js`: 648 líneas que calculaban EN EL
 * NAVEGADOR los cinco pasos del recorrido, la banda de «lo esperado», la caída entre pasos, las once
 * fricciones con su pérdida en personas y el plan de tres acciones con su 45 % de recuperación —todo
 * sobre **530 literales inventados** y **47 frases escritas a mano**—. No tenía una sola sentencia
 * `import`, ni `fetch`, ni `await`: no había servidor del que traer nada.
 *
 * ── POR QUÉ NO ES UN EMBUDO, QUE ES LA DECISIÓN ENTERA ────────────────────
 *
 * El prototipo dibujaba `Landing → VSL → Formulario → Agenda → Gracias` como una cadena, con el
 * porcentaje de cada paso sobre el total de visitas. Medido el 2026-09-20, **esa cadena ya no es por
 * donde pasa la gente**: en agosto el 58 % entraba por la landing y en septiembre el 13 %, mientras
 * el widget de reserva directo pasó del 24 % al 44 %.
 *
 * Landing y widget **no son dos pasos de un camino: son dos caminos**. Sumarlos, o dibujar uno
 * debajo del otro con una flecha, afirmaría que quien está en el segundo pasó por el primero. Por
 * eso el bloque de arriba es un REPARTO —siete filas que suman la cohorte, cada una con su
 * población— y no una cadena. Es la regla 11 de `07-REGLAS-TRANSVERSALES.md:451`: *«una cadena que
 * no es monótona no es un embudo»*.
 *
 * ── Y POR QUÉ LAS FILAS LLEVAN UN CONTEO Y NO UNA TASA ────────────────────
 *
 * La tasa de agenda por familia salió **circular** al medirla: dos familias dan 100 % porque su
 * dirección se escribió en el momento de reservar, así que «entró por acá» y «reservó acá» son el
 * mismo hecho. El conteo viaja con `capturadaAlReservar` al lado, que es cuánto de la fila es
 * circular, y el servidor lo dice en su aviso. Ver `docs/conversion/02-METRICAS.md`, `CV2-02`.
 *
 * ── LAS CIFRAS NO SE ESCRIBEN ACÁ ─────────────────────────────────────────
 *
 * Las de este comentario llevan su fecha porque explican por qué el maquetado es así, no lo que la
 * pantalla muestra hoy. Todo lo que se dibuja lo calcula el servidor: es la corrección que Creative
 * tuvo que hacer después de que sus tres cifras de encabezado quedaran vencidas el mismo día.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from 'react';
import { CADENCIA, usarReloj } from '@/lib/reloj';
import { estaALaVista } from '@/lib/vista';
import { PERIODOS, PERIODO_POR_OMISION } from '@/lib/negocio/periodo';
import { leerConversion } from '@/lib/negocio/vistaDeConversion';

export default function PanelDeConversion() {
  const [periodo, setPeriodo] = useState(PERIODO_POR_OMISION);
  const [pantalla, setPantalla] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(
    async (esRecarga = false) => {
      if (!esRecarga) setCargando(true);
      const r = await leerConversion(periodo);
      if (r.tipo === 'datos') {
        setPantalla(r.pantalla);
        setError('');
      } else {
        setError(r.mensaje);
        if (!esRecarga) setPantalla(null);
      }
      if (!esRecarga) setCargando(false);
    },
    [periodo],
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  /* Con `null` como clave el reloj no se registra: con Conversion cerrada esto no cuesta una
     petición. Y la cadencia es la de Inteligencia porque la fuente es el alta del contacto en el
     CRM, que entra por el colector y no en vivo. */
  const aLaVista = estaALaVista('conversion');
  const recargar = useCallback(() => cargar(true), [cargar]);
  usarReloj(aLaVista ? 'conversion:tic' : null, recargar, CADENCIA.inteligencia);

  return (
    <>
      {/* La barra, SIEMPRE: si apareciera con los datos, la pantalla salta al cargar. */}
      <div className="cs-barra">
        {/* El botón encendido es el que el SERVIDOR contestó, no el que se pidió. */}
        <Periodos valor={pantalla?.periodo ?? periodo} alElegir={setPeriodo} />
      </div>

      {error ? <p className="cs-grave">{error}</p> : null}

      {cargando && pantalla === null ? (
        <p className="cs-vacio">Leyendo por dónde entra la gente…</p>
      ) : pantalla === null ? null : (
        /* La clave reinicia el cuerpo al cambiar de ventana: sin ella, lo que esté desplegado
           sobrevive al cambio y queda describiendo otra ventana. */
        <Cuerpo key={pantalla.periodo} p={pantalla} />
      )}
    </>
  );
}

/* Copia deliberada de `PanelDeCreative` y `PanelDeAcquisition`: el segmentado es el mismo control y
   `PERIODOS` la misma lista. Sacarlo a un cuarto archivo del que dependan las tres pantallas sería
   más acople que las doce líneas que ahorra — la decisión vive en `periodo.ts`, que sí es único. */
function Periodos({ valor, alElegir }) {
  return (
    <div className="db-seg cs-periodos" role="group" aria-label="Período de las cifras">
      {PERIODOS.map((p) => (
        <button
          key={p.clave}
          type="button"
          className={valor === p.clave ? 'on' : undefined}
          aria-pressed={valor === p.clave}
          title={p.matiz ?? undefined}
          onClick={() => alElegir(p.clave)}
        >
          {p.etiqueta}
        </button>
      ))}
    </div>
  );
}

/** El porqué de una cifra, detrás de un ícono. `grave` lo deja a la vista. */
function Nota({ texto, grave = false }) {
  if (!texto) return null;
  if (grave) return <p className="cs-grave">{texto}</p>;
  return (
    <span className="cs-nota" title={texto} aria-label={texto} role="note">
      i
    </span>
  );
}

// ─── Formateadores. El guion es «no se sabe», NUNCA un cero. ──────────────────

function miles(v) {
  if (v === null || v === undefined) return null;
  return Number(v).toLocaleString('es-PE');
}

function pct(v) {
  return v === null || v === undefined ? null : `${v}%`;
}

/** Una proporción de 0 a 1 a porcentaje entero. */
function tasa(v) {
  return v === null || v === undefined ? null : `${Math.round(v * 100)}%`;
}

function fechaCorta(iso) {
  if (!iso) return null;
  const [a, m, d] = iso.split('-');
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const esteAno = String(new Date().getFullYear());
  return `${Number(d)} ${MESES[Number(m) - 1] ?? ''}${a === esteAno ? '' : ` ${a}`}`;
}

function Cuerpo({ p }) {
  return (
    <>
      {/* La cobertura ANTES de cualquier reparto. Es el § 18.5. */}
      <Cobertura p={p} />
      <PorRecorrido r={p.recorrido} />
      <EmbudoDelFormulario f={p.formulario} />
      {/* Y lo último: qué NO muestra esta pantalla, y por qué. Ver `Huecos`. */}
      <Huecos lista={p.formulario.fueraDeAlcance} />
    </>
  );
}

/**
 * Cuánto vale lo que dice esta pantalla: las dos coberturas y el corte de época.
 *
 * **Son dos poblaciones que ni siquiera se solapan del todo**, y ése es el motivo de que este bloque
 * exista: el reparto habla de la cohorte entera y el formulario sólo de quienes llegaron a verlo. Un
 * lector que tome las dos cifras de abajo como si fueran del mismo grupo saca una conclusión falsa
 * sobre el abandono.
 */
function Cobertura({ p }) {
  const { recorrido, formulario } = p;
  const propRecorrido = recorrido.cobertura.sobre > 0 ? recorrido.cobertura.con / recorrido.cobertura.sobre : null;
  const propForm = formulario.cobertura.sobre > 0 ? formulario.cobertura.con / formulario.cobertura.sobre : null;

  return (
    <div className="csf">
      <div className="csf-h">
        <div className="csf-hl">
          <p className="csf-t">Cuánto vale lo que dice esta pantalla</p>
          <p className="csf-m">
            Los dos bloques de abajo hablan de poblaciones distintas y no se comparan entre sí.
          </p>
        </div>
      </div>

      <div className="csr">
        <span className="csr-n">
          Contactos de los que se sabe por dónde entraron
          <Nota
            texto={
              'Sale de la última dirección registrada del contacto. Los que no la traen no son un ' +
              'descarte: son sus propias filas del reparto, porque no tener dirección también dice ' +
              'algo sobre por dónde entró.'
            }
          />
        </span>
        <span className="csr-v">{tasa(propRecorrido) ?? '—'}</span>
        <span className="csr-b">
          <i style={{ width: `${Math.round((propRecorrido ?? 0) * 100)}%` }} />
        </span>
        <span className="csr-p">
          {miles(recorrido.cobertura.con)} de {miles(recorrido.cobertura.sobre)}
        </span>
      </div>

      <div className="csr">
        <span className="csr-n">
          Contactos que llegaron al formulario de la landing
          <Nota
            texto={
              'El denominador es la cohorte entera, no los que entraron por la landing: lo que esta ' +
              'fila mide es qué parte de toda la gente pasó por el formulario.'
            }
          />
        </span>
        <span className="csr-v">{tasa(propForm) ?? '—'}</span>
        <span className="csr-b">
          <i style={{ width: `${Math.round((propForm ?? 0) * 100)}%` }} />
        </span>
        <span className="csr-p">
          {miles(formulario.cobertura.con)} de {miles(formulario.cobertura.sobre)}
        </span>
      </div>

      {/* El rango REAL de cada bloque, que casi nunca es la ventana pedida. El del formulario se
          corta el día que el campo dejó de escribirse; el del reparto, el día que entró el último
          contacto. Decir «30 días» sobre los dos sería falso en los dos. */}
      <p className="cs-fuera">
        {recorrido.desde
          ? `Los contactos van del ${fechaCorta(recorrido.desde)} al ${fechaCorta(recorrido.hasta)}. `
          : 'Todavía no hay contactos en esta ventana. '}
        {formulario.desde
          ? `Los que traen el formulario, del ${fechaCorta(formulario.desde)} al ${fechaCorta(formulario.hasta)}.`
          : 'Ninguno de ellos trae el formulario de la landing.'}
      </p>
    </div>
  );
}

/**
 * Por dónde entró la gente: una fila por camino, y **no se suman como un embudo**.
 *
 * Las filas suman la cohorte exacta —el servidor lo garantiza— así que no hace falta una fila de
 * «resto» que se coma la diferencia. Lo que se dibuja es el REPARTO, que es la cifra más valiosa que
 * esta pantalla puede publicar hoy: cuánta gente va por cada camino.
 */
function PorRecorrido({ r }) {
  if (r.filas.length === 0) {
    return (
      <div className="csf">
        <div className="csf-h">
          <div className="csf-hl">
            <p className="csf-t">Por dónde entró la gente</p>
          </div>
        </div>
        {/* «No hubo gente» y «no hay dato» son dos afirmaciones distintas, y el servidor sabe cuál
            es: la pauta está apagada desde el 2026-09-14, así que la ventana corta sale vacía por
            falta de tráfico y no por un defecto. El texto lo escribe el servidor. */}
        {r.aviso ? <p className="cs-fuera">{r.aviso}</p> : null}
      </div>
    );
  }

  return (
    <div className="csf">
      <div className="csf-h">
        <div className="csf-hl">
          <p className="csf-t">Por dónde entró la gente</p>
          <p className="csf-m">
            Caminos alternativos, no pasos de uno solo: quien está en una fila no pasó por las de
            arriba. Por eso no se suman hacia abajo — suman la cohorte entera.
          </p>
        </div>
        {/* `<b>` y `<span>` adentro, que es el marcado que la hoja de estilos espera: el `<b>` es
            la cifra de 22 px y el `<span>` su rótulo. Un `csf-key` con texto pelado —como el de
            Creative— se dibuja al tamaño del cuerpo y la cifra clave deja de serlo. */}
        <p className="csf-key">
          <b>{miles(r.cohorte)}</b>
          <span>contactos en la ventana</span>
        </p>
      </div>

      <div className="crv-tabla crv-recorrido" role="table">
        <div className="crv-fila crv-cab" role="row">
          <span role="columnheader">Camino</span>
          <span role="columnheader">Contactos</span>
          <span role="columnheader">Del total</span>
          <span role="columnheader">Agendaron</span>
        </div>

        {r.filas.map((f) => (
          <div className="crv-fila" role="row" key={f.familia}>
            <span className="crv-n" role="cell" title={f.titulo}>
              {f.titulo}
              {/* La definición de cada camino VIAJA en la respuesta y no es una copia escrita acá:
                  este archivo es `'use client'` y `recorrido.ts` abre la base, así que importarlo
                  arrastraría `pg` —y con él `fs`, `dns` y `net`— al paquete del navegador. El build
                  falla con «Can't resolve 'dns'», que es la forma ruidosa de un error que conviene
                  que sea ruidosa. Es la misma decisión que `titulos` en Creative. */}
              <Nota texto={r.rotulos[f.familia]?.que} />
              <CircularidadDeLaFila f={f} />
            </span>
            <span role="cell">{miles(f.contactos)}</span>
            <span role="cell">{tasa(f.porcion) ?? '—'}</span>
            {/* Un CONTEO, no una tasa: la tasa por familia es circular. Ver el encabezado. */}
            <span role="cell">{miles(f.agendaron)}</span>
          </div>
        ))}
      </div>

      {r.aviso ? <p className="cs-fuera">{r.aviso}</p> : null}
    </div>
  );
}

/**
 * La marca de que el conteo de agendados de una fila no describe un recorrido.
 *
 * El servidor ya nombra en su aviso las familias donde la dirección se registró al reservar, pero
 * ese aviso está al pie del bloque y la fila está arriba. Esta nota la pone AL LADO del número que
 * se malinterpreta, que es donde alguien la va a leer.
 *
 * No repite la frase del aviso: dice la fracción medida de ESTA fila, que el aviso no da.
 */
function CircularidadDeLaFila({ f }) {
  if (f.contactos === 0 || f.capturadaAlReservar === 0) return null;
  const parte = f.capturadaAlReservar / f.contactos;
  if (parte < 0.9) return null;
  return (
    <Nota
      texto={
        `En ${f.capturadaAlReservar} de los ${f.contactos} contactos de esta fila la dirección se ` +
        'registró al reservar, así que «entró por acá» y «agendó» son el mismo hecho. Los ' +
        'agendados de esta fila no dicen que este camino convierta mejor.'
      }
    />
  );
}

/**
 * Cuántos abandonan el formulario de la landing.
 *
 * Es lo que contesta la única frase que el documento funcional pone en boca de este departamento:
 * *«La finalización del formulario es baja»* (`CC_Arquitectura_Funcional.md:1425`).
 *
 * ── LOS CUATRO SILENCIOS SE DIBUJAN DISTINTO ───────────────────────────────
 *
 * Sin el campo en el CRM el bloque se apaga y lo dice; sin nadie que lo traiga dice desde cuándo;
 * bajo el piso muestra los conteos y no la tasa; y un valor fuera del vocabulario se cuenta y se
 * informa. Los cuatro textos los escribe el servidor —están probados por mutación— y acá sólo se
 * eligen los píxeles.
 */
function EmbudoDelFormulario({ f }) {
  /* Sin el campo en el CRM no hay tabla que dibujar: publicar tres ceros afirmaría que nadie
     completa el formulario, que es una afirmación sobre el negocio hecha con cero datos. */
  const hayPoblacion = f.campoDelFormulario !== null && f.cobertura.con > 0;

  return (
    <div className="csf">
      <div className="csf-h">
        <div className="csf-hl">
          <p className="csf-t">Cuántos abandonan el formulario de la landing</p>
          <p className="csf-m">
            De los que llegaron a verlo, no de toda la gente. Es lo único que esta pantalla puede
            decir y ninguna otra puede dar.
          </p>
        </div>
        {/* El guion y no un cero: bajo el piso hay conteos pero no tasa, y un «0 %» ahí sería una
            afirmación que el servidor se negó a hacer.
            *
            Y el rótulo cambia con él: «—» encima de «completan el formulario» se lee como si la
            cifra existiera y no se hubiera podido dibujar. `.falta` apaga el color del número, que
            es la señal que la hoja de estilos ya tiene para esto. */}
        <p className={f.finalizacion === null ? 'csf-key falta' : 'csf-key'}>
          <b>{pct(f.finalizacion) ?? '—'}</b>
          <span>{f.finalizacion === null ? 'no alcanza para una tasa' : 'completan el formulario'}</span>
        </p>
      </div>

      {hayPoblacion ? (
        <div className="crv-tabla crv-formulario" role="table">
          <div className="crv-fila crv-cab" role="row">
            <span role="columnheader">Estado</span>
            <span role="columnheader">Contactos</span>
            <span role="columnheader">De los que llegaron</span>
          </div>

          {f.filas.map((x) => (
            <div className="crv-fila" role="row" key={x.estado}>
              <span className="crv-n" role="cell" title={x.estado}>
                {x.estado}
                {x.estado === 'Agendado' ? <ElCampoContraLasCitas f={f} /> : null}
              </span>
              <span role="cell">{miles(x.contactos)}</span>
              <span role="cell">{tasa(x.porcion) ?? '—'}</span>
            </div>
          ))}
        </div>
      ) : null}

      {f.aviso ? <p className="cs-fuera">{f.aviso}</p> : null}
    </div>
  );
}

/**
 * La contradicción entre lo que dice el campo y lo que dicen las citas, al lado del número.
 *
 * El campo marca `Agendado` más veces de las que hay citas alcanzables. **No es que el campo mienta**
 * —medido a 30 días las dos coinciden— sino que las citas viejas se congelan: el CRM deja de
 * devolver sus eventos. Por eso la nota habla de lo que el CRM sigue devolviendo y no acusa al campo.
 *
 * Si las dos cifras coinciden no se dibuja nada: una nota que aparece siempre es una que nadie lee.
 */
function ElCampoContraLasCitas({ f }) {
  const { segunElCampo, conCitaAlcanzable } = f.agendadoSegunLasCitas;
  if (segunElCampo <= conCitaAlcanzable) return null;
  return (
    <Nota
      texto={
        `De estos ${segunElCampo}, ${conCitaAlcanzable} tienen una cita que el CRM siga devolviendo. ` +
        'El agendamiento de este producto sale del calendario y no de este campo: si saliera de acá, ' +
        'esta pantalla diría otra cifra que Acquisition y Conversation.'
      }
    />
  );
}

/**
 * Lo que esta pantalla NO puede mostrar, dicho en la pantalla.
 *
 * ── VA ACÁ Y NO EN UN DOCUMENTO, POR DOS MOTIVOS ────────────────────────────
 *
 * El primero es el del patrón: `calidadDeLaAtribucion.ts:69` dice que los huecos *«viajan para que
 * nadie los rehaga»*.
 *
 * El segundo es de esta pantalla en particular, y pesa más acá que en Creative. **La maqueta que
 * había dibujaba estas cinco cosas con números inventados**: una curva de retención del VSL con 89
 * literales y dos caídas marcadas al segundo exacto, un mapa de calor de seis zonas, el abandono
 * campo por campo del formulario. Quien conozca esa pantalla las va a buscar, y si no están ni se
 * dice por qué, la lectura razonable es que se rompió.
 *
 * **El del VSL es el que más importa.** Su medidor escribió el campo 79 veces y las 79 dicen cero.
 * Publicar «0 % de visionado promedio» sería técnicamente cierto y completamente engañoso, así que
 * va acá con su medición y su fecha, como alarma y no como cifra.
 *
 * Si la lista llega vacía **no se dibuja nada**: es la regla del silencio.
 */
function Huecos({ lista }) {
  if (!lista?.length) return null;
  return (
    <div className="csf">
      <div className="csf-h">
        <div className="csf-hl">
          <p className="csf-t">Lo que esta pantalla no puede medir</p>
          <p className="csf-m">
            Medido contra la base y contra la API de GoHighLevel el 20 de septiembre de 2026. No son
            cosas pendientes de programar: son datos que hoy no existen en ninguna parte.
          </p>
        </div>
      </div>
      {lista.map((h) => (
        <p className="cs-fuera" key={h.punto}>
          <b>{h.punto}</b>: {h.porque}.
        </p>
      ))}
    </div>
  );
}
