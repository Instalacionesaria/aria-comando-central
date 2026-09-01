'use client';

/* Los closers de la empresa: quiénes son, con qué usuario del CRM se vinculan, y cuánto cobran.
   ==========================================================================

   ── ERA UN DESPLEGABLE Y AHORA ES UNA TABLA ───────────────────────────────

   Hasta la migración 034 había UN closer por empresa —la clave primaria de la tabla era `org_id`
   sola, así que la base no aceptaba un segundo— y este panel era un `<select>`. Se pidieron hasta
   tres, cada uno con sus propios leads.

   ── LAS DOS COLUMNAS, Y POR QUÉ HACEN FALTA LAS DOS ───────────────────────

   Designar a alguien closer y **vincularlo con su usuario de GoHighLevel** son dos hechos
   distintos, y solo el segundo reparte trabajo:

     · sin designación → esa persona no aparece en el selector «ver como» ni tiene comisión;
     · sin vínculo     → está designada y **ve todos los leads**, como cualquiera que no sea closer.

   El segundo estado no es un error y se dibuja con todas las letras. Esconderlo detrás de un campo
   obligatorio obligaría a inventar un vínculo al designar, y un vínculo inventado le da a alguien
   los leads de otro.

   ── EL AVISO DEL AGENTE DE IA ─────────────────────────────────────────────

   Medido contra producción el 2026-09-01: de los 152 contactos de `zona_closer`, los **135** que
   traen asignado apuntan al MISMO usuario del CRM, y ese usuario es el que la empresa tiene cargado
   como cuenta del agente de IA. Vincular a alguien con él es legítimo —es lo que el CRM dice— y
   significa llevarse esos 135. Se avisa al lado de la opción, no se prohíbe.

   ── QUIÉN APARECE EN LA LISTA ─────────────────────────────────────────────

   Cualquiera con la pestaña Closer habilitada, **incluidos los administradores**. Antes no: la
   regla era *«quien configura no puede ser el configurado»*, y el aviso mandaba a dar de alta a
   alguien que no administrara. Se pidió sacarla, y el argumento que la sostenía se cayó solo: lo
   que decide qué leads ve cada uno ya no es la designación, es el vínculo con el CRM. */

import { useCallback, useEffect, useRef, useState } from 'react';

import { pedir } from '@/lib/http/cliente';

/* Los TRES motivos por los que la lista puede estar vacía, cada uno con la acción que lo resuelve.

   **Eran cuatro.** El que se fue es `todos_admin` —*«las personas de esta empresa administran la
   empresa, y quien configura no puede ser el configurado»*—, que se pidió quitar explícitamente y
   que era, además, el que más se veía en producción: las tres personas de la empresa son
   administradoras, así que el panel quedaba vacío mandando a crear un usuario más. */
const SIN_CANDIDATOS = {
  sin_gente:
    'Esta empresa no tiene todavía ninguna persona activa con correo, así que no hay a quién ' +
    'designar. Se dan de alta en Ajustes → Usuarios.',
  sin_capacidad:
    'Todavía no hay nadie que pueda ser closer. Hay que darle a alguien la pestaña Closer desde ' +
    'Ajustes → Usuarios.',
  sin_seccion:
    'Hay personas con el rol que corresponde, pero ninguna tiene concedida la pestaña Closer. Se ' +
    'concede en Ajustes → Usuarios, en la ficha de cada una.',
};

function porQue(r) {
  if (r.tipo === 'sin_respuesta') return 'No llegó al servidor. No se cambió nada.';
  if (r.tipo === 'rechazado') return r.detalle ?? `Rechazado (${r.estado}).`;
  return `No se pudo: ${r.datos?.motivo ?? 'sin motivo'}`;
}

