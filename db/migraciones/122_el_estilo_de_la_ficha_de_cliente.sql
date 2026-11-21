-- 122 · La ficha de cliente del Brief lleva su propio estilo, simple, desde la base.
--
-- La ficha de cliente la lee el CLIENTE y se convierte en PDF (n8n), así que su estilo es simple a propósito: una
-- columna, tablas, letra del sistema, sin degradados ni íconos (decisión del usuario del 2026-11-20). Igual que las
-- fichas 1 y 2 (120 y 121), el Brief manda sólo el contenido y guardar_respuesta guarda el documento entero en
-- negocio.respuestas_de_los_agentes.brief_ficha_de_cliente_1. No incluye otra ficha: la ficha 2 es interna (tiene la
-- evaluación del closer y las objeciones) y el cliente no la ve.

update catalogo.salidas_de_los_agentes
   set envoltura = $env$<!DOCTYPE html>
<html lang="es"><head>
<title>Tu ficha de cliente · ARIA IA Accelerator</title>
<style>
@page { size: A4; margin: 16mm 14mm; }
* { box-sizing: border-box; }
body { margin: 0; background: #FFFFFF; color: #1A1F29; font-family: Arial, Helvetica, sans-serif; font-size: 12.5px; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.hoja { max-width: 780px; margin: 0 auto; padding: 24px 20px 32px; }
.top { border-bottom: 2px solid #0B6F93; padding-bottom: 10px; margin-bottom: 18px; overflow: hidden; }
.marca { float: left; font-size: 13px; font-weight: bold; color: #0B6F93; }
.marca small { font-weight: normal; color: #5B6576; }
.fecha { float: right; font-size: 11px; color: #5B6576; }
h1 { margin: 0 0 2px; font-size: 24px; line-height: 1.2; }
.sub { margin: 0 0 16px; font-size: 14px; color: #3D4654; }
h2 { margin: 0 0 10px; font-size: 15px; color: #04060A; }
.caja { border: 1px solid #DDE3EA; border-radius: 8px; padding: 14px 16px; margin: 0 0 14px; page-break-inside: avoid; break-inside: avoid; }
.destacada { border: 2px solid #0B6F93; background: #F2F8FB; }
.destacada p { margin: 0 0 8px; }
.enlace { font-size: 14px; font-weight: bold; }
.enlace a { color: #0B6F93; }
.cifras { width: 100%; border-collapse: collapse; margin: 0 0 14px; }
.cifras td { width: 33%; border: 1px solid #DDE3EA; padding: 10px 12px; vertical-align: top; }
.cifras b { display: block; font-size: 18px; color: #04060A; }
.cifras span { font-size: 11px; color: #5B6576; }
ul, ol { margin: 0; padding-left: 20px; }
li { margin: 0 0 5px; }
.seccion { margin: 18px 0 0; }
.seccion h2 { border-bottom: 1px solid #DDE3EA; padding-bottom: 6px; }
.n { display: inline-block; width: 22px; height: 22px; line-height: 22px; text-align: center; border-radius: 11px; background: #0B6F93; color: #FFFFFF; font-size: 12px; margin-right: 8px; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; vertical-align: top; padding: 7px 8px; border-bottom: 1px solid #EEF1F5; }
th { width: 40%; font-weight: normal; color: #3D4654; }
tr { page-break-inside: avoid; break-inside: avoid; }
.de { display: block; font-size: 10.5px; color: #7F8A9B; margin-top: 2px; }
.falta { color: #8A6A12; font-style: italic; }
.pie { margin-top: 24px; padding-top: 10px; border-top: 1px solid #DDE3EA; font-size: 10.5px; color: #7F8A9B; }
</style></head><body>$env$,
       descripcion = 'La ficha de cliente: lo que ARIA ya sabe del negocio, ordenado por las 5 secciones del Brief, para que el cliente rellene el formulario del Brief (con su enlace). La lee el cliente y se pasa a PDF. HTML entero; el agente manda sólo el contenido y la base le pone el estilo (122).'
 where clave = 'brief_ficha_de_cliente_1';
