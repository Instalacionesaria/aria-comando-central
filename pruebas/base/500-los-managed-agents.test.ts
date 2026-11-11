// LOS MANAGED AGENTS (las migraciones 110 a 114 y el rol `agente_mcp` del arranque 011). Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (decisiones del usuario del 2026-11-10; docs/_privado/modelo-de-datos/27-MANAGED-AGENTS.md;
// y lo que encontraron las dos rondas de verificación adversaria del mismo día)
//
// Los siete agentes corren en GoHighLevel y, durante la prueba, entran por el MCP de Supabase como `postgres`: un rol
// que NO es superusuario, omite la RLS y hereda `agente_mcp`. Las pruebas corren con un rol igual (`mcp_simulado`) para
// que una función que sólo anda como superusuario se vea acá y no en producción.
//
//   · aislamiento: una sesión de otra organización no escribe en la corrida; un contacto de otra cuenta no abre una
//     corrida — mutaciones: sacar el control de la sesión en `_corrida`, sacar el de la cuenta del contacto;
//   · idempotencia: la misma clave devuelve la misma corrida; otra corrida del mismo sujeto reemplaza a la abierta y la
//     reemplazada ya no recibe salidas — mutaciones: sin la búsqueda por clave, sin el reemplazo;
//   · el contrato: una salida inválida no escribe NADA de negocio y cuenta el intento; al quinto, la corrida falla;
//   · la cita: un «detectado» cuya cita no está en su fuente baja a «ambiguo»; una fuente que la corrida no conoce
//     rechaza — mutación: sin el cotejo;
//   · el Triage no toca contactos.cuadrante ni crea clasificaciones (el cuadrante es del CRM);
//   · el lead que llega después: la corrida y el triaje se vinculan al crearse el contacto;
//   · un resultado propuesto NO es una venta hasta que el closer lo confirma; la corrección guarda las diferencias;
//   · el alta del comprador: si vende ARIA, una organización de nivel 2; si vende una agencia, una cuenta de nivel 3;
//   · el Brief se escribe en la cuenta del comprador, y al enviarlo vuelve al lead la respuesta estándar;
//   · la cascada: corregir el ICP aprobado desactualiza la oferta; el ICP aprobado es conocimiento de la cuenta;
//   · no_contactar_desde impide el borrador del seguimiento;
//   · los permisos: las tablas de sólo agregar no se editan ni como agente_mcp, y ninguna función es de PUBLIC.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';

let admin: Client;
let principal: { org: string; cuenta: string; persona: string };
let agencia: { org: string; cuenta: string; persona: string };

before(async () => {
  admin = await conectar('admin');
  const deLaOrg = `select o.id as org, c.id as cuenta, (select u.id from identidad.usuarios u where u.org_id = o.id order by u.id limit 1) as persona
                     from identidad.organizaciones o join identidad.cuentas c on c.org_id = o.id and c.es_por_omision`;
  const p = await unaFila<{ org: string; cuenta: string; persona: string }>(admin, `${deLaOrg} where o.es_principal`);
  const a = await unaFila<{ org: string; cuenta: string; persona: string }>(admin, `${deLaOrg} where o.slug = 'alfa'`);
  assert.ok(p && a && p.persona && a.persona, 'falta el sembrado (una organización con una persona)');
  principal = p;
  agencia = a;
});

after(async () => {
  await cerrarTodo();
  await cerrarClientes();
});

/** Una transacción que siempre se deshace, con la preparación como superusuario y el trabajo como el MCP. */
async function enUnEnsayo(
  preparar: () => Promise<void>,
  comoElMcp: () => Promise<void>,
): Promise<void> {
  await admin.query('begin');
  try {
    await admin.query(`do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'mcp_simulado') then
        create role mcp_simulado nologin nosuperuser bypassrls;
      end if; end $$`);
    await admin.query('grant agente_mcp, pg_read_all_data to mcp_simulado');
    await preparar();
    await admin.query('set local role mcp_simulado');
    await comoElMcp();
  } finally {
    await admin.query('rollback');
  }
}

async function jsonDe(sql: string, params: unknown[] = []): Promise<Record<string, any>> {
  const r = await admin.query<{ r: Record<string, any> }>(sql, params);
  return r.rows[0]!.r;
}

/** Espera que la sentencia falle con ese código, dentro de un savepoint. */
async function fallaCon(codigo: string, sql: string, params: unknown[] = []): Promise<void> {
  await admin.query('savepoint s');
  try {
    await admin.query(sql, params);
    assert.fail(`debió fallar con ${codigo}: ${sql}`);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.message?.startsWith('debió fallar')) throw e;
    assert.equal(err.code, codigo, err.message);
  } finally {
    await admin.query('rollback to savepoint s');
  }
}

