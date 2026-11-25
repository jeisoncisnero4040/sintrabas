export const potSource = Object.freeze({
  name: 'Alcaldía de Bucaramanga · POT en línea',
  url: 'https://mbucaramanga.maps.arcgis.com/apps/webappviewer/index.html?id=5c32765bb4d544d1a20182ca13fc16b1',
  consultUrl: 'https://consultadesarrolloactividadeconomica.bucaramanga.gov.co/consulta.php',
  webMapUrl: 'https://mbucaramanga.maps.arcgis.com/home/item.html?id=ad93268eee3e45e3be1c75b95c515c7e',
});

const serviceRoot = 'https://services6.arcgis.com/KmKGWMjOsgTLFBpe/arcgis/rest/services';

function layer(id, name, service, fields, label) {
  return { id, name, url: serviceRoot + '/' + service + '/FeatureServer/0', fields, label };
}

export const potParcels = [
  layer('predios_urbanos', 'Terreno predial urbano del visor municipal', 'U_TERRENO_PREDIO_2020', 'FID,codigo,codigo_ant'),
  layer('predios_rurales', 'Terreno predial rural del visor municipal', 'R_TERRENO_PREDIO_2020', 'FID,codigo,codigo_ant'),
  layer('predios_urbanos_2012', 'Terreno predial urbano histórico del visor municipal', 'Terreno_predio_Urbano_2012', 'FID,codigo'),
];

export const potLayers = [
  layer('areas', 'Áreas de actividad', 'Areas_de_Actividad', 'FID,Layer,OTROS', 'Layer'),
  layer('tratamientos', 'Tratamientos urbanísticos', 'Tratamientos_Urbanisticos', 'FID,Layer', 'Layer'),
  layer('barrios', 'Barrios', 'Barrios', 'FID,NOMBRE', 'NOMBRE'),
  layer('comunas', 'Comunas', 'Comunas', 'FID,NOMBRE_COM', 'NOMBRE_COM'),
];

export const unitsSource = {
  id: 'unidades', name: 'Unidades de uso del formulario municipal',
  url: 'https://consultadesarrolloactividadeconomica.bucaramanga.gov.co/php/cargar_unidad.php',
};

export const referenceSource = {
  id: 'referencia_old', name: 'Índice de direcciones del prototipo a partir del visor POT',
  url: potSource.url,
};
