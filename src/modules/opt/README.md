# OPT de Bucaramanga

El módulo consulta en SQLite los datos del POT de Bucaramanga para orientar el paso de ubicación del diagnóstico. El nombre `opt` identifica el módulo de SINTRABAS. El instrumento municipal se llama Plan de Ordenamiento Territorial o POT.

## Fuentes

- La [consulta municipal de actividad económica](https://consultadesarrolloactividadeconomica.bucaramanga.gov.co/consulta.php) enlaza al [visor POT 2014–2027](https://mbucaramanga.maps.arcgis.com/apps/webappviewer/index.html?id=5c32765bb4d544d1a20182ca13fc16b1). De su [mapa web público](https://mbucaramanga.maps.arcgis.com/home/item.html?id=ad93268eee3e45e3be1c75b95c515c7e) se importan las capas de predios urbanos y rurales, áreas de actividad, tratamientos urbanísticos, barrios y comunas.
- El [catálogo municipal de unidades de uso](https://consultadesarrolloactividadeconomica.bucaramanga.gov.co/php/cargar_unidad.php) se obtiene del recurso público que alimenta el selector del formulario.
- El índice de direcciones incluido en `app/old.html` se conserva como referencia del prototipo. Su cobertura y sus etiquetas pueden diferir de la cartografía actual. La capa pública de nomenclatura del visor contiene placas sueltas y, por sí sola, no permite reconstruir una dirección completa.

## Importación

Desde la raíz del backend, ejecuta `node scripts/import-opt.mjs`. El comando usa `SQLITE_PATH` si está configurado y aplica las migraciones de SQLite. Descarga las capas públicas por páginas y reemplaza los datos de OPT en una única transacción. Las filas oficiales sin geometría o sin etiqueta se omiten. Si el archivo de referencia vive en otra ruta, configura `OPT_REFERENCE_HTML`. Cuando el archivo no existe, sigue disponible la consulta por código predial.

`opt_fuentes` registra la URL, el nombre, el total de la fuente y la fecha de importación. `opt_predios` conserva los identificadores y centroides. `opt_capas` guarda polígonos en WGS 84 con un índice espacial SQLite en `opt_capas_limites`. `opt_unidades` y `opt_direcciones_referencia` habilitan el formulario.

## API

- `GET /api/v1/opt` devuelve el catálogo, el total de registros y las fuentes.
- `POST /api/v1/opt` recibe `{ "query": "Carrera 33 # 47-80", "unitId": "1", "area": 40, "people": 2 }`. La consulta también acepta un código que aparezca en el visor, como `680010102000003380001000000000`. Para buscar coincidencias de una cuadra, ingresa la vía y el cruce.
- Los estados de la consulta son `found`, `ambiguous`, `not_found` y `not_imported`. Los resultados indican si proceden del centroide predial o de la referencia del prototipo. Las dos operaciones requieren una sesión válida.

La ubicación del centroide permite mostrar las capas que coinciden en ese punto. Un predio puede atravesar límites cartográficos. La consulta municipal permite confirmar la ubicación exacta y el uso de la actividad con sus demás condiciones. SINTRABAS no radica la solicitud municipal.
