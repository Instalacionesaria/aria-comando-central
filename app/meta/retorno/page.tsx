'use client';

// `/meta/retorno` — adonde vuelve Meta después de «Conectar con Meta» (Meta directo, M2).
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA PÁGINA NO ESCRIBE NADA: PIDE EL CANJE Y VUELVE
//
// Meta vuelve con un GET y, en la URL, el `code` y el `state` (o un `error` si quien conectaba canceló). Esta página
// los manda a `POST /api/admin/meta/canje` —con la sesión, que viaja en la cookie (`SameSite=Lax` la deja pasar en una
// navegación que viene de facebook.com)—, deja el resultado para Ajustes y navega a la aplicación con `replace`, para
// que el código no quede en el historial del navegador.
//
// Sin sesión (venció mientras se elegían las cuentas) el canje responde 401 y se pide volver a entrar: el código de
// Meta dura pocos minutos y de todas formas no sobreviviría al login.
// ═══════════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { pedir } from '../../../lib/http/cliente.ts';
import { dejarResultadoDeMeta, desdeDondeSeConecto } from '../../../lib/meta/retorno.ts';

/* El canje declara `maxDuration = 90` (tres llamadas a Meta): el navegador espera más, o mostraría un fallo sobre una
   conexión que el servidor está por guardar bien (la regla de `ESPERA_MS` en `lib/http/cliente.ts`). */
const ESPERA_DEL_CANJE_MS = 100_000;

const CANCELADO = 'No se conectó Meta: el diálogo se cerró o se canceló antes de aceptar.';

export default function RetornoDeMeta() {
  const [texto, setTexto] = useState('Conectando con Meta…');

  useEffect(() => {
    const parametros = new URLSearchParams(window.location.search);
    const code = parametros.get('code');
    const state = parametros.get('state');
    const pestana = desdeDondeSeConecto();
    // La URL con el código se reemplaza ya: no queda en el historial aunque algo falle después.
    window.history.replaceState(null, '', '/meta/retorno');

    const volver = (ok: boolean, mensaje: string) => {
      dejarResultadoDeMeta({ ok, texto: mensaje, pestana });
      window.location.replace('/');
    };

    if (!code || !state) {
      volver(false, CANCELADO);
      return;
    }
    void (async () => {
      const r = await pedir<{ cuentasConectadas: number; cuentasRetenidas?: string[] }>('/api/admin/meta/canje', { metodo: 'POST', cuerpo: { code, state }, espera: ESPERA_DEL_CANJE_MS });
      if (r.tipo === 'datos') {
        const n = r.datos.cuentasConectadas;
        const retenidas = r.datos.cuentasRetenidas?.length ?? 0;
        // Una cuenta con campañas o gasto ya leídos en otro cliente no se mueve: se dice, para que nadie la espere acá.
        const nota =
          retenidas === 0
            ? ''
            : ` ${retenidas === 1 ? 'Una cuenta ya tenía' : `${retenidas} cuentas ya tenían`} campañas o gasto leídos en otro cliente y ${retenidas === 1 ? 'quedó' : 'quedaron'} en ese cliente.`;
        volver(
          true,
          n === 0
            ? 'Meta quedó conectado, pero no se eligió ninguna cuenta publicitaria. Vuelve a conectar y marca tus cuentas.'
            : `Meta quedó conectado con ${n} cuenta${n === 1 ? '' : 's'} publicitaria${n === 1 ? '' : 's'}.${nota}`,
        );
        return;
      }
      if (r.tipo === 'rechazado' && r.estado === 401) {
        setTexto('Tu sesión venció mientras conectabas Meta. Vuelve a entrar y conecta de nuevo.');
        return;
      }
      volver(false, r.tipo === 'rechazado' && r.detalle ? r.detalle : 'No se pudo conectar Meta. Prueba de nuevo en unos minutos.');
    })();
  }, []);

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#0b0d10', color: '#e8eaed' }}>
      <p role="status" style={{ fontSize: 15 }}>
        {texto}
      </p>
    </main>
  );
}
