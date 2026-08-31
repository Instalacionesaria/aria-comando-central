'use client';

/* Quién es EL closer, y cuánto cobra. El bloque de administración del cockpit.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * REEMPLAZA A «PORCENTAJES DEL EQUIPO», Y NO ES UN CAMBIO DE LUGAR
 *
 * Esa ventana listaba a TODAS las personas de la empresa con un campo de porcentaje cada una. Tenía
 * sentido con un equipo de closers; no lo tiene con la regla que se pidió: **una organización tiene
 * UN closer**, designado por quien administra, y los números del cockpit son suyos.
 *
 * Con esa regla, una lista de porcentajes por persona invita al defecto que la migración `015`
 * describe: cargarle un porcentaje a alguien que no es el closer produce una fila que no se usa en
 * ninguna pantalla, y que el día que esa persona sea designada aparece de golpe como si alguien lo
 * hubiera decidido hoy.
 *
 * Así que hay una sola decisión y dos partes: **quién**, y **cuánto**. En ese orden, porque el
 * porcentaje sin designación no se ve en ninguna parte.
 *
 * ── LO QUE NO CAMBIÓ ────────────────────────────────────────────────────────
 *
 * La tabla sigue siendo por persona (`negocio.comisiones`, clave `(org_id, usuario_id, tipo)`).
 * Aplanarla a una fila por empresa habría sido migrar datos de sueldos para ahorrar una columna, y
 * el día que haya dos closers habría que migrarla de vuelta. Lo que cambió es la PANTALLA: muestra
 * la fila del designado, no todas.
 *
 * Y la autorización tampoco: los dos endpoints piden `credenciales.ver` para leer y
 * `credenciales.editar` para escribir. Es lo que hace verdadera la regla *«un administrador no puede
 * ser closer»* sin un `if` que compare nombres de rol: la misma capacidad que habilita designar es
 * la que excluye de la lista de designables. El motivo largo está en `lib/negocio/closer.ts`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * LA DISTINCIÓN QUE ESTE PANEL NO PUEDE PERDER
 *
 * **Vacío no es cero.** Un `0 %` guardado afirma que esa persona no cobra comisión; un campo vacío
 * dice que todavía nadie lo definió. Del otro lado se ven completamente distintos: con cero, el
 * anillo dice `$0`; sin configurar, dice `—` y explica que falta que alguien lo cargue.
 *
 * Por eso hay DOS acciones y no una —«Guardar» y «Dejar sin configurar»—: volver del cero al «sin
 * definir» tiene que ser posible, y con un solo botón no lo sería.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';

const MOTIVOS = {
  sin_permiso: 'No tenés permiso para elegir el closer ni para cambiar su comisión.',
  sin_sesion: 'La sesión venció. Hay que volver a entrar.',
  no_encontrado:
    'Esa persona no puede ser el closer. Necesita tener la pestaña Closer habilitada y no ' +
    'administrar la empresa.',
};

function porQue(r) {
  if (r.tipo === 'sin_respuesta') return 'No se pudo contactar al servidor.';
  return r.detalle ?? MOTIVOS[r.codigo] ?? `El servidor respondió ${r.estado}.`;
}

/**
 * Qué hacer cuando no hay nadie que pueda ser closer, según POR QUÉ no hay nadie.
 *
 * Los cuatro motivos los mide el servidor —`PorqueNingunCandidato` en `lib/negocio/closer.ts`— y
 * llevan a DOS pantallas distintas. Un texto único para los cuatro manda a la equivocada en tres de
 * ellos, que es lo que pasaba: ver el comentario del aviso, más abajo.
 *
 * Cada texto dice la ACCIÓN y dónde se hace. «No hay candidatos» sin decir qué hacer es un cartel.
 */
const SIN_CANDIDATOS = {
  sin_gente:
    'Esta empresa no tiene todavía ninguna persona activa con correo, así que no hay a quién ' +
    'designar. Se dan de alta en Ajustes → Usuarios.',
  todos_admin:
    'Las personas de esta empresa administran la empresa, y quien configura no puede ser el ' +
    'configurado. Hace falta dar de alta a alguien que NO sea administrador —en Ajustes → ' +
    'Usuarios— y darle la pestaña Closer.',
  sin_capacidad:
    'Todavía no hay nadie que pueda ser closer. Hay que darle a alguien la pestaña Closer desde ' +
    'Ajustes → Usuarios.',
  sin_seccion:
    'Hay personas con el rol adecuado, pero ninguna tiene concedida la sección Closer. Se concede ' +
    'una por una en Ajustes → Usuarios, en la lista de pestañas de cada persona.',
};

