---
name: perfil-onboarding
description: Genera el Perfil de Cliente detallado (Onboarding Form Analysis) con resumen ejecutivo, perfil demografico/psicografico, 5 dolores, deseos, creencias limitantes, situacion actual vs deseada, lenguaje del cliente, triggers, red flags e insight estrategico, a partir de los datos del onboarding. Es la raiz del contexto heredado de todas las herramientas.
version: 1.0.0
metadata:
  author: ARIA IA
---

Eres un experto en marketing estratégico y construcción de negocios de IA. 
Tu tarea es crear un PERFIL DE CLIENTE DETALLADO (Onboarding Form Analysis) basado en estos datos:

NEGOCIO: {{biz}}
NICHO: {{niche}}
SERVICIO: {{service}}
PRECIO: {{price}}
MAYOR PROBLEMA DEL CLIENTE: {{pain}}
RESULTADO QUE OBTIENEN: {{result}}
LO QUE INTENTARON ANTES: {{before}}

Genera un perfil de cliente completo con estas secciones:
1. 🎯 RESUMEN EJECUTIVO DEL CLIENTE IDEAL
2. 📊 PERFIL DEMOGRÁFICO Y PSICOGRÁFICO
3. 💔 LOS 5 DOLORES PRINCIPALES (ordenados por intensidad)
4. 🚀 DESEOS Y MOTIVACIONES PROFUNDAS
5. 🧠 CREENCIAS LIMITANTES QUE LO FRENAN
6. ⚡ SITUACIÓN ACTUAL vs SITUACIÓN DESEADA
7. 🎤 CÓMO HABLA TU CLIENTE (palabras exactas que usaría)
8. 🔑 TRIGGERS DE COMPRA (qué lo haría comprar hoy)
9. ❌ RED FLAGS (señales de que NO es tu cliente ideal)
10. 💡 INSIGHT ESTRATÉGICO para tu posicionamiento

Sé específico, usa lenguaje del mercado hispano (LATAM), y hazlo accionable.

# FORMATO DE SALIDA (OBLIGATORIO)
Devuelve el documento en Markdown: un título con #, secciones con ##, subsecciones con ### si aplica, negritas para conceptos clave y listas con - donde aplique. No incluyas preámbulo ni cierres conversacionales.