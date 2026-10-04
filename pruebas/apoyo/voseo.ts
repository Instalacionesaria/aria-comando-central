// Las formas de voseo que ya aparecieron en pantalla, para las pruebas de «un solo tono» (`D-26`: tú neutro).
//
// Una lista y no una regla gramatical: «más», «después» o «país» terminan igual y no son verbos. Nace de la
// lista de la prueba 185 de la rama `feature/icp-oferta-v2` (Fundaciones), a la que se suman las formas que
// tenía Tools hasta AG3 de los agentes; cuando la rama se integre, la 185 puede importarla de acá en vez de
// llevar su copia.

export const VOSEO =
  /(?<!\p{L})(contame|cont[aá]melos|decime|dec[ií]melo|decile|pedile|pasale|mandale|preguntame|preguntale|fijate|segu[ií]|sos|vos|ten[eé]s|pod[eé]s|quer[eé]s|hablás|escribís|escribí|llená|llenás|apretá|apretás|probá|volvé|volvés|recargá|intentá|esperá|acortá|reformulá|completá|completás|cambiá|regenerá|revisás|hacé|bajá|pedí|anotá|preguntá|mirá|tomá|usá|respondé|resumilo|citá|proponé|deducí|dejalos|proponelos|usalos|citalos|espiá|detectá|extraé|marcá|generá|generás|scrapeá|hablá|evitá|elegí|buscá|buscás)(?!\p{L})/iu;