export default function QuienEsElCloser({ alCambiar }) {
  const [candidatos, setCandidatos] = useState([]);
  /* POR QUÉ no hay ninguno, cuando no hay ninguno. Lo responde el SERVIDOR y no se deduce acá: los
     cuatro motivos se distinguen contando capacidades y secciones concedidas, y eso vive en identidad
     —una tabla que el navegador no ve ni debe ver—. Ver `PorqueNingunCandidato`. */
  const [porqueNinguno, setPorqueNinguno] = useState(null);
  const [asignado, setAsignado] = useState(null);
  const [situacion, setSituacion] = useState('cargando');
  const [causa, setCausa] = useState(null);
  const [aviso, setAviso] = useState(null);
  /* El borrador del porcentaje. Arranca en `null` —«nadie tocó el campo»— y no copiando el valor
     guardado: si arrancara copiándolo, una recarga pisaría lo que se está tipeando. */
  const [borrador, setBorrador] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const yaPedido = useRef(false);

  const absorber = useCallback((datos) => {
    setCandidatos(datos.candidatos ?? []);
    setPorqueNinguno(datos.porqueNinguno ?? null);
    setAsignado(datos.asignado ?? null);
    setBorrador(null);
  }, []);

  const cargar = useCallback(async () => {
    const r = await pedir('/api/admin/closer');
    if (r.tipo !== 'datos') {
      setCausa(porQue(r));
      setSituacion(r.tipo);
      return;
    }
    absorber(r.datos);
    setSituacion('listo');
  }, [absorber]);

  useEffect(() => {
    if (yaPedido.current) return;
    yaPedido.current = true;
    void cargar();
  }, [cargar]);

  /** Designa —o quita— al closer. */
  const designar = useCallback(
    async (usuarioId) => {
      setOcupado(true);
      setAviso(null);
      const r =
        usuarioId === ''
          ? await pedir('/api/admin/closer', { metodo: 'DELETE' })
          : await pedir('/api/admin/closer', { metodo: 'PUT', cuerpo: { usuarioId } });
      setOcupado(false);
      if (r.tipo !== 'datos') {
        setAviso({ mal: true, texto: porQue(r) });
        return;
      }
      absorber(r.datos);
      setAviso({
        mal: false,
        texto:
          usuarioId === ''
            ? 'La empresa quedó sin closer asignado. El cockpit lo dice así, no con ceros.'
            : 'Listo. El cockpit ahora muestra sus números.',
      });
      /* Y se avisa hacia arriba para que el cockpit se recargue: sus números son de otra persona
         desde este instante, y dejarlos en pantalla sería mostrarle los de quien ya no es. */
      alCambiar?.();
    },
    [absorber, alCambiar],
  );

  /** Fija —o borra— el porcentaje del designado. Va al endpoint de comisiones, que ya existe. */
  const guardarPorcentaje = useCallback(
    async (porcentaje) => {
      if (!asignado) return;
      setOcupado(true);
      setAviso(null);
      const r = await pedir('/api/admin/comisiones', {
        metodo: 'PUT',
        /* El TRAMO va explícito y el endpoint lo exige. Sin él sería un 400: es a propósito, porque
           un valor por omisión del lado del servidor convierte un olvido de una pantalla en
           escribirle el sueldo de closer a alguien en una fila que la otra pantalla no muestra. */
        cuerpo: { usuarioId: asignado.usuarioId, tramo: 'closer', porcentaje },
      });
      setOcupado(false);
      if (r.tipo !== 'datos') {
        setAviso({ mal: true, texto: porQue(r) });
        return;
      }
      /* La respuesta de ese endpoint trae la lista de porcentajes, no el estado de este panel. Así
         que se relee: mostrar «guardado» con el número viejo en pantalla es reportar un éxito sin
         verificarlo, y acá lo que quedó es cuánto va a cobrar alguien. */
      await cargar();
      setAviso({
        mal: false,
        texto:
          porcentaje === null
            ? 'Quedó sin configurar. Del otro lado se ve «nadie cargó tu porcentaje», no «0 %».'
            : `Quedó en ${porcentaje} %.`,
      });
      alCambiar?.();
    },
    [asignado, cargar, alCambiar],
  );

  if (situacion === 'cargando') {
    return (
      <div className="fd-aviso">
        <i>◍</i>
        <span>Cargando la configuración del closer…</span>
      </div>
    );
  }
  if (situacion !== 'listo') {
    return (
      <div className="fd-aviso falta">
        <i>◍</i>
        <span>{causa}</span>
      </div>
    );
  }

  const elDesignado = asignado
    ? candidatos.find((k) => k.usuarioId === asignado.usuarioId)
    : undefined;
  /* El porcentaje que se muestra: el borrador si alguien tocó el campo, y si no el guardado. El
     `??` NO puede colapsarse a `|| ''`: un porcentaje de 0 es falsy y se vería como vacío, que es
     justo la distinción que este panel existe para no perder. */
  const valorDelCampo =
    borrador !== null ? borrador : elDesignado?.porcentaje === null || elDesignado === undefined
      ? ''
      : String(elDesignado.porcentaje);

  return (
    <div className="aj-tarjeta ck-admin">
      <div className="fd-cab">
        <h3>Quién es el closer</h3>
        <span className="fd-bajada">
          Los números y la comisión de esta pantalla son de la persona que elijas acá. Podés
          cambiarla cuando quieras.
        </span>
      </div>

      <div className="fd-campo">
        <label htmlFor="ck-quien">Closer de la organización</label>
        <select
          id="ck-quien"
          value={asignado?.usuarioId ?? ''}
          disabled={ocupado}
          onChange={(e) => void designar(e.target.value)}
        >
          {/* La opción vacía NO es un relleno: es la única forma de volver de «es Ana» a «todavía
              nadie», que es un estado distinto y que el cockpit dibuja distinto. */}
          <option value="">— Sin asignar —</option>
          {candidatos.map((k) => (
            <option key={k.usuarioId} value={k.usuarioId}>
              {k.nombre} · {k.email}
            </option>
          ))}
        </select>
        {/* POR QUÉ LA LISTA PUEDE VERSE CORTA. Sin esto, un administrador que no encuentra a alguien
            en el desplegable no tiene forma de saber si es un error o una regla. */}
        <span className="aj-ayuda">
          Aparecen las personas con la pestaña Closer habilitada. Quien administra la empresa no
          aparece: quien configura no puede ser el configurado.
        </span>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          EL AVISO NOMBRA LA ACCIÓN QUE RESUELVE, Y ANTES NO

          Acá había un solo texto: *«hay que darle a alguien la pestaña Closer desde Ajustes →
          Usuarios»*. Medido contra la base de producción el 2026-08-28: los tres usuarios que existen
          son administradores y **los tres ya tienen la pestaña Closer** —`closer.ver` está concedida a
          los tres roles del catálogo—. Lo que les falta es lo contrario: no administrar la empresa.

          Así que el aviso mandaba a una pantalla donde no había nada que cambiar. No daba error, el
          texto era amable, y dejaba trabado a quien lo leyera.

          Los cuatro motivos los distingue el servidor contando descartes, y llevan a dos acciones
          distintas. Sin el motivo, la pantalla no puede elegir cuál nombrar.
          ═════════════════════════════════════════════════════════════════════ */}
      {candidatos.length === 0 ? (
        <div className="fd-aviso falta">
          <i>◍</i>
          <span>{SIN_CANDIDATOS[porqueNinguno] ?? SIN_CANDIDATOS.sin_capacidad}</span>
        </div>
      ) : null}

      {/* ── EL PORCENTAJE, y solo cuando hay a quién ponérselo ──
          Sin designado el campo no se dibuja. Dibujarlo deshabilitado invitaría a cargar un número
          que no se vería en ninguna pantalla hasta que alguien designe a alguien — y entonces
          aparecería como si se hubiera decidido en ese momento. */}
      {asignado ? (
        <div className="fd-campo">
          <label htmlFor="ck-pct">Su comisión, en porcentaje de lo cobrado</label>
          <input
            id="ck-pct"
            type="number"
            min="0"
            max="100"
            step="0.01"
            inputMode="decimal"
            placeholder="sin configurar"
            value={valorDelCampo}
            disabled={ocupado}
            onChange={(e) => setBorrador(e.target.value)}
          />
          <div className="fd-acciones">
            <button
              type="button"
              className="fd-btn"
              disabled={ocupado || borrador === null || borrador.trim() === ''}
              onClick={() => void guardarPorcentaje(Number(borrador))}
            >
              Guardar
            </button>
            <button
              type="button"
              className="fd-btn sec"
              disabled={ocupado || elDesignado?.porcentaje === null}
              onClick={() => void guardarPorcentaje(null)}
            >
              Dejar sin configurar
            </button>
          </div>
          <span className="aj-ayuda">
            Vacío y cero no son lo mismo: un 0 % dice que no cobra comisión, y sin configurar dice
            que todavía nadie lo definió.
          </span>
        </div>
      ) : null}

      {aviso ? (
        <div className={`fd-aviso ${aviso.mal ? 'falta' : 'bien'}`} role="status">
          <i>{aviso.mal ? '⚠' : '✓'}</i>
          <span>{aviso.texto}</span>
        </div>
      ) : null}
    </div>
  );
}