export default function QuienEsElCloser({ alCambiar }) {
  const [candidatos, setCandidatos] = useState([]);
  /* POR QUÉ no hay ninguno, cuando no hay ninguno. Lo responde el SERVIDOR y no se deduce acá: los
     motivos se distinguen contando capacidades y secciones concedidas, y eso vive en identidad —una
     tabla que el navegador no ve ni debe ver—. Ver `PorqueNingunCandidato`. */
  const [porqueNinguno, setPorqueNinguno] = useState(null);
  const [closers, setClosers] = useState([]);
  const [tope, setTope] = useState(3);
  const [situacion, setSituacion] = useState('cargando');
  const [causa, setCausa] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  /* El borrador del porcentaje, POR PERSONA. Con un solo borrador compartido, escribir en la fila
     de un closer pisaría el campo de los otros dos: un objeto por identificador es lo mínimo que
     hace que tres campos sean tres campos. */
  const [borradores, setBorradores] = useState({});
  /** La fila de alta, abierta o no. `null` = cerrada. */
  const [nuevo, setNuevo] = useState(null);
  const yaPedido = useRef(false);

  /* ── LOS USUARIOS DEL CRM SE PIDEN APARTE, Y FALLAN APARTE ──────────────────
   *
   * Es la única llamada de este panel que toca GoHighLevel. Con los dos en la misma petición, un
   * token vencido dejaría sin panel a quien solo quería ver los porcentajes. Separados, la tabla se
   * dibuja igual y el desplegable del CRM dice qué pasó. */
  const [usuariosCrm, setUsuariosCrm] = useState(null);
  const [fallaCrm, setFallaCrm] = useState(null);
  const [agenteId, setAgenteId] = useState(null);

  const absorber = useCallback((datos) => {
    setCandidatos(datos.candidatos ?? []);
    setPorqueNinguno(datos.porqueNinguno ?? null);
    setClosers(datos.closers ?? []);
    setTope(datos.tope ?? 3);
    setBorradores({});
    setNuevo(null);
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
    void (async () => {
      const r = await pedir('/api/admin/closer/usuarios-crm');
      if (r.tipo !== 'datos') {
        setFallaCrm(porQue(r));
        return;
      }
      setUsuariosCrm(r.datos.usuarios ?? []);
      setAgenteId(r.datos.agenteId ?? null);
    })();
  }, [cargar]);

  /** Designa a alguien, o le cambia el vínculo. El servidor rechaza el cuarto y el vínculo repetido. */
  const guardar = useCallback(
    async (usuarioId, crmUsuarioId) => {
      setOcupado(true);
      setAviso(null);
      const r = await pedir('/api/admin/closer', {
        metodo: 'PUT',
        cuerpo: { usuarioId, crmUsuarioId: crmUsuarioId ?? '' },
      });
      setOcupado(false);
      if (r.tipo !== 'datos') {
        setAviso({ mal: true, texto: porQue(r) });
        return;
      }
      absorber(r.datos);
      /* Las DOS respuestas se dicen distinto, porque llevan a cosas distintas: con vínculo esa
         persona pasa a ver solo lo suyo, y sin vínculo sigue viendo todo. Un «guardado» a secas
         dejaría a un administrador creyendo que ya repartió el trabajo. */
      setAviso({
        mal: false,
        texto: crmUsuarioId
          ? 'Listo. Desde ahora ve solo los contactos que el CRM le asignó.'
          : 'Guardado sin vincular: por ahora ve TODOS los contactos del closer, no un reparto.',
      });
      alCambiar?.();
    },
    [absorber, alCambiar],
  );

  /** Saca a alguien de la lista de closers. */
  const quitar = useCallback(
    async (usuarioId) => {
      setOcupado(true);
      setAviso(null);
      const r = await pedir(`/api/admin/closer?usuarioId=${encodeURIComponent(usuarioId)}`, {
        metodo: 'DELETE',
      });
      setOcupado(false);
      if (r.tipo !== 'datos') {
        setAviso({ mal: true, texto: porQue(r) });
        return;
      }
      absorber(r.datos);
      setAviso({ mal: false, texto: 'Ya no es closer. Sus contactos vuelven a verlos todos.' });
      alCambiar?.();
    },
    [absorber, alCambiar],
  );

  /** Fija —o borra— el porcentaje de UNA persona. Va al endpoint de comisiones, que ya existe. */
  const guardarPorcentaje = useCallback(
    async (usuarioId, porcentaje) => {
      setOcupado(true);
      setAviso(null);
      const r = await pedir('/api/admin/comisiones', {
        metodo: 'PUT',
        /* El TRAMO va explícito y el endpoint lo exige. Sin él sería un 400: es a propósito, porque
           un valor por omisión del lado del servidor convierte un olvido de una pantalla en
           escribirle el sueldo de closer a alguien en una fila que la otra pantalla no muestra. */
        cuerpo: { usuarioId, tramo: 'closer', porcentaje },
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
    [cargar, alCambiar],
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

  const yaSonCloser = new Set(closers.map((k) => k.usuarioId));
  const libres = candidatos.filter((k) => !yaSonCloser.has(k.usuarioId));
  const lleno = closers.length >= tope;

  return (
    <div className="aj-tarjeta ck-admin">
      <div className="fd-cab">
        <h3>Closers</h3>
        <span className="fd-bajada">
          Cada closer ve <b>solo los contactos que GoHighLevel le asignó</b>. Quien no esté acá ve
          todos. Hasta {tope}.
        </span>
      </div>

      {/* ── EL FALLO DEL CRM, UNA VEZ Y NO POR FILA ──────────────────────────
          Es el mismo hecho para las tres filas —falta el token, o el proveedor no respondió— y
          repetirlo en cada una lo hace leer como tres problemas. Se dice acá y las filas quedan
          con «sin vincular» a secas, que es lo que se puede afirmar sin la lista. */}
      {fallaCrm ? (
        <div className="fd-aviso falta">
          <i>◍</i>
          <span>
            No se pudo leer la lista de usuarios de GoHighLevel, así que no se puede vincular a
            nadie: {fallaCrm}
          </span>
        </div>
      ) : null}

      {closers.length === 0 ? (
        /* El vacío DICE qué pasa, no solo que está vacío: sin closers, todos ven todo, que es un
           estado que funciona y que alguien podría no haber elegido. */
        <div className="fd-aviso">
          <i>◍</i>
          <span>
            Todavía no hay closers configurados, así que todos los que entran a esta pestaña ven
            todos los contactos.
          </span>
        </div>
      ) : (
        <ul className="ck-closers">
          {closers.map((k) => (
            <FilaDeCloser
              key={k.usuarioId}
              closer={k}
              candidato={candidatos.find((c) => c.usuarioId === k.usuarioId)}
              usuariosCrm={usuariosCrm}
              fallaCrm={fallaCrm}
              agenteId={agenteId}
              ocupado={ocupado}
              borrador={borradores[k.usuarioId]}
              alEscribir={(v) => setBorradores((b) => ({ ...b, [k.usuarioId]: v }))}
              alVincular={(crm) => void guardar(k.usuarioId, crm)}
              alQuitar={() => void quitar(k.usuarioId)}
              alGuardarPorcentaje={(p) => void guardarPorcentaje(k.usuarioId, p)}
            />
          ))}
        </ul>
      )}

      {/* ── EL ALTA ────────────────────────────────────────────────────────
          Se abre con un botón en vez de estar siempre visible: una fila vacía permanente al final de
          la lista se lee como un closer sin configurar. */}
      {nuevo === null ? (
        <div className="fd-acciones">
          <button
            type="button"
            className="fd-btn"
            disabled={ocupado || lleno || libres.length === 0}
            onClick={() => setNuevo({ usuarioId: '', crmUsuarioId: '' })}
          >
            + Agregar closer
          </button>
          {/* Los DOS motivos por los que el botón puede estar apagado se dicen, y son distintos: uno
              se resuelve quitando a alguien y el otro dando de alta una persona. Un botón gris sin
              explicación manda a adivinar. */}
          {lleno ? (
            <span className="aj-ayuda">
              Ya hay {tope}, que es el máximo. Quitá a uno para agregar otro.
            </span>
          ) : libres.length === 0 && candidatos.length > 0 ? (
            <span className="aj-ayuda">Ya son closers todas las personas que pueden serlo.</span>
          ) : null}
        </div>
      ) : (
        <div className="fd-campo ck-alta">
          <label htmlFor="ck-nuevo">Agregar closer</label>
          <select
            id="ck-nuevo"
            value={nuevo.usuarioId}
            disabled={ocupado}
            onChange={(e) => setNuevo({ ...nuevo, usuarioId: e.target.value })}
          >
            <option value="">— Elegí a la persona —</option>
            {libres.map((k) => (
              <option key={k.usuarioId} value={k.usuarioId}>
                {k.nombre} · {k.email}
              </option>
            ))}
          </select>
          <SelectorDelCrm
            id="ck-nuevo-crm"
            valor={nuevo.crmUsuarioId}
            usuariosCrm={usuariosCrm}
            fallaCrm={fallaCrm}
            agenteId={agenteId}
            ocupado={ocupado}
            alElegir={(v) => setNuevo({ ...nuevo, crmUsuarioId: v })}
          />
          <div className="fd-acciones">
            <button
              type="button"
              className="fd-btn"
              disabled={ocupado || nuevo.usuarioId === ''}
              onClick={() => void guardar(nuevo.usuarioId, nuevo.crmUsuarioId)}
            >
              Agregar
            </button>
            <button type="button" className="fd-btn sec" onClick={() => setNuevo(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          POR QUÉ NO HAY A QUIÉN DESIGNAR, cuando no lo hay. Los tres motivos llevan a acciones
          distintas y los distingue el servidor contando descartes: sin el motivo, la pantalla no
          puede elegir cuál nombrar y termina mandando a la pantalla equivocada.
          ═════════════════════════════════════════════════════════════════════ */}
      {candidatos.length === 0 ? (
        <div className="fd-aviso falta">
          <i>◍</i>
          <span>{SIN_CANDIDATOS[porqueNinguno] ?? SIN_CANDIDATOS.sin_capacidad}</span>
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

/** Una fila: quién es, con qué usuario del CRM se vincula, y cuánto cobra. */
function FilaDeCloser({
  closer,
  candidato,
  usuariosCrm,
  fallaCrm,
  agenteId,
  ocupado,
  borrador,
  alEscribir,
  alVincular,
  alQuitar,
  alGuardarPorcentaje,
}) {
  /* El porcentaje que se muestra: el borrador si alguien tocó el campo, y si no el guardado. El
     `??` NO puede colapsarse a `|| ''`: un porcentaje de 0 es falsy y se vería como vacío, que es
     justo la distinción que este panel existe para no perder. */
  const valorDelCampo =
    borrador !== undefined
      ? borrador
      : candidato?.porcentaje === null || candidato === undefined
        ? ''
        : String(candidato.porcentaje);

  return (
    <li className="ck-closer">
      <div className="ck-closer-quien">
        <b>{closer.nombre}</b>
        {candidato?.email ? <span className="aj-ayuda">{candidato.email}</span> : null}
      </div>

      <div className="ck-closer-crm">
        <SelectorDelCrm
          id={`ck-crm-${closer.usuarioId}`}
          valor={closer.crmUsuarioId ?? ''}
          usuariosCrm={usuariosCrm}
          fallaCrm={fallaCrm}
          agenteId={agenteId}
          ocupado={ocupado}
          alElegir={(v) => alVincular(v)}
        />
        {/* SIN VINCULAR se dice, y se dice qué implica. Un desplegable en «— sin vincular —» sin
            texto al lado se lee como un campo opcional que alguien todavía no completó, y lo que
            significa es que esa persona ve todos los contactos. */}
        {closer.crmUsuarioId === null ? (
          <span className="aj-ayuda ck-sin-vincular">
            Sin vincular: ve <b>todos</b> los contactos, no solo los suyos.
          </span>
        ) : null}
      </div>

      <div className="ck-closer-pct">
        <input
          type="number"
          min="0"
          max="100"
          step="0.01"
          inputMode="decimal"
          placeholder="sin %"
          aria-label={`Comisión de ${closer.nombre}, en porcentaje`}
          value={valorDelCampo}
          disabled={ocupado}
          onChange={(e) => alEscribir(e.target.value)}
        />
        <button
          type="button"
          className="fd-btn sec"
          disabled={ocupado || borrador === undefined || borrador.trim() === ''}
          onClick={() => alGuardarPorcentaje(Number(borrador))}
        >
          Guardar %
        </button>
      </div>

      <button
        type="button"
        className="fd-btn sec ck-quitar"
        disabled={ocupado}
        aria-label={`Quitar a ${closer.nombre} de los closers`}
        onClick={alQuitar}
      >
        ×
      </button>
    </li>
  );
}

/**
 * El desplegable de usuarios de GoHighLevel, con sus tres estados.
 *
 * Cargando, con error y con datos se ven distinto, por lo mismo que en el resto del proyecto: un
 * desplegable vacío mientras carga y un desplegable vacío porque el token venció son el mismo
 * control para quien mira, y llevan a dos acciones opuestas — esperar, o ir a Integraciones.
 */
function SelectorDelCrm({ id, valor, usuariosCrm, fallaCrm, agenteId, ocupado, alElegir }) {
  /* Con la lista caída no hay nada que elegir, y el motivo ya se dijo UNA vez arriba. Acá queda
     solo el estado del vínculo, que sí es de esta fila: se puede afirmar sin la lista porque sale
     de nuestra base, no del CRM. */
  if (fallaCrm) {
    return (
      <span className="aj-ayuda">
        {valor ? `Vinculado · ${valor}` : '— Sin vincular —'}
      </span>
    );
  }
  if (usuariosCrm === null) {
    return <span className="aj-ayuda">Cargando los usuarios de GoHighLevel…</span>;
  }

  return (
    <>
      <select
        id={id}
        value={valor}
        disabled={ocupado}
        aria-label="Usuario en GoHighLevel"
        onChange={(e) => alElegir(e.target.value)}
      >
        {/* La opción vacía NO es un relleno: es la única forma de volver de «vinculado» a «sin
            vincular», que es un estado distinto y que la fila dibuja distinto. */}
        <option value="">— Sin vincular —</option>
        {usuariosCrm.map((u) => (
          <option key={u.id} value={u.id}>
            {u.nombre}
            {u.id === agenteId ? ' · cuenta del agente de IA' : ''}
          </option>
        ))}
      </select>
      {/* EL AVISO DEL AGENTE, cuando está elegido. Medido: en producción los 135 contactos del
          closer que tienen asignado apuntan a esa cuenta, así que vincular a alguien con ella le da
          todos esos leads. No se prohíbe —es lo que el CRM dice— pero nadie debería descubrirlo
          después. */}
      {agenteId && valor === agenteId ? (
        <span className="aj-ayuda ck-sin-vincular">
          Es la cuenta con la que escribe el agente de IA. Todo lo que el CRM le asigne a ella va a
          ser de esta persona.
        </span>
      ) : null}
    </>
  );
}
