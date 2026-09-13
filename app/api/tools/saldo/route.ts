// GET /api/tools/saldo — el saldo de leads de la organización, desglosado.
//
// Kevin, como Allpa (2026-09-13): la empresa no tenía dónde ver cuántos leads le quedaban ni cuántos
// le regalamos. Esta ruta lee el monedero DENTRO de `conOrganizacion(`: la política de RLS deja como
// mucho la fila propia, así que no lleva `where` —igual que Monitoreo en `lib/monitoreo/consumo.ts`,
// y por la misma razón: que el filtro visible no tape cuál es la protección real.
//
// Devuelve `saldo: null` cuando la organización todavía no abrió su monedero. Eso pasa hasta el
// primer scraping (el backend lo abre solo), y no es un error: la franja lo dice como «todavía no
// usaste leads».

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok } from '../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion, datos } from '../../../../lib/datos/contexto.ts';
import { desglosarSaldo } from '../../../../lib/tools/saldo.ts';

export const PANTALLA = 'tools';

export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['tools.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  const monedero = await conOrganizacion(contexto.orgEfectiva, async () =>
    datos()
      .selectFrom('public.aria_cc_scraper_monedero')
      .select([
        'numero_leads_scrapeados',
        'leads_base_gratuitos',
        'leads_adicionales_pagados',
        'leads_disponibles_en_total',
        'leads_regalados',
        'sin_limite',
      ])
      .executeTakeFirst(),
  );

  return ok({
    saldo: monedero
      ? desglosarSaldo({
          numero_leads_scrapeados: Number(monedero.numero_leads_scrapeados),
          leads_base_gratuitos: Number(monedero.leads_base_gratuitos),
          leads_adicionales_pagados: Number(monedero.leads_adicionales_pagados),
          leads_disponibles_en_total: Number(monedero.leads_disponibles_en_total),
          leads_regalados: Number(monedero.leads_regalados),
          sin_limite: Boolean(monedero.sin_limite),
        })
      : null,
  });
}