async function unLead(cuenta: { org: string; cuenta: string; persona: string }, ghl: string, location: string): Promise<string> {
  await admin.query(`update identidad.cuentas set crm_cuenta_id = $2 where id = $1`, [cuenta.cuenta, location]);
  const c = await unaFila<{ id: string }>(
    admin,
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, fuente, cuadrante)
     values ($1, $2, $3, 'Lead 500', 'meta', 'valida') returning id`,
    [cuenta.org, cuenta.cuenta, ghl],
  );
  await admin.query(
    `insert into negocio.respuestas_del_lead (org_id, cuenta_id, contacto_id, pregunta, origen_clave, valor_texto, proveedor, obtenida_por, observada_el)
     values ($1, $2, $3, 'facturacion_mensual', 'contact.facturacion', 'factura entre 5 y 10 mil dólares al mes', 'ghl', 'formulario', now())`,
    [cuenta.org, cuenta.cuenta, c!.id],
  );
  return c!.id;
}

const TRIAGE_BUENO = {
  prioridad: 2,
  ruta_clase: 'alto_ticket',
  confianza: 'media',
  razones: [
    { campo: 'facturacion_mensual', estado: 'detectado', valor: 'USD 5-10 mil', fuente: 'formulario:facturacion_mensual', cita: 'entre 5 y 10 mil dólares' },
  ],
};

test('aislamiento: otra organización no escribe en la corrida, y un contacto de otra cuenta no abre una', async () => {
  await enUnEnsayo(
    async () => {
      await unLead(principal, 'ghl-500-a', 'loc-500-p');
      await unLead(agencia, 'ghl-500-b', 'loc-500-a');
      // Una segunda subcuenta de la misma organización, con su propia location.
      await admin.query(
        `insert into identidad.cuentas (org_id, nombre, slug, crm_cuenta_id) values ($1, 'Segunda 500', 'segunda-500', 'loc-500-p2')`,
        [principal.org],
      );
    },
    async () => {
      const r = await jsonDe(`select agentes.abrir_corrida('triage', 'loc-500-p', 'ghl-500-a', 'k1') as r`);
      assert.equal(r.ok, true);
      assert.equal(r.org_id, principal.org);
      await admin.query(`select set_config($1, $2, true)`, ['app.org_id', agencia.org]);
      await fallaCon('42501', `select agentes.registrar_triage($1, $2)`, [r.corrida_id, TRIAGE_BUENO]);
      await admin.query(`select set_config($1, '', true)`, ['app.org_id']);
      // El contacto de la agencia con la location de ARIA: no se encuentra (es de otra organización) y la corrida queda
      // sin lead, sin ver nada de él.
      const ajeno = await jsonDe(`select agentes.abrir_corrida('triage', 'loc-500-p', 'ghl-500-b', 'k2') as r`);
      assert.equal(ajeno.contacto_id, null);
      assert.ok((ajeno.faltantes as string[]).includes('contacto_en_la_base'));
      const leido = await jsonDe(`select agentes.leer_triage($1) as r`, [ajeno.corrida_id]);
      assert.equal(leido.lead, null);
      await fallaCon('P0002', `select agentes.abrir_corrida('triage', 'loc-que-no-existe', 'ghl-500-a', 'k3')`);
      // El lead de la cuenta por omisión con la location de OTRA cuenta de la misma organización: 42501.
      await fallaCon('42501', `select agentes.abrir_corrida('triage', 'loc-500-p2', 'ghl-500-a', 'k4')`);
    },
  );
});

test('idempotencia: la misma clave es la misma corrida; otra sobre el mismo sujeto reemplaza a la abierta', async () => {
  await enUnEnsayo(
    async () => {
      await unLead(principal, 'ghl-500-c', 'loc-500-p');
    },
    async () => {
      const a = await jsonDe(`select agentes.abrir_corrida('triage', 'loc-500-p', 'ghl-500-c', 'f1') as r`);
      const b = await jsonDe(`select agentes.abrir_corrida('triage', 'loc-500-p', 'ghl-500-c', 'f1') as r`);
      assert.equal(b.corrida_id, a.corrida_id);
      assert.equal(b.reutilizada, true);
      const c = await jsonDe(`select agentes.abrir_corrida('triage', 'loc-500-p', 'ghl-500-c', 'f2') as r`);
      assert.notEqual(c.corrida_id, a.corrida_id);
      assert.equal(c.motivo, 'datos_nuevos');
      const vieja = await unaFila<{ estado: string; reemplazada_por: string }>(
        admin, `select estado, reemplazada_por from negocio.corridas_de_agente where id = $1`, [a.corrida_id]);
      assert.equal(vieja!.estado, 'reemplazada');
      assert.equal(vieja!.reemplazada_por, c.corrida_id);
      await fallaCon('55000', `select agentes.registrar_triage($1, $2)`, [a.corrida_id, TRIAGE_BUENO]);
    },
  );
});

test('el contrato: lo inválido no escribe nada, cuenta el intento, y al quinto la corrida falla', async () => {
  await enUnEnsayo(
    async () => {
      await unLead(principal, 'ghl-500-d', 'loc-500-p');
    },
    async () => {
      const r = await jsonDe(`select agentes.abrir_corrida('triage', 'loc-500-p', 'ghl-500-d', 'x') as r`);
      const malo = { prioridad: 20, ruta_clase: 'alto_ticket', razones: [] };
      for (let i = 1; i <= 5; i += 1) {
        const s = await jsonDe(`select agentes.registrar_triage($1, $2) as r`, [r.corrida_id, malo]);
        assert.equal(s.ok, false);
        assert.equal(s.intentos, i);
      }
      const t = await unaFila<{ n: string }>(admin, `select count(*) as n from negocio.triajes where corrida_id = $1`, [r.corrida_id]);
      assert.equal(Number(t!.n), 0);
      const c = await unaFila<{ estado: string }>(admin, `select estado from negocio.corridas_de_agente where id = $1`, [r.corrida_id]);
      assert.equal(c!.estado, 'fallida');
    },
  );
});

test('la cita: un detectado sin respaldo baja a ambiguo, y una fuente desconocida rechaza', async () => {
  await enUnEnsayo(
    async () => {
      await unLead(principal, 'ghl-500-e', 'loc-500-p');
    },
    async () => {
      const r = await jsonDe(
        `select agentes.abrir_corrida('triage', 'loc-500-p', 'ghl-500-e', 'x', $1) as r`,
        [{ fuentes: { 'ghl:notas': 'Tengo 4 clientes activos' } }],
      );
      await jsonDe(`select agentes.leer_triage($1) as r`, [r.corrida_id]);
      const desconocida = await jsonDe(`select agentes.registrar_triage($1, $2) as r`, [
        r.corrida_id,
        { ...TRIAGE_BUENO, razones: [{ campo: 'x', estado: 'detectado', valor: '1', fuente: 'web:inventada', cita: 'x' }] },
      ]);
      assert.equal(desconocida.ok, false);
      const s = await jsonDe(`select agentes.registrar_triage($1, $2) as r`, [
        r.corrida_id,
        {
          ...TRIAGE_BUENO,
          razones: [
            ...TRIAGE_BUENO.razones,
            { campo: 'clientes_activos', estado: 'detectado', valor: '40', fuente: 'ghl:notas', cita: 'Tengo 40 clientes' },
          ],
        },
      ]);
      assert.equal(s.ok, true);
      assert.equal(s.degradados, 1);
      const t = await unaFila<{ razones: Array<{ estado: string; degradado?: boolean }> }>(
        admin, `select razones from negocio.triajes where id = $1`, [s.triaje_id]);
      assert.deepEqual(t!.razones.map((x) => x.estado), ['detectado', 'ambiguo']);
    },
  );
});

test('el Triage no toca el cuadrante del CRM, y el lead que llega después se vincula', async () => {
  await enUnEnsayo(
    async () => {
      await unLead(principal, 'ghl-500-f', 'loc-500-p');
    },
    async () => {
      const r = await jsonDe(`select agentes.abrir_corrida('triage', 'loc-500-p', 'ghl-500-f', 'x') as r`);
      await jsonDe(`select agentes.leer_triage($1) as r`, [r.corrida_id]);
      const s = await jsonDe(`select agentes.registrar_triage($1, $2) as r`, [
        r.corrida_id, { ...TRIAGE_BUENO, cuadrante_propuesto: 'prioriza' }]);
      assert.equal(s.ok, true);
      assert.equal(s.difiere_del_crm, true);
      const k = await unaFila<{ cuadrante: string; n: string }>(
        admin,
        `select c.cuadrante, (select count(*) from negocio.clasificaciones x where x.contacto_id = c.id) as n
           from negocio.contactos c where c.ghl_contact_id = 'ghl-500-f'`,
      );
      assert.equal(k!.cuadrante, 'valida');
      const antes = Number(k!.n);
      assert.ok(antes <= 1, 'sólo la del alta del CRM');

      // Un lead que todavía no está en la base: la corrida queda sin contacto y se vincula al llegar.
      const sin = await jsonDe(`select agentes.abrir_corrida('triage', 'loc-500-p', 'ghl-500-tarde', 'y') as r`);
      assert.equal(sin.contacto_id, null);
      assert.ok((sin.faltantes as string[]).includes('contacto_en_la_base'));
      const t = await jsonDe(`select agentes.registrar_triage($1, $2) as r`, [
        sin.corrida_id, { prioridad: 5, ruta_clase: 'nutricion', confianza: 'baja', razones: [{ campo: 'datos', estado: 'no_consta' }] },
      ]);
      // Sin el contacto no hay respuestas que citar: la razón es «no consta».
      assert.equal(t.ok, true);
      await admin.query('reset role');
      await admin.query(
        `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, fuente) values ($1, $2, 'ghl-500-tarde', 'Tarde', 'meta')`,
        [principal.org, principal.cuenta],
      );
      const v = await unaFila<{ corrida: string | null; triaje: string | null }>(
        admin,
        `select (select contacto_id from negocio.corridas_de_agente where id = $1)::text as corrida,
                (select contacto_id from negocio.triajes where corrida_id = $1)::text as triaje`,
        [sin.corrida_id],
      );
      assert.ok(v!.corrida && v!.triaje && v!.corrida === v!.triaje);
    },
  );
});

/** Lleva a un lead de la cuenta dada hasta la venta confirmada; devuelve el cliente. */
async function hastaLaVenta(ghl: string, location: string, closer: string, corregir?: object): Promise<{ cliente: string; resultadosAntes: number; diferencias: object }> {
  const llamada = await jsonDe(
    `select agentes.registrar_llamada($1, $2, $3, 'venta', 'ghl', 'Lead: me preocupa el precio, pero en cuotas lo tomo.') as r`,
    [location, ghl, `grab-${ghl}`],
  );
  const c = await jsonDe(
    `select agentes.abrir_corrida('sales_coach', $1, $2, $3, '{}', 'transcripcion_lista', $4) as r`,
    [location, ghl, `sc-${ghl}`, { llamada_id: llamada.llamada_id }],
  );
  await jsonDe(`select agentes.leer_sales_coach($1) as r`, [c.corrida_id]);
  const s = await jsonDe(`select agentes.registrar_sales_coach($1, $2) as r`, [
    c.corrida_id,
    {
      resultado: {
        compro: true, salida: 'venta', monto: 3000, moneda: 'USD', monto_usd: 3000, ruta_clase: 'alto_ticket', confianza: 'alta',
        next_steps: [{ accion: 'enviar contrato', responsable: 'closer' }],
        evidencia: [{ campo: 'compro', estado: 'detectado', valor: true, fuente: `llamada_venta:${llamada.llamada_id}`, cita: 'en cuotas lo tomo' }],
      },
      objeciones: [{ categoria: 'precio', texto: 'me preocupa el precio', resuelta: true }],
      seguimiento: { canal: 'whatsapp', cuerpo: 'Te mando el contrato' },
    },
  ]);
  assert.equal(s.ok, true, JSON.stringify(s));
  const antes = await unaFila<{ n: string }>(admin, `select count(*) as n from negocio.resultados r join negocio.contactos k on k.id = r.contacto_id where k.ghl_contact_id = $1`, [ghl]);
  const conf = await jsonDe(`select agentes.confirmar_resultado($1, $2, $3, $4) as r`, [s.resultado_propuesto_id, corregir ? 'corregido' : 'confirmado', closer, corregir ?? {}]);
  assert.equal(conf.ok, true);
  return { cliente: conf.cliente_id, resultadosAntes: Number(antes!.n), diferencias: conf.diferencias };
}

test('un resultado propuesto no es una venta; la corrección guarda las diferencias', async () => {
  await enUnEnsayo(
    async () => {
      await unLead(principal, 'ghl-500-g', 'loc-500-p');
    },
    async () => {
      const v = await hastaLaVenta('ghl-500-g', 'loc-500-p', principal.persona, { monto: 2500 });
      assert.equal(v.resultadosAntes, 0);
      assert.deepEqual(Object.keys(v.diferencias), ['monto']);
      const r = await unaFila<{ n: string; monto: string }>(
        admin,
        `select count(*) as n, max(r.monto)::text as monto from negocio.resultados r join negocio.contactos k on k.id = r.contacto_id where k.ghl_contact_id = 'ghl-500-g'`,
      );
      assert.equal(Number(r!.n), 1);
      assert.equal(r!.monto, '2500.00');
      const o = await unaFila<{ texto: string; cita_verificada: boolean }>(
        admin, `select texto, cita_verificada from negocio.objeciones_de_llamada o join negocio.contactos k on k.id = o.contacto_id where k.ghl_contact_id = 'ghl-500-g'`);
      assert.equal(o!.texto, 'me preocupa el precio');
      assert.equal(o!.cita_verificada, true);
    },
  );
});

test('el alta del comprador: de ARIA, una organización de nivel 2; de una agencia, una cuenta de nivel 3', async () => {
  await enUnEnsayo(
    async () => {
      await unLead(principal, 'ghl-500-h', 'loc-500-p');
      await unLead(agencia, 'ghl-500-i', 'loc-500-a');
    },
    async () => {
      for (const [ghl, loc, nivel, persona] of [
        ['ghl-500-h', 'loc-500-p', 2, principal.persona],
        ['ghl-500-i', 'loc-500-a', 3, agencia.persona],
      ] as const) {
        const v = await hastaLaVenta(ghl, loc, persona);
        const p = await jsonDe(`select agentes.registrar_pago($1, $2, 'pasarela', $3, 1000, 'USD') as r`, [loc, ghl, `pago-${ghl}`]);
        assert.equal(p.alta_del_comprador.nivel, nivel);
        const k = await unaFila<{ org: string; cuenta_org: string; es_por_omision: boolean }>(
          admin,
          `select k.organizacion_cliente_id as org, c.org_id as cuenta_org, c.es_por_omision
             from negocio.clientes k join identidad.cuentas c on c.id = k.cuenta_cliente_id where k.id = $1`,
          [v.cliente],
        );
        if (nivel === 2) {
          assert.notEqual(k!.org, principal.org);
          assert.equal(k!.es_por_omision, true);
        } else {
          assert.equal(k!.org, agencia.org);
          assert.equal(k!.es_por_omision, false);
        }
        // Repetir el pago no crea otra cuenta.
        const p2 = await jsonDe(`select agentes.registrar_pago($1, $2, 'pasarela', $3, 1000, 'USD', 'pagado', now() - interval '1 hour') as r`, [loc, ghl, `pago-${ghl}`]);
        assert.equal(p2.alta_del_comprador.creada, false);
        // Y el reintento del aviso no duplica el evento del pago (la clave única de eventos lleva la hora).
        const ev = await unaFila<{ n: string }>(admin, `select count(*) as n from negocio.eventos where tipo = 'pago_recibido' and id_externo = $1`, [`pago:pago-${ghl}`]);
        assert.equal(Number(ev!.n), 1);
      }
    },
  );
});

test('el Brief va a la cuenta del comprador y, al enviarlo, la respuesta estándar vuelve al lead; la cascada del ICP', async () => {
  await enUnEnsayo(
    async () => {
      await unLead(principal, 'ghl-500-j', 'loc-500-p');
    },
    async () => {
      const v = await hastaLaVenta('ghl-500-j', 'loc-500-p', principal.persona);
      await jsonDe(`select agentes.registrar_pago('loc-500-p', 'ghl-500-j', 'pasarela', 'pj', 1000, 'USD') as r`);
      const cli = await unaFila<{ cuenta: string }>(admin, `select cuenta_cliente_id as cuenta from negocio.clientes where id = $1`, [v.cliente]);
      const b = await jsonDe(`select agentes.abrir_corrida('brief', 'loc-500-p', 'ghl-500-j', 'b1') as r`);
      assert.equal(b.cuenta_id, cli!.cuenta);
      await jsonDe(`select agentes.leer_brief($1) as r`, [b.corrida_id]);
      const s = await jsonDe(`select agentes.registrar_brief($1, $2) as r`, [b.corrida_id, {
        a_quien_vende: 'negocios',
        respuestas: [{ pregunta: 'facturacion_mensual', estado: 'detectado', valor: 'USD 5-10 mil', fuente: 'formulario:facturacion_mensual', cita: 'entre 5 y 10 mil' }],
      }]);
      assert.equal(s.prellenadas, 1);
      const e = await jsonDe(`select agentes.responder_brief($1, $2, true, $3) as r`, [cli!.cuenta, JSON.stringify([{ pregunta: 'facturacion_mensual', valor: 'USD 12 mil' }, { pregunta: 'a_quien_vende', valor: 'consumidores' }]), principal.persona]);
      assert.equal(e.enviado, true);
      assert.equal(e.copiadas_al_lead, 1);
      const r = await unaFila<{ valor_texto: string; obtenida_por: string }>(
        admin,
        `select r.valor_texto, r.obtenida_por from negocio.respuestas_del_lead r join negocio.contactos k on k.id = r.contacto_id
          where k.ghl_contact_id = 'ghl-500-j' and r.obtenida_por = 'brief'`,
      );
      assert.equal(r!.valor_texto, 'USD 12 mil');
      const k = await unaFila<{ a_quien_vende: string; estado: string }>(admin, `select a_quien_vende, estado from negocio.clientes where id = $1`, [v.cliente]);
      assert.equal(k!.a_quien_vende, 'consumidores', 'manda lo que respondió el cliente, no lo que propuso el agente');
      assert.equal(k!.estado, 'brief_enviado');

      // Research (sólo la decisión, con su segmento) → ICP → oferta, y la corrección del ICP desactualiza la oferta.
      const seg = await jsonDe(`select agentes.abrir_corrida('research', 'loc-500-p', 'ghl-500-j', 'r1', '{}', null, '{"paso": "mr_segmentos"}') as r`);
      const vs = await jsonDe(`select agentes.registrar_research($1, '{"texto": "# S", "segmentos": [{"nombre": "Clínicas"}]}') as r`, [seg.corrida_id]);
      await jsonDe(`select agentes.decidir_entregable($1, 'aprobada', $2) as r`, [vs.version_id, principal.persona]);
      const dec = await jsonDe(`select agentes.abrir_corrida('research', 'loc-500-p', 'ghl-500-j', 'r5', '{}', null, '{"paso": "mr_decision"}') as r`);
      const vd = await jsonDe(`select agentes.registrar_research($1, '{"texto": "# D", "segmento_elegido": "Clínicas"}') as r`, [dec.corrida_id]);
      await jsonDe(`select agentes.decidir_entregable($1, 'aprobada', $2) as r`, [vd.version_id, principal.persona]);
      const icp = await jsonDe(`select agentes.abrir_corrida('estratega', 'loc-500-p', 'ghl-500-j', 'e1', '{}', null, '{"etapa": "icp"}') as r`);
      const malo = await jsonDe(`select agentes.registrar_estratega($1, '{"texto": "# ICP", "contenido": {"a_quien_si": [{"criterio": "x", "pregunta_estandar": "no_existe"}]}}') as r`, [icp.corrida_id]);
      assert.equal(malo.ok, false);
      const vi = await jsonDe(`select agentes.registrar_estratega($1, '{"texto": "# ICP", "contenido": {"a_quien_si": [{"criterio": "clínicas"}], "a_quien_no": []}}') as r`, [icp.corrida_id]);
      const ap = await jsonDe(`select agentes.decidir_entregable($1, 'aprobada', $2) as r`, [vi.version_id, principal.persona]);
      assert.equal(ap.conocimiento_publicado.tipo, 'icp');
      const of = await jsonDe(`select agentes.abrir_corrida('estratega', 'loc-500-p', 'ghl-500-j', 'e2', '{}', null, '{"etapa": "categoria_y_oferta"}') as r`);
      const vo = await jsonDe(`select agentes.registrar_estratega($1, '{"texto": "# O", "contenido": {"categoria": {"nombre": "a"}, "mecanismo": {"nombre": "b"}, "oferta": {"promesa": "c"}}}') as r`, [of.corrida_id]);
      await jsonDe(`select agentes.decidir_entregable($1, 'aprobada', $2) as r`, [vo.version_id, principal.persona]);
      const pp = await jsonDe(`select agentes.abrir_corrida('estratega', 'loc-500-p', 'ghl-500-j', 'e3', '{}', null, '{"etapa": "precio_y_process_map"}') as r`);
      const vp = await jsonDe(`select agentes.registrar_estratega($1, '{"texto": "# P", "contenido": {"precio": {"monto": 2000, "moneda": "USD"}, "metodo": {"fases": [{"nombre": "Diagnóstico"}]}}}') as r`, [pp.corrida_id]);
      await jsonDe(`select agentes.decidir_entregable($1, 'aprobada', $2) as r`, [vp.version_id, principal.persona]);
      // Un conocimiento «de un entregable» que no es su versión aprobada del mismo tipo no pasa sin persona.
      await fallaCon('22023', `select agentes.cargar_conocimiento($1, 'icp', '{"a_quien_si": []}', '# x', true, null, 'entregable', $2)`, [cli!.cuenta, vo.version_id]);
      const corr = await jsonDe(`select agentes.decidir_entregable($1, 'corregida', $2, 'ajuste', '{"a_quien_si": [{"criterio": "clínicas grandes"}], "a_quien_no": []}') as r`, [vi.version_id, principal.persona]);
      // Transitiva: la oferta consumió el ICP viejo, y el precio consumió la oferta.
      assert.equal(corr.desactualizados, 2);
      const pr = await unaFila<{ estado: string }>(admin, `select estado from negocio.entregables where cuenta_id = $1 and tipo = 'precio_y_process_map'`, [cli!.cuenta]);
      assert.equal(pr!.estado, 'desactualizado');
      // Corregir el Brief con decidir_entregable no se puede: se corrige respondiéndolo.
      const bv = await unaFila<{ id: string }>(admin, `select version_aprobada_id as id from negocio.entregables where cuenta_id = $1 and tipo = 'brief'`, [cli!.cuenta]);
      await fallaCon('22023', `select agentes.decidir_entregable($1, 'corregida', $2, 'x', '{}')`, [bv!.id, principal.persona]);
      // Una versión ya superada no se corrige.
      const vieja = await jsonDe(`select agentes.decidir_entregable($1, 'corregida', $2, 'x', '{"a_quien_si": [{"criterio": "y"}]}') as r`, [vi.version_id, principal.persona]);
      assert.equal(vieja.ok, false);
      // El ICP depende de la decisión del Research, no de los segmentos: sólo la recursión lo alcanza.
      await jsonDe(`select agentes.decidir_entregable($1, 'corregida', $2, 'segmentos', null, '# S2') as r`, [vs.version_id, principal.persona]);
      const ic = await unaFila<{ estado: string }>(admin, `select estado from negocio.entregables where cuenta_id = $1 and tipo = 'icp'`, [cli!.cuenta]);
      assert.equal(ic!.estado, 'desactualizado');
      const o = await unaFila<{ estado: string }>(admin, `select estado from negocio.entregables where cuenta_id = $1 and tipo = 'categoria_y_oferta'`, [cli!.cuenta]);
      assert.equal(o!.estado, 'desactualizado');
      const kv = await unaFila<{ version: number; origen: string }>(admin, `select version, origen from negocio.conocimiento_vigente where cuenta_id = $1 and tipo = 'icp'`, [cli!.cuenta]);
      assert.equal(kv!.version, 2);
      assert.equal(kv!.origen, 'entregable');
    },
  );
});

test('no_contactar_desde impide el borrador del seguimiento', async () => {
  await enUnEnsayo(
    async () => {
      const k = await unLead(principal, 'ghl-500-k', 'loc-500-p');
      await admin.query(`update negocio.contactos set no_contactar_desde = now() where id = $1`, [k]);
    },
    async () => {
      const llamada = await jsonDe(`select agentes.registrar_llamada('loc-500-p', 'ghl-500-k', 'gk', 'venta', 'ghl', 'Lead: no me interesa.') as r`);
      const c = await jsonDe(`select agentes.abrir_corrida('sales_coach', 'loc-500-p', 'ghl-500-k', 'sk', '{}', null, $1) as r`, [{ llamada_id: llamada.llamada_id }]);
      await jsonDe(`select agentes.leer_sales_coach($1) as r`, [c.corrida_id]);
      const s = await jsonDe(`select agentes.registrar_sales_coach($1, $2) as r`, [c.corrida_id, {
        resultado: { compro: false, salida: 'no_interesa', confianza: 'alta', next_steps: [{ accion: 'nada', responsable: 'sistema' }] },
        seguimiento: { canal: 'whatsapp', cuerpo: 'hola' },
      }]);
      assert.equal(s.ok, true);
      assert.equal(s.borrador_id, null);
      assert.equal(s.seguimiento_omitido_por_no_contactar, true);
    },
  );
});

test('los permisos: lo de sólo agregar no se edita, y ninguna función de la puerta es de PUBLIC', async () => {
  const soloAgregar = ['triajes', 'transcripciones', 'objeciones_de_llamada', 'respuestas_del_brief', 'acciones_externas',
    'conocimiento_de_la_cuenta', 'citas_del_mercado', 'dolores_del_segmento', 'decisiones_de_kickoff'];
  // Lo único que se puede cambiar en una tabla de sólo agregar, por rol: el lead que llega después (el disparador lo
  // escribe como el inquilino) y la versión a la que pasan las filas del Research al corregir.
  const editables: Record<string, Record<string, string[]>> = {
    agente_mcp: { dolores_del_segmento: ['version_id'], citas_del_mercado: ['version_id'] },
    app_inquilino: { triajes: ['contacto_id'], dolores_del_segmento: ['version_id'], citas_del_mercado: ['version_id'] },
  };
  for (const t of soloAgregar) {
    for (const rol of ['agente_mcp', 'app_inquilino']) {
      const r = await unaFila<{ del: boolean; columnas: string[] | null }>(
        admin,
        `select has_table_privilege($2, $1, 'delete') as del,
                (select array_agg(a.attname::text order by a.attname) from pg_attribute a
                  where a.attrelid = $1::regclass and a.attnum > 0 and not a.attisdropped
                    and has_column_privilege($2, $1::regclass, a.attname, 'UPDATE')) as columnas`,
        [`negocio.${t}`, rol],
      );
      assert.equal(r!.del, false, `${t}: ${rol} no borra`);
      assert.deepEqual(r!.columnas ?? [], editables[rol]![t] ?? [], `${t}: ${rol} sólo edita lo de la lista blanca`);
    }
  }
  const publicas = await filas<{ f: string }>(
    admin,
    `select p.oid::regprocedure::text as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'agentes' and has_function_privilege('public', p.oid, 'execute')`,
  );
  assert.deepEqual(publicas, []);
  const rol = await unaFila<{ rolcanlogin: boolean; rolbypassrls: boolean; rolsuper: boolean }>(
    admin, `select rolcanlogin, rolbypassrls, rolsuper from pg_roles where rolname = 'agente_mcp'`);
  assert.deepEqual(rol, { rolcanlogin: false, rolbypassrls: false, rolsuper: false });
});

test('el agente no se aprueba solo: confirmar, aprobar un borrador y decidir una versión piden una persona', async () => {
  await enUnEnsayo(
    async () => {
      await unLead(principal, 'ghl-500-l', 'loc-500-p');
    },
    async () => {
      const llamada = await jsonDe(`select agentes.registrar_llamada('loc-500-p', 'ghl-500-l', 'gl', 'venta', 'ghl', 'Lead: lo compro.') as r`);
      const c = await jsonDe(`select agentes.abrir_corrida('sales_coach', 'loc-500-p', 'ghl-500-l', 'sl', '{}', null, $1) as r`, [{ llamada_id: llamada.llamada_id }]);
      await jsonDe(`select agentes.leer_sales_coach($1) as r`, [c.corrida_id]);
      // Un valor mal escrito se rechaza con su error, no revienta.
      const mal = await jsonDe(`select agentes.registrar_sales_coach($1, $2) as r`, [c.corrida_id, {
        resultado: { compro: 'si', salida: 'venta', monto: 'tres mil', confianza: 'alta', next_steps: [{ accion: 'x' }] },
      }]);
      assert.equal(mal.ok, false);
      assert.ok((mal.errores as string[]).some((e) => e.includes('compro')));
      assert.ok((mal.errores as string[]).some((e) => e.includes('monto')));
      const s = await jsonDe(`select agentes.registrar_sales_coach($1, $2) as r`, [c.corrida_id, {
        resultado: { compro: true, salida: 'venta', confianza: 'alta', next_steps: [{ accion: 'x' }] },
        seguimiento: { canal: 'whatsapp', cuerpo: 'hola' },
      }]);
      assert.equal(s.ok, true);
      await fallaCon('22023', `select agentes.confirmar_resultado($1, 'confirmado')`, [s.resultado_propuesto_id]);
      // Una persona de OTRA organización tampoco.
      await fallaCon('22023', `select agentes.confirmar_resultado($1, 'confirmado', $2)`, [s.resultado_propuesto_id, agencia.persona]);
      await fallaCon('22023', `select agentes.decidir_borrador($1, 'aprobado')`, [s.borrador_id]);
      await fallaCon('22023', `select agentes.decidir_borrador($1, 'enviado')`, [s.borrador_id]);
      const ok = await jsonDe(`select agentes.decidir_borrador($1, 'aprobado', $2) as r`, [s.borrador_id, principal.persona]);
      assert.equal(ok.ok, true);
      await fallaCon('55000', `select agentes.decidir_borrador($1, 'aprobado', $2)`, [s.borrador_id, principal.persona]);
      await fallaCon('22023', `select agentes.decidir_borrador($1, 'enviado', $2, 'otro texto')`, [s.borrador_id, principal.persona]);
      const env = await jsonDe(`select agentes.decidir_borrador($1, 'enviado', null, null, 'msg-ghl-1') as r`, [s.borrador_id]);
      assert.equal(env.estado, 'enviado');
      await fallaCon('55000', `select agentes.decidir_borrador($1, 'descartado')`, [s.borrador_id]);
      // El modo sombra, sólo para el Triage.
      await fallaCon('22023', `select agentes.abrir_corrida('sales_coach', 'loc-500-p', 'ghl-500-l', 'sombra-1', '{}', null, $1, null, null, 'sombra')`,
        [{ llamada_id: llamada.llamada_id }]);
      // Cargar conocimiento vigente a mano también pide quién lo aprueba.
      await fallaCon('22023', `select agentes.cargar_conocimiento($1, 'icp', '{"a_quien_si": []}', '# ICP')`, [principal.cuenta]);
    },
  );
});

test('el alta del comprador con su location de GHL, y la versión la decide alguien del cliente o de quien vendió', async () => {
  await enUnEnsayo(
    async () => {
      await unLead(principal, 'ghl-500-m', 'loc-500-p');
    },
    async () => {
      const v = await hastaLaVenta('ghl-500-m', 'loc-500-p', principal.persona, { nombre_del_negocio: 'Clínica Ñandú' });
      // Sin el pago, no hay cuenta del comprador.
      await fallaCon('55000', `select agentes.alta_del_comprador($1)`, [v.cliente]);
      const pago = await jsonDe(`select agentes.registrar_pago('loc-500-p', 'ghl-500-m', 'pasarela', 'pm', 1000, 'USD') as r`);
      assert.equal(pago.alta_del_comprador.creada, true);
      assert.match(pago.alta_del_comprador.slug, /^clinica-nandu-/);
      // La location de GHL del cliente llega después, y se pone.
      const alta = await jsonDe(`select agentes.alta_del_comprador($1, null, 'loc-del-cliente-500') as r`, [v.cliente]);
      assert.equal(alta.creada, false);
      const c = await unaFila<{ crm_cuenta_id: string }>(admin, `select crm_cuenta_id from identidad.cuentas where id = $1`, [alta.cuenta_id]);
      assert.equal(c!.crm_cuenta_id, 'loc-del-cliente-500');
      const b = await jsonDe(`select agentes.abrir_corrida('brief', 'loc-500-p', 'ghl-500-m', 'bm') as r`);
      await jsonDe(`select agentes.leer_brief($1) as r`, [b.corrida_id]);
      const s = await jsonDe(`select agentes.registrar_brief($1, $2) as r`, [b.corrida_id, {
        respuestas: [{ pregunta: 'facturacion_mensual', estado: 'detectado', valor: 'USD 5-10 mil', fuente: 'formulario:facturacion_mensual', cita: 'entre 5 y 10 mil' }],
      }]);
      await fallaCon('22023', `select agentes.decidir_entregable($1, 'aprobada')`, [s.version_id]);
      // Alguien de una organización que no es ni el cliente ni quien le vendió, tampoco.
      await fallaCon('22023', `select agentes.decidir_entregable($1, 'aprobada', $2)`, [s.version_id, agencia.persona]);
      await fallaCon('22023', `select agentes.decidir_entregable($1, 'aprobada', $2)`, [s.version_id, principal.persona]);
      const env = await jsonDe(`select agentes.responder_brief($1, $2, true, $3) as r`, [alta.cuenta_id, JSON.stringify([{ pregunta: 'facturacion_mensual', valor: 'USD 5-10 mil' }]), principal.persona]);
      assert.equal(env.enviado, true);
    },
  );
});

test('el formulario mapeado: una respuesta con la pregunta nula se lee por el mapeo «campo», y lo crudo como campo:', async () => {
  await enUnEnsayo(
    async () => {
      const k = await unLead(principal, 'ghl-500-n', 'loc-500-p');
      // Como las escribe el disparador de contactos: sin pregunta, con el fieldKey del CRM.
      await admin.query(
        `insert into negocio.mapeos_de_cuenta (org_id, cuenta_id, tipo, campo, valor_origen, destino_catalogo, destino_clave)
         values ($1, $2, 'campo', '', 'contact.cuantos_clientes_500', 'preguntas_estandar', 'clientes_activos')`,
        [principal.org, principal.cuenta],
      );
      await admin.query(
        `insert into negocio.respuestas_del_lead (org_id, cuenta_id, contacto_id, pregunta, origen_clave, valor_texto, proveedor, obtenida_por, observada_el)
         values ($1, $2, $3, null, 'contact.cuantos_clientes_500', 'tengo 12 clientes', 'ghl', 'formulario', now()),
                ($1, $2, $3, null, 'contact.color_favorito_500', 'azul', 'ghl', 'formulario', now())`,
        [principal.org, principal.cuenta, k],
      );
    },
    async () => {
      const r = await jsonDe(`select agentes.abrir_corrida('triage', 'loc-500-p', 'ghl-500-n', 'n1') as r`);
      const l = await jsonDe(`select agentes.leer_triage($1) as r`, [r.corrida_id]);
      assert.equal(l.fuentes['formulario:clientes_activos'], 'tengo 12 clientes');
      assert.equal(l.fuentes['formulario:facturacion_mensual'], 'factura entre 5 y 10 mil dólares al mes');
      assert.equal(l.fuentes['campo:contact.color_favorito_500'], 'azul');
      const s = await jsonDe(`select agentes.registrar_triage($1, $2) as r`, [r.corrida_id, { prioridad: 3, ruta_clase: 'alto_ticket', confianza: 'alta',
        razones: [{ campo: 'clientes_activos', estado: 'detectado', valor: '12', fuente: 'formulario:clientes_activos', cita: '12 clientes' }] }]);
      assert.equal(s.degradados, 0);
    },
  );
});

test('el pago que llega antes que la confirmación del closer crea la cuenta al confirmar; un aviso viejo no lo despaga', async () => {
  await enUnEnsayo(
    async () => {
      await unLead(principal, 'ghl-500-o', 'loc-500-p');
    },
    async () => {
      const antes = await jsonDe(`select agentes.registrar_pago('loc-500-p', 'ghl-500-o', 'pasarela', 'po', 1000, 'USD') as r`);
      assert.equal(antes.cliente_id, null);
      const v = await hastaLaVenta('ghl-500-o', 'loc-500-p', principal.persona);
      const k = await unaFila<{ nivel: number; cuenta: string | null; estado: string }>(
        admin, `select nivel, cuenta_cliente_id as cuenta, estado from negocio.clientes where id = $1`, [v.cliente]);
      assert.equal(k!.nivel, 2);
      assert.ok(k!.cuenta);
      const viejo = await jsonDe(`select agentes.registrar_pago('loc-500-p', 'ghl-500-o', 'pasarela', 'po', 1000, 'USD', 'pendiente') as r`);
      assert.equal(viejo.ok, true);
      const p = await unaFila<{ estado: string }>(admin, `select estado from negocio.pagos where id = $1`, [antes.pago_id]);
      assert.equal(p!.estado, 'pagado');
    },
  );
});

test('corregir un paso del Research se lleva sus filas; enviar el Brief pide una persona y algo del cliente; el borrador no salta estados', async () => {
  await enUnEnsayo(
    async () => {
      await unLead(principal, 'ghl-500-q', 'loc-500-p');
    },
    async () => {
      const v = await hastaLaVenta('ghl-500-q', 'loc-500-p', principal.persona);
      await jsonDe(`select agentes.registrar_pago('loc-500-p', 'ghl-500-q', 'pasarela', 'pq', 1000, 'USD') as r`);
      const cli = await unaFila<{ cuenta: string }>(admin, `select cuenta_cliente_id as cuenta from negocio.clientes where id = $1`, [v.cliente]);
      const b = await jsonDe(`select agentes.abrir_corrida('brief', 'loc-500-p', 'ghl-500-q', 'bq') as r`);
      await jsonDe(`select agentes.leer_brief($1) as r`, [b.corrida_id]);
      await jsonDe(`select agentes.registrar_brief($1, $2) as r`, [b.corrida_id, {
        respuestas: [{ pregunta: 'facturacion_mensual', estado: 'detectado', valor: 'USD 5-10 mil', fuente: 'formulario:facturacion_mensual', cita: 'entre 5 y 10 mil' }],
      }]);
      // Sin persona no se envía; con persona pero sin nada del cliente, tampoco.
      await fallaCon('22023', `select agentes.responder_brief($1, '[]', true)`, [cli!.cuenta]);
      const vacio = await jsonDe(`select agentes.responder_brief($1, '[]', true, $2) as r`, [cli!.cuenta, principal.persona]);
      assert.equal(vacio.ok, false);
      const enBlanco = await jsonDe(`select agentes.responder_brief($1, '[{"pregunta": "meta_a_un_ano", "valor": ""}]', true, $2) as r`, [cli!.cuenta, principal.persona]);
      assert.equal(enBlanco.ok, false, 'una respuesta en blanco no es algo respondido');
      // Y un nulo repetido no se vuelve a guardar.
      await jsonDe(`select agentes.responder_brief($1, '[{"pregunta": "meta_a_un_ano", "valor": null}]', false) as r`, [cli!.cuenta]);
      await jsonDe(`select agentes.responder_brief($1, '[{"pregunta": "meta_a_un_ano", "valor": null}]', false) as r`, [cli!.cuenta]);
      const nulas = await unaFila<{ n: string }>(admin, `select count(*) as n from negocio.respuestas_del_brief where cuenta_id = $1 and pregunta = 'meta_a_un_ano'`, [cli!.cuenta]);
      assert.equal(Number(nulas!.n), 1);
      const env = await jsonDe(`select agentes.responder_brief($1, $2, true, $3) as r`, [cli!.cuenta, JSON.stringify([{ pregunta: 'facturacion_mensual', valor: 'USD 5-10 mil' }]), principal.persona]);
      assert.equal(env.enviado, true);
      const otra = await jsonDe(`select agentes.responder_brief($1, '[]', true, $2) as r`, [cli!.cuenta, principal.persona]);
      assert.equal(otra.sin_cambios, true);
      // El formulario reenvía todo, igual: tampoco es otra versión.
      const igual = await jsonDe(`select agentes.responder_brief($1, $2, true, $3) as r`, [cli!.cuenta, JSON.stringify([{ pregunta: 'facturacion_mensual', valor: 'USD 5-10 mil' }]), principal.persona]);
      assert.equal(igual.sin_cambios, true);

      const seg = await jsonDe(`select agentes.abrir_corrida('research', 'loc-500-p', 'ghl-500-q', 'rq', '{}', null, '{"paso": "mr_segmentos"}') as r`);
      const vs = await jsonDe(`select agentes.registrar_research($1, '{"texto": "# S", "segmentos": [{"nombre": "A"}, {"nombre": "B"}]}') as r`, [seg.corrida_id]);
      const corr = await jsonDe(`select agentes.decidir_entregable($1, 'corregida', $2, 'el coach reescribe el texto', null, '# S corregido') as r`, [vs.version_id, principal.persona]);
      const filas2 = await unaFila<{ n: string }>(admin, `select count(*) as n from negocio.segmentos_del_mercado where version_id = $1`, [corr.version_id]);
      assert.equal(Number(filas2!.n), 2);
      const dol = await jsonDe(`select agentes.abrir_corrida('research', 'loc-500-p', 'ghl-500-q', 'rd', '{}', null, '{"paso": "mr_dolores"}') as r`);
      const pub = await jsonDe(`select agentes.registrar_fuente_publica($1, 'foro', 'Siempre llego y me hacen esperar una hora') as r`, [dol.corrida_id]);
      const vdol = await jsonDe(`select agentes.registrar_research($1, $2) as r`, [dol.corrida_id, {
        texto: '# D', dolores: [{ segmento: 'A', descripcion: 'esperas', intensidad: 4, es_critico: true }],
        citas: [{ texto: 'me hacen esperar una hora', fuente: pub.fuente, dolor: 'esperas', segmento: 'A' }],
      }]);
      assert.equal(vdol.citas_verificadas, 1);
      const cdol = await jsonDe(`select agentes.decidir_entregable($1, 'corregida', $2, 'texto', null, '# D corregido') as r`, [vdol.version_id, principal.persona]);
      const movidas = await unaFila<{ d: string; c: string }>(admin,
        `select (select count(*) from negocio.dolores_del_segmento where version_id = $1) as d,
                (select count(*) from negocio.citas_del_mercado where version_id = $1) as c`, [cdol.version_id]);
      assert.deepEqual([Number(movidas!.d), Number(movidas!.c)], [1, 1]);

      // Un paso que no es del Research se rechaza.
      const mal = await jsonDe(`select agentes.abrir_corrida('research', 'loc-500-p', 'ghl-500-q', 'rq2', '{}', null, '{"paso": "icp"}') as r`);
      const m = await jsonDe(`select agentes.registrar_research($1, '{"texto": "x"}') as r`, [mal.corrida_id]);
      assert.equal(m.ok, false);
    },
  );
});
